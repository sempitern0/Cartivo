// Builds cores/mgba (Game Boy Advance only) to standalone WebAssembly and
// records what was built. Run in CI only, on explicit request
// (.github/workflows/core-mgba.yml). Needs emcc from cores/mgba/toolchain.json.
// cores/mgba/sources.txt lists the files of mGBA's libretro target (CMake,
// GBA only, no dependencies) minus its frontend and OpenGL renderer.
//   node tools/build-mgba.mjs           build + write dist/, manifest, sbom
//   node tools/build-mgba.mjs --verify  build into a temp dir and compare
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const core = join(root, "cores/mgba");
const work = join(core, "build");
const verify = process.argv.includes("--verify");
const pins = JSON.parse(readFileSync(join(core, "toolchain.json"), "utf8"));
const run = (cmd, args, opts = {}) =>
  (execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"], ...opts }) ?? "").trim();
const sha256 = (file) =>
  createHash("sha256").update(readFileSync(file)).digest("hex");

const emcc = run("emcc", ["--version"]).split("\n")[0];
if (!emcc.includes(` ${pins.emsdk.version} `))
  throw Error(`emcc ${pins.emsdk.version} requerido; encontrado: ${emcc}`);

mkdirSync(work, { recursive: true });
const mgba = join(work, "mgba");
const { repository, tag, commit } = pins.mgba;
if (!existsSync(join(mgba, ".git")))
  run("git", ["-c", "advice.detachedHead=false", "clone", "--depth", "1", "--branch", tag, repository, mgba], { stdio: "inherit" });
const head = run("git", ["-C", mgba, "rev-parse", "HEAD"]);
if (head !== commit) throw Error(`mGBA: ${head} no es el commit fijado ${commit}`);

// What CMake would generate: build flags and version strings.
const gen = join(work, "gen");
mkdirSync(join(gen, "mgba"), { recursive: true });
writeFileSync(
  join(gen, "mgba/flags.h"),
  "#ifndef FLAGS_H\n#define FLAGS_H\n#ifndef M_CORE_GBA\n#define M_CORE_GBA\n#endif\n#ifndef DISABLE_THREADING\n#define DISABLE_THREADING\n#endif\n#ifndef MINIMAL_CORE\n#define MINIMAL_CORE 2\n#endif\n#endif\n",
);
writeFileSync(
  join(gen, "version.c"),
  [
    "#include <mgba/core/version.h>",
    `MGBA_EXPORT const char* const gitCommit = "${commit}";`,
    `MGBA_EXPORT const char* const gitCommitShort = "${commit.slice(0, 7)}";`,
    `MGBA_EXPORT const char* const gitBranch = "${tag}";`,
    "MGBA_EXPORT const int gitRevision = 1;",
    'MGBA_EXPORT const char* const binaryName = "mgba";',
    'MGBA_EXPORT const char* const projectName = "mGBA";',
    `MGBA_EXPORT const char* const projectVersion = "${tag}";`,
    "",
  ].join("\n"),
);

const sources = readFileSync(join(core, "sources.txt"), "utf8").split("\n").filter(Boolean);
const flags = [
  "-std=c11", "-O3",
  "-DDISABLE_THREADING", "-DMGBA_STANDALONE", "-DMINIMAL_CORE=2", "-DM_CORE_GBA",
  "-DHAVE_STRDUP", "-DHAVE_STRNDUP", "-DHAVE_VASPRINTF", "-DHAVE_LOCALTIME_R",
  "-DHAVE_LOCALE", "-DHAVE_NEWLOCALE", "-DHAVE_USELOCALE", "-DHAVE_FREELOCALE", "-DHAVE_SETLOCALE",
  "-D_GNU_SOURCE", "-DNDEBUG",
  `-I${gen}`, `-I${join(mgba, "src")}`, `-I${join(mgba, "include")}`,
  // Deterministic paths in the binary, independent of the runner layout.
  `-ffile-prefix-map=${mgba}=/mgba`, `-ffile-prefix-map=${root}=/cartivo`,
];
const objects = join(work, "obj");
rmSync(objects, { recursive: true, force: true });
mkdirSync(objects, { recursive: true });
const built = [];
for (const [i, source] of [...sources.map((s) => join(mgba, s)), join(gen, "version.c")].entries()) {
  const object = join(objects, `${String(i).padStart(3, "0")}.o`);
  run("emcc", [...flags, "-w", "-c", source, "-o", object], { stdio: "inherit" });
  built.push(object);
}
run("emcc", [...flags, "-Wall", "-Wextra", "-c", join(core, "src/cartivo.c"), "-o", join(objects, "cartivo.o")], { stdio: "inherit" });

const exports = [
  "malloc", "free", "cartivo_create", "cartivo_free", "cartivo_reset",
  "cartivo_save_size", "cartivo_load_save", "cartivo_save", "cartivo_set_input",
  "cartivo_frames", "cartivo_pixels", "cartivo_audio",
  "cartivo_state_size", "cartivo_save_state", "cartivo_load_state",
];
const out = verify ? mkdtempSync(join(tmpdir(), "mgba-")) : join(core, "dist");
if (!verify) rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
run("emcc", [
  "-O3", "--no-entry",
  "-sSTANDALONE_WASM=1", "-sFILESYSTEM=0", "-sALLOW_MEMORY_GROWTH=1",
  "-sINITIAL_MEMORY=32MB", "-sSTACK_SIZE=1MB",
  `-sEXPORTED_FUNCTIONS=${exports.map((e) => `_${e}`).join(",")}`,
  ...built, join(objects, "cartivo.o"),
  "-o", join(out, "mgba.wasm"),
], { stdio: "inherit" });
const files = [{ path: "dist/mgba.wasm", sha256: sha256(join(out, "mgba.wasm")) }];

if (verify) {
  const manifest = JSON.parse(readFileSync(join(core, "manifest.json"), "utf8"));
  if (JSON.stringify(manifest.files) !== JSON.stringify(files)) {
    console.error("Build no reproducible.\nVersionado:", manifest.files, "\nNuevo:", files);
    process.exit(1);
  }
  console.log("Build reproducible:", files[0].sha256.slice(0, 12));
  process.exit(0);
}

const emscripten = "https://github.com/emscripten-core/emscripten";
const sbom = [
  { name: "mGBA (core, GBA, ARM, util)", version: tag, license: "MPL-2.0", repository },
  { name: "mGBA HLE BIOS (src/gba/hle-bios.c)", version: tag, license: "MPL-2.0", repository },
  { name: "blip_buf 1.1.0 (src/third-party/blip_buf)", version: tag, license: "LGPL-2.1-or-later", repository },
  { name: "inih (src/third-party/inih)", version: tag, license: "BSD-3-Clause", repository },
  { name: "MurmurHash3 (src/util/hash.c)", version: tag, license: "LicenseRef-public-domain", repository },
  { name: "Emscripten system libraries", version: pins.emsdk.version, license: "MIT OR NCSA", repository: emscripten },
  { name: "musl libc (Emscripten)", version: pins.emsdk.version, license: "MIT", repository: emscripten },
  { name: "compiler-rt (Emscripten)", version: pins.emsdk.version, license: "Apache-2.0 WITH LLVM-exception", repository: emscripten },
  { name: "dlmalloc (Emscripten)", version: pins.emsdk.version, license: "CC0-1.0", repository: emscripten },
];
writeFileSync(join(core, "sbom.json"), JSON.stringify(sbom, null, 2) + "\n");

const manifest = {
  id: "mgba-gba-wasm",
  engine: "WebAssembly (standalone)",
  upstream: { name: "mGBA", ...pins.mgba },
  toolchain: { emcc, emsdk: `${pins.emsdk.version} (${pins.emsdk.commit})` },
  platforms: ["GBA"],
  biosRequired: false,
  bios: "mGBA HLE BIOS (built in, MPL-2.0); no BIOS file is loaded",
  sources: sources.length,
  patchedFiles: [],
  exports,
  dependencies: sbom.length,
  files,
};
writeFileSync(join(core, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log(`mGBA ${tag} → ${files.map((f) => `${f.path} ${f.sha256.slice(0, 12)}`).join(", ")}`);
