# JSNES experimental

No hay binarios copiados en este directorio. La dependencia exacta `jsnes@2.1.0` entrega las fuentes ESM; Vite construye el Worker desde ellas y el adaptador propio.

```sh
pnpm install --frozen-lockfile
node tools/verify-jsnes.mjs
pnpm test
pnpm build
```

`manifest.json` fija los hashes git de 51 archivos del commit upstream, integridad npm, licencia y capacidades admitidas. La receta usa las versiones de Node/pnpm del proyecto y el lockfile. No instala ni ejecuta la toolchain webpack de upstream ni su frontend Browser.

Ver ADR-007 y docs/compatibility/H1-B-NES.md. Es **JavaScript, no WASM**. La build de TetaNES, otros mappers y la promoción estable siguen pendientes.
