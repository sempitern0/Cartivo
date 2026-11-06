# ADR-002 — Adaptadores y runtime de sesión

Estado: **aceptado** (contrato implementado el 2026-11-01). Fecha: 2026-10-30.

## Decisión propuesta

El dominio define identidad, perfil y lifecycle. La UI habla con el gestor de sesión; este selecciona un adaptador por manifiesto aceptado y capacidades efectivas. Adaptadores traducen formatos, input, IO, guardados, opciones y ABI; el núcleo conserva CPU/GPU/audio emulados. Una sesión activa y un módulo Emscripten aislado por sesión.

Preferir Worker y OffscreenCanvas. No exigirlo a ports que no lo soporten: cualquier fallback main-thread debe medirse y declararse. No mover render 3D por un framebuffer CPU universal. Respetar el grafo de audio existente si no puede sustituirse y publicar sus límites.

Protocolo con versión, sesión, request ID, schema, errores, timeout y cancelación. Descartar mensajes tardíos. Transferir buffers acotados y reutilizarlos; memoria compartida solo con build y aislamiento compatibles. Threaded/single-thread y SIMD/no-SIMD son artefactos separados si existen, no flags cosméticos del mismo binario.

Estados y transiciones en la sección 4 del plan. `dispose` idempotente, `stop` con flush confirmado o resultado de fallo explícito. Tras crash iniciar una instancia limpia.

## Criterios de aceptación

- Mock verifica protocolo, transiciones inválidas, cancelación y mensajes de sesión anterior.
- Un núcleo real demuestra input, audio, presentación y recuperación, además de arranque.
- Cien ciclos de abrir/cerrar detectan fugas crecientes de Workers, audio, memoria o GPU; registrar herramientas, límites y resultado, no presumir liberación inmediata del GC.
- Opciones de UI provienen de schema real y capacidades de build/juego. No inventar APIs ni exponer punteros arbitrarios.

## Consecuencias

Cada port requiere trabajo propio. WASM no universaliza gráficos, JIT ni filesystem. El aislamiento técnico no determina independencia legal de componentes.

## Implementación (2026-11-01)

- **Contrato** `packages/adapters/src/contract.ts`: `EmulatorCore` (entrada, frames, SRAM, instantáneas, `dispose`) y `CoreModule` (sistema, versión, vídeo, validación, demo, preparación y creación). Desde ADR-010, el tamaño de la SRAM lo da cada núcleo para su cartucho (`EmulatorCore.saveBytes`) y el ritmo de frames, el sistema (`SystemInfo.frameRate`).
- **Registros:** `packages/adapters/src/registry.ts` (lado Worker, módulos de núcleo) y `packages/runtime/src/systems.ts` (lado UI, sin código de núcleos).
- **Protocolo v1 genérico** `packages/runtime/src/protocol.ts` con `system` y `core`, cliente `EmulatorClient` y un único `apps/web/src/emulator.worker.ts`.
- **Pruebas:** `tests/core-conformance.test.ts` se aplica a cada módulo registrado.
- **Guía:** `docs/ADDING_A_SYSTEM.md`.

Pendiente: acciones de entrada por sistema (L/R, X/Y, C), OffscreenCanvas y renderizado propio para núcleos 3D.

## Revisión: cadencia por juego (2026-11-06)

`EmulatorCore.frameRate` (opcional) es la frecuencia del juego cargado cuando el núcleo la conoce; sin ella se usa la nominal del sistema (`systems.ts`). Los puentes libretro (Snes9x, Genesis Plus GX) exportan `cartivo_frame_rate`, que devuelve `retro_get_system_av_info().timing.fps`: el núcleo decide la región por la cabecera y Cartivo no replica esa regla. `wasm-host.ts` lee el export si existe y lo valida (`isFrameRate`, 30–75 Hz), así que un núcleo sin él sigue funcionando. La respuesta de `load` lleva `frameRate` como campo opcional, compatible con el protocolo v1, y el reproductor ajusta su `FramePacer`. Con esto se admiten los cartuchos PAL de SNES y Mega Drive, que antes se rechazaban.
