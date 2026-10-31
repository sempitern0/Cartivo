# Licencias y procedencia de terceros

El código original de Cartivo usa PolyForm Noncommercial 1.0.0; esa restricción no se aplica al código ajeno. Los núcleos se aceptan por artefacto, no por aislamiento en Worker.

- **JSNES 2.1.0**: Apache-2.0, Copyright 2020 Ben Firshman. Commit `cbad9f1db57dfb275b90ffa26f9c479c355d8d5c`, sin parches ni dependencias runtime. Se importan fuentes ESM. [Licencia completa](apps/web/public/licenses/jsnes-Apache-2.0.txt), [manifest de hashes](cores/jsnes/manifest.json), [expediente](docs/compatibility/H1-B-NES.md). No se incluyen ROMs, BIOS, assets del frontend ni binarios WASM de upstream.
- **Svelte 5.57.3**: runtime MIT; [licencia y copyright completos](apps/web/public/licenses/svelte-MIT.txt).
- El resto de herramientas de compilación y pruebas están fijadas en package.json/pnpm-lock.yaml; no se presenta este inventario de runtime como una auditoría completa de todas las herramientas.

Los avisos y textos se copian al build mediante el directorio público `apps/web/public/licenses/`. El núcleo JSNES conserva su Apache-2.0 y sus permisos, incluidos usos que la licencia propia de Cartivo no concede para el código original del producto.

La fixture `packages/fixtures/src/control-demo.ts` es código original de Cartivo bajo la licencia del repositorio, no una ROM de terceros. Véase su hash y procedencia en el expediente H1-B-NES.
