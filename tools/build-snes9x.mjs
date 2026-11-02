// Builds cores/snes9x (SNES) to standalone WebAssembly and records what was
// built. Run in CI only, on explicit request (.github/workflows/core-snes9x.yml).
// Needs em++ from cores/snes9x/toolchain.json. cores/snes9x/sources.txt is
// the source list of Snes9x's own libretro target (libretro/Makefile.common);
// the Cartivo bridge (src/cartivo.cpp) drives that frontend.
//   node tools/build-snes9x.mjs           build + write dist/, manifest, sbom
//   node tools/build-snes9x.mjs --verify  build into a temp dir and compare
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
const core = join(root, "cores/snes9x");
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
const snes9x = join(work, "snes9x");
const { repository, tag, commit } = pins.snes9x;
if (!existsSync(join(snes9x, ".git")))
  run("git", ["-c", "advice.detachedHead=false", "clone", "--depth", "1", "--branch", tag, repository, snes9x], { stdio: "inherit" });
const head = run("git", ["-C", snes9x, "rev-parse", "HEAD"]);
if (head !== commit) throw Error(`Snes9x: ${head} no es el commit fijado ${commit}`);

const sources = readFileSync(join(core, "sources.txt"), "utf8").split("\n").filter(Boolean);
// The flags of libretro/Makefile (release, non-MSVC), plus deterministic paths.
const common = [
  "-O3", "-DNDEBUG", "-DRIGHTSHIFT_IS_SAR", "-D__LIBRETRO__", "-DALLOW_CPU_OVERCLOCK", "-DHAVE_STDINT_H",
  `-I${join(snes9x, "libretro")}`, `-I${join(snes9x, "libretro/libretro-common/include")}`,
  `-I${snes9x}`, `-I${join(snes9x, "apu")}`, `-I${join(snes9x, "apu/bapu")}`,
  `-ffile-prefix-map=${snes9x}=/snes9x`, `-ffile-prefix-map=${root}=/cartivo`,
];
const cxx = ["-std=c++14", "-fno-rtti", "-fno-exceptions", ...common];
const objects = join(work, "obj");
rmSync(objects, { recursive: true, force: true });
mkdirSync(objects, { recursive: true });
const built = [];
for (const [i, source] of sources.entries()) {
  const object = join(objects, `${String(i).padStart(3, "0")}.o`);
  const c = source.endsWith(".c");
  run(c ? "emcc" : "em++", [...(c ? ["-std=c99", ...common] : cxx), "-w", "-c", join(snes9x, source), "-o", object], { stdio: "inherit" });
  built.push(object);
}
run("em++", [...cxx, "-Wall", "-Wextra", "-c", join(core, "src/cartivo.cpp"), "-o", join(objects, "cartivo.o")], { stdio: "inherit" });

const exports = [
  "malloc", "free", "cartivo_create", "cartivo_free", "cartivo_reset",
  "cartivo_save_size", "cartivo_load_save", "cartivo_save", "cartivo_set_input",
  "cartivo_frames", "cartivo_pixels", "cartivo_audio",
  "cartivo_state_size", "cartivo_save_state", "cartivo_load_state",
];
const out = verify ? mkdtempSync(join(tmpdir(), "snes9x-")) : join(core, "dist");
if (!verify) rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
run("em++", [
  "-O3", "--no-entry", "-fno-exceptions",
  "-sSTANDALONE_WASM=1", "-sFILESYSTEM=0", "-sALLOW_MEMORY_GROWTH=1",
  "-sINITIAL_MEMORY=32MB", "-sSTACK_SIZE=1MB",
  `-sEXPORTED_FUNCTIONS=${exports.map((e) => `_${e}`).join(",")}`,
  ...built, join(objects, "cartivo.o"),
  "-o", join(out, "snes9x.wasm"),
], { stdio: "inherit" });
const files = [{ path: "dist/snes9x.wasm", sha256: sha256(join(out, "snes9x.wasm")) }];

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
  { name: "Snes9x (core and libretro frontend)", version: tag, license: "LicenseRef-Snes9x-noncommercial", repository },
  { name: "S-SMP emulator by byuu (apu/bapu/smp, under the Snes9x licence)", version: tag, license: "LicenseRef-Snes9x-noncommercial", repository },
  { name: "snes_spc 0.9.0 SPC_DSP by Shay Green (apu/bapu/dsp)", version: tag, license: "LGPL-2.1-or-later", repository },
  { name: "snes_ntsc by Shay Green (filter/snes_ntsc.c)", version: tag, license: "LGPL-2.1-or-later", repository },
  { name: "libretro API header and libretro-common", version: tag, license: "MIT", repository },
  { name: "Emscripten system libraries", version: pins.emsdk.version, license: "MIT OR NCSA", repository: emscripten },
  { name: "musl libc (Emscripten)", version: pins.emsdk.version, license: "MIT", repository: emscripten },
  { name: "libc++ and libc++abi (Emscripten)", version: pins.emsdk.version, license: "Apache-2.0 WITH LLVM-exception", repository: emscripten },
  { name: "compiler-rt (Emscripten)", version: pins.emsdk.version, license: "Apache-2.0 WITH LLVM-exception", repository: emscripten },
  { name: "dlmalloc (Emscripten)", version: pins.emsdk.version, license: "CC0-1.0", repository: emscripten },
];
writeFileSync(join(core, "sbom.json"), JSON.stringify(sbom, null, 2) + "\n");

const manifest = {
  id: "snes9x-snes-wasm",
  engine: "WebAssembly (standalone)",
  upstream: { name: "Snes9x", ...pins.snes9x },
  toolchain: { emcc, emsdk: `${pins.emsdk.version} (${pins.emsdk.commit})` },
  platforms: ["SNES"],
  biosRequired: false,
  bios: "None: DSP-1–4, Cx4, ST010/011, SA-1, Super FX, S-DD1, SPC7110 and S-RTC are emulated in code; BS-X, Sufami Turbo, Super Game Boy and ST018 are refused by Cartivo",
  sources: sources.length,
  patchedFiles: [],
  exports,
  dependencies: sbom.length,
  files,
};
writeFileSync(join(core, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log(`Snes9x ${tag} → ${files.map((f) => `${f.path} ${f.sha256.slice(0, 12)}`).join(", ")}`);
