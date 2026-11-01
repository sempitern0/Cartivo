# PR #2 — Traspaso operativo para agente de IA antes del merge

**Propósito:** permitir que un agente retome y mejore de forma autónoma la PR #2 sin alterar sus funcionalidades ni ampliar indebidamente el alcance. Este archivo es un **plan de ejecución**, no prueba de que sus tareas estén realizadas.

**Repositorio:** `sempitern0/Cartivo` (privado)
**PR:** https://github.com/sempitern0/Cartivo/pull/2
**Rama de trabajo obligatoria:** `feat/h1-session-foundation`
**Base:** `main`
**Referencia auditada:** `25975eeb49b72990549ae3e8652fab981ec211c8` (2026-11-01). **Refrescar HEAD, diff y checks antes de modificar cualquier archivo:** la rama puede avanzar.
**Estado al revisar:** abierta, no fusionada, marcada como lista para revisión. `Foundation CI` y `Core TetaNES` estaban verdes para el commit auditado. **No cambiar el estado de la PR ni fusionarla sin instrucción explícita del propietario.**

## 0. Mandato ejecutivo

**Objetivo del incremento:** convertir H1 en una base NES sólida, mantenible y *realmente extensible* antes de mergear; preservar la experiencia minimalista, la compatibilidad de las partidas y la PWA. La siguiente consola (preferentemente GB/GBC) se implementará **después**, en otro incremento, como prueba real de extensibilidad.

**Prioridades, por este orden:**

1. **P0 — No perder progreso:** pruebas de guardados y errores, protección de SRAM/instantáneas, lifecycle, cierre/cambio de ROM, Web Locks, entrada neutral, audio, PWA offline.
2. **P1 — Separar responsabilidades:** reducir `Player.svelte` (~1482 líneas) y `ControlsPanel.svelte` (~945) mediante extracciones incrementales y pruebas por commit; no una reescritura masiva.
3. **P1 — Consolidar el contrato multiconsola:** aislar supuestos NES que contaminarían la siguiente integración, pero **sin ampliar el protocolo v1 o añadir abstracciones no utilizadas**.
4. **P2 — Optimizar entrega de núcleos:** estudiar carga diferida y política de caché, implementar únicamente con evidencia de bundle/arranque y pruebas de offline.
5. **P0 — Cierre:** CI verde para el último SHA, matriz de QA reportada con evidencia, informe final de riesgos; preparar la PR para revisión del propietario **sin merge**.

No valorar la calidad por líneas modificadas ni por añadir características nuevas. **Priorizar menos código acoplado y más garantías sobre el comportamiento existente.**

## 1. Lecturas obligatorias (en este orden)

1. `AGENTS.md`, `CLAUDE.md` si aplica, `README.md`.
2. `docs/PLAN_TECNICO_CARTIVO.md`, `docs/ADDING_A_SYSTEM.md`, `docs/DESIGN.md`.
3. `docs/adr/002-core-runtime.md`, `005-licensing.md`, `008-nes-tetanes-wasm.md`, `009-save-states.md`.
4. `packages/adapters/src/contract.ts`, `registry.ts`, `tetanes.ts`, `jsnes.ts`.
5. `packages/runtime/src/systems.ts`, `protocol.ts`, `client.ts`; `apps/web/src/emulator.worker.ts`.
6. `packages/input/src/nes-input.ts`, `preferences.ts`; `packages/storage/src/sram.ts`, `states.ts`.
7. `apps/web/src/Player.svelte`, `ControlsPanel.svelte`, `App.svelte`, `GameStage.svelte`, `pwa.svelte.ts`, `tools/pwa-plugin.mjs`.
8. `tests/core-conformance.test.ts`, `tests/systems.test.ts`, `tests/e2e/{nes,input,saves,pwa,ui}.spec.ts`.

Antes de actuar: `git status`, `git fetch`, verificar el HEAD de la PR y los checks del último SHA, examinar cambios no confirmados, ejecutar el baseline. No sobrescribir trabajo paralelo. No modificar `main` ni abrir otra PR para esta labor.

## 2. Arquitectura existente que SE DEBE preservar

```text
App.svelte / Player UI / ControlsPanel
  → systems.ts (catálogo: ids, aspectos, archivos, núcleos disponibles)
  → EmulatorClient (id, sesión, secuencia, timeout, validación)
  → emulator.worker.ts (una sesión y un núcleo)
  → registry.ts / CoreModule
  → TetanesAdapter | NesAdapter → CPU/PPU/APU
             ↘ StateStore y SramStore (IndexedDB/Web Locks)
        GameStage ↔ display-scaler / preferencias por sistema
        audio ↔ AudioWorklet
        PWA ↔ Service Worker (actualización segura)
```

**Hechos auditados:** NES cuenta con TetaNES 0.17.0 WASM como núcleo por defecto y JSNES 2.1.0 como alternativa; `EmulatorCore` incluye `input/advance/save/snapshot/restore/lastFrame/dispose`; `CoreModule` declara `system/id/version/video/sramBytes/validate/demo/prepare/create`. `tests/core-conformance.test.ts` somete a ambos a un contrato común. `systems.ts` (UI) y `registry.ts` (Worker) están separados y `tests/systems.test.ts` compara sus metadatos. La PWA precarga activos y difiere actualizaciones mientras se juega.

**Invariantes de no regresión:**
- Una ROM seleccionada se inicia sin segundo clic «Jugar»; shell minimalista y control accesible.
- NES admite WASD/flechas, L=A, K=B, Q=Select y Enter=Start; remapeos persistidos y compatibilidad con perfiles anteriores; foco no captura botones del menú.
- Focus, fullscreen, pausa y ajustes gráficos no recrean la sesión, pierden el foco ni borran el framebuffer.
- Guardados SRAM de dos generaciones y snapshot «Al salir» + ranuras 1–3: la operación confirma escritura o comunica fallo sin perder silenciosamente datos.
- La instantánea se valida por ROM, núcleo, **versión** y hash. No falsificar compatibilidad entre JSNES y TetaNES.
- `dispose` de WASM, cierre Worker, audio y liberación de locks; una sola pestaña escribe por juego.
- El Worker/GUI no incorpora archivos del usuario en red; ninguna BIOS, ROM comercial ni arte protegido nuevo en git.
- Actualización SW nunca interrumpe juego en curso ni elimina IndexedDB. No convertir los errores de guardado en simples notificaciones autodescartables.

## 3. Plan de ejecución con gates

### Etapa A — Baseline y riesgos de H1 (P0; primero)

**Acciones**
- Registrar HEAD, resultados de CI, tamaño de build/caché, y resultados de pruebas reproducibles. No inferir QA manual de Chromium headless.
- Añadir/fortalecer pruebas de **100 ciclos** sobre fixtures propias: abrir → avanzar → guardar SRAM/instantánea → cerrar → reabrir → verificar integridad; incluir cambios de núcleo donde sean válidos. Inyectar fallo de escritura/corrupción y verificar recuperación o error explícito. Evitar una prueba inestable que dependa de `sleep` arbitrario.
- Cubrir cerrar/cambiar ROM durante un guardado, cancelar selección de archivo, pestaña oculta, foco perdido, desconexión de gamepad, reset, restaurar ranura y versión de snapshot incompatible.
- Verificar métricas mínimas de Workers/listeners/buffers tras ciclos, con umbrales razonables y evidencia; no afirmar ausencia de fugas solo porque el GC no haya liberado memoria inmediatamente.
- Revisar que el flujo de `StateStore.open()` con Web Locks tenga un comportamiento explícito cuando la API no exista. No inventar una alternativa multi-pestaña insegura.

**Aceptación:** suite estable con fixture original, checksum/locks verificados y ningún camino nuevo de pérdida silenciosa de partidas. Anotar qué queda solo para QA manual.

### Etapa B — Refactor progresivo del reproductor (P1)

El tamaño actual de `Player.svelte` es una señal de acoplamiento, no una razón para sustituirlo entero. Extraer **una frontera por commit**, empezando por presentación:
1. `PlayerToolbar.svelte`: cabecera compacta, botones, estado Focus, acciones accesibles. **Sin iniciar Workers ni escribir partidas.**
2. `GraphicsPanel.svelte`: selector de escala/aspecto/suavizado; recibe valores y callbacks. `GameStage` sigue controlando canvas y resize.
3. `SavePanel.svelte`: ranuras, miniaturas, confirmaciones, mensajes; recibe estado y operaciones de su coordinador. Mantener tamaños/formatos existentes.
4. `InputCapture` (módulo TS o clase con consumidor real): `keydown/keyup`, foco, teclado, gamepad, neutralización, scope y teardown. Consola recibe `InputState`; **UI conserva Tab, Escape y controles accesibles**.
5. Solo después, y si tests lo justifican, extraer un `EmulatorSession`/controlador que gestione RAF, Worker/audio y lifecycle; `Player.svelte` queda como composición de pantalla.

Para `ControlsPanel.svelte`, separar **vista de teclado/gamepad** de escaneo y remapeo, reutilizando el módulo de captura donde corresponda; mantener su laboratorio y perfiles funcionando.

**Cada extracción:** commit específico, sin cambios visuales innecesarios, pruebas existentes pasando, sin duplicar Worker o listeners, con destrucción/restauración de estado comprobadas. Evitar Svelte stores o paquetes nuevos sin consumidor y dependencia explícitos.

**Aceptación:** componentes de UI no importan `NesAdapter`, `TetanesAdapter`, ABI WASM ni internals de SRAM. Coordinador no manipula CSS, SVG o markup de paneles. No imponer una cifra artificial de líneas como único criterio de éxito.

### Etapa C — Preparación **realista** para otra consola 2D (P1/P2)

No integrar otra consola en PR #2. Documentar y mitigar solo los bloqueos **demostrados** para la siguiente:

| Límite observado | Trabajo premerge permitido | Expansión posmerge |
|---|---|---|
| `InputState` y `nes-input.ts` expresan los ocho botones NES/P1 | Identificar fronteras, desacoplar la UI de la lista rígida donde tenga consumidor real y mantener adaptador NES sin ruptura | Descriptor de acciones por sistema, L/R y X/Y/C, P1–P4 y perfiles/migraciones versionados |
| `Player.svelte` aún conoce formato NES de backup y pistas `256×240` | Quitar textos/constantes de la UI que deban venir de `SystemInfo`; conservar el formato de backup NES existente | Políticas de backup por sistema y formatos con versionado |
| `Player.svelte` calcula a 60 Hz | Incorporar capacidad de timing declarada solo si se prueba y consume, sin alterar emulación NES | PAL/variantes, cadencias por núcleo y sincronización A/V |
| `GameStage` y `CoreModule.video` usan tamaño fijo | Mantener descriptor de presentación por sistema y verificar fallback; documentar cambios dinámicos futuros | Framebuffer variable, backend WebGL/GPU específico para 3D |
| `StateStore` tiene topes/previews y mensaje de núcleos NES | Hacer texto de error genérico/derivado de metadatos **sin migrar ni borrar estados**; testear compatibilidad | Cuotas y previews por sistema/portátil, snapshots 3D más grandes |
| Registros/UI + Worker | Añadir pruebas que eviten desincronía entre versiones, capacidades y extensiones | Nuevo `CoreModule` GB/GBC en otra PR |

**Criterio de prueba de extensibilidad:** especificar qué archivos deberían tocarse al añadir GB/GBC; demostrar por tests/mocks que `PlayerToolbar`, `SavePanel` y `App` no necesitan condicionales exclusivos para otra consola. No crear un adaptador falso publicado como compatible.

### Etapa D — Carga diferida y PWA offline (P2, condicionada a medición)

**Auditoría antes de editar:** `packages/adapters/src/registry.ts` importa TetaNES/JSNES estáticamente y `tools/pwa-plugin.mjs` precarga activos del build. Obtener tamaños por chunk, JS inicial, WASM, total shell, tiempo de arranque y caché en dev/preview.

Si la medición justifica un cambio, implementar carga diferida por `system/core` **dentro del Worker** sin exponer núcleos al hilo UI, y clasificar recursos PWA en shell crítico y núcleos instalados/opcionales. Un núcleo requerido para jugar offline debe estar disponible una vez preparado; no introducir descargas silenciosas ni invalidar partidas al actualizar.

**Aceptación si se implementa:** JS inicial y bytes precargados documentados antes/después; arrancan ambos núcleos; JSNES fallback; integridad manifest/CI; modo offline después de instalación y recarga; no descarga un núcleo que el usuario no seleccionó salvo política explícita. Si falta evidencia o el cambio aumenta el riesgo de merge, documentar el estudio y **posponer** la modificación.

### Etapa E — QA de navegadores, hardware y revisión final (P0)

**Automático en cada incremento afectado**
```bash
pnpm install --frozen-lockfile
pnpm verify:core
pnpm lint
pnpm check
pnpm test
pnpm build
pnpm test:e2e
pnpm test:e2e:preview
```

Requisitos actuales: Node `>=24.22.1 <25`, pnpm `11.25.0`. Si el entorno no soporta la ejecución, **no informar de tests como superados**. Inspeccionar GitHub Actions sobre el SHA final, no sobre un commit antiguo.

**Matriz QA manual con resultados visibles, NO inventados:**
- Brave/Chromium y Firefox en escritorio; Safari/macOS e iOS si se dispone de ellos. Documentar versiones y lo que no se pudo ejecutar.
- Teclado: WASD/flechas equivalentes en pantalla de menú y juego; Q/Enter/L/K, Focus/pausa, reanudar, remapeo y `ShiftRight` heredado; interacciones con menús sin robo de foco.
- Mando real USB/Bluetooth, al menos perfil Xbox/PlayStation cuando haya hardware; conectar/desconectar, remapeo, navegación por interfaz y pausa.
- TetaNES y JSNES con fixture original; una ROM aportada legalmente por propietario **solo para prueba local**, nunca commit, almacenamiento remoto ni distribución. Prueba real de Contra (USA) si el titular la proporciona y permite usarla localmente; seleccionar 1/2 jugadores, Start, movimiento, reset y estados.
- PWA instalada: arranque offline, guardados, cambio de ROM, actualización retenida mientras hay partida; revisar móviles y presión de almacenamiento cuando sea posible.
- Focus/fullscreen y escalado en 16:9, 16:10, HiDPI y tamaños móviles; `prefers-reduced-motion`, teclado y lector de pantalla.

**Criterio de cierre**: workflows verdes en el último commit; ninguna regresión crítica; QA manual registrada con resultados reales o marcada pendiente; documentos README/CHANGELOG/compatibilidad/ADRs congruentes; el propietario recibe un resumen con recomendación concreta de merge/no merge y riesgos. **El agente nunca ejecuta merge ni cambia licencias/visibilidad por cuenta propia.**

## 4. Lo que queda explícitamente FUERA de PR #2

- Añadir GB/GBC, GBA, SNES, SMS/Mega Drive, N64, PS1, PSP o Play! PS2.
- Implementar un renderer 3D/GPU, WebGPU, PSP/PS1, JIT, hilos WASM o cambio universal de resolución.
- OPFS con biblioteca de ROMs, proveedores de carátulas o descargas de firmware/ROMs.
- Rediseñar visualmente toda la UI otra vez, sustituir Svelte, o añadir una plataforma de plugins vacía.
- Cambiar PolyForm Noncommercial o publicar distribuciones con núcleos sin nueva evaluación de ADR-005.

**Prueba posterior al merge recomendada:** GB/GBC con su propio CoreModule, fixture libre, registros y conformidad. Si para GB hay que editar `Player.svelte` con numerosos `if (system === "gb")`, la separación todavía es insuficiente.

## 5. Formato obligatorio de avance y entrega

Para cada etapa informar:
1. **Commit(s)/archivos modificados** y frontera arquitectónica corregida.
2. **Pruebas ejecutadas** (comando, ambiente, resultado real) y links a workflows cuando existan.
3. **Riesgos/compatibilidad**: ROM, SRAM, snapshots, foco, audio, caché y licencia si corresponde.
4. **Siguiente paso** según P0/P1/P2; no saltar gates ni ocultar problemas.
5. **Bloqueos para el titular** exclusivamente cuando haga falta hardware real, una decisión de producto/licencia o datos que no pueda obtener el agente.

**Primera acción concreta:** abrir los tests de partidas y `Player.svelte`, fijar el baseline de CI, implementar la prueba reproducible de estrés/errores y luego extraer `PlayerToolbar.svelte` sin cambio de comportamiento. Continuar hasta cerrar las etapas aplicables en la misma PR #2; no detenerse tras escribir un plan ni declarar «listo para merge» sin evidencia.
