// Builds cores/genesis-plus-gx (Master System and Mega Drive) to standalone
// WebAssembly and records what was built. Run in CI only, on explicit request
// (.github/workflows/core-genesis-plus-gx.yml). Needs emcc from
// cores/genesis-plus-gx/toolchain.json. cores/genesis-plus-gx/sources.txt is
// upstream's libretro target (libretro/Makefile.common) without CHD (no CD in
// Cartivo) and with libretro-common and zlib, which the static target leaves
// to the frontend. The Cartivo bridge (src/cartivo.c) drives that frontend.
//   node tools/build-genesis-plus-gx.mjs           build + dist/, manifest, sbom
//   node tools/build-genesis-plus-gx.mjs --verify  build into a temp dir and compare
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
const core = join(root, "cores/genesis-plus-gx");
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
const gpgx = join(work, "genesis-plus-gx");
const { repository, commit } = pins.genesisPlusGx;
// No release tags upstream: fetch exactly the pinned commit.
if (!existsSync(join(gpgx, ".git"))) {
  run("git", ["init", "-q", gpgx]);
  run("git", ["-C", gpgx, "fetch", "-q", "--depth", "1", repository, commit], { stdio: "inherit" });
  run("git", ["-C", gpgx, "-c", "advice.detachedHead=false", "checkout", "-q", "FETCH_HEAD"]);
}
const head = run("git", ["-C", gpgx, "rev-parse", "HEAD"]);
if (head !== commit) throw Error(`Genesis Plus GX: ${head} no es el commit fijado ${commit}`);

const sources = readFileSync(join(core, "sources.txt"), "utf8").split("\n").filter(Boolean);
// The flags of Makefile.libretro (emscripten platform, release), without
// CHD, plus deterministic paths.
const dirs = ["core", "core/z80", "core/m68k", "core/ntsc", "core/sound", "core/sound/minimp3",
  "core/input_hw", "core/cd_hw", "core/cart_hw", "core/cart_hw/svp"];
const flags = [
  "-O3", "-DNDEBUG", "-DLSB_FIRST", "-DALIGN_LONG", "-DBYTE_ORDER=LITTLE_ENDIAN", "-DHAVE_ZLIB",
  // Upstream's -Dfseeko/-Dftello/-Dflac_* only serve libchdr's FLAC (CHD),
  // which is not built; with Emscripten's stdio.h they would not compile.
  "-DUSE_LIBTREMOR",
  "-DUSE_16BPP_RENDERING", "-DFRONTEND_SUPPORTS_RGB565", "-D__LIBRETRO__", "-DUSE_LIBRETRO_VFS",
  "-DM68K_OVERCLOCK_SHIFT=20", "-DZ80_OVERCLOCK_SHIFT=20", "-DHAVE_YM3438_CORE", "-DHAVE_OPLL_CORE",
  "-DINLINE=static inline",
  `-I${join(gpgx, "libretro")}`, `-I${join(gpgx, "libretro/libretro-common/include")}`,
  ...dirs.map((d) => `-I${join(gpgx, d)}`),
  `-I${join(gpgx, "core/cd_hw/libchdr/deps/zlib-1.3.1")}`,
  `-ffile-prefix-map=${gpgx}=/genesis-plus-gx`, `-ffile-prefix-map=${root}=/cartivo`,
];
const objects = join(work, "obj");
rmSync(objects, { recursive: true, force: true });
mkdirSync(objects, { recursive: true });
const built = [];
for (const [i, source] of sources.entries()) {
  const object = join(objects, `${String(i).padStart(3, "0")}.o`);
  run("emcc", [...flags, "-w", "-c", join(gpgx, source), "-o", object], { stdio: "inherit" });
  built.push(object);
}
run("emcc", [...flags, "-Wall", "-Wextra", "-c", join(core, "src/cartivo.c"), "-o", join(objects, "cartivo.o")], { stdio: "inherit" });

const exports = [
  "malloc", "free", "cartivo_create", "cartivo_free", "cartivo_reset",
  "cartivo_save_size", "cartivo_load_save", "cartivo_save", "cartivo_set_input",
  "cartivo_frames", "cartivo_pixels", "cartivo_audio",
  "cartivo_state_size", "cartivo_save_state", "cartivo_load_state",
];
const out = verify ? mkdtempSync(join(tmpdir(), "gpgx-")) : join(core, "dist");
if (!verify) rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
run("emcc", [
  "-O3", "--no-entry",
  "-sSTANDALONE_WASM=1", "-sFILESYSTEM=0", "-sALLOW_MEMORY_GROWTH=1",
  "-sINITIAL_MEMORY=32MB", "-sSTACK_SIZE=1MB",
  `-sEXPORTED_FUNCTIONS=${exports.map((e) => `_${e}`).join(",")}`,
  ...built, join(objects, "cartivo.o"),
  "-o", join(out, "genesis-plus-gx.wasm"),
], { stdio: "inherit" });
const files = [{ path: "dist/genesis-plus-gx.wasm", sha256: sha256(join(out, "genesis-plus-gx.wasm")) }];

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
  { name: "Genesis Plus GX (core and libretro frontend; MAME-derived YM2612/YM2413/SN76489 portions)", version: commit, license: "LicenseRef-GenesisPlusGX-noncommercial", repository },
  { name: "Musashi 3.3 68000 core by Karl Stenerud (core/m68k)", version: commit, license: "LicenseRef-Musashi-noncommercial", repository },
  { name: "Z80 core by Juergen Buchmueller (core/z80)", version: commit, license: "LicenseRef-MAME-Z80-noncommercial", repository },
  { name: "SVP/SSP1601 core by notaz (core/cart_hw/svp)", version: commit, license: "LicenseRef-notaz-SVP-noncommercial", repository },
  { name: "Nuked OPLL by Nuke.YKT (core/sound/opll.c)", version: commit, license: "LicenseRef-NukedOPLL-noncommercial", repository },
  { name: "Nuked OPN2 by Nuke.YKT (core/sound/ym3438.c)", version: commit, license: "LGPL-2.1-or-later", repository },
  { name: "blip_buf, sms_ntsc and md_ntsc by Shay Green", version: commit, license: "LGPL-2.1-or-later", repository },
  { name: "Tremor (core/sound/tremor)", version: commit, license: "BSD-3-Clause", repository },
  { name: "minimp3 (core/sound/minimp3)", version: commit, license: "CC0-1.0", repository },
  { name: "Equalizer (core/sound/eq.c)", version: commit, license: "LicenseRef-public-domain", repository },
  { name: "zlib 1.3.1 (core/cd_hw/libchdr/deps)", version: commit, license: "Zlib", repository },
  { name: "libretro API header and libretro-common", version: commit, license: "MIT", repository },
  { name: "Emscripten system libraries", version: pins.emsdk.version, license: "MIT OR NCSA", repository: emscripten },
  { name: "musl libc (Emscripten)", version: pins.emsdk.version, license: "MIT", repository: emscripten },
  { name: "compiler-rt (Emscripten)", version: pins.emsdk.version, license: "Apache-2.0 WITH LLVM-exception", repository: emscripten },
  { name: "dlmalloc (Emscripten)", version: pins.emsdk.version, license: "CC0-1.0", repository: emscripten },
];
writeFileSync(join(core, "sbom.json"), JSON.stringify(sbom, null, 2) + "\n");

const manifest = {
  id: "genesis-plus-gx-sms-md-wasm",
  engine: "WebAssembly (standalone)",
  upstream: { name: "Genesis Plus GX", ...pins.genesisPlusGx },
  toolchain: { emcc, emsdk: `${pins.emsdk.version} (${pins.emsdk.commit})` },
  platforms: ["Master System", "Mega Drive"],
  biosRequired: false,
  bios: "None: cartridges boot directly (TMSS and Master System BIOS are optional and never loaded); Mega-CD, Game Gear and SG-1000 are refused by Cartivo",
  sources: sources.length,
  patchedFiles: [],
  exports,
  dependencies: sbom.length,
  files,
};
writeFileSync(join(core, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log(`Genesis Plus GX ${commit.slice(0, 7)} → ${files.map((f) => `${f.path} ${f.sha256.slice(0, 12)}`).join(", ")}`);
