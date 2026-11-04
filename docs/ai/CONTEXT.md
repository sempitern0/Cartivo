# Cartivo — mapa de contexto mínimo para agentes

Este documento **no es una lista de lectura obligatoria**. Es una tabla de enrutamiento: usa la fila del área afectada, abre primero las implementaciones y pruebas, y consulta el ADR/ficha solo si afecta a un contrato, decisión o compatibilidad. Las reglas viven en `../../AGENTS.md` y, para núcleos, `../../cores/AGENTS.md`.

| Trabajo | Empezar por | Pruebas y contexto a demanda |
|---|---|---|
| Pantalla inicial, navegación y estilo | `apps/web/src/App.svelte`, `Player.svelte`, `theme.css` | `tests/e2e/ui.spec.ts`, `pad-navigation.spec.ts`; `docs/DESIGN.md` |
| Controles, teclado, mando, foco | `packages/input/src/` (`ui-navigation.ts` para menús), `apps/web/src/ControlsPanel.svelte`, `game-capture.ts`, `pad-navigation.svelte.ts`, `input-mode.svelte.ts` y el modo consola (`PauseMenu`, `PadHints`, `InterfacePreference`) | `tests/{input,capture,ui-navigation}.test.ts`, `tests/e2e/{input,controls-page,pad-navigation}.spec.ts`; ADR-006 |
| Protocolo/sesión/Worker | `packages/runtime/src/protocol.ts`, `client.ts`, `systems.ts`; `apps/web/src/emulator.worker.ts` | `tests/{client,systems,core-conformance}.test.ts`; ADR-002 |
| ROM, adaptador o consola | `packages/adapters/src/{contract,registry,wasm-host}.ts`, adaptador concreto; `cores/AGENTS.md` | `docs/ADDING_A_SYSTEM.md`, `docs/research/`, ADR del núcleo, `tests/{core-conformance,wasm-host}.test.ts`, `tests/e2e/{nes,gb,gba,snes,sega}.spec.ts` |
| SRAM, Partidas, biblioteca | `packages/storage/src/`, `apps/web/src/{SavePanel,LibraryPage,RecentGames,ContinueCard}.svelte` | `tests/{storage,snapshots,library,state-file,background-commit,persistence}.test.ts`, `tests/e2e/{saves,storage,library,integrity,faults}.spec.ts`; ADR-003/009/012 |
| Gráficos, audio, ritmo | `packages/media/src/`, `apps/web/src/{GraphicsPanel,GameStage}.svelte`, `audio.worklet.ts`, `sound.svelte.ts` | `tests/{display-scaler,frame-pacer}.test.ts`, `tests/e2e/nes.spec.ts`; `docs/DESIGN.md` |
| PWA, caché, modo offline | `tools/pwa-plugin.mjs`, `apps/web/src/pwa.svelte.ts`, `offline-cache.ts`, `apps/web/vite.config.ts` | `tests/pwa.test.ts`, `tests/e2e/{pwa,subpath}.spec.ts`; `docs/compatibility/H1-C-PWA.md` |
| CI y toolchains | `.github/workflows/ci.yml`, `.github/actions/setup/action.yml`, `tools/verify-*.mjs` | `package.json`, `docs/ADDING_A_SYSTEM.md`, `cores/AGENTS.md` si afecta builds |

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
