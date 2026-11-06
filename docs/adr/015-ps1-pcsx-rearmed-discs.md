# ADR-015 — PlayStation con PCSX-ReARMed, discos bajo demanda y N64 aplazado

Estado: aceptado (experimental). Fecha: 2026-11-06.

## Contexto

El titular prioriza un MVP jugable hasta PS2. Tras Mega Drive tocaba N64 o PS1, y antes de elegir se hizo un spike con N64.

**N64 no encaja hoy en la arquitectura de Cartivo.** Cartivo usa núcleos WASM autónomos en un Worker que entregan RGBA dibujado por CPU.
- En parallel-n64 (`e0ef5d67`), el RDP por software angrylion solo se compila con `HAVE_THR_AL=1`, es decir, con un pool de hilos. En el navegador eso exige SharedArrayBuffer y aislamiento COOP/COEP.
- Mupen64Plus-Next (`15bada85`) siempre compila GLideN64, que necesita OpenGL; en la web sería WebGL2.
- Cualquiera de los dos caminos cambia la arquitectura de vídeo o de hilos. Por eso el titular eligió **PS1 primero**.

**La novedad de PS1 son los discos.** Ocupan de 300 a 700 MB, a menudo repartidos en varios archivos (`.cue` con sus pistas `.bin`). Copiar un disco entero a la memoria de WebAssembly no es viable. Hasta ahora `prepareRom` leía la ROM completa.

## Decisión

- **Núcleo:** PCSX-ReARMed `7b0e8f8` (libretro/pcsx_rearmed, GPL-2.0-or-later), compilado por CI a WebAssembly autónomo con Emscripten 6.0.12 sobre la plantilla común (`wasm-host.ts`, ABI `cartivo_*`).
  - Opciones: intérprete (sin dynarec), GPU por software `gpu_neon` con SIMD de WebAssembly, sin hilos ni CHD.
  - Sigue la receta `tools/build-pcsx-rearmed.mjs`, cuyo expediente es [PCSX_REARMED_CORE_GATE](../research/PCSX_REARMED_CORE_GATE.md).
- **BIOS HLE del núcleo, forzada.**
  - El puente no ofrece directorio de sistema, así que nunca se busca la BIOS de Sony.
  - Los juegos que necesiten la BIOS real quedan fuera hasta que el titular decida otra cosa.
- **Discos bajo demanda:**
  - El disco se queda en los archivos que abre el jugador. El puente (`cores/pcsx-rearmed/src/cartivo.c`) ofrece al núcleo la **interfaz VFS de libretro** de solo lectura y la reenvía a las importaciones del host `cartivo_vfs_open|size|read|close`.
  - `disc.ts` las implementa con `FileReaderSync` sobre `Blob.slice()`. Es síncrono, como pide la VFS, y está permitido en Workers. Solo se leen los sectores que el núcleo pide.
  - Los desplazamientos viajan como `double`, así que no se desbordan por encima de 2 GiB.
  - Las pistas se buscan por el nombre que usa el `.cue`, en cualquier carpeta y sin distinguir mayúsculas.
- **Identidad del disco** (`disc-identity.ts`): SHA-256 de los resúmenes WebCrypto de bloques de 16 MiB, más una cabecera con versión, nombres y tamaños.
  - Es estable y rápida, unos 565 MB/s en Node. No es el SHA-256 plano de la imagen, así que solo se compara consigo misma.
  - Identifica las Partidas y la tarjeta de memoria. Solo cubre el archivo de arranque y las pistas que nombra un `.cue`: ni el orden en que se eligieron los archivos ni un archivo ajeno abierto con ellos la cambian.
- **Contrato:** `CoreModule = CartridgeModule | DiscModule`.
  - Un `DiscModule` declara `disc: true` y su `create` recibe un `DiscImage`. El archivo de arranque lo elige la página (`gameForFiles`, con las `extensions` de `systems.ts` por orden de preferencia: `.cue`, `.iso`, `.exe`, `.bin`) y viaja como `file`; el resto, como `extra`.
  - El Worker prepara cada tipo con `prepareRom` o `prepareDisc` y guarda un único `start(save?)` para cargar, reiniciar e importar.
  - `BridgeCore` acepta un `DiscImage` y pasa el nombre del archivo de arranque a `cartivo_create`.
- **Varios archivos a la vez:**
  - El protocolo `load` admite `extra: File[]` (hasta 100) junto al archivo principal.
  - Selectores, arrastre y «Abrir con» entregan todos los archivos. `gameForFiles` (en `systems.ts`) elige el juego: prueba primero los sistemas de disco, de modo que un `.cue` gana a sus pistas.
- **`.bin` compartido con Mega Drive:**
  - Un `.bin` suelto de hasta 10 MiB (el límite de Mega Drive) es un cartucho.
  - Si es mayor, o se abre con su `.cue`, o desde la tarjeta de PlayStation, es una pista de CD.
  - Esto concreta lo que ADR-014 dejó pendiente.
- **Vídeo:** el puente escala todos los modos de PlayStation (256 a 640 de ancho, 240 o 480 líneas, PAL incluido) a un fotograma fijo de **640×480** a 4:3, que conserva el detalle de los modos de alta resolución.
  - La cadencia la informa el núcleo (`cartivo_frame_rate`, 50 Hz en PAL).
- **Mando digital por posición:**
  - Cruz y Círculo sobre B y A, Cuadrado y Triángulo sobre Y y X, L1 y R1 sobre L y R.
  - Se añaden las acciones **L2/R2** a Cartivo: gatillos 6 y 7 del mando estándar, Y y P en el teclado. Los perfiles antiguos se completan con la misma migración que L/R y X/Y.
  - El analógico (DualShock) queda para después.
- **Partidas y tarjeta:**
  - Instantáneas con `retro_serialize`, de unos 4,4 MB.
  - La tarjeta de memoria 1 (128 KiB, gestionada por libretro) se guarda con `SramStore`, igual que la batería de un cartucho.
  - El núcleo nunca escribe archivos.
- **Demo:** un PS-EXE original (`ps1-control-demo.ts`) que la BIOS HLE arranca como un disco de un archivo.
- **Biblioteca:** los discos todavía **no** se recuerdan (no se copian a OPFS) y se juegan desde los archivos abiertos. Copiar cientos de MB pide su propia decisión de espacio y consentimiento.

## Alternativas descartadas

- **Leer el disco entero a memoria:** inviable con 700 MB y con la memoria de WebAssembly.
- **Hilo de lectura asíncrona con Atomics.wait:** necesita SharedArrayBuffer y COOP/COEP. `FileReaderSync` ya es síncrono en el Worker.
- **Beetle PSX (Mednafen):** más preciso pero mucho más pesado sin recompilador. La BIOS libre que necesitaría (OpenBIOS) sería otro componente que auditar.
- **Detectar `.bin` por contenido:** innecesario mientras el tamaño y el `.cue` lo resuelven.

## Consecuencias

- **GPL-2.0-or-later:** admitida para uso privado. Si se publicara, afectaría al conjunto (expediente, apartado 3).
- La PWA crece unos 0,75 MB por el núcleo.
- **Pendiente de QA real del titular:** compatibilidad y rendimiento con sus discos (el intérprete puede no llegar a 60 fps en equipos modestos), mandos físicos y audio.
- **Límites:**
  - CHD, `.pbp`, `.m3u` multidisco, cambio de disco, analógico, multitap y pistola;
  - juegos que dependan de la BIOS real;
  - discos en la biblioteca.
- **N64:** aplazado hasta planificar WebGL2 en el Worker (OffscreenCanvas) o hilos con COOP/COEP. El resultado del spike queda registrado arriba.
