# Cartivo — mapa de contexto mínimo para agentes

Este documento **no es una lista de lectura obligatoria**. Es una tabla de enrutamiento: usa la fila del área afectada, abre primero las implementaciones y pruebas, y consulta el ADR/ficha solo si afecta a un contrato, decisión o compatibilidad. Las reglas viven en `../../AGENTS.md` y, para núcleos, `../../cores/AGENTS.md`.

<!-- areas:start (pnpm context --write-doc) -->
| Área (`pnpm context …`) | Trabajo | Empezar por | Pruebas y contexto a demanda |
|---|---|---|---|
| `ui` | Pantalla inicial, navegación y estilo | `apps/web/src/{App,Player}.svelte`, `apps/web/src/theme.css` | `tests/e2e/{ui,pad-navigation}.spec.ts`, `docs/DESIGN.md` |
| `input` | Controles, teclado, mando, foco y modo consola | `packages/input/src/`, `apps/web/src/{ControlsPanel,PauseMenu,PadHints,InterfacePreference}.svelte`, `apps/web/src/{game-capture,pad-navigation.svelte,input-mode.svelte}.ts` | `tests/{input,capture,ui-navigation}.test.ts`, `tests/e2e/{input,controls-page,pad-navigation}.spec.ts`, `docs/adr/006-*.md` |
| `load` | Carga de ROM y discos: Worker, preparación y biblioteca | `apps/web/src/{emulator.worker,game-source}.ts`, `packages/runtime/src/{prepare-rom,client,protocol}.ts`, `packages/adapters/src/disc.ts`, `packages/storage/src/{library,sram,states,disc-identity}.ts` | `tests/{prepare-rom,library,client,disc,disc-identity}.test.ts`, `tests/e2e/{library,faults}.spec.ts`, `docs/adr/{012,015}-*.md` |
| `runtime` | Protocolo, sesión y sistemas | `packages/runtime/src/{protocol,client,systems}.ts`, `apps/web/src/emulator.worker.ts` | `tests/{client,systems,core-conformance}.test.ts`, `docs/adr/002-*.md` |
| `cores` | ROM, adaptador o consola | `packages/adapters/src/{contract,registry,wasm-host}.ts`, `cores/AGENTS.md` | `docs/ADDING_A_SYSTEM.md`, `docs/research/`, `tests/{core-conformance,wasm-host}.test.ts`, `tests/e2e/{nes,gb,gba,snes,sega,pal,ps1}.spec.ts` |
| `storage` | SRAM, Partidas y biblioteca | `packages/storage/src/`, `apps/web/src/{SavePanel,LibraryPage,RecentGames,ContinueCard}.svelte` | `tests/{storage,snapshots,library,state-file,background-commit,persistence}.test.ts`, `tests/e2e/{saves,storage,library,integrity,faults}.spec.ts`, `docs/adr/{003,009,012}-*.md` |
| `media` | Gráficos, audio y ritmo | `packages/media/src/`, `apps/web/src/{GraphicsPanel,GameStage,PerformanceDetails}.svelte`, `apps/web/src/{audio.worklet,sound.svelte}.ts` | `tests/{display-scaler,frame-pacer,frame-metrics}.test.ts`, `tests/e2e/nes.spec.ts`, `docs/DESIGN.md` |
| `pwa` | PWA, caché y modo offline | `tools/pwa-plugin.mjs`, `apps/web/src/{pwa.svelte,offline-cache}.ts`, `apps/web/vite.config.ts` | `tests/pwa.test.ts`, `tests/e2e/{pwa,subpath}.spec.ts`, `docs/compatibility/H1-C-PWA.md`, `docs/adr/001-*.md` |
| `ci` | CI y toolchains | `.github/workflows/ci.yml`, `.github/actions/setup/action.yml`, `tools/verify-*.mjs` | `package.json`, `playwright*.ts`, `cores/AGENTS.md` |
<!-- areas:end -->

## Descubrimiento acotado

`pnpm context <área>` (la primera columna) lista los archivos candidatos de un área con sus líneas y caracteres, sin volcar código. Informa líneas y caracteres, no tokens: el tokenizador depende del modelo. Abre solo símbolos/rangos relevantes de los candidatos. **La tabla se genera desde `tools/context-areas.mjs`**, el único mapa: para cambiar un área se edita allí y se ejecuta `pnpm context --write-doc` (`tests/context.test.ts` falla si la tabla y el mapa no coinciden o si un patrón ya no encuentra archivos).

Antes de editar, comprueba `git status`, la base y los nombres de archivos cambiados en las PR abiertas; consulta parches únicamente si se solapan con el flujo. No descargues ni reconstruyas el repositorio archivo a archivo si existe un checkout Git disponible. No leas `dist`, lockfiles ni todo el historial para identificar el estado actual.

## Método de trabajo económico en contexto

1. Identifica un único flujo o fallo. Para no reimplementar lo existente busca por concepto en `docs/PLAN_TECNICO_CARTIVO.md` §2; si el encargo es definir próximos pasos, usa §3. **No leas todo el plan por rutina**.
2. Localiza nombres (`rg --files apps/web/src packages tests` o `rg -l 'patrón' ruta/`) antes de abrir archivos. Busca símbolos con `rg -n 'patrón' ruta/` y abre solo las líneas relevantes. No leas varios `.svelte` enormes por anticipado.
3. Comienza por una prueba enfocada. Ejemplos desde la raíz:

   ```sh
   node --experimental-strip-types --test tests/input.test.ts
   pnpm exec playwright test tests/e2e/input.spec.ts --project=chromium
   pnpm exec prettier --check packages/input/src/nes-input.ts
   ```

4. Después de los cambios, realiza la verificación completa estipulada en `AGENTS.md` **una vez**, más E2E dev/preview según el área. CI es la referencia de la matriz completa; la ejecución local no acredita QA física.
5. Conserva los códigos de salida y, si falla un comando, consulta el tramo relevante del error. Resume los éxitos en una línea por comando; **no** pegues cientos de líneas de logs, `git diff` entero o volcados de WASM/lockfile.

## Evitar búsquedas inútiles

- Las skills `cartivo-increment` y `cartivo-core-gate` pueden estar instaladas fuera del repositorio; **no aparecen versionadas bajo `.claude/skills/`**. Si el agente no las tiene disponibles, utiliza las reglas y los documentos anteriores; no entres en ciclos buscando un archivo local inexistente.
- En tareas solo documentales, revisa enlaces y exactitud: no ejecutes builds o E2E sin código modificado.
- No cambies automáticamente `README.md`, CHANGELOG, compatibilidad y ADR en bloque: toca únicamente las fuentes cuyo estado o decisión haya variado.
