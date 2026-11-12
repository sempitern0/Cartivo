# ADR-022 — PlayStation 2 con Play!: hilos, superficie WebGL2 y frontend propio

Estado: aceptado (experimental). Fecha: 2026-11-11. Decisión del titular: integrar PS2 con Play! y dejar PSP, GameCube y Dreamcast para después.

## Contexto

Play! (`1f27232`, BSD-2-Clause) es el único emulador de PS2 con una versión web de upstream: emula la BIOS por HLE, compila el código de la consola a WebAssembly con su propio JIT y dibuja con OpenGL ES 3. El gate legal es favorable ([PLAY_CORE_GATE](../research/PLAY_CORE_GATE.md)).

Es distinto de todos los núcleos anteriores en tres cosas:
- **Hilos.** La consola (EE, IOP y SPU) corre en un pthread, que necesita `SharedArrayBuffer` y una página aislada ([ADR-020](020-cross-origin-isolation.md)).
- **GPU.** El GS dibuja con WebGL2, como GLideN64 en N64 ([ADR-017](017-n64-gpu-surface.md)).
- **Módulo con JS.** Los hilos exigen el cargador de Emscripten; no puede ser WASM independiente sobre `wasm-host.ts`.

El primer intento, sobre el frontend libretro de Play!, compiló pero no funcionó en el navegador. Con el JIT de WebAssembly cada hilo tiene su propia tabla de funciones, y ese frontend:
- no registra en el hilo de la consola las funciones que importan los bloques compilados (`fctTable: table import requires a WebAssembly.Table`);
- arranca, reinicia y (des)serializa desde el hilo que lo llama, lo que crea o borra bloques en la tabla equivocada;
- espera en cada fotograma a que el juego toque los registros de vídeo: un juego parado bloquearía el Worker para siempre.

## Decisión

**1. Frontend propio** (`cores/play/src/cartivo.cpp`), sobre las clases de Play!, como hace su versión web (`Source/ui_js`).
- La VM es una subclase de `CPS2VM` que registra las funciones del JIT en su hilo.
- Arranque y estados se ejecutan en ese hilo, a través de su buzón. Mientras esperan, el hilo del anfitrión sigue atendiendo al GS, porque la consola puede estar esperándolo.
- El GS no tiene hilo propio: sus llamadas se ejecutan en el hilo del Worker, dueño del contexto WebGL2, y presenta un fotograma por paso aunque el juego no haya cambiado nada.
- Un fotograma que no llega en 5 s se da por perdido: el adaptador avisa de que el juego ha dejado de responder, en vez de bloquear el Worker.
- El anfitrión marca el ritmo: Play! sin su limitador, y la consola se detiene sola dos fotogramas por delante del GS, así que nada corre mientras el juego está en pausa.

**2. Un cuarto tipo de módulo: `SurfaceDiscModule`** (`packages/adapters/src/contract.ts`): un disco cuyo núcleo dibuja en el lienzo. `create(disc, canvas)` es asíncrono y no recibe batería. Lo que comparten N64 y PS2 (crear el contexto y leer la superficie para las miniaturas) está en `packages/adapters/src/surface.ts`.

**3. El disco se lee bajo demanda, sin sistema de archivos.** Bajo Emscripten, Play! lee su imagen por `Module.discImageDevice`; el adaptador responde con lecturas síncronas del archivo del jugador (`DiscImage`, ADR-015). Solo imágenes de **un archivo** (`.iso`, `.chd`, `.cso`, `.isz`); un `.elf` se copia a la memoria del módulo.

**4. Vídeo fijo de 640 × 448 a 4:3.** El GS presenta cualquier modo de vídeo ajustado a esa superficie; un juego PAL (512 líneas) se reduce. Resolución 1x.

**5. PAL por la región del disco.** El anfitrión necesita la cadencia al cargar, antes de que el juego fije su modo: los discos europeos (`SLES`, `SCES`, `SLED`, `SCED`) van a 50 Hz y el resto a 59,94.

**6. Sin memory card por ahora.** Play! guarda las memory cards en su propio sistema de archivos, que aquí vive en memoria. El progreso se conserva con Partidas (el estado de Play!, un zip comprimido: 18 KiB en la demo).

**7. Cada juego es una instancia nueva del módulo** (como N64), y es de un solo uso: al cerrar se para la consola, se liberan los objetos de GL y se terminan sus hilos; la instancia se descarta con su memoria. Reiniciar es arrancar otra.

**8. Aislamiento comprobado antes de descargar.** El sistema declara `threads` (`systems.ts`); si la página no está aislada, el reproductor lo explica sin descargar el núcleo.

**9. Build:** `tools/build-play.mjs` con CMake, bajo petición (`core-play.yml`). El cargador se nombra a sí mismo para crear sus hilos, porque el empaquetador de la app renombra los archivos.

**10. `.iso` y `.chd` los comparten PlayStation y PS2.** Sin elegir consola, una imagen de más de 900 MiB solo puede ser un DVD de PS2; hasta ese tamaño se abre como PlayStation. Un juego de PS2 en CD se abre desde la tarjeta de PS2.

## Alternativas descartadas

- **Frontend libretro con parches:** habría que sustituir su VM, su bucle de fotograma, su arranque y sus estados; queda menos código y más claro escribiendo el frontend.
- **PCSX2 o AetherSX2:** sin versión web, GPL-3.0 y dependientes de JIT nativo.
- **Montar el disco con WORKERFS:** Play! ya tiene su propio dispositivo de imagen para Emscripten; usarlo evita que cada lectura cruce de hilo por el sistema de archivos.
- **Leer los fotogramas a memoria** (como PS1): una copia de GPU a CPU por fotograma, innecesaria con la superficie de ADR-017.
- **Superficie del tamaño de cada modo de vídeo:** el contrato y las miniaturas suponen un tamaño fijo por sistema.

## Consecuencias y límites

- **Experimental.** Play! no arranca todos los juegos y el rendimiento con juegos reales no está medido: depende de la GPU y del JIT en cada navegador. Queda para la QA del titular con sus propios discos.
- **Cámara lenta en vez de pausa** (revisión 2026-11-12, tras la primera prueba del titular con un DVD comercial). En las demás consolas el reproductor se pausa si el dispositivo no mantiene la velocidad; en PS2 (`slowMotion` en `systems.ts`) el juego sigue por debajo de su velocidad, fotograma a fotograma, y la cabecera muestra «Velocidad N %». Nunca se acelera para recuperar.
- **Partidas de hasta 64 MiB** (revisión 2026-11-12). La de un juego real no cabía en los 8 MiB anteriores (32 MiB de RAM más vídeo y sonido, comprimidos por Play!) y «Guardar y salir» fallaba. `MAX_STATE_BYTES` sube para todos los sistemas; los de cartucho siguen muy por debajo.
- **Sonido a ritmo constante** (revisión 2026-11-12). El hilo de la consola entrega el sonido en bloques de unos 22 ms, no por fotograma; `AudioPace` (`packages/adapters/src/audio-pace.ts`) lo reparte por fotograma con 60 ms de reserva. Sigue en mono, como el resto de núcleos.
- **Sin memory card:** un juego que solo guarde en memory card pierde ese guardado al salir; las Partidas lo sustituyen.
- **Sin multidisco, sin `.cue`/`.bin`, sin mejoras de resolución, sin L3/R3** (no tienen acción en Cartivo) **ni vibración.**
- **Un PAL a 60 Hz** (los que ofrecen ese modo) se sigue marcando a 50.
- **Memoria:** el módulo reserva 256 MiB por juego y puede crecer.
- **Una Partida dañada** que tenga forma de zip puede dejar el juego sin estado: el adaptador lo detecta y pide volver a abrirlo. Lo que no es un zip se rechaza antes de llegar al núcleo.
- Requiere WebGL2 en Workers y página aislada. Firefox y WebKit headless de la CI no ofrecen WebGL2 en Workers, así que la E2E solo lo ejercita en Chromium.

## Evidencia

- **Build:** `core-play.yml` run 43109997432 sobre `f1ceea0`, emsdk 6.0.12; commit del bot `2bbb8f7`; `play.wasm` 2,4 MiB (`5be0e1fe9720…`) y `play.js` 133 KiB (`c70d3a1771bd…`), sin `eval` ni `new Function` (ADR-021).
- **Banco local** (Chromium headless con SwiftShader, servidor con COOP/COEP, el adaptador `ps2.ts` sin modificar):
  - la demo `.elf` arranca en 0,5 s y cada fotograma tarda menos de 1 ms;
  - oráculo de color y mando (Cruz, Círculo, Start);
  - Partida de 18 833 bytes guardada y restaurada; una que no es un zip se rechaza y el juego sigue;
  - la misma demo como imagen `.iso` arranca con 9 lecturas del archivo y se detecta PAL (50 Hz);
  - dos juegos seguidos sobre el mismo lienzo; el primero queda cerrado.
- **Unitarias** (`tests/ps2.test.ts`, `tests/systems.test.ts`): contrato en UI y Worker, la fixture (ELF e ISO 9660), el ensamblador MIPS, la forma de zip y el reparto de `.iso`/`.chd` por tamaño.
- **E2E** (`tests/e2e/ps2.spec.ts`): demo con colores por captura, F5/F9 con miniatura y la imagen `.iso` abierta desde el selector.
- **CI:** Foundation CI 43115390468 sobre `7f72d57`, en verde: `verify` y las seis tandas E2E. Las tres pruebas de PS2 pasan en Chromium, en dev y en preview (bajo la CSP de ADR-021); Firefox y WebKit las saltan por no ofrecer WebGL2 en Workers. El run anterior (`6faade5`) ya las pasaba y falló por tipos del adaptador, la tarjeta sin portada y dos textos de otras E2E.
