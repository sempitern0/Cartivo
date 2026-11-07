# N64 — laboratorio aislado

Estado: **preflight y prueba de corutinas; todavía no ejecuta juegos**. Base de trabajo: `62dc1c749f40c478bbdcd585083baa4117263803`. Rama: `feat/n64-gpu-prototype`.

No se importa desde la aplicación, no registra N64 en producción y no incorpora assets al Service Worker. No modifica PS1, Player, perfiles, ownership del mando ni protocolo de producción. La PR #35 estaba abierta al iniciar este incremento (2026-11-07): volver a revisar sus cambios antes de integrar piezas comunes.

## Ejecutar desde la raíz

Usar las versiones de Node/pnpm declaradas en el repositorio y sus dependencias instaladas.

```sh
pnpm exec vite experiments/n64 --host 127.0.0.1
```

El diagnóstico transfiere un canvas a un Worker, crea WebGL2 y comprueba una escritura/lectura del framebuffer. Lee solo 64 bytes de la ROM seleccionada y reconoce el orden de bytes de z64/v64/n64. **No verifica CRC, arranque ni compatibilidad.** El límite de 64 MiB es del prototipo, no una afirmación sobre todos los cartuchos posibles. No normaliza/copia el archivo completo, no lo persiste y no hace solicitudes con datos del usuario.

La prueba de mando es voluntaria, analógica y de solo lectura. Admite mapeo estándar; limpia la entrada al desconectar y se detiene al perder foco/visibilidad. No es el futuro remapeador ni maneja el foco. Los ejes Y mantienen el signo de Gamepad API; convertirlo explícitamente al contrato del núcleo al integrarlo.

Cada diagnóstico tiene Worker propio, límite de diez segundos, cancelación y descarte de respuestas antiguas. El contexto gráfico se libera al acabar. El tiempo mostrado es **duración del diagnóstico**, no arranque de un juego ni latencia GPU.

## Comprobaciones rápidas y navegador

```sh
node --experimental-strip-types --test tests/n64-prototype.test.ts
pnpm exec tsc --project experiments/n64/tsconfig.json
pnpm exec prettier --check "experiments/n64/*.{ts,mjs,html,json,md}" tests/n64-prototype.test.ts
pnpm exec vite build experiments/n64
pnpm exec playwright test --config experiments/n64/playwright.config.ts
N64_PREVIEW=1 pnpm exec playwright test --config experiments/n64/playwright.config.ts
```

`N64_PREVIEW=1` es sintaxis Bash; en PowerShell usar `$env:N64_PREVIEW='1'` antes del comando. `CARTIVO_CHROMIUM_PATH` permite indicar un Chromium instalado. Las tres pruebas E2E cubren Worker real/cabecera, rechazo y recuperación, cancelación. Registran capacidades: si el host deniega WebGL2, verifican el diagnóstico de error y **no** lo cuentan como soporte GPU demostrado.

Las siete unitarias entran en el glob habitual de `pnpm test`. El build del laboratorio, sus tipos y E2E se ejecutan explícitamente; no se ha añadido otro job ni una matriz a CI. La aplicación de producción mantiene su build intacta.

## Microprueba de corutinas, sin compilar el núcleo

```sh
# Instalar/activar Emscripten 6.0.12 fuera del repositorio.
node experiments/n64/check-fibers.mjs
# Si emcc no está en PATH:
EMCC=/ruta/emsdk/upstream/emscripten/emcc node experiments/n64/check-fibers.mjs
```

La receta exige 6.0.12 y compila únicamente el puente original `fibers/cooperative.c` y `fibers/smoke.c`. Implementa las cuatro entradas libco con fibers/Asyncify, **sin pthreads ni SharedArrayBuffer**. Genera `.build/fiber-smoke.cjs`, WASM y evidencia local ignorada por Git. Nunca se llama desde CI normal.

Prueba 100 ciclos de crear/destruir una fibra con pila C de 4 MiB, 100 cesiones por ciclo, preservación de variables locales y heap WASM estable tras calentamiento. Esto no mide el coste de Asyncify en el núcleo real, profundidad de pila de N64, audio, WebGL ni recuperación de una partida. El tamaño de pila Asyncify de 64 KiB es provisional y debe medirse con el núcleo. El puente es monohilo y sus contextos no son compartibles; una entrada debe ceder, no retornar.

## Estado de relevo

- Fase 0 completada: main comprobado, rama separada y PR #35 sin tocar.
- Fase 1 en curso: upstream y toolchain fijados para investigación; expediente en [N64_CORE_GATE.md](../../docs/research/N64_CORE_GATE.md). Gate del **núcleo completo pendiente**.
- Fase 2 parcial: preflight real y microprueba ejecutable. **No hay build N64, host libretro gráfico, audio ni ROM jugable.**
- Verificación registrada: [N64_CORE_GATE.md](../../docs/research/N64_CORE_GATE.md#verificación-de-este-incremento).
- Siguiente paso: incorporar este puente en un build local deliberado del candidato, con GLES3 y renderizador sin hilos, resolver imports/glue y el frontend libretro. Antes, completar inventario de fuentes/licencias del artefacto. No agregarlo a `cores/` ni producir manifiestos de un núcleo que todavía no compila.
- Después: fixture N64 original con oráculo, sesión de vídeo/audio/entrada, mediciones sostenidas y decisión go/no-go. Solo entonces extender el contrato GPU y la entrada de Cartivo, tras revisar la PR #35 o su sucesora.
- Publicación: agrupar cambios en un commit de rama. No abrir PR automáticamente para lanzar CI durante el spike; no modificar `.build-request` ni workflows.
