// Builds cores/play (PlayStation 2) to an Emscripten module: play.js (ES
// module loader, also the pthread worker) + play.wasm. Run in CI only, on
// explicit request (.github/workflows/core-play.yml). Needs the emcc pinned
// in cores/play/toolchain.json, plus cmake and make (or ninja).
//
// Unlike the standalone-WASM cores (NES–PS1), Play! needs pthreads (VM
// thread) and WebGL2 (GS hardware renderer), so the output keeps Emscripten's
// JS glue and the host needs cross-origin isolation (COOP/COEP) for
// SharedArrayBuffer. The recipe is CMake, not a source list: Play! and its
// submodules have hundreds of sources and per-platform options that its own
// CMake files already encode. cores/play/CMakeLists.txt links upstream's
// static libraries with the libretro frontend and the Cartivo bridge.
//
//   node tools/build-play.mjs           build → dist/, manifest.json, sbom.json
//   node tools/build-play.mjs --verify  rebuild and compare with the manifest
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { availableParallelism, tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const core = join(root, "cores/play");
const work = join(core, "build");
const verify = process.argv.includes("--verify");
const pins = JSON.parse(readFileSync(join(core, "toolchain.json"), "utf8"));
const run = (cmd, args, opts = {}) =>
  (execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"], ...opts }) ?? "").trim();
const sha256 = (file) => createHash("sha256").update(readFileSync(file)).digest("hex");

const emcc = run("emcc", ["--version"]).split("\n")[0];
if (!emcc.includes(` ${pins.emsdk.version} `)) throw Error(`emcc ${pins.emsdk.version} requerido; encontrado: ${emcc}`);

// --- Play! at the pinned commit, with the submodules the WASM build uses ----
mkdirSync(work, { recursive: true });
const play = join(work, "play");
const { repository, commit } = pins.play;
if (!existsSync(join(play, ".git"))) {
  run("git", ["init", "-q", play]);
  run("git", ["-C", play, "fetch", "-q", "--depth", "1", repository, commit], { stdio: "inherit" });
  run("git", ["-C", play, "-c", "advice.detachedHead=false", "checkout", "-q", "FETCH_HEAD"]);
}
const head = run("git", ["-C", play, "rev-parse", "HEAD"]);
if (head !== commit) throw Error(`Play!: ${head} no es el commit fijado ${commit}`);

// Each submodule is checked out at the SHA recorded by its superproject, so
// the pinned Play! commit fixes the whole tree. AltKit (iOS) and
// SDWebImage (iOS) are not part of the WASM build.
const submodule = (repo, path) => {
  run("git", ["-C", repo, "submodule", "update", "--init", "--depth", "1", path], { stdio: "inherit" });
  return run("git", ["-C", repo, "rev-parse", `HEAD:${path}`]);
};
const sub = Object.fromEntries(
  ["deps/Dependencies", "deps/Framework", "deps/CodeGen", "deps/Nuanceur", "deps/libchdr"].map((p) => [p, submodule(play, p)]),
);
const dependencies = join(play, "deps/Dependencies");
for (const p of ["ghc_filesystem", "zstd", "xxHash", "zlib"]) sub[`deps/Dependencies/${p}`] = submodule(dependencies, p);

// --- Configure and build ---------------------------------------------------
const cmakeBuild = join(work, "cmake");
rmSync(cmakeBuild, { recursive: true, force: true }); // no stale cache across pins
run(
  "emcmake",
  [
    "cmake",
    "-S",
    core,
    "-B",
    cmakeBuild,
    `-DPLAY_UPSTREAM=${play}`,
    `-DPLAY_VERSION=${commit.slice(0, 7)}`,
    "-DCMAKE_BUILD_TYPE=Release",
    "-DENABLE_AMAZON_S3=OFF",
  ],
  { stdio: "inherit" },
);
// -k (keep going): one CI run reports every compile error, not just the first.
run("cmake", ["--build", cmakeBuild, "--target", "play", "--parallel", String(availableParallelism()), "--", "-k"], {
  stdio: "inherit",
});

// --- Artifacts -------------------------------------------------------------
// Since Emscripten 3.1.58 there is no play.worker.js: play.js is the worker.
const out = verify ? mkdtempSync(join(tmpdir(), "play-")) : join(core, "dist");
if (!verify) rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
const files = ["play.js", "play.wasm"].map((name) => {
  const built = join(cmakeBuild, name);
  if (!existsSync(built)) throw Error(`Falta el artefacto ${built}`);
  copyFileSync(built, join(out, name));
  return { path: `dist/${name}`, sha256: sha256(join(out, name)) };
});

// The exports are declared once, in CMakeLists.txt; check that the loader
// really exposes each of them.
const cmake = readFileSync(join(core, "CMakeLists.txt"), "utf8");
const declared = /-sEXPORTED_FUNCTIONS=\[([^\]]+)\]/.exec(cmake.replace(/\\\n/g, ""));
if (!declared) throw Error("EXPORTED_FUNCTIONS no encontrado en CMakeLists.txt");
const exports = [...declared[1].matchAll(/'_(\w+)'/g)].map((m) => m[1]);
const loader = readFileSync(join(out, "play.js"), "utf8");
const missing = exports.filter((name) => !loader.includes(`_${name}`));
if (missing.length) throw Error(`play.js no expone: ${missing.join(", ")}`);

if (verify) {
  const manifest = JSON.parse(readFileSync(join(core, "manifest.json"), "utf8"));
  rmSync(out, { recursive: true, force: true });
  if (JSON.stringify(manifest.files) !== JSON.stringify(files)) {
    console.error("Build no reproducible.\nVersionado:", manifest.files, "\nNuevo:", files);
    process.exit(1);
  }
  console.log("Build reproducible:", files.map((f) => f.sha256.slice(0, 12)).join(" "));
  process.exit(0);
}

// --- SBOM: components compiled into play.wasm (CMake graph for TARGET_PLATFORM_JS)
const deps = (path) => ({ version: sub["deps/Dependencies"], repository: "https://github.com/jpd002/Play-Dependencies", path });
const emscripten = { version: pins.emsdk.version, repository: "https://github.com/emscripten-core/emscripten" };
const sbom = [
  { name: "Play! (PS2 VM: EE, IOP HLE, GS, SPU; ui_libretro, ui_shared)", license: "BSD-2-Clause", version: commit, repository },
  { name: "Play--Framework", license: "BSD-2-Clause", version: sub["deps/Framework"], repository: "https://github.com/jpd002/Play--Framework" },
  { name: "Play--CodeGen (JIT, CodeGen_Wasm)", license: "BSD-2-Clause", version: sub["deps/CodeGen"], repository: "https://github.com/jpd002/Play--CodeGen" },
  { name: "Nuanceur (shaders)", license: "BSD-2-Clause", version: sub["deps/Nuanceur"], repository: "https://github.com/jpd002/Nuanceur" },
  { name: "libchdr (with bundled zlib 1.3.1, zstd 1.5.6, LZMA SDK 24.05)", license: "BSD-3-Clause AND Zlib AND LicenseRef-public-domain", version: sub["deps/libchdr"], repository: "https://github.com/jpd002/libchdr" },
  { name: "bzip2 1.0.6", license: "bzip2-1.0.6", ...deps("bzip2-1.0.6") },
  { name: "sqlite 3.20.1 (FrameworkSqlite)", license: "LicenseRef-public-domain", ...deps("sqlite-3.20.1") },
  { name: "nlohmann/json", license: "MIT", ...deps("nlohmann_json") },
  { name: "ghc::filesystem", license: "MIT", version: sub["deps/Dependencies/ghc_filesystem"], repository: "https://github.com/gulrak/filesystem" },
  { name: "Zstandard (zstd_zlibwrapper)", license: "BSD-3-Clause", version: sub["deps/Dependencies/zstd"], repository: "https://github.com/facebook/zstd" },
  { name: "xxHash", license: "BSD-2-Clause", version: sub["deps/Dependencies/xxHash"], repository: "https://github.com/Cyan4973/xxHash" },
  { name: "zlib", license: "Zlib", version: sub["deps/Dependencies/zlib"], repository: "https://github.com/madler/zlib" },
  { name: "libretro API header (Source/ui_libretro/ext/libretro.h)", license: "MIT", version: commit, repository },
  { name: "Emscripten system libraries and JS runtime", license: "MIT OR NCSA", ...emscripten },
  { name: "musl libc (Emscripten)", license: "MIT", ...emscripten },
  { name: "libc++ / libc++abi / compiler-rt (Emscripten)", license: "Apache-2.0 WITH LLVM-exception", ...emscripten },
];
writeFileSync(join(core, "sbom.json"), JSON.stringify(sbom, null, 2) + "\n");

const manifest = {
  id: "play-ps2-wasm",
  engine: "WebAssembly (Emscripten module: pthreads + WebGL2)",
  upstream: { name: "Play!", ...pins.play },
  submodules: sub,
  toolchain: { emcc, emsdk: `${pins.emsdk.version} (${pins.emsdk.commit})` },
  platforms: ["PlayStation 2"],
  biosRequired: false,
  bios: "None: Play!'s HLE (IopBios, EE kernel) replaces Sony's BIOS; games that need unimplemented IOP modules may not boot.",
  host: {
    crossOriginIsolated: true,
    canvas: "#cartivo-canvas (OffscreenCanvas in specialHTMLTargets)",
    filesystem: "WORKERFS (disc mounted by path)",
  },
  frame: { width: 640, height: 448 },
  saveRam: false,
  exports: exports.filter((name) => name.startsWith("cartivo_") || name === "malloc" || name === "free"),
  files,
};
writeFileSync(join(core, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log(`Play! ${commit.slice(0, 7)} → ${files.map((f) => `${f.path} ${f.sha256.slice(0, 12)}`).join(", ")}`);
