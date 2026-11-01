# H1 — Matriz de QA (NES, PWA y entrada)

Fecha: 2026-11-01. Estado de verificación de la base NES antes de fusionar la PR #2. Lo automático se ejecuta en GitHub Actions (Node 24, Chromium headless de Playwright); lo manual solo cuenta cuando alguien lo ha hecho en hardware real, y entonces se anota quién, con qué y cuándo.

## Automático (CI, workflow `ci` y `core-tetanes`)

Cada commit de la rama pasa `pnpm verify:core`, `lint`, `check`, `test`, `build`, `test:e2e` (dev, 127.0.0.1:5173) y `test:e2e:preview` (build de producción, 4173). El SHA final y su resultado se anotan en la descripción de la PR.

| Área | Prueba | Dónde |
|---|---|---|
| Integridad de partidas | 100 ciclos abrir → jugar → guardar → cerrar alternando TetaNES y JSNES: la SRAM sobrevive, la instantánea de otro núcleo se rechaza, sin Workers huérfanos | `tests/e2e/integrity.spec.ts` (dev) |
| Partidas dañadas o de otra versión | Se rechazan con mensaje y el registro se conserva | `integrity.spec.ts`, `tests/storage.test.ts` |
| Sin Web Locks | SRAM y Partidas se niegan a abrir (nunca modo multipestaña inseguro) | `tests/storage.test.ts` |
| Ciclo de vida | Cancelar «Cargar ROM» mantiene la partida; ocultar la pestaña pausa y guarda «Al salir»; 5 ciclos F5 + Salir sin Workers huérfanos | `tests/e2e/saves.spec.ts` |
| Núcleos | Conformidad de todo módulo registrado (arranque, imagen, entrada, audio, SRAM, instantáneas, `dispose`) | `tests/core-conformance.test.ts` |
| Registros | UI ↔ Worker (ids, versiones, vídeo), manifest ↔ `systems.ts`, sin ids de sistema escritos a mano en la interfaz | `tests/systems.test.ts` |
| PWA | Manifiesto, SW sin `skipWaiting` automático, precache estable, offline tras recarga | `tests/pwa.test.ts`, `tests/e2e/pwa.spec.ts` |
| Entrada | Teclado, mando sintético, remapeo, neutralización | `tests/input.test.ts`, E2E de controles |

## Manual

| Prueba | Resultado | Fuente |
|---|---|---|
| PWA instalada en local y jugando | Hecho | Titular, durante la PR #2 (navegador y versión sin registrar) |
| Contra (USA), TetaNES: guardar y cargar Partida | Hecho | Titular, durante la PR #2 (ROM propia, solo local) |
| Brave/Chromium escritorio: teclado (flechas/WASD, Q/Enter/L/K), Focus, pantalla completa, escalado 16:9/16:10/HiDPI | Pendiente | — |
| Firefox escritorio (pestaña, offline) | Pendiente | — |
| Safari macOS, iOS/iPadOS (añadir a inicio, offline) | Pendiente | — |
| Android Chrome: instalación, suspensión, presión de almacenamiento | Pendiente | — |
| Mando real USB/Bluetooth (Xbox/PlayStation): conexión, remapeo, navegación, pausa | Pendiente | [GAMEPAD_BROWSER_QA](../research/GAMEPAD_BROWSER_QA.md) |
| Audio en altavoces reales (latencia, cortes) | Pendiente | — |
| «Abrir con Cartivo» desde el explorador de archivos | Pendiente | — |
| Actualización retenida con partida abierta | Pendiente | — |
| Lector de pantalla y `prefers-reduced-motion` | Pendiente | — |

Pasos detallados: [H1-B-NES](H1-B-NES.md#qa-manual-pendiente), [H1-C-PWA](H1-C-PWA.md#validación-manual-pendiente-qa-real) y [H1-B-INPUT](H1-B-INPUT.md).
