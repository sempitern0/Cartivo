# ADR-023 — Resolución de las consolas 3D: automática para la pantalla del equipo

Estado: aceptado. Fecha: 2026-11-12. Decisión del titular: Cartivo elige la configuración básica (aquí, la resolución) y solo quien quiera la toca.

## Contexto

N64 y PS2 se dibujan con la GPU sobre el lienzo del juego (ADR-017, ADR-022). Hasta ahora lo hacían siempre a la resolución de la consola (640 × 480 y 640 × 448) y la página ampliaba esa imagen. A pantalla completa en un portátil de 1080 líneas eso es ampliar más del doble; además se ampliaba con píxel duro, porque el descriptor `pixelArt: false` de estas consolas no se usaba.

Los emuladores de escritorio dibujan los polígonos a un múltiplo de la resolución original. Los dos núcleos ya lo saben hacer: Play! con su factor de resolución y GLideN64 con su tamaño de pantalla.

La regla general de Cartivo es «fidelidad original por defecto; mejoras desactivadas». Esta decisión es una excepción acotada a esa regla, tomada por el titular.

## Decisión

**1. El núcleo dibuja a un múltiplo entero de la resolución de la consola, de ×1 a ×4** (`MAX_RENDER_SCALE`). Solo en los sistemas con `surface` (N64, PS2). Las consolas 2D y PlayStation (GPU por software) no cambian.

**2. Por defecto es automática** (`packages/runtime/src/render-scale.ts`): el múltiplo **más cercano** a las líneas físicas de la **pantalla** del equipo (`screen.height × devicePixelRatio`), no de la ventana.
- Al pasar a pantalla completa no hay nada que cambiar ni que recargar: el juego ya está dibujado para esa pantalla; en ventana, la imagen se reduce.
- El más cercano y no el siguiente hacia arriba: en 1080 líneas es ×2 (1280 × 960 o 1280 × 896), no ×3, que cuesta más del doble de trabajo de GPU por poca ganancia.

**3. Cartivo la baja sola si el equipo no puede.** Con la resolución en automática y por encima de ×1:
- PS2 (cámara lenta, ADR-022): cinco segundos seguidos por debajo del 85 % de velocidad;
- N64: la pausa por «dispositivo lento».

En ambos casos se recuerda un techo un paso menor para ese sistema en este dispositivo (`cartivo:render-ceiling:<sistema>:v1`) y se avisa de que el juego se verá a menor resolución la próxima vez. Una resolución fijada por el jugador no se toca.

**4. El jugador puede fijarla** en «Ajustes del juego» y en Ajustes › Pantalla: Automática, Original, ×2, ×3 o ×4, junto a las demás opciones de pantalla (`DisplayPreferences.resolution`, por sistema). Las preferencias guardadas antes de existir el campo valen como «Automática».

**5. Se fija al abrir el juego.** El múltiplo viaja en `load` (`scale`, validado en el protocolo) y los módulos de superficie lo reciben en `create`. El adaptador da al lienzo ese tamaño (`useSurface`) y el núcleo lo usa: `cartivo_create(…, scale)` en Play! y `n64_init(scale)` en Mupen64Plus-Next. Un cambio en ajustes se aplica la próxima vez que se abre el juego.

**6. Las miniaturas no cambian de tamaño.** `surfaceFrame` devuelve la imagen a la resolución de la consola, muestreando la superficie; Partidas y «Continuar» siguen igual.

**7. Las consolas 3D se amplían siempre con suavizado** (`GameStage`): el interruptor «Suavizado» es para el pixel art y no se muestra en ellas.

## Alternativas descartadas

- **Dejarlo desactivado por defecto**, como las demás mejoras: es lo que había, y el resultado a pantalla completa era el motivo de la petición.
- **Cambiar la resolución al entrar y salir de pantalla completa:** Play! lo admite en caliente, GLideN64 no; exige recrear framebuffers a mitad de juego y dos caminos distintos. Dibujar para la pantalla desde el principio lo evita.
- **Múltiplos no enteros** (×1,5): GLideN64 lo ofrece, Play! no; y las miniaturas dejarían de ser un muestreo exacto.
- **Medir la GPU antes de elegir:** no hay una medida fiable desde el navegador; se corrige con el uso (punto 3).

## Consecuencias y límites

- **Más trabajo de GPU y memoria de vídeo:** ×2 son cuatro veces los píxeles. En un equipo modesto la primera partida puede ir lenta hasta que Cartivo baja el techo; el aviso lo explica.
- **Solo los polígonos ganan resolución.** Las texturas, los fondos 2D y los vídeos del juego siguen siendo los originales, ampliados.
- **No arregla fallos del núcleo:** los errores gráficos de Play! (ADR-022) son los mismos a cualquier resolución, y algún juego puede mostrar costuras que a ×1 no se ven. «Original» está a un ajuste.
- **El techo solo baja.** Para volver a subir, el jugador elige un múltiplo fijo.
- Un lienzo de ×4 (2560 × 1920) supera el mínimo de textura que WebGL2 garantiza (2048); no se ha visto un equipo real donde falle, pero no está probado.

## Evidencia

- **Builds:** Play! `core-play.yml` run 43295621238 sobre `363edf7`, commit del bot `d07ffee`, `play.wasm` `5394f26248e7…` (2 495 983 bytes). Mupen64Plus-Next `core-mupen64plus-next.yml` run 43296088341 sobre `ba6887b`, commit del bot `4287c3a`, `n64-core.wasm` `34b1063c9dec…` (3 219 743 bytes).
- **Banco local de PS2** (adaptador real, Chromium headless): a ×3 el lienzo mide 1920 × 1344 y la imagen lo llena (las cuatro esquinas); la miniatura sigue en 640 × 448; mando, Partida y sonido como a ×1; un segundo juego a ×2 deja el lienzo en 1280 × 896.
- **Unitarias:** `tests/render-scale.test.ts`, `tests/display-preferences.test.ts` (campo nuevo, compatibilidad y techo) y el protocolo en `tests/n64.test.ts`.
- **N64 no tiene banco local:** su comprobación es la E2E de la CI.
- **Pendiente de QA del titular:** aspecto y velocidad con juegos reales a pantalla completa, y la bajada automática en su equipo.
