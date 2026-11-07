// Explicit local build of the N64 laboratory core. Never invoked by the
// normal CI and never written to cores/: the output stays in .build/ (git
// ignored) until the core passes CORE-LEGAL-01 and the viability gate.
//   node experiments/n64/build-core.mjs
// Needs emcc 6.0.12 from emsdk (LLVM 24). N64_EXPLORATORY_EMCC=1 accepts another version only to
// iterate locally; the evidence then says the build is not reproducible.
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { resolve } from "node:path";

const root = import.meta.dirname;
const out = resolve(root, ".build");
const core = resolve(out, "mupen64plus-libretro-nx");
const CORE = {
  repository: "https://github.com/libretro/mupen64plus-libretro-nx",
  commit: "15bada85906593376e8fd697f1b0b3af3a20f512",
};
// The upstream Makefile needs make and a Unix shell: on Windows, use WSL.
if (process.platform === "win32")
  throw new Error(
    "Este build necesita Linux o macOS (make y una shell Unix). En Windows, ejecútalo dentro de WSL (Ubuntu) con emsdk 6.0.12 activado; ver experiments/n64/README.md.",
  );
const emcc = process.env.EMCC || "emcc";
const run = (cmd, args, opts = {}) =>
  execFileSync(cmd, args, { encoding: "utf8", stdio: "inherit", ...opts });
const probe = spawnSync(emcc, ["--version"], { encoding: "utf8" });
if (probe.error)
  throw new Error(
    `No se encuentra emcc (${emcc}). Instala y activa emsdk 6.0.12 en esta terminal: ./emsdk install 6.0.12 && ./emsdk activate 6.0.12 && source ./emsdk_env.sh`,
  );
const version = probe.stdout.split("\n")[0];
// emsdk 6.0.12 ships its own LLVM 24: the same emcc over another clang is
// not the pinned toolchain either.
const clang = /clang version (\S+)/.exec(
  spawnSync(emcc, ["-v"], { encoding: "utf8" }).stderr,
)?.[1];
const pinned = /\b6\.0\.12\b/.test(version) && clang?.split(".")[0] === "24";
if (!pinned && process.env.N64_EXPLORATORY_EMCC !== "1")
  throw new Error(
    `Expected emcc 6.0.12 with LLVM 24; found ${version}, clang ${clang}`,
  );

mkdirSync(out, { recursive: true });
if (!existsSync(resolve(core, ".git"))) {
  run("git", ["init", "-q", core]);
  run("git", [
    "-C",
    core,
    "fetch",
    "-q",
    "--depth",
    "1",
    CORE.repository,
    CORE.commit,
  ]);
  run("git", [
    "-C",
    core,
    "-c",
    "advice.detachedHead=false",
    "checkout",
    "-q",
    "FETCH_HEAD",
  ]);
}
const head = execFileSync("git", ["-C", core, "rev-parse", "HEAD"], {
  encoding: "utf8",
}).trim();
if (head !== CORE.commit)
  throw new Error(`Core at ${head}, not ${CORE.commit}`);
// Laboratory patches (patches/*.patch), each one documented in the gate.
const patches = ["emu-thread-entry.patch"].map((p) =>
  resolve(root, "patches", p),
);
for (const patch of patches) {
  const applied = (() => {
    try {
      execFileSync(
        "git",
        ["-C", core, "apply", "--reverse", "--check", patch],
        { stdio: "ignore" },
      );
      return true;
    } catch {
      return false;
    }
  })();
  if (!applied) run("git", ["-C", core, "apply", patch]);
}

// Upstream's emscripten target as a static archive, with GLES3. Two
// deviations, both outside the sources: the bundled zlib instead of
// Emscripten's port (downloaded at build time), and -fno-common, because
// WebAssembly has no common symbols.
const archive = resolve(core, "mupen64plus_next_libretro_emscripten.bc");
run(
  "make",
  [
    "-C",
    core,
    "platform=emscripten",
    "GLES3=1",
    "STATIC_LINKING=1",
    "CPUFLAGS=-DEMSCRIPTEN -DNO_ASM",
    `-j${process.env.JOBS || 2}`,
  ],
  {
    env: {
      ...process.env,
      EMCC_CFLAGS: "-fno-common -Wno-unknown-warning-option",
    },
  },
);

// Upstream names the archive .bc; emcc decides by extension.
const library = resolve(out, "libmupen64plus_next.a");
copyFileSync(archive, library);

// The laboratory frontend and the fibers libco link before the archive, so
// the archive's own libco.o (signals, sigaltstack) is never pulled in.
// What the page loads goes to .build/web/, the lab's Vite publicDir: served
// as is (Vite must not transform Emscripten's glue), next to its .wasm, and
// apart from the clone and the archive.
const web = resolve(out, "web");
mkdirSync(web, { recursive: true });
const module = resolve(web, "n64-core.mjs");
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
].map((name) => `_${name}`);
// N64_DEBUG=1: symbol names and runtime assertions, for stack traces.
const debug = process.env.N64_DEBUG === "1" ? ["-g2", "-sASSERTIONS=1"] : [];
run(emcc, [
  "-O2",
  ...debug,
  `-I${resolve(core, "libretro-common/include")}`,
  resolve(root, "host/frontend.c"),
  resolve(root, "fibers/cooperative.c"),
  library,
  "-o",
  module,
  "-sMODULARIZE",
  "-sEXPORT_ES6",
  "-sENVIRONMENT=worker",
  "-sASYNCIFY",
  "-sASYNCIFY_STACK_SIZE=1048576",
  "-sALLOW_MEMORY_GROWTH",
  // Mupen64Plus first tries a 512 MiB "full mem base" (the whole N64 address
  // space) and falls back to its compact layout when that allocation fails.
  // The cap makes it fail: a session then fits in about half the memory.
  "-sMAXIMUM_MEMORY=536870912",
  "-sINITIAL_MEMORY=268435456",
  "-sSTACK_SIZE=4194304",
  "-sMIN_WEBGL_VERSION=2",
  "-sMAX_WEBGL_VERSION=2",
  "-sFULL_ES3",
  "-sGL_ENABLE_GET_PROC_ADDRESS",
  "-sFORCE_FILESYSTEM",
  // GLideN64 is C++: since Emscripten 5, emcc links only the C libraries
  // unless told to (4.x did it by default).
  "-sDEFAULT_TO_CXX",
  `-sEXPORTED_FUNCTIONS=${exports.join(",")}`,
  "-sEXPORTED_RUNTIME_METHODS=GL,FS,HEAP16,HEAPU8,UTF8ToString,stringToNewUTF8",
]);

const wasm = resolve(web, "n64-core.wasm");
const bytes = readFileSync(wasm);
const imports = WebAssembly.Module.imports(new WebAssembly.Module(bytes)).map(
  ({ module: m, name }) => `${m}.${name}`,
);
writeFileSync(
  resolve(out, "n64-core-evidence.json"),
  JSON.stringify(
    {
      core: CORE,
      patches: patches.map((p) => p.slice(root.length + 1)),
      emcc: version,
      clang,
      reproducible: pinned,
      wasm: {
        bytes: bytes.length,
        sha256: createHash("sha256").update(bytes).digest("hex"),
      },
      imports: imports.length,
      scope: "laboratory build; not admitted, not in cores/",
    },
    null,
    2,
  ) + "\n",
);
console.log(
  `n64-core.wasm ${bytes.length} bytes, ${imports.length} imports, emcc ${pinned ? "pinned" : "EXPLORATORY"} → ${web}`,
);
