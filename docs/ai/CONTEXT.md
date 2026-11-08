# Cartivo — mapa de contexto mínimo para agentes

Este documento **no es una lista de lectura obligatoria**. Es una tabla de enrutamiento: usa la fila del área afectada, abre primero las implementaciones y pruebas, y consulta el ADR/ficha solo si afecta a un contrato, decisión o compatibilidad. Las reglas viven en `../../AGENTS.md` y, para núcleos, `../../cores/AGENTS.md`.

<!-- areas:start (pnpm context --write-doc) -->
| Área (`pnpm context …`) | Trabajo | Empezar por | Pruebas y contexto a demanda |
|---|---|---|---|
| `ui` | Pantalla inicial, navegación y estilo | `apps/web/src/{App,Player,ConsoleCard,ConsoleIcon,SettingsPage,PauseMenu}.svelte`, `apps/web/src/{theme.css,accent.ts}` | `tests/e2e/{ui,pad-navigation}.spec.ts`, `docs/DESIGN.md` |
| `input` | Controles, teclado, mando, foco y modo consola | `packages/input/src/`, `apps/web/src/{ControlsPanel,PauseMenu,PadHints,InterfacePreference}.svelte`, `apps/web/src/{game-capture,pad-navigation.svelte,input-mode.svelte}.ts` | `tests/{input,capture,ui-navigation}.test.ts`, `tests/e2e/{input,controls-page,pad-navigation}.spec.ts`, `docs/adr/006-*.md` |
| `load` | Carga de ROM y discos: Worker, preparación y biblioteca | `apps/web/src/{emulator.worker,game-source}.ts`, `packages/runtime/src/{prepare-rom,client,protocol}.ts`, `packages/adapters/src/disc.ts`, `packages/storage/src/{library,sram,states,disc-identity}.ts` | `tests/{prepare-rom,library,client,disc,disc-identity}.test.ts`, `tests/e2e/{library,faults}.spec.ts`, `docs/adr/{012,015}-*.md` |
| `runtime` | Protocolo, sesión y sistemas | `packages/runtime/src/{protocol,client,systems}.ts`, `apps/web/src/emulator.worker.ts` | `tests/{client,systems,core-conformance}.test.ts`, `docs/adr/002-*.md` |
| `cores` | ROM, adaptador o consola | `packages/adapters/src/{contract,registry,wasm-host}.ts`, `cores/AGENTS.md` | `docs/ADDING_A_SYSTEM.md`, `docs/research/`, `packages/adapters/src/n64.ts`, `experiments/n64/README.md`, `tests/{core-conformance,wasm-host,n64}.test.ts`, `tests/e2e/{nes,gb,gba,snes,sega,pal,ps1,n64}.spec.ts` |
| `storage` | SRAM, Partidas, biblioteca y perfiles | `packages/storage/src/`, `apps/web/src/{SavePanel,LibraryPage,RecentGames,ContinueCard,ProfilePicker}.svelte`, `apps/web/src/{profile.svelte,library-view}.ts` | `tests/{storage,snapshots,library,shared-library,state-file,background-commit,persistence,profiles}.test.ts`, `tests/e2e/{saves,storage,library,integrity,faults,profiles}.spec.ts`, `docs/adr/{003,009,012,016,018}-*.md` |
| `media` | Gráficos, audio y ritmo | `packages/media/src/`, `apps/web/src/{GraphicsPanel,DisplayOptions,DisplayPreview,GameStage,PerformanceDetails}.svelte`, `apps/web/src/display-sample.ts`, `apps/web/src/{audio.worklet,sound.svelte}.ts` | `tests/{display-scaler,display-sample,frame-pacer,frame-metrics,sound-preferences}.test.ts`, `tests/e2e/nes.spec.ts`, `docs/DESIGN.md` |
| `pwa` | PWA, caché y modo offline | `tools/pwa-plugin.mjs`, `apps/web/src/{pwa.svelte,offline-cache}.ts`, `apps/web/vite.config.ts` | `tests/pwa.test.ts`, `tests/e2e/{pwa,subpath}.spec.ts`, `docs/compatibility/H1-C-PWA.md`, `docs/adr/001-*.md` |
| `ci` | CI y toolchains | `.github/workflows/ci.yml`, `.github/actions/setup/action.yml`, `tools/verify-*.mjs` | `package.json`, `playwright*.ts`, `cores/AGENTS.md` |
<!-- areas:end -->

## Descubrimiento acotado

`pnpm context <área>` (la primera columna) lista los archivos candidatos de un área con sus líneas y caracteres, sin volcar código. Informa líneas y caracteres, no tokens: el tokenizador depende del modelo. Abre solo símbolos/rangos relevantes de los candidatos. **La tabla se genera desde `tools/context-areas.mjs`**, el único mapa: para cambiar un área se edita allí y se ejecuta `pnpm context --write-doc` (`tests/context.test.ts` falla si la tabla y el mapa no coinciden o si un patrón ya no encuentra archivos).

Antes de editar, comprueba `git status`, la base y los nombres de archivos cambiados en las PR abiertas; consulta parches únicamente si se solapan con el flujo. No descargues ni reconstruyas el repositorio archivo a archivo si existe un checkout Git disponible. No leas `dist`, lockfiles ni todo el historial para identificar el estado actual.

## Método de trabajo económico en contexto

1. Identifica un único flujo o fallo. Para no reimplementar lo existente busca por concepto en `docs/PLAN_TECNICO_CARTIVO.md` §2; si el encargo es definir próximos pasos, usa §3.2. **No leas todo el plan por rutina**.
2. Localiza nombres (`rg --files apps/web/src packages tests` o `rg -l 'patrón' ruta/`) antes de abrir archivos. Busca símbolos con `rg -n 'patrón' ruta/` y abre solo las líneas relevantes. No leas varios `.svelte` enormes por anticipado.
3. Comienza por una prueba enfocada. Ejemplos desde la raíz:

   ```sh
   node --experimental-strip-types --test tests/input.test.ts
   pnpm exec playwright test tests/e2e/input.spec.ts --project=chromium
   pnpm exec prettier --check packages/input/src/nes-input.ts
   ```

4. Después de los cambios, realiza la verificación completa estipulada en `AGENTS.md` **una vez**, más E2E dev/preview según el área. CI es la referencia de la matriz completa; la ejecución local no acredita QA física.
5. Conserva los códigos de salida y, si falla un comando, consulta el tramo relevante del error. Resume los éxitos en una línea por comando; **no** pegues cientos de líneas de logs, `git diff` entero o volcados de WASM/lockfile.

## Recetas: dónde va cada cosa

Patrones ya resueltos. Se reutilizan en lugar de reinventarlos:

| Si necesitas… | Usa | Referencia |
|---|---|---|
| Guardar algo propio de cada jugador (base IndexedDB, clave de `localStorage`, Web Lock) | `scoped(nombre, perfil)` de `packages/storage/src/profiles.ts`. El Worker recibe el perfil en `load.profile`; la UI usa `profiles.key(…)` | ADR-016 |
| Un sistema de disco (archivos grandes, varias pistas) | `DiscModule` en `contract.ts`, `prepareDisc` y la VFS `cartivo_vfs_*` del puente | ADR-015, `cores/pcsx-rearmed/src/cartivo.c` |
| Un núcleo que dibuja con la GPU (WebGL2) | `SurfaceModule` en `contract.ts`, `surface: "webgl2"` en `systems.ts`; la UI transfiere el lienzo (`apps/web/src/surface.ts`) | ADR-017, `packages/adapters/src/n64.ts` |
| Elegir el juego entre varios archivos abiertos juntos | `gameForFiles` (`systems.ts`); pistas de `.cue` con `cueFiles`/`matchTracks` (`storage/src/cue.ts`) | `tests/systems.test.ts`, `tests/disc.test.ts` |
| Un botón que inicia un juego | Atributo `data-launch="<único>"`: al salir del juego el foco vuelve a él | `App.svelte` (`returnFocus`) |
| Que el mando no salga de una zona mientras está abierta | `data-pad-scope` en su contenedor; un `<dialog>` modal ya acota | `pad-navigation.svelte.ts` |
| Leer el mando para otra cosa (juego, prueba de controles) | `claimPadWhile(owner, busy)` | ADR-006 |
| Un botón nuevo en el mando | Añadirlo a `actions` y a `later` en `nes-input.ts`, a `optional` en `protocol.ts` y a las etiquetas de `ControlsPanel` | L2/R2 (ADR-015) |
| Una fixture para un sistema nuevo | Programa propio generado en TS con hash y oráculo, nunca un juego de terceros | `packages/fixtures/src/` |
| Una E2E que necesita la pantalla «¿Quién juega?» | `test.use({ profile: "" })`; las demás empiezan con el primer perfil (`tests/e2e/fixtures.ts`) | `tests/e2e/profiles.spec.ts` |

## Trampas conocidas

Problemas reales que han costado iteraciones. Comprobarlos ahorra rondas de CI:

- **Sin `node_modules` (registro npm bloqueado):** `svelte-check`, `vite build` y Playwright solo corren en CI. Para añadir una dependencia, escribe la versión en `package.json` y sube el cambio: la CI de ese commit resuelve sin lockfile (aviso) y el workflow `Dependencies` sube `pnpm-lock.yaml` y relanza la CI; después, `git pull`. En local funcionan las unitarias (`node --experimental-strip-types --test tests/*.test.ts`), el Prettier global y el `tsc` global. Los errores de `tsc` por módulos ausentes (`svelte`, `vite`, `$state`) son del entorno, no del cambio.
- **Prettier:** el repositorio fija 3.6.2. Un Prettier global más nuevo da por buenos archivos que el `lint` de CI rechaza, y al revés con `tests/display-scaler.test.ts` y `tests/input.test.ts` (no reformatearlos con el global).
  - Evita las formas que difieren: `const { x } = await import(…)` largo, operadores mezclados (`a | b % c`, `x + (y % 2)`) y literales largos dentro de llamadas.
  - Escribe líneas que no necesiten partirse.
- **`svelte-check` sin `DOM.Iterable`:** no se puede hacer spread de un `FileList`; usa `Array.from(files)`.
- **Playwright:** una opción de fixture con valor `undefined` vuelve a su valor por defecto. Para desactivarla, usa `""` o `null`.
- **`tests/context.test.ts`** solo ve archivos que git conoce: haz `git add` de los nuevos antes de ejecutarlo.
- **Núcleos:** cambiar `cores/*/src` sin regenerar `dist`/`manifest.json` hace fallar `verify`. El build se pide en un commit aparte que solo toque `.build-request` (`cores/AGENTS.md`); el bot sube los artefactos y luego hay que hacer `git pull`.
- **Discos:** `Blob.text()` quita el BOM UTF-8. Para detectarlo, lee los tres primeros bytes.
- **PS1:** el núcleo amplía el color de 15 bits (0x20 → 0x21); los oráculos lo tienen en cuenta.
- **Lienzo transferido (N64):** tras `transferControlToOffscreen` el `<canvas>` no admite `getContext` ni cambios de `width`/`height`. Las E2E leen los píxeles con una captura de pantalla (`tests/e2e/n64.spec.ts`), no con `getImageData`.
- **Emscripten con Asyncify (N64):** una exportación que cambia de fibra pierde su valor de retorno. Los resultados se leen con getters (`n64_audio_frames`, `n64_snapshot_size`, `n64_restore_status`).
- **E2E pesadas:** N64 (WebGL2 por software), el disco de PS1 y los 100 ciclos corren solas, sin otra prueba a la vez en otro worker (`heavy` en `tests/e2e/fixtures.ts`, candado en `tests/e2e/turns.ts`): si coinciden con otra emulación, el reproductor se pausa por lentitud. Una prueba nueva igual de pesada lleva `{ tag: "@heavy" }` o, para un archivo entero, `test.use({ heavy: true })`.
- **Pruebas de tiempo real:** `tests/background-commit.test.ts` mide menos de 5 ms y puede fallar en un CI cargado. Se relanza el job; no es una regresión.

## Evitar búsquedas inútiles

- Las skills `cartivo-increment` y `cartivo-core-gate` pueden estar instaladas fuera del repositorio; **no aparecen versionadas bajo `.claude/skills/`**. Si el agente no las tiene disponibles, utiliza las reglas y los documentos anteriores; no entres en ciclos buscando un archivo local inexistente.
- En tareas solo documentales, revisa enlaces y exactitud: no ejecutes builds o E2E sin código modificado.
- No cambies automáticamente `README.md`, CHANGELOG, compatibilidad y ADR en bloque: toca únicamente las fuentes cuyo estado o decisión haya variado.
