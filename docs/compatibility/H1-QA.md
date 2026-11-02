# H1 — Matriz de QA (todos los sistemas, PWA y entrada)

Actualizado: 2026-11-02. Lo automático se ejecuta en GitHub Actions (Node 24; Chromium, Firefox y WebKit de Playwright, en dev y en preview). Lo manual solo cuenta cuando alguien lo ha hecho en hardware real, y entonces se anota quién, con qué y cuándo. Cerrar H1 solo depende ya de la sección **Manual**.

## Automático (CI, workflow `ci`)

Cada push con código (los cambios solo de documentación se omiten) pasa `pnpm verify:core`, `lint`, `check`, `test`, `build`, `test:e2e` (dev, 127.0.0.1:5173) y `test:e2e:preview` (build de producción, 4173). El SHA final y su resultado se anotan en la descripción de la PR. `core-tetanes` no forma parte de esta verificación: solo se ejecuta a petición al cambiar el núcleo ([ADR-008](../adr/008-nes-tetanes-wasm.md)).

| Área | Prueba | Dónde |
|---|---|---|
| Integridad de partidas | 100 ciclos abrir → jugar → guardar → cerrar alternando TetaNES y JSNES: la SRAM sobrevive, la instantánea de otro núcleo se rechaza, sin Workers huérfanos | `tests/e2e/integrity.spec.ts` (dev) |
| Partidas dañadas o de otra versión | Se rechazan con mensaje y el registro se conserva | `integrity.spec.ts`, `tests/storage.test.ts` |
| Sin Web Locks | SRAM y Partidas se niegan a abrir (`StorageUnavailable`, nunca modo multipestaña inseguro) y el juego arranca igual sin guardar: aviso en el inicio y en el reproductor, Partidas desactivado, F5 explica y se sale limpio | `tests/storage.test.ts`, `tests/e2e/storage.spec.ts` |
| Sin OPFS (ventana privada) | Aviso en el inicio; no se pregunta por recordar; Partidas sigue guardando. **CI sobre `e00ef13`** (run 41547120110): en verde en las siete tandas | `tests/persistence.test.ts`, `tests/e2e/storage.spec.ts` |
| Exportar e importar Partidas | Ida y vuelta exacta con y sin miniatura; rechazo de otro juego, otra versión, checksum, tamaño y formato; otro núcleo aceptado. E2E: exportar ranura 1 → sustituir pide confirmación → borrar → importar → cargar; archivo de otro juego rechazado sin tocar la ranura. **CI sobre `a8e0579`** (run 41453068889): 73 superadas en dev y 73 en preview | `tests/state-file.test.ts`, `tests/e2e/saves.spec.ts` |
| SRAM sin frenar la imagen | El commit periódico no bloquea `advance` (un commit de 500 ms no retrasa el tick), sin escrituras solapadas, resultado entregado una vez, reintento tras fallo, `settle` antes de pausa, Partidas, reinicio e importar. **CI sobre `de4d385`** (run 41466198664): 73 superadas en Chromium y 73 en Firefox, en dev y en preview | `tests/background-commit.test.ts`; E2E de SRAM de cada sistema e `integrity.spec.ts` |
| Ciclo de vida | Cancelar «Cargar ROM» mantiene la partida; ocultar la pestaña pausa y guarda «Al salir»; 5 ciclos F5 + Salir sin Workers huérfanos | `tests/e2e/saves.spec.ts` |
| Núcleos | Conformidad de todo módulo registrado (arranque, imagen, entrada, audio, SRAM, instantáneas, `dispose`) | `tests/core-conformance.test.ts` |
| Registros | UI ↔ Worker (ids, versiones, vídeo), manifest ↔ `systems.ts`, sin ids de sistema escritos a mano en la interfaz | `tests/systems.test.ts` |
| PWA | Manifiesto, SW sin `skipWaiting` automático, precache estable, offline tras recarga | `tests/pwa.test.ts`, `tests/e2e/pwa.spec.ts` |
| Firefox | La suite E2E completa también en Firefox, en dev y en preview (matriz paralela `e2e` de `ci.yml`), con salida de audio virtual (PulseAudio con sumidero nulo: Firefox necesita un servidor de sonido en Linux). Ninguna prueba se omite por ser Firefox. **CI sobre `352382c`** (run 41455858387): 73 superadas en dev y 73 en preview, igual que en Chromium | `playwright.config.ts` (proyecto `firefox`), matriz `e2e` de `ci.yml` |
| WebKit (motor de Safari) | La suite E2E en el WebKit de Playwright para Linux, en dev y en preview, con pantalla virtual (`xvfb-run --headed`: sin pantalla, WebKit dispara `requestAnimationFrame` unas 2 veces por segundo). Destapó y se corrigieron dos fallos que también afectaban a Safari: el Worker se reevaluaba al cargar un núcleo en un chunk dinámico (ahora es un solo archivo) y una parada puntual del primer fotograma pausaba el juego (ahora `FramePacer` la absorbe). **Omitida en WebKit:** `library.spec.ts`, porque el perfil efímero de Playwright no ofrece OPFS, como una ventana privada de Safari. **CI sobre `cd547cd`** (run 41540097684): 67 y 68 superadas, 8 y 7 omitidas por diseño | `playwright.config.ts` (proyecto `webkit`), matriz `e2e` de `ci.yml` |
| Subruta | La build con `--base /cartivo/` funciona bajo esa ruta: demo, manifest relativo (`start_url` y `scope` en `/cartivo/`), licencias, logo, SW con ámbito `/cartivo/`, juego sin conexión y ninguna petición fuera de la subruta. **CI sobre `0c58e14`** (run 41544269746): en verde, como las seis tandas de navegador | `tests/e2e/subpath.spec.ts`, `playwright.subpath.config.ts`; `tests/systems.test.ts` (licencias relativas y existentes) |
| Entrada | Teclado, mando sintético, remapeo, neutralización | `tests/input.test.ts`, E2E de controles |

## Manual

| Prueba | Resultado | Fuente |
|---|---|---|
| PWA instalada en local y jugando | Hecho | Titular, durante la PR #2 (navegador y versión sin registrar) |
| Contra (USA), TetaNES: guardar y cargar Partida | Hecho | Titular, durante la PR #2 (ROM propia, solo local) |
| Brave/Chromium escritorio: teclado (flechas/WASD, Q/Enter/L/K), Focus, pantalla completa, escalado 16:9/16:10/HiDPI | Pendiente | — |
| Firefox escritorio real (pestaña, offline, audio en altavoces, mando) | Pendiente; las E2E automáticas ya pasan en Firefox headless | — |
| Safari macOS, iOS/iPadOS (añadir a inicio, offline, biblioteca con OPFS) | Pendiente, **prioridad baja** (decisión del titular); las E2E automáticas ya pasan en WebKit | — |
| Android Chrome: instalación, suspensión, presión de almacenamiento | Pendiente | — |
| Mando real USB/Bluetooth (Xbox/PlayStation): conexión, remapeo, navegación, pausa | Pendiente | [GAMEPAD_BROWSER_QA](../research/GAMEPAD_BROWSER_QA.md) |
| Audio en altavoces reales (latencia, cortes) | Pendiente | — |
| «Abrir con Cartivo» desde el explorador de archivos | Pendiente | — |
| Actualización retenida con partida abierta | Pendiente | — |
| Lector de pantalla y `prefers-reduced-motion` | Pendiente | — |

Pasos detallados: [H1-B-NES](H1-B-NES.md#qa-manual-pendiente), [H1-C-PWA](H1-C-PWA.md#validación-manual-pendiente-qa-real) y [H1-B-INPUT](H1-B-INPUT.md).
