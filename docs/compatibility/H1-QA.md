# H1 — Matriz de QA (NES, PWA y entrada)

Fecha: 2026-11-01. Estado de verificación de la base NES antes de fusionar la PR #2. Lo automático se ejecuta en GitHub Actions (Node 24, Chromium headless de Playwright); lo manual solo cuenta cuando alguien lo ha hecho en hardware real, y entonces se anota quién, con qué y cuándo.

## Automático (CI, workflow `ci`)

Cada push con código (los cambios solo de documentación se omiten) pasa `pnpm verify:core`, `lint`, `check`, `test`, `build`, `test:e2e` (dev, 127.0.0.1:5173) y `test:e2e:preview` (build de producción, 4173). El SHA final y su resultado se anotan en la descripción de la PR. `core-tetanes` no forma parte de esta verificación: solo se ejecuta a petición al cambiar el núcleo ([ADR-008](../adr/008-nes-tetanes-wasm.md)).

| Área | Prueba | Dónde |
|---|---|---|
| Integridad de partidas | 100 ciclos abrir → jugar → guardar → cerrar alternando TetaNES y JSNES: la SRAM sobrevive, la instantánea de otro núcleo se rechaza, sin Workers huérfanos | `tests/e2e/integrity.spec.ts` (dev) |
| Partidas dañadas o de otra versión | Se rechazan con mensaje y el registro se conserva | `integrity.spec.ts`, `tests/storage.test.ts` |
| Sin Web Locks | SRAM y Partidas se niegan a abrir (nunca modo multipestaña inseguro) | `tests/storage.test.ts` |
| Exportar e importar Partidas | Ida y vuelta exacta con y sin miniatura; rechazo de otro juego, otra versión, checksum, tamaño y formato; otro núcleo aceptado. E2E: exportar ranura 1 → sustituir pide confirmación → borrar → importar → cargar; archivo de otro juego rechazado sin tocar la ranura. **CI sobre `a8e0579`** (run 41453068889): 73 superadas en dev y 73 en preview | `tests/state-file.test.ts`, `tests/e2e/saves.spec.ts` |
| Ciclo de vida | Cancelar «Cargar ROM» mantiene la partida; ocultar la pestaña pausa y guarda «Al salir»; 5 ciclos F5 + Salir sin Workers huérfanos | `tests/e2e/saves.spec.ts` |
| Núcleos | Conformidad de todo módulo registrado (arranque, imagen, entrada, audio, SRAM, instantáneas, `dispose`) | `tests/core-conformance.test.ts` |
| Registros | UI ↔ Worker (ids, versiones, vídeo), manifest ↔ `systems.ts`, sin ids de sistema escritos a mano en la interfaz | `tests/systems.test.ts` |
| PWA | Manifiesto, SW sin `skipWaiting` automático, precache estable, offline tras recarga | `tests/pwa.test.ts`, `tests/e2e/pwa.spec.ts` |
| Firefox | La suite E2E completa también en Firefox, en dev y en preview, en un job paralelo con salida de audio virtual (PulseAudio con sumidero nulo: Firefox necesita un servidor de sonido en Linux). Ninguna prueba se omite por ser Firefox. **CI sobre `352382c`** (run 41455858387): 73 superadas en dev y 73 en preview, igual que en Chromium | `playwright.config.ts` (proyecto `firefox`), job `e2e-firefox` de `ci.yml` |
| Entrada | Teclado, mando sintético, remapeo, neutralización | `tests/input.test.ts`, E2E de controles |

## Manual

| Prueba | Resultado | Fuente |
|---|---|---|
| PWA instalada en local y jugando | Hecho | Titular, durante la PR #2 (navegador y versión sin registrar) |
| Contra (USA), TetaNES: guardar y cargar Partida | Hecho | Titular, durante la PR #2 (ROM propia, solo local) |
| Brave/Chromium escritorio: teclado (flechas/WASD, Q/Enter/L/K), Focus, pantalla completa, escalado 16:9/16:10/HiDPI | Pendiente | — |
| Firefox escritorio real (pestaña, offline, audio en altavoces, mando) | Pendiente; las E2E automáticas ya pasan en Firefox headless | — |
| Safari macOS, iOS/iPadOS (añadir a inicio, offline) | Pendiente | — |
| Android Chrome: instalación, suspensión, presión de almacenamiento | Pendiente | — |
| Mando real USB/Bluetooth (Xbox/PlayStation): conexión, remapeo, navegación, pausa | Pendiente | [GAMEPAD_BROWSER_QA](../research/GAMEPAD_BROWSER_QA.md) |
| Audio en altavoces reales (latencia, cortes) | Pendiente | — |
| «Abrir con Cartivo» desde el explorador de archivos | Pendiente | — |
| Actualización retenida con partida abierta | Pendiente | — |
| Lector de pantalla y `prefers-reduced-motion` | Pendiente | — |

Pasos detallados: [H1-B-NES](H1-B-NES.md#qa-manual-pendiente), [H1-C-PWA](H1-C-PWA.md#validación-manual-pendiente-qa-real) y [H1-B-INPUT](H1-B-INPUT.md).
