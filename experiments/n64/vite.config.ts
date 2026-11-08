// Laboratory only (`vite experiments/n64`). The core is the CI build in
// cores/mupen64plus-next/dist (tools/build-mupen64plus-next.mjs), served from
// there untouched: as source, Vite would transform Emscripten's glue and the
// import would fail. N64_CORE=debug serves the local debug build instead
// (`node tools/build-mupen64plus-next.mjs --debug`).
const env = (globalThis as { process?: { env: Record<string, string> } })
  .process?.env;
export default {
  publicDir:
    env?.N64_CORE === "debug"
      ? "../../cores/mupen64plus-next/build/debug"
      : "../../cores/mupen64plus-next/dist",
};
