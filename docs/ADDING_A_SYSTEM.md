# Añadir una consola a Cartivo

Checklist para integrar un sistema nuevo. Los núcleos en C/C++ reutilizan la plantilla común (`packages/adapters/src/wasm-host.ts`, puente `cartivo_*`). Si el núcleo tiene frontend libretro, el camino más corto es el de Snes9x y Genesis Plus GX: un puente que conduce `retro_*`, con la ROM en memoria y el orden de botones común `libretroInputBits`. Un sistema por incremento, en la rama de trabajo y con plan previo. El contrato está en `packages/adapters/src/contract.ts`; NES (`tetanes`, `jsnes`) es la referencia.

## 1. Núcleo y licencia
- Elegir el núcleo con la matriz de `docs/research/` y el plan técnico. Requisitos: compila a WebAssembly, no necesita BIOS propietaria y ofrece **instantáneas de estado** (para «Partidas»).
- Pasar el gate con la skill `cartivo-core-gate` y guardar el expediente en `docs/research/<NUCLEO>_CORE_GATE.md` (política de uso privado, ADR-005).

## 2. Build reproducible en CI
- Crear `cores/<id>/` con el envoltorio mínimo: solo emulación, sin sistema de archivos ni `localStorage`; ROM, SRAM e instantáneas entran y salen como bytes. API:
  - `new(rom, sampleRate)`, `set_input(bits)` y `frames(n)`.
  - `pixels()`, `audio()`, `sram()` y `set_sram()`.
  - `save_state()`, `load_state()` y `reset()`.
- Copiar como base `core-genesis-plus-gx.yml` y `tools/build-genesis-plus-gx.mjs` (C/C++ con Emscripten) o `core-tetanes.yml` y `tools/build-tetanes.mjs` (Rust):
  - Rust → `wasm-bindgen`; C/C++ → Emscripten con versión fijada.
  - Lockfile, toolchain y rutas reasignadas.
  - Gate de licencias y fuentes.
  - Disparo **solo explícito** (`workflow_dispatch` o un archivo `.build-request` en una rama de trabajo, con `branches-ignore: [main]` para que fusionar no recompile), nunca por push o PR: el binario se compila una vez por cambio del núcleo.
  - Commit de `dist/`, `manifest.json` y `sbom.json` por el workflow; recompilación de verificación solo a mano.
- Añadir el id del núcleo a `node tools/verify-core.mjs …` en `pnpm verify:core` (núcleos Emscripten; manifiesto con `upstream.name` y `tag` o `commit`). La CI rechaza una PR que cambie `cores/<id>/src`, `Cargo.toml` o la toolchain sin traer `manifest.json` y `dist/` regenerados.

## 3. Módulo del núcleo
- Adaptador `packages/adapters/src/<id>.ts` que implemente `EmulatorCore`: `input`, `advance` (1–3 frames, RGBA del tamaño declarado, audio mono a 48 kHz ≤ 1 s), `saveBytes` (tamaño de la SRAM de ese cartucho; 0 si no tiene) y `save` (SRAM de ese tamaño), `snapshot`/`restore` (errores legibles), `lastFrame` y `dispose` (liberar memoria WASM).
- Validador de formato del sistema (como `packages/adapters/src/ines.ts`): cabecera, tamaños y variantes admitidas, con mensajes en español.
- Fixture **original** en `packages/fixtures/` (nunca ROMs comerciales ni de terceros) con hash, licencia y oráculo.
- Registrar un `CoreModule` en `packages/adapters/src/registry.ts` con `system`, `id`, `version` exacta, `video`, `maxRomBytes`, `validate`, `demo`, `prepare` y `create`.
- **Sistemas de disco** (ADR-015): un `DiscModule` (`disc: true`) declara `boots` (extensiones de arranque por orden de preferencia) en lugar de `maxRomBytes`/`validate`; su `demo` devuelve `{ name, bytes }` y su `create` recibe un `DiscImage`. El núcleo lee los archivos por la VFS de libretro reenviada a `cartivo_vfs_*` (ver `cores/pcsx-rearmed/src/cartivo.c`); en `systems.ts`, `disc: true` y `extensions` en el mismo orden que `boots`.

## 4. Sistema en la interfaz
- Añadir la entrada en `packages/runtime/src/systems.ts`:
  - `id`, `name`, `longName` y `extensions`.
  - `video` con resolución y aspecto: GB/GBC 160×144 (10:9) y GBA 240×160 (3:2); no forzar 4:3.
  - `cores` con versión y licencias, `defaultCore`, `formatNote`, `demo` y `available`.
- Añadir las extensiones a `file_handlers` en `apps/web/public/manifest.webmanifest`.
- La tarjeta de inicio, el selector de archivos, el reproductor, Gráficos, Partidas y la selección de núcleo salen del registro sin más cambios.
- **Botones:** declarar en `systems.ts` los `buttons` del mando original (acciones de `packages/input/src/nes-input.ts` además de la cruceta). Controles muestra solo los botones que usa alguna consola disponible y genera las notas («L y R solo los usa Game Boy Advance»). Hoy hay doce acciones (cruceta, A, B, X, Y, L, R, Start y Select); un mando con otros nombres reutiliza las posiciones (Mega Drive: A/B/C sobre Y/B/A) con etiquetas propias. Si el sistema necesita una acción que de verdad no existe, se añade en `packages/input` con migración de perfiles como L/R (lista `later`) y como opcional en el protocolo v1.

## 5. Pruebas
- `pnpm test` ejecuta `tests/core-conformance.test.ts` sobre todos los módulos registrados: arranque, tamaño de imagen, entrada, audio, SRAM, instantáneas deterministas, rechazo de estados corruptos y `dispose`. En Node, instancia el WASM con `initSync` igual que TetaNES.
- `tests/systems.test.ts` comprueba que la UI y el Worker coinciden (ids, versiones y vídeo).
- Añadir pruebas específicas del formato y E2E del flujo (abrir archivo, jugar, Partidas) en dev y preview.

## Lo que tocó GB/GBC (H2-GB, ADR-010)
Primera prueba real de este checklist con SameBoy. Además de los archivos del núcleo (`cores/sameboy`, workflow, build, verify), el adaptador, el validador, la fixture, `registry.ts`, `systems.ts`, el manifest y la documentación, hicieron falta tres cambios de base, que ya sirven para los siguientes sistemas:

- **`EmulatorCore.saveBytes`:** el tamaño de la SRAM depende del cartucho, no del módulo.
- **`SystemInfo.frameRate`:** el reproductor avanza al ritmo del hardware. Con 60 Hz fijos, un núcleo a 59,73 Hz produce más audio del que se consume y acaba cortándose.
- **Gráficos:** oculta las opciones de proporción cuando el píxel es cuadrado.

Por lo demás, `App`, `Player` (salvo `frameRate`), `PlayerToolbar`, `SavePanel`, `GameStage`, el Worker (salvo `saveBytes`), el protocolo y `packages/storage` no cambiaron. Para cargar núcleos solo al usarlos, `prepare()` hace `import()` del adaptador (Workers como módulos ES).

**Plantilla C/C++ (Emscripten), consolidada con GBA (ADR-011):**
- El envoltorio C expone la ABI `cartivo_*` común (ver `cores/sameboy/src/cartivo.c` y `cores/mgba/src/cartivo.c`). En TS, el adaptador es una subclase de `BridgeCore` (`packages/adapters/src/wasm-host.ts`) que solo aporta orden de botones, dimensiones y `cartivo_create`; ver `mgba.ts` (unas 60 líneas).
- Si el upstream solo compila con CMake, se configura una vez en nativo, se versiona la lista de fuentes (`cores/mgba/sources.txt`) y se generan `flags.h`/`version.c` en la receta.
- Si el tipo de guardado se detecta con el juego en marcha, se usa un búfer fijo del tamaño máximo (GBA: 128 KB) para que `saveBytes` no cambie.
- Copiar `tools/build-sameboy.mjs`, `cores/sameboy/toolchain.json` y `core-sameboy.yml`.
- `STANDALONE_WASM` sin JS de Emscripten y un adaptador TS que aporte los imports de sistema (ver `packages/adapters/src/sameboy.ts`).
- Probar antes el envoltorio con un arnés nativo (gcc): cada compilación en CI cuesta minutos.

**Límites conocidos:** la entrada tiene doce acciones (cruceta, A, B, X, Y, L, R, Select y Start); un sistema declara las que usa (`buttons`) y sus nombres propios (`labels`), como Mega Drive. Si el núcleo usa `setjmp`/`longjmp`, compilar con `-sSUPPORT_LONGJMP=wasm` (Genesis Plus GX). El vídeo del núcleo es de tamaño fijo.

## 6. Documentación
Crear `docs/compatibility/<SISTEMA>.md` y un ADR del núcleo, y actualizar README, el plan técnico (catálogo y backlog), `LICENSES.md`, `apps/web/public/licenses/` y CHANGELOG.
