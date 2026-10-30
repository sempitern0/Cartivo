# ADR-002 — Adaptadores y runtime de sesión

Estado: propuesto. Fecha: 2026-10-30.

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
