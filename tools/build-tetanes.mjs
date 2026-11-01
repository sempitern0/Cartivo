// Builds cores/tetanes to WebAssembly and records exactly what was built.
// Run in CI (GitHub Actions); requires the toolchain from rust-toolchain.toml.
//   node tools/build-tetanes.mjs           build + write dist/, manifest, sbom
//   node tools/build-tetanes.mjs --verify  build into a temp dir and compare
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const crate = join(root, "cores/tetanes");
const verify = process.argv.includes("--verify");
const run = (cmd, args, opts = {}) =>
  execFileSync(cmd, args, { cwd: crate, encoding: "utf8", ...opts }).trim();
const sha256 = (file) =>
  createHash("sha256").update(readFileSync(file)).digest("hex");

const lock = readFileSync(join(crate, "Cargo.lock"), "utf8");
const locked = (name) =>
  lock.match(
    new RegExp(`name = "${name}"\\nversion = "([^"]+)"`),
  )?.[1];
const bindgen = locked("wasm-bindgen");
const tetanes = locked("tetanes-core");
if (!bindgen || !tetanes) throw Error("Cargo.lock sin wasm-bindgen o tetanes-core");

// Deterministic paths in the binary, independent of the runner layout.
const home = process.env.CARGO_HOME ?? join(process.env.HOME ?? "", ".cargo");
process.env.RUSTFLAGS = [
  '--cfg=getrandom_backend="wasm_js"',
  `--remap-path-prefix=${home}=/cargo`,
  `--remap-path-prefix=${crate}=/cartivo-tetanes`,
].join(" ");
process.env.SOURCE_DATE_EPOCH = "0";

const installed = (() => {
  try {
    return run("wasm-bindgen", ["--version"]).split(" ")[1];
  } catch {
    return "";
  }
})();
if (installed !== bindgen)
  // Installed with the runner's default toolchain (repo root), not the
  // pinned one: the CLI is a build tool and not part of the shipped binary.
  run("cargo", ["install", "wasm-bindgen-cli", "--version", bindgen, "--locked"], {
    stdio: "inherit",
    cwd: root,
  });

run(
  "cargo",
  ["build", "--release", "--locked", "--target", "wasm32-unknown-unknown"],
  { stdio: "inherit" },
);
const out = verify ? mkdtempSync(join(tmpdir(), "tetanes-")) : join(crate, "dist");
if (!verify) rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
run("wasm-bindgen", [
  "--target",
  "web",
  "--out-dir",
  out,
  "--out-name",
  "tetanes",
  "target/wasm32-unknown-unknown/release/cartivo_tetanes.wasm",
]);
const files = readdirSync(out)
  .sort()
  .map((name) => ({ path: `dist/${name}`, sha256: sha256(join(out, name)) }));

if (verify) {
  const manifest = JSON.parse(readFileSync(join(crate, "manifest.json"), "utf8"));
  const expected = JSON.stringify(manifest.files);
  const actual = JSON.stringify(files);
  if (expected !== actual) {
    console.error("Build no reproducible.\nVersionado:", expected, "\nNuevo:", actual);
    process.exit(1);
  }
  console.log("Build reproducible:", files.map((f) => f.sha256.slice(0, 12)).join(" "));
  process.exit(0);
}

const metadata = JSON.parse(
  run("cargo", [
    "metadata",
    "--format-version",
    "1",
    "--locked",
    "--filter-platform",
    "wasm32-unknown-unknown",
  ], { maxBuffer: 64 * 1024 * 1024 }),
);
const used = new Set(metadata.resolve.nodes.map((n) => n.id));
const sbom = metadata.packages
  .filter((p) => used.has(p.id) && p.name !== "cartivo-tetanes")
  .map((p) => ({
    name: p.name,
    version: p.version,
    license: p.license,
    repository: p.repository,
  }))
  .sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version));
writeFileSync(join(crate, "sbom.json"), JSON.stringify(sbom, null, 2) + "\n");

const manifest = {
  id: "tetanes-nes-wasm",
  engine: "WebAssembly",
  upstream: {
    crate: "tetanes-core",
    version: tetanes,
    repository: "https://github.com/lukexor/tetanes",
    spdx: "MIT OR Apache-2.0",
  },
  toolchain: {
    rustc: run("rustc", ["-V"]),
    cargo: run("cargo", ["-V"]),
    wasmBindgen: bindgen,
    target: "wasm32-unknown-unknown",
  },
  acceptedMappers: [0, 1, 2, 3, 4],
  biosRequired: false,
  patchedFiles: [],
  dependencies: sbom.length,
  files,
};
writeFileSync(join(crate, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log(`TetaNES ${tetanes} → ${files.map((f) => `${f.path} ${f.sha256.slice(0, 12)}`).join(", ")}`);
if (!existsSync(join(crate, "dist/tetanes_bg.wasm"))) process.exit(1);
