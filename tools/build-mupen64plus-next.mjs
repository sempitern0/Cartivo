// Builds cores/mupen64plus-next (Nintendo 64) and records what was built.
// Run in CI only, on explicit request (.github/workflows/
// core-mupen64plus-next.yml); locally only on Linux/macOS/WSL with the
// pinned emsdk active. Needs make and a Unix shell (upstream's Makefile).
//
// Unlike the standalone cores, the output is an Emscripten ES module plus
// its .wasm: GLideN64 draws through WebGL2 (Emscripten's GL library) into an
// OffscreenCanvas, and libco runs on fibers/Asyncify (src/cooperative.c), so
// the core needs Emscripten's JS runtime. Not used by the app yet (ADR-015,
// docs/research/N64_PLAN_INTEGRACION.md): the laboratory in experiments/n64
// loads dist/ while the viability gate is open.
//   node tools/build-mupen64plus-next.mjs           build + dist/, manifest, sbom
//   node tools/build-mupen64plus-next.mjs --verify  build into a temp dir and compare
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { cpus, tmpdir } from "node:os";
import { join, resolve } from "node:path";

if (process.platform === "win32")
  throw Error(
    "Este build necesita Linux o macOS (make y una shell Unix). En Windows, usa WSL con emsdk activado.",
  );
const root = resolve(import.meta.dirname, "..");
const core = join(root, "cores/mupen64plus-next");
const work = join(core, "build");
const verify = process.argv.includes("--verify");
const pins = JSON.parse(readFileSync(join(core, "toolchain.json"), "utf8"));
const run = (cmd, args, opts = {}) =>
  (
    execFileSync(cmd, args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "inherit"],
      ...opts,
    }) ?? ""
  ).trim();
const sha256 = (file) =>
  createHash("sha256").update(readFileSync(file)).digest("hex");

// emsdk ships its own LLVM: the same emcc over another clang is not the
// pinned toolchain (6.0.12 over LLVM 21 cannot build its own libc).
const probe = spawnSync("emcc", ["--version"], { encoding: "utf8" });
if (probe.error)
  throw Error(`emcc no encontrado: activa emsdk ${pins.emsdk.version}`);
const emcc = probe.stdout.split("\n")[0];
const clang = /clang version (\S+)/.exec(
  spawnSync("emcc", ["-v"], { encoding: "utf8" }).stderr,
)?.[1];
if (
  !emcc.includes(` ${pins.emsdk.version} `) ||
  !clang?.startsWith(`${pins.emsdk.llvm}.`)
)
  throw Error(
    `emsdk ${pins.emsdk.version} (LLVM ${pins.emsdk.llvm}) requerido; encontrado: ${emcc}, clang ${clang}`,
  );

mkdirSync(work, { recursive: true });
const source = join(work, "mupen64plus-libretro-nx");
const { repository, commit } = pins.mupen64plusNext;
if (!existsSync(join(source, ".git"))) {
  run("git", ["init", "-q", source]);
  run(
    "git",
    ["-C", source, "fetch", "-q", "--depth", "1", repository, commit],
    {
      stdio: "inherit",
    },
  );
  run("git", [
    "-C",
    source,
    "-c",
    "advice.detachedHead=false",
    "checkout",
    "-q",
    "FETCH_HEAD",
  ]);
}
const head = run("git", ["-C", source, "rev-parse", "HEAD"]);
if (head !== commit)
  throw Error(`Mupen64Plus-Next: ${head} no es el commit fijado ${commit}`);
// Cartivo's patches, each one documented in docs/research/N64_CORE_GATE.md;
// applied once (a reverse check says whether they already are).
const patches = ["emu-thread-entry.patch"];
for (const patch of patches.map((p) => join(core, "patches", p))) {
  const applied =
    spawnSync("git", ["-C", source, "apply", "--reverse", "--check", patch])
      .status === 0;
  if (!applied) run("git", ["-C", source, "apply", patch]);
}

// Upstream's emscripten target as a static archive, with GLES3 and without
// dynarec. Two deviations, both outside the sources: the bundled zlib instead
// of Emscripten's port (downloaded at build time), and -fno-common, because
// WebAssembly has no common symbols.
run(
  "make",
  [
    "-C",
    source,
    "platform=emscripten",
    "GLES3=1",
    "STATIC_LINKING=1",
    "CPUFLAGS=-DEMSCRIPTEN -DNO_ASM",
    `-j${process.env.JOBS || cpus().length}`,
  ],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      EMCC_CFLAGS: `-fno-common -Wno-unknown-warning-option -ffile-prefix-map=${source}=/mupen64plus-libretro-nx`,
    },
  },
);
// Upstream names the archive .bc; emcc decides by extension.
const library = join(work, "libmupen64plus_next.a");
copyFileSync(join(source, "mupen64plus_next_libretro_emscripten.bc"), library);

const exports = [
  "n64_init",
  "n64_load",
  "n64_run",
  "n64_audio",
  "n64_audio_frames",
  "n64_fps",
  "n64_sample_rate",
  "n64_presented",
  "n64_duped",
  "n64_input",
  "n64_unload",
  "malloc",
  "free",
];
const out = verify ? mkdtempSync(join(tmpdir(), "n64-")) : join(core, "dist");
if (!verify) rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
const module = join(out, "n64-core.mjs");
// The Cartivo frontend and the fibers libco link before the archive, so the
// archive's own libco.o (signals, sigaltstack) is never pulled in.
run(
  "emcc",
  [
    "-O2",
    `-I${join(source, "libretro-common/include")}`,
    `-ffile-prefix-map=${root}=/cartivo`,
    join(core, "src/frontend.c"),
    join(core, "src/cooperative.c"),
    library,
    "-o",
    module,
    "-sMODULARIZE",
    "-sEXPORT_ES6",
    "-sENVIRONMENT=worker",
    "-sASYNCIFY",
    "-sASYNCIFY_STACK_SIZE=1048576",
    "-sALLOW_MEMORY_GROWTH",
    // Mupen64Plus first tries a 512 MiB "full mem base" (the whole N64
    // address space) and falls back to its compact layout when that
    // allocation fails. The cap makes it fail: a session fits in 256 MiB.
    "-sMAXIMUM_MEMORY=536870912",
    "-sINITIAL_MEMORY=268435456",
    "-sSTACK_SIZE=4194304",
    "-sMIN_WEBGL_VERSION=2",
    "-sMAX_WEBGL_VERSION=2",
    "-sFULL_ES3",
    "-sGL_ENABLE_GET_PROC_ADDRESS",
    "-sFORCE_FILESYSTEM",
    // GLideN64 is C++: since Emscripten 5, emcc links only the C libraries
    // unless told to.
    "-sDEFAULT_TO_CXX",
    `-sEXPORTED_FUNCTIONS=${exports.map((e) => `_${e}`).join(",")}`,
    "-sEXPORTED_RUNTIME_METHODS=GL,FS,HEAP16,HEAPU8,UTF8ToString,stringToNewUTF8",
  ],
  { stdio: "inherit" },
);

const wasm = join(out, "n64-core.wasm");
const imports = WebAssembly.Module.imports(
  new WebAssembly.Module(readFileSync(wasm)),
).map(({ module: m, name }) => `${m}.${name}`);
// The glue provides every import: only Emscripten's own modules may appear.
const foreign = imports.filter(
  (i) => !i.startsWith("env.") && !i.startsWith("wasi_snapshot_preview1."),
);
if (foreign.length) throw Error(`Imports inesperados: ${foreign.join(", ")}`);
const files = [
  { path: "dist/n64-core.mjs", sha256: sha256(module) },
  { path: "dist/n64-core.wasm", sha256: sha256(wasm) },
];

if (verify) {
  const manifest = JSON.parse(
    readFileSync(join(core, "manifest.json"), "utf8"),
  );
  if (JSON.stringify(manifest.files) !== JSON.stringify(files)) {
    console.error(
      "Build no reproducible.\nVersionado:",
      manifest.files,
      "\nNuevo:",
      files,
    );
    process.exit(1);
  }
  console.log(
    "Build reproducible:",
    files.map((f) => f.sha256.slice(0, 12)).join(", "),
  );
  process.exit(0);
}

const emscripten = "https://github.com/emscripten-core/emscripten";
const sbom = [
  {
    name: "mupen64plus-core (CPU cached interpreter, PIF/CIC HLE, memory) and custom/mupen64plus-core",
    version: commit,
    license: "GPL-2.0-or-later",
    repository,
  },
  {
    name: "Mupen64Plus-Next libretro frontend (libretro/libretro.c, patched: patches/emu-thread-entry.patch)",
    version: commit,
    license: "GPL-2.0-or-later",
    repository,
  },
  {
    name: "mupen64plus-rsp-hle",
    version: commit,
    license: "GPL-2.0-or-later",
    repository,
  },
  {
    name: "GLideN64 (GL RDP, uCodes, GLideNHQ, OpenGLContext)",
    version: commit,
    license: "GPL-2.0-only",
    repository,
  },
  {
    name: "gles2n64-derived code in GLideN64 (GLideN64/licenses/gles2n64)",
    version: commit,
    license: "LGPL-3.0-only",
    repository,
  },
  {
    name: "GLSL-FXAA shader in GLideN64 (GLideN64/licenses/GLSL-FXAA)",
    version: commit,
    license: "MIT",
    repository,
  },
  {
    name: "Glow bloom shader in GLideN64 (GLideN64/licenses/Glow)",
    version: commit,
    license: "MIT",
    repository,
  },
  {
    name: "readerwriterqueue in GLideN64 (GLideN64/licenses/readerwriterqueue)",
    version: commit,
    license: "BSD-2-Clause AND Zlib",
    repository,
  },
  {
    name: "libretro API header and libretro-common",
    version: commit,
    license: "MIT",
    repository,
  },
  {
    name: "libpng 1.6.34 (custom/dependencies/libpng)",
    version: commit,
    license: "Libpng",
    repository,
  },
  {
    name: "zlib 1.2.8 (custom/dependencies/libzlib)",
    version: commit,
    license: "Zlib",
    repository,
  },
  {
    name: "minizip (mupen64plus-core/subprojects/minizip)",
    version: commit,
    license: "Zlib",
    repository,
  },
  {
    name: "md5 by L. Peter Deutsch (mupen64plus-core/subprojects/md5)",
    version: commit,
    license: "Zlib",
    repository,
  },
  {
    name: "Emscripten system libraries and JS runtime (GL, FS, fibers, Asyncify)",
    version: pins.emsdk.version,
    license: "MIT OR NCSA",
    repository: emscripten,
  },
  {
    name: "libc++ and libc++abi (Emscripten)",
    version: pins.emsdk.version,
    license: "Apache-2.0 WITH LLVM-exception",
    repository: emscripten,
  },
  {
    name: "musl libc (Emscripten)",
    version: pins.emsdk.version,
    license: "MIT",
    repository: emscripten,
  },
  {
    name: "compiler-rt (Emscripten)",
    version: pins.emsdk.version,
    license: "Apache-2.0 WITH LLVM-exception",
    repository: emscripten,
  },
  {
    name: "dlmalloc (Emscripten)",
    version: pins.emsdk.version,
    license: "CC0-1.0",
    repository: emscripten,
  },
];
writeFileSync(join(core, "sbom.json"), JSON.stringify(sbom, null, 2) + "\n");

const manifest = {
  id: "mupen64plus-next-n64-wasm",
  engine: "WebAssembly + Emscripten ES module (WebGL2, Asyncify)",
  upstream: { name: "Mupen64Plus-Next", ...pins.mupen64plusNext },
  toolchain: {
    emcc,
    clang,
    emsdk: `${pins.emsdk.version} (${pins.emsdk.commit})`,
  },
  platforms: ["Nintendo 64"],
  biosRequired: false,
  bios: "None: PIF and CIC are the core's HLE and each cartridge carries its own IPL3",
  status:
    "laboratory: not registered in the app until the viability gate (N64_PLAN_INTEGRACION)",
  patchedFiles: ["libretro/libretro.c (patches/emu-thread-entry.patch)"],
  exports,
  imports: imports.length,
  dependencies: sbom.length,
  files,
};
writeFileSync(
  join(core, "manifest.json"),
  JSON.stringify(manifest, null, 2) + "\n",
);
console.log(
  `Mupen64Plus-Next ${commit.slice(0, 7)} → ${files.map((f) => `${f.path} ${f.sha256.slice(0, 12)}`).join(", ")}`,
);
