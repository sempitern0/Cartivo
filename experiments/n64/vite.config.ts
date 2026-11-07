// Laboratory only (`vite experiments/n64`). The core is the CI build in
// cores/mupen64plus-next/dist (tools/build-mupen64plus-next.mjs), served from
// there untouched: as source, Vite would transform Emscripten's glue and the
// import would fail.
export default { publicDir: "../../cores/mupen64plus-next/dist" };
