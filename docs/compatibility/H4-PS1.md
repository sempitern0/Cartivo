# H4-PS1 — PlayStation (PCSX-ReARMed)

Estado: **experimental.** PlayStation funciona de extremo a extremo con PCSX-ReARMed en WebAssembly ([ADR-015](../adr/015-ps1-pcsx-rearmed-discs.md)): archivos locales o demo → Worker → disco leído bajo demanda → vídeo, audio, tarjeta de memoria y Partidas. Usa la BIOS HLE del núcleo. Falta la QA del titular con discos reales.

## Expediente

| Campo | Evidencia |
|---|---|
| Núcleo | PCSX-ReARMed `7b0e8f8`, GPL-2.0-or-later; expediente [PCSX_REARMED_CORE_GATE](../research/PCSX_REARMED_CORE_GATE.md) |
| Build | `core-pcsx-rearmed.yml` (run 42255955518) sobre `69e30e5`, emsdk 6.0.12; commit del bot `bf5b11d`; `dist/pcsx-rearmed.wasm` SHA-256 `07e7d3904235…` (759 305 bytes); primer intento, sin reintentos |
| Firmware | BIOS HLE del núcleo forzada; sin directorio de sistema, nunca se busca la BIOS de Sony |
| Formatos | `.cue` con sus pistas, `.iso`, `.bin` de una pista y `.exe` (PS-EXE). Fuera: CHD, `.pbp`, `.m3u` multidisco |
| Lectura | VFS de libretro de solo lectura hacia `cartivo_vfs_*` (`FileReaderSync` sobre `Blob.slice()`); el disco nunca se copia entero |
| Entrada | DualShock: empieza digital (Cruz/Círculo en K/L, Cuadrado/Triángulo en J/U, L1/R1 en I/O, L2/R2 en Y/P; en el mando estándar, por posición y gatillos 6/7) y pasa a analógico cuando lo pide el juego o con L1+R1+Select. Sticks del mando estándar, sin equivalente en teclado |
| Guardado | Tarjeta de memoria 1 (128 KiB, `cartivo-ps1-sram-v1`) como batería; Partidas con `retro_serialize` (≈ 4,4 MB) |

## QA del titular

- 2026-11-07, mando físico: *Crash Bandicoot* (USA, disco propio) jugable abriendo el `.bin`.
- Abrir solo el `.cue` fallaba con «El núcleo no ha podido abrir el disco»: faltaba la pista.
  - Ahora la tarjeta pide las pistas antes de arrancar, y se aceptan una pista renombrada y una hoja guardada con BOM.
  - Pendiente: confirmar el `.cue` con ese disco.

## Fixtures originales

**`ps1-control-demo.ts`** (emisor MIPS R3000 propio; PS-EXE de 4 KiB sin texto de licencia de Sony). SHA-256 `2ec37a8d0e7b68d644b5efc4e131bd7f3c413cdb1ca85640893be1aa89a617b3`.
- Inicializa la GPU (320×240, 15 bits) y el mando con `InitPad`/`StartPad` de la BIOS HLE.
- **`ps1-disc-demo.ts`:** el mismo programa dentro de una imagen de CD propia: ISO 9660 con SYSTEM.CNF y PSX.EXE, 24 sectores MODE2/2352 y su `.cue`. SHA-256 del `.bin`: `70b0fe39…13ebc`. El núcleo la arranca desde el `.cue` con su pista, desde el `.bin` solo y como `.iso`.
- Pinta la pantalla de un color y un cuadrado blanco de 32×32 en (16, 16); un bucle de espera deja la GPU libre medio fotograma.
- Sin botones, azul oscuro; Cruz, rojo; Círculo, verde; Start, amarillo (el núcleo amplía el color de 15 bits: 0x20 → 0x21).

## Evidencia

| Prueba | Resultado |
|---|---|
| Arnés C nativo (`.so` libretro del mismo commit) | Ver el expediente, apartado 6: oráculo completo, 60 Hz, estado de 4 456 448 bytes |
| `tests/ps1.test.ts` (WASM del bot) | Hash y cabecera del PS-EXE; la BIOS HLE lo arranca por la VFS; oráculo de Cruz, Círculo y Start; cuadrado blanco; 59–61 Hz; tarjeta de 128 KiB conservada en un núcleo nuevo |
| `tests/core-conformance.test.ts` | Contrato completo con un disco en memoria: fotogramas 640×480, entrada, audio acotado, tarjeta, instantáneas deterministas y corruptas rechazadas; un `.cue` sin su pista se rechaza con «no ha podido abrir el disco» |
| `tests/disc.test.ts`, `disc-identity.test.ts`, `systems.test.ts`, `input.test.ts` | VFS por sectores; `prepareDisc` sin leer el disco; arranque por extensión; protocolo `extra`; `.cue` + pistas y `.bin` por tamaño; L2/R2 y migración |
| E2E `tests/e2e/ps1.spec.ts` | Demo 640×480 con Cruz, Círculo y Start comprobados en el canvas; tarjeta exportada (131 072 bytes); F5/F9; varios archivos elegidos a la vez; `.cue` sin pista rechazado; notas en Controles. **CI sobre `0d7b73d`** (Foundation CI, run 42259092317): 4/4 PS1 en dev y en preview en Chromium, Firefox y WebKit; suite completa en verde (Chromium 91 + 92, Firefox 91 + 92, WebKit 83 + 83 superadas, el resto omitidas por diseño); `svelte-check` sin errores |

## QA manual pendiente

1. Demo con mando físico: Cruz/Círculo en sur/este, Cuadrado/Triángulo en oeste/norte, L2/R2 en los gatillos.
1. Un juego propio que use el analógico: los sticks mueven y la cruceta sigue funcionando. Comprobar también uno solo digital, que debe seguir igual.
2. Discos propios (solo en local, nunca en git ni CI):
   - un juego `.cue` con varias pistas de audio y otro `.bin` de una pista;
   - guardar en la tarjeta desde el juego, salir y volver;
   - Partidas, F5/F9 y «Al salir»;
   - juegos PAL (50 Hz).
3. Velocidad del intérprete en escritorio y en móvil; tiempo de identificación de un disco de 700 MB al abrirlo.
4. Juegos que la BIOS HLE no arranque, para listarlos como límite.
