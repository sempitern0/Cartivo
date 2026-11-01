# Añadir una consola a Cartivo

Checklist para integrar un sistema nuevo (por ejemplo GB/GBC con mGBA). Un sistema por incremento, en la rama de trabajo y con plan previo. El contrato está en `packages/adapters/src/contract.ts`; NES (`tetanes`, `jsnes`) es la referencia.

## 1. Núcleo y licencia
- Elegir el núcleo con la matriz de `docs/research/` y el plan técnico. Requisitos: compila a WebAssembly, no necesita BIOS propietaria y ofrece **instantáneas de estado** (para «Partidas»).
- Pasar el gate con la skill `cartivo-core-gate` y guardar el expediente en `docs/research/<NUCLEO>_CORE_GATE.md` (política de uso privado, ADR-005).

## 2. Build reproducible en CI
- Crear `cores/<id>/` con el envoltorio mínimo: solo emulación, sin sistema de archivos ni `localStorage`; ROM, SRAM e instantáneas entran y salen como bytes. API:
  - `new(rom, sampleRate)`, `set_input(bits)` y `frames(n)`.
  - `pixels()`, `audio()`, `sram()` y `set_sram()`.
  - `save_state()`, `load_state()` y `reset()`.
- Copiar `.github/workflows/core-tetanes.yml` y `tools/build-tetanes.mjs` como base:
  - Rust → `wasm-bindgen`; C/C++ → Emscripten con versión fijada.
  - Lockfile, toolchain y rutas reasignadas.
  - Gate de licencias y fuentes.
  - Commit automático de `dist/`, `manifest.json` y `sbom.json`.
  - Recompilación de verificación.
- Añadir `tools/verify-<id>.mjs` a `pnpm verify:core`.

## 3. Módulo del núcleo
- Adaptador `packages/adapters/src/<id>.ts` que implemente `EmulatorCore`: `input`, `advance` (1–3 frames, RGBA del tamaño declarado, audio mono a 48 kHz ≤ 1 s), `save` (SRAM del tamaño de `sramBytes`), `snapshot`/`restore` (errores legibles), `lastFrame` y `dispose` (liberar memoria WASM).
- Validador de formato del sistema (como `packages/adapters/src/ines.ts`): cabecera, tamaños y variantes admitidas, con mensajes en español.
- Fixture **original** en `packages/fixtures/` (nunca ROMs comerciales ni de terceros) con hash, licencia y oráculo.
- Registrar un `CoreModule` en `packages/adapters/src/registry.ts` con `system`, `id`, `version` exacta, `video`, `sramBytes`, `maxRomBytes`, `validate`, `demo`, `prepare` y `create`.

## 4. Sistema en la interfaz
- Añadir la entrada en `packages/runtime/src/systems.ts`:
  - `id`, `name`, `longName` y `extensions`.
  - `video` con resolución y aspecto: GB/GBC 160×144 (10:9) y GBA 240×160 (3:2); no forzar 4:3.
  - `cores` con versión y licencias, `defaultCore`, `formatNote`, `demo` y `available`.
- Añadir las extensiones a `file_handlers` en `apps/web/public/manifest.webmanifest`.
- La tarjeta de inicio, el selector de archivos, el reproductor, Gráficos, Partidas y la selección de núcleo salen del registro sin más cambios.
- **Botones:** NES, GB y GBC usan los 8 de `packages/input/src/nes-input.ts`. Para GBA (L/R), SNES (X/Y/L/R) o Mega Drive (C, 6 botones) hay que ampliar antes `InputState` y `ControlsPanel` con acciones por sistema; es un incremento propio.

## 5. Pruebas
- `pnpm test` ejecuta `tests/core-conformance.test.ts` sobre todos los módulos registrados: arranque, tamaño de imagen, entrada, audio, SRAM, instantáneas deterministas, rechazo de estados corruptos y `dispose`. En Node, instancia el WASM con `initSync` igual que TetaNES.
- `tests/systems.test.ts` comprueba que la UI y el Worker coinciden (ids, versiones y vídeo).
- Añadir pruebas específicas del formato y E2E del flujo (abrir archivo, jugar, Partidas) en dev y preview.

## 6. Documentación
Crear `docs/compatibility/<SISTEMA>.md` y un ADR del núcleo, y actualizar README, el plan técnico (catálogo y backlog), `LICENSES.md`, `apps/web/public/licenses/` y CHANGELOG.
