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
- **Hojas `.cue` incompletas:** si se abre un `.cue` sin las pistas que nombra, la tarjeta de PlayStation lo dice antes de arrancar y ofrece «Elegir pistas» para añadirlas (`storage/src/cue.ts`, `matchTracks`). El Worker repite la comprobación. Se acepta una única pista renombrada tras el volcado, que se ofrece al núcleo con el nombre del `.cue`, y una hoja guardada con BOM UTF-8 se entrega sin él, porque el núcleo no lo espera.
- **`.bin` compartido con Mega Drive:**
  - Un `.bin` suelto de hasta 10 MiB (el límite de Mega Drive) es un cartucho.
  - Si es mayor, o se abre con su `.cue`, o desde la tarjeta de PlayStation, es una pista de CD.
  - Esto concreta lo que ADR-014 dejó pendiente.
- **Vídeo:** el puente escala todos los modos de PlayStation (256 a 640 de ancho, 240 o 480 líneas, PAL incluido) a un fotograma fijo de **640×480** a 4:3, que conserva el detalle de los modos de alta resolución.
  - La cadencia la informa el núcleo (`cartivo_frame_rate`, 50 Hz en PAL).
- **Mando digital por posición:**
  - Cruz y Círculo sobre B y A, Cuadrado y Triángulo sobre Y y X, L1 y R1 sobre L y R.
  - Se añaden las acciones **L2/R2** a Cartivo: gatillos 6 y 7 del mando estándar, Y y P en el teclado. Los perfiles antiguos se completan con la misma migración que L/R y X/Y.
  - **DualShock** desde el 2026-11-07 (revisión de ADR-006). El puente elige el `RETRO_DEVICE_PSE_DUALSHOCK` del núcleo **antes de cargar el juego**: cambiarlo después hace que el núcleo simule enchufar un mando nuevo y no responda durante 32 fotogramas. Empieza en modo digital, igual que el mando estándar. El juego lo pasa a analógico con sus comandos de configuración, o el jugador con L1+R1+Select (`pcsx_rearmed_analog_combo`). Los sticks llegan por `cartivo_set_analog` como `RETRO_DEVICE_ANALOG`.
- **Partidas y tarjeta:**
  - Instantáneas con `retro_serialize`, de unos 4,4 MB.
  - La tarjeta de memoria 1 (128 KiB, gestionada por libretro) se guarda con `SramStore`, igual que la batería de un cartucho.
  - El núcleo nunca escribe archivos.
- **Demo:** un PS-EXE original (`ps1-control-demo.ts`) que la BIOS HLE arranca como un disco de un archivo. Para las pruebas existe además una imagen de CD original (`ps1-disc-demo.ts`: volumen ISO 9660 con SYSTEM.CNF y PSX.EXE en sectores MODE2/2352, con su `.cue`), que recorre el camino de un disco real.
- **Biblioteca:** los discos todavía **no** se recuerdan (no se copian a OPFS) y se juegan desde los archivos abiertos. Copiar cientos de MB pide su propia decisión de espacio y consentimiento. *Revisión 2026-11-08:* ya se recuerdan; ver «Discos en la biblioteca» más abajo.

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
- **N64:** aplazado hasta planificar WebGL2 en el Worker (OffscreenCanvas) o hilos con COOP/COEP. El resultado del spike queda registrado arriba. *Revisión 2026-11-07:* resuelto con WebGL2 en el Worker, en [ADR-017](017-n64-gpu-surface.md).

## Revisión 2026-11-08 — Discos en la biblioteca

- **Copia:** recordar un disco copia a OPFS, en la carpeta `roms/<identidad>/`, los archivos que forman su identidad: el `.cue` sin BOM y sus pistas con el nombre que usa la hoja, o el `.iso`/`.bin`/`.exe` solo. El archivo de arranque va primero. La entrada de la biblioteca guarda esa lista (`files`: nombre y tamaño) y el tamaño total. Las copias de cartucho siguen siendo `roms/<sha256>`.
- **Mientras se juega:** la copia se escribe en trozos de 4 MiB entre fotogramas. La carga no la espera: responde `remembering` con los bytes que se van a copiar, y el resultado (`remembered` o `libraryError`) llega con el siguiente `advance`. La entrada solo se escribe cuando la copia está completa.
- **Espacio:** antes de copiar se consulta `navigator.storage.estimate()`, con un margen del 5 %. Si no cabe, no se copia nada y se dice cuánto ocupa el disco y cuánto queda libre. Se sigue jugando desde los archivos.
- **Verificación:** al copiar se comprueban los tamaños. Cada vez que se juega desde la copia se recalcula la identidad (`prepareDisc`), y si no coincide la copia se rechaza por dañada. No se vuelven a leer 700 MB justo al terminar de copiar, mientras la partida sigue en marcha.
- **Perfiles y olvido:** la copia es por identidad, y la comparten los perfiles como la de los cartuchos (ADR-016). Olvidar un disco borra la carpeta solo si ningún otro perfil lo recuerda; la tarjeta de memoria y las Partidas se conservan. Las carpetas huérfanas se limpian a las 24 h, según su archivo más reciente.
- **Fuera:** CHD y multidisco (`.m3u`).

## Revisión: varios discos y CHD (2026-11-08)

- **Varios discos (`.m3u`):** la página y el Worker leen la lista (`resolveDisc` en `packages/storage/src/cue.ts`): cada disco puede ser un `.cue` con sus pistas, un `.chd` o un `.iso`, y se piden los que falten antes de empezar. El núcleo nunca lee el `.m3u` (lo haría con `fopen`, fuera de la VFS): arranca el primer disco y el puente añade los demás con la interfaz de control de discos de libretro (`cartivo_disc_add`).
  - **Cambiar de disco:** «Disco N» en la barra del reproductor (menú de Bits UI) y «Poner el disco N» en el menú de pausa. El puente abre la tapa, cambia la imagen y la cierra (`cartivo_disc_insert`); el núcleo ve la tapa cerrada unos dos segundos después, como en la consola.
  - **Reinicio y batería:** crean un núcleo nuevo que arranca con el disco de la bandeja (`DiscImage.withFirst`). El adaptador traduce entre el orden del juego y el del núcleo (el disco con el que arrancó va primero).
  - **Identidad:** el `.m3u` con todos sus discos. Los discos de siempre conservan la suya; la tarjeta de memoria es una por juego, compartida por sus discos.
  - **Límite:** una Partida guarda el estado de la consola, no qué disco hay en la bandeja: antes de cargar una de otro disco hay que poner ese disco.
- **CHD:** compilado con `HAVE_CHD` (libchdr y sus decodificadores LZMA, Zstandard y FLAC), leído por la misma VFS. Licencias: libchdr BSD-3-Clause, LZMA SDK dominio público, Zstandard BSD-3-Clause o GPL-2.0, dr_flac Unlicense o MIT-0; todas en el SBOM y admitidas por la política de uso privado y, a diferencia del núcleo, también publicables.
- **Pruebas:** fixtures propios de dos discos (`ps1TwoDiscDemo`, el segundo en verde) y CHD v5 sin comprimir (`ps1DiscChd`), en Node (`tests/ps1.test.ts`) y E2E (`tests/e2e/ps1.spec.ts`).
