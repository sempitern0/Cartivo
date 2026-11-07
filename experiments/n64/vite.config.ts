// Laboratory only (`vite experiments/n64`). The local core build lands in
// .build/web/ (git ignored) and is served from there untouched: as source,
// Vite would transform Emscripten's glue and the import would fail.
export default { publicDir: ".build/web" };
