# N64 — laboratorio aislado

Estado: **sesión real con el núcleo que compila la CI** (`cores/mupen64plus-next`, gate CORE-LEGAL-01 aceptado para uso privado). Mupen64Plus-Next + GLideN64 dibuja por WebGL2 en un Worker, sin hilos ni readback por fotograma, con audio, pausa y métricas. **No es soporte N64**: falta la medición con juegos reales (fase 3) y el go o no-go antes de integrarlo en la app.

No se importa desde la aplicación, no registra N64 en producción y no incorpora assets al Service Worker. No modifica PS1, Player, perfiles, ownership del mando ni protocolo de producción. La PR #35 (perfiles, foco y discos) ya está en `main`; sus piezas comunes se revisan antes de la fase 4.

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

## Sesión con el núcleo (fase 2)

```sh
git pull                                           # trae cores/mupen64plus-next/dist
pnpm exec vite experiments/n64 --host 127.0.0.1    # «Arrancar demo»
```

- **El núcleo lo compila la CI**, no hace falta Emscripten ni WSL para probar. `.github/workflows/core-mupen64plus-next.yml` corre al cambiar `cores/mupen64plus-next/.build-request` o con `workflow_dispatch`, y el bot versiona `dist/n64-core.{mjs,wasm}`, `manifest.json` y `sbom.json`. `vite.config.ts` sirve esa carpeta tal cual como `publicDir`.
- **Receta:** `tools/build-mupen64plus-next.mjs`. Descarga el commit fijado en `cores/mupen64plus-next/build/` (ignorado por Git) y lo compila con el target `emscripten` de upstream como archivo estático (GLES3, sin dynarec). Luego lo enlaza con `src/frontend.c` (frontend libretro propio) y `src/cooperative.c` (libco sobre fibers/Asyncify). Exige el emsdk de `toolchain.json` con su propio LLVM: hoy **4.0.10 (LLVM 21)**, porque el build con 6.0.12 (LLVM 24) se cuelga en el primer fotograma. `--verify` recompila en un directorio temporal y compara hashes.
- **Build de depuración:** para diagnosticar un fallo con un juego propio (por ejemplo `memory access out of bounds`). Lleva nombres de función en las trazas, comprobaciones de Emscripten, aserciones de Asyncify y detección de desbordamiento de la pila C. No se versiona y la CI no lo compila.

  ```sh
  ~/emsdk/emsdk install 4.0.10 && ~/emsdk/emsdk activate 4.0.10 && source ~/emsdk/emsdk_env.sh
  node tools/build-mupen64plus-next.mjs --debug     # → cores/mupen64plus-next/build/debug/
  N64_CORE=debug pnpm exec vite experiments/n64 --host 127.0.0.1
  ```

  Si el núcleo falla dentro de un fotograma, el Worker escribe en el registro la pila del error antes de detenerse.
- **Compilar en local** solo hace falta para cambiar la receta o el frontend. Necesita Linux, macOS o WSL con `make` y emsdk activado; en WSL, mejor con el repositorio dentro de su disco (`~/Cartivo`). Ejecuta `node tools/build-mupen64plus-next.mjs`.
- **Desvíos respecto a upstream, todos explícitos:**
  - el zlib incluido en el árbol en vez del port de Emscripten, que se descarga durante el build;
  - `-fno-common`, porque WebAssembly no tiene símbolos comunes;
  - el parche `cores/mupen64plus-next/patches/emu-thread-entry.patch`, porque la entrada de la corutina tenía un tipo distinto y WebAssembly lo detiene;
  - un `sem_timedwait` que falla de forma explícita, porque el renderizador con hilos de GLideN64 se enlaza pero nunca arranca;
  - `-sDEFAULT_TO_CXX`, porque GLideN64 es C++ y desde Emscripten 5 emcc solo enlaza las bibliotecas de C si no se le pide (la 4.x lo hacía por defecto);
  - `-sMAXIMUM_MEMORY=512 MiB`: así falla la reserva de 512 MiB del «full mem base» de Mupen64Plus (todo el espacio de direcciones de la N64) y el núcleo usa su disposición compacta. La sesión pasa de 730 MiB a 256 MiB sin cambio medible de coste por fotograma.
- **Sesión** (`session.ts` y `session.worker.ts`):
  - el canvas se transfiere una vez y Emscripten crea WebGL2 sobre él; el núcleo dibuja en el framebuffer por defecto;
  - la ROM va al FS en memoria;
  - los fotogramas van a la cadencia del juego, sin ráfagas;
  - detener o un fallo terminan el Worker, también durante la carga;
  - el único readback es un píxel de diagnóstico por segundo;
  - el audio sale en un bloque por fotograma. El frontend lo cuenta con `n64_audio_frames()`, porque Asyncify pierde el valor de retorno de una exportación que cambia de fibra. La página lo programa con Web Audio (`AudioContext` creado en el clic de arranque) en una cola acotada: más de 250 ms por delante se descarta el bloque;
  - una pérdida del contexto WebGL detiene la sesión con un mensaje; «Simular pérdida de contexto» la provoca (`WEBGL_lose_context`);
  - **estados explícitos** `loading → running ⇄ paused → stopping`. Una petición que no encaja con el estado se ignora y queda en el registro. Pausar, o que la pestaña pase a segundo plano, detiene el bucle y el audio. Al reanudar se sigue desde ese momento, sin ráfaga para recuperar el tiempo;
  - **ritmo por audio:** tras cada bloque la página dice al Worker cuánto audio tiene en cola. Con más de 150 ms un tic no emula; con menos de 40 ms emula dos fotogramas, nunca más. El Worker descuenta el tiempo transcurrido desde el último aviso, porque un tic saltado no produce audio ni aviso;
  - **métricas de fase 3** en el estado:
    - velocidad (tiempo emulado / tiempo real);
    - p50, p95 y p99 entre tics, y tiempo por fotograma;
    - tics saltados y dobles;
    - tiempos de arranque (glue, WebAssembly, contexto, carga, primer fotograma);
    - underruns y déficit de audio, y memoria;
  - **registro visible y copiable:** user agent, GPU (`WEBGL_debug_renderer_info` cuando el navegador lo da), cada paso del arranque, los mensajes del núcleo (incluidos los fallos de shaders de GLideN64) y los errores con su pila. Avisa si el arranque pasa de 45 s y si el núcleo emula pero no presenta imagen.
- **Demo original** (`fixture/n64-control-demo.ts`): cartucho de 1 MiB sin código de Nintendo. El PIF HLE copia ROM 0x40–0xFFF a DMEM y salta allí, así que el programa propio sustituye al IPL3: configura el VI, dibuja con rectángulos de relleno del RDP (los presenta GLideN64) y lee el mando 1 por el PIF. Además copia del cartucho (PI DMA) una onda cuadrada de 500 Hz a 32 kHz y mantiene alimentada la FIFO de la interfaz de audio (AI) desde su bucle de espera.
- **Mando:** el núcleo asigna los botones por posición: libretro B = A de N64, Y = B, Start = Start y L2 = Z.

## Microprueba de corutinas, sin compilar el núcleo

```sh
# Instalar/activar Emscripten 6.0.12 fuera del repositorio.
node experiments/n64/check-fibers.mjs
# Si emcc no está en PATH:
EMCC=/ruta/emsdk/upstream/emscripten/emcc node experiments/n64/check-fibers.mjs
```

La receta exige 6.0.12 y compila únicamente el puente original `cores/mupen64plus-next/src/cooperative.c` y `fibers/smoke.c`. Implementa las cuatro entradas libco con fibers/Asyncify, **sin pthreads ni SharedArrayBuffer**. Genera `.build/fiber-smoke.cjs`, WASM y evidencia local ignorada por Git. Nunca se llama desde CI normal.

Prueba 100 ciclos de crear/destruir una fibra con pila C de 4 MiB, 100 cesiones por ciclo, preservación de variables locales y heap WASM estable tras calentamiento. Esto no mide el coste de Asyncify en el núcleo real, profundidad de pila de N64, audio, WebGL ni recuperación de una partida. El tamaño de pila Asyncify de 64 KiB es provisional y debe medirse con el núcleo. El puente es monohilo y sus contextos no son compartibles; una entrada debe ceder, no retornar.

## Estado de relevo

### Relevo — 2026-11-07, sesión 5

- **Base:** `main` `cc80df4`, con la PR #37 fusionada (inicio rediseñado y laboratorio). Rama `feat/n64-analogico-y-build`.
- **Decisión del titular:** avanzar con lo que sirve en cualquier caso mientras mide en paralelo: el build de CI del núcleo y la entrada analógica en producción. N64 sigue fuera de la app hasta el go o no-go.
- **Hecho:**
  - `cores/mupen64plus-next`: fuentes propias, parche y pins (`src/`, `patches/`, `toolchain.json`);
  - receta de CI `tools/build-mupen64plus-next.mjs` y workflow `core-mupen64plus-next.yml`;
  - avisos de licencia en `apps/web/public/licenses/` y gate CORE-LEGAL-01 **accepted (uso privado)** en [N64_CORE_GATE](../../docs/research/N64_CORE_GATE.md);
  - el laboratorio carga `cores/mupen64plus-next/dist` y ya no tiene receta propia.
- **Build de CI con emsdk 6.0.12:** reproducible, porque su wasm (`269939ab…`) coincide con el del titular en WSL. **Pero se cuelga en el primer fotograma**, y probablemente esa sea la pantalla negra que vio el titular, además del fallo de Vite.
  - **Síntoma:** al pausar el Worker por CDP e instrumentar `fd_write` del glue, la primera línea que el núcleo escribe desde su fibra no termina nunca. musl repite escrituras vacías a stderr porque las variables locales están corruptas.
  - **No era el búfer de Asyncify.** Subirlo a 1 MiB no lo arregló; se mantiene como margen.
  - **El glue de fibras es idéntico** al de 4.0.10, así que la diferencia está en el wasm (LLVM 24, libc o Binaryen 133).
- **Decisión:** `cores/mupen64plus-next/toolchain.json` fija **emsdk 4.0.10 (LLVM 21)**, la combinación que arranca la demo. El fallo de 6.0.12 queda como investigación abierta en [N64_CORE_GATE](../../docs/research/N64_CORE_GATE.md#emscripten-6012-se-cuelga-investigación-abierta).
- **Build de CI con 4.0.10:** `n64-core.wasm` `75903b7a…`, verificado por `pnpm verify:core`. En Chromium headless:
  - demo, botones, pausa con los fotogramas congelados, reanudar y pérdida de contexto;
  - velocidad 0,99×, tono a 500,09 Hz, ningún bloque de audio descartado ni underrun;
  - unos 5,9 ms por fotograma (p95 de 8,7 ms) y primer fotograma a los 0,29 s.
- **Entrada analógica:** producción tiene sticks (`packages/input/src/analog.ts`, ADR-006) y el laboratorio reutiliza esa normalización.
- **QA del titular (2026-11-07, Brave en Windows, servido desde WSL):**
  - La demo funciona completa: imagen, pausa, reanudar y pérdida de contexto.
  - *Super Mario 64* (propio, sin versionar) arranca y se ve: 561 fotogramas presentados, velocidad 0,93×, unos 14 ms por fotograma (p95 de 20 ms), 3 underruns de audio (586 ms de déficit).
  - A los 10 s el Worker cae con `RuntimeError: memory access out of bounds`, con la memoria aún en 256 MiB.
  - Descartado por lectura: la disposición compacta de memoria pasa toda la traducción de direcciones por `mem_base_u32`.
- **Causa del cierre de *Super Mario 64*:** el titular repitió la prueba con el build de depuración. La pila es `abort()` en `free` ← `TextureCache::_addTexture` ← `_updateTextures`: dlmalloc detecta el heap corrupto.
  - **Origen:** el frontend del laboratorio solo respondía a sus siete opciones fijas, así que el resto quedaba con los inicializadores a 0 del núcleo.
  - Con `MaxTxCacheSize = 0`, GLideN64 expulsa una textura en cada inserción y hace `pop_back` sobre una lista vacía, y eso corrompe el heap.
  - Por el mismo motivo, la sensibilidad del stick también era 0.
- **Arreglo:** `src/frontend.c` responde `GET_CORE_OPTIONS_VERSION = 2` y guarda la tabla de `SET_CORE_OPTIONS_V2`/`_INTL`. Una opción no fijada toma el valor por defecto que declara el núcleo, como en RetroArch. Cambian así de 0 a ese valor, entre otras:
  - caché de texturas 8000;
  - copia de color a RDRAM `Async` y de profundidad `Software`;
  - LOD y escritura de profundidad en el fragmento;
  - stick con zona muerta 15 y sensibilidad 100.
- **Próxima acción:** build de CI deliberado; demo en headless con ese núcleo; el titular repite *Super Mario 64* y compara la velocidad, porque las copias a RDRAM tienen coste.
- **No tocar:** el registro de la app (`registry.ts`, `systems.ts`) hasta el go.

### Relevo — 2026-11-07, sesión 4

- **QA del titular:** con el build fijado (WSL y Vite), la demo no muestra imagen ni sonido en Chrome ni en Firefox.
  - El registro dio `Failed to fetch dynamically imported module: …/.build/n64-core.mjs`: Vite trataba el glue de Emscripten como código fuente.
  - Ahora Vite sirve el núcleo tal cual como `publicDir` (desde la sesión 5, `cores/mupen64plus-next/dist`).
  - La comprobación previa exige un `content-type` de JavaScript, porque Vite responde 200 con su HTML a cualquier ruta.
- **Hecho:**
  - estados explícitos, pausa y segundo plano sin ráfaga;
  - ritmo por audio: con la demo, velocidad 1,00× y sin descartes tras el calentamiento. Antes había unos 4 descartes cada 4 s y la cola tocaba el tope;
  - métricas de fase 3, y registro visible con botón «Copiar registro».
  - Arranque en SwiftShader: unos 0,1 s el WebAssembly, unos 0,23 s el cartucho cargado y unos 0,4 s el primer fotograma.
- **Pruebas:**
  - driver local sobre el bundle: botones, tono, pausa que congela los fotogramas, reanudar, velocidad > 0,9, GPU en el registro y pérdida de contexto;
  - `browser.spec.ts` añade la prueba de pausa, métricas y registro (sin ejecutar con Vite aquí).
- **Próxima acción:**
  1. El titular repite la demo y envía el registro copiado. Por ahí sale el paso en que se queda: glue, WebAssembly, contexto, cartucho, o shaders sin imagen.
  2. Corregir según el registro y repetir.
  3. Después, fase 3 con juegos propios.
- **No tocar:** producción hasta superar la fase 3.
