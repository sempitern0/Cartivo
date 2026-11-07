# N64 — laboratorio aislado

Estado: **sesión real con el núcleo compilado en local**. Mupen64Plus-Next + GLideN64 dibuja por WebGL2 en un Worker, sin hilos ni readback por fotograma, y arranca la demo original con mando. **No es soporte N64**: falta el build fijado (6.0.12), el gate legal, audio, medición y juegos reales. Rama: `feat/n64-gpu-prototype` (al día con `main` `e09f772`).

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

## Sesión con el núcleo local (fase 2)

```sh
# Emscripten 6.0.12 de emsdk (LLVM 24) activo; JOBS=n para paralelizar make.
node experiments/n64/build-core.mjs
pnpm exec vite experiments/n64 --host 127.0.0.1   # «Arrancar demo»
```

- **En Windows:** usa WSL, porque el `Makefile` de upstream necesita `make` y una shell Unix. Con Ubuntu en WSL:

  ```sh
  sudo apt install -y build-essential git python3
  # Node 20.11 o posterior (el de apt suele ser antiguo): emsdk trae uno,
  # o instala Node 22 con nvm.
  git clone https://github.com/emscripten-core/emsdk ~/emsdk
  ~/emsdk/emsdk install 6.0.12 && ~/emsdk/emsdk activate 6.0.12
  source ~/emsdk/emsdk_env.sh   # en cada terminal nueva
  cd /mnt/c/Users/<usuario>/…/Cartivo && node experiments/n64/build-core.mjs
  ```

  Es más rápido clonar el repo dentro del disco de WSL (`~/Cartivo`) que compilar sobre `/mnt/c`.
- **Qué compila:** `build-core.mjs` descarga el commit fijado del candidato en `.build/` (ignorado por Git) y lo compila con el target `emscripten` de upstream como archivo estático (GLES3, sin dynarec). Luego lo enlaza con `host/frontend.c` (frontend libretro propio) y `fibers/cooperative.c`, que sustituye a libco con Asyncify. Deja `.build/n64-core.{mjs,wasm}` y un JSON de evidencia.
- **Desvíos respecto a upstream, todos explícitos:**
  - el zlib incluido en el árbol en vez del port de Emscripten, que se descarga durante el build;
  - `-fno-common`, porque WebAssembly no tiene símbolos comunes;
  - el parche `patches/emu-thread-entry.patch`, porque la entrada de la corutina tenía un tipo distinto y WebAssembly lo detiene;
  - un `sem_timedwait` que falla de forma explícita, porque el renderizador con hilos de GLideN64 se enlaza pero nunca arranca;
  - `-sDEFAULT_TO_CXX`, porque GLideN64 es C++ y desde Emscripten 5 emcc solo enlaza las bibliotecas de C si no se le pide (la 4.x lo hacía por defecto);
  - `-sMAXIMUM_MEMORY=512 MiB`: así falla la reserva de 512 MiB del «full mem base» de Mupen64Plus (todo el espacio de direcciones de la N64) y el núcleo usa su disposición compacta. La sesión pasa de 730 MiB a 256 MiB sin cambio medible de coste por fotograma.
- `N64_EXPLORATORY_EMCC=1` acepta otra toolchain solo para iterar; la evidencia la marca como no reproducible y guarda la versión de clang. Fijada significa emcc 6.0.12 **con su LLVM 24**: el emcc 6.0.12 sobre LLVM 21 no compila su propia libc (faltan `__builtin_wasm_memory_copy` y `__builtin_wasm_memory_fill`). `N64_DEBUG=1` añade nombres y aserciones.
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

La receta exige 6.0.12 y compila únicamente el puente original `fibers/cooperative.c` y `fibers/smoke.c`. Implementa las cuatro entradas libco con fibers/Asyncify, **sin pthreads ni SharedArrayBuffer**. Genera `.build/fiber-smoke.cjs`, WASM y evidencia local ignorada por Git. Nunca se llama desde CI normal.

Prueba 100 ciclos de crear/destruir una fibra con pila C de 4 MiB, 100 cesiones por ciclo, preservación de variables locales y heap WASM estable tras calentamiento. Esto no mide el coste de Asyncify en el núcleo real, profundidad de pila de N64, audio, WebGL ni recuperación de una partida. El tamaño de pila Asyncify de 64 KiB es provisional y debe medirse con el núcleo. El puente es monohilo y sus contextos no son compartibles; una entrada debe ceder, no retornar.

## Estado de relevo

### Relevo — 2026-11-07, sesión 4

- **QA del titular:** con el build fijado (WSL y Vite), la demo no muestra imagen ni sonido en Chrome ni en Firefox. «Parece que está haciendo algo»: no hay más datos.
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

### Relevo — 2026-11-07, sesión 3

- **Base:** `feat/n64-gpu-prototype` con `main` fusionado y el rediseño del inicio. Sin PR abierta; la CI de la rama se lanzó a mano (`workflow_dispatch`) y está en verde. Esa CI no ejecuta este laboratorio.
- **Fase:** 2 casi completa: vídeo, entrada, audio, pérdida de contexto y cancelación. Empieza la 3 con las primeras mediciones de la demo. El gate CORE-LEGAL-01 sigue **pendiente**.
- **Build:** aquí sigue siendo **exploratorio** (Emscripten 4.0.10 con LLVM 21). El emcc 6.0.12 sobre LLVM 21 no compila su libc. El titular compiló con emsdk 6.0.12 (LLVM 24) en WSL: `reproducible: true` y SHA-256 `269939ab…6a6b`. Ver [N64_CORE_GATE](../../docs/research/N64_CORE_GATE.md#build-con-la-toolchain-fijada-titular-2026-11-07).
- **Medido** (Chromium headless con SwiftShader, demo original, sin GPU física):
  - **Coste por fotograma:** media 5,6–5,9 ms y p95 8–9 ms, sobre un presupuesto de 16,7 ms. Incluye Asyncify y fibers.
  - **Memoria:** 256 MiB fijos con el tope de memoria (antes 730 MiB).
  - **Audio:** el oráculo da 500,09 Hz a 44,1 kHz. El núcleo emite unas 46,9 k muestras por segundo de reloj, más que el tiempo real, y la cola acotada descarta bloques. En producción hará falta pautar por audio o un control de tasa.
  - **Cadencia:** `setInterval` deja unos 56 fps de 60 con la sonda de estado activa.
- **Pruebas:**
  - Unitarias: 8 de 8, con el hash nuevo de la demo y el oráculo de la onda.
  - Driver de Playwright local sobre el bundle de esbuild: botones, tono, pérdida de contexto y detener.
  - `browser.spec.ts` añade el tono y la pérdida de contexto, pero no se ha ejecutado con Vite aquí.
- **Próxima acción:**
  1. Hecho por el titular: build fijado. Falta repetir `browser.spec.ts` con Vite sobre ese build.
  2. Fase 3 con juegos propios del titular (no versionados): coste por fotograma con GPU real en Chromium, Firefox y Safari, pila de Asyncify, estabilidad de 30 minutos y control de tasa de audio.
  3. Completar CORE-LEGAL-01 y decidir go o no-go.
- **No tocar:** producción (Player, protocolo, `cores/`, `.build-request`, workflows) hasta superar la fase 3.

### Relevo — 2026-11-07, sesión 2

- **Base:** `main` `e09f772`, fusionado en `feat/n64-gpu-prototype`. Sin PR abierta: la rama no lanza CI.
- **Fase:** 1 avanzada (inventario de fuentes y licencias en el expediente; gate **pendiente**) y 2 con sesión real de vídeo y entrada. Faltan el audio, la pérdida de contexto y la cancelación durante la carga.
- **Build:** local y **exploratorio** (Emscripten 4.0.10 con LLVM 21; el registro de Emscripten 6.0.12 no era accesible). WASM de 3,2 MB, 407 imports. La receta exige 6.0.12 salvo con `N64_EXPLORATORY_EMCC=1`.
- **Pruebas:**
  - Unitarias: 8 de 8 (`tests/n64-prototype.test.ts`), con hash de la demo.
  - Chromium headless con SwiftShader: la demo presenta todos los fotogramas a 60 Hz; píxel central `[33,33,99]` sin botones, A → `[255,0,0]`, Start → `[255,255,0]`; cuadrado blanco en su sitio; detener libera la sesión.
  - La E2E `browser.spec.ts` («a real session…») se salta si falta `.build/` y no se ha ejecutado con Vite en este entorno.
- **Sin probar:** GPU física, Firefox y WebKit, audio, rendimiento con juegos reales, móvil y el build con la toolchain fijada.
- **Próxima acción:**
  1. Compilar con emcc 6.0.12 (`node experiments/n64/build-core.mjs`) y repetir la E2E con Vite.
  2. Audio: `n64_audio`, una cola acotada y AudioContext con gesto del usuario.
  3. Medir el coste de Asyncify, la cadencia y la memoria con juegos propios (fase 3).
  4. Completar CORE-LEGAL-01 y decidir go o no-go.
- **No tocar:** producción (Player, protocolo, `cores/`, `.build-request`, workflows) hasta superar la fase 3.
