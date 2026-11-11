# H4-PS2 — PlayStation 2 (Play!)

Estado: **experimental.** PlayStation 2 funciona en la app con Play!: la consola corre en su propio hilo y su GS dibuja con WebGL2 sobre el lienzo del juego dentro del Worker ([ADR-022](../adr/022-ps2-play.md)). El flujo es: imagen de disco local o demo → Worker → vídeo en la GPU, audio y Partidas. La compatibilidad y el rendimiento con juegos comerciales **no están medidos**.

## Expediente

| Campo | Evidencia |
|---|---|
| Núcleo | Play! `1f27232` (BSD-2-Clause; dependencias BSD, MIT, Zlib y dominio público); expediente [PLAY_CORE_GATE](../research/PLAY_CORE_GATE.md), **accepted (uso privado)** |
| Build | `core-play.yml` (run 43109997432) sobre `f1ceea0`, emsdk 6.0.12; commit del bot `2bbb8f7`; `dist/play.wasm` SHA-256 `5be0e1fe9720…` (2 483 711 bytes) y `dist/play.js` `c70d3a1771bd…` |
| Firmware | BIOS por HLE del núcleo (kernel del EE y módulos del IOP). Sin BIOS de Sony |
| Requisitos | Página aislada (COOP/COEP, [ADR-020](../adr/020-cross-origin-isolation.md)), WebGL2 y `OffscreenCanvas` en Workers; se comprueban antes de descargar el núcleo y, si faltan, se explica el motivo |
| Formatos | Imágenes de un solo archivo: `.iso`, `.chd`, `.cso` e `.isz`, leídas bajo demanda; ejecutables `.elf`. Fuera: `.cue`/`.bin` y multidisco |
| Vídeo | 640×448 a 4:3; un juego PAL (512 líneas) se ajusta a esa superficie. Resolución 1x |
| Cadencia | 59,94 Hz; 50 Hz para discos europeos (`SLES`, `SCES`, `SLED`, `SCED`) |
| Entrada | DualShock 2 por posición, como PlayStation: Cruz/Círculo en B/A, Cuadrado/Triángulo en Y/X, L1/R1, L2/R2 y los dos sticks. Sin L3/R3 ni vibración |
| Guardado | Partidas con el estado de Play! (zip comprimido: 18 833 bytes en la demo). **Sin memory card:** lo que el juego guarde en ella se pierde al salir |

## Pruebas

- **Unitarias** (`tests/ps2.test.ts`, `tests/systems.test.ts`): contrato en UI y Worker, la fixture (ELF e imagen ISO 9660), el ensamblador MIPS, la forma de zip de una Partida y el reparto de `.iso`/`.chd` entre PlayStation y PS2 por tamaño.
- **Adaptador de producción en Chromium headless (SwiftShader)**, con un banco que lo carga sin la UI desde un servidor con COOP/COEP:
  - la demo `.elf` arranca en 0,5 s; menos de 1 ms por fotograma;
  - colores del oráculo con Cruz, Círculo y Start;
  - Partida guardada y restaurada; una que no es un zip se rechaza y el juego sigue;
  - la demo como imagen `.iso` arranca con 9 lecturas del archivo y a 50 Hz (región PAL);
  - un segundo juego sobre el mismo lienzo cierra el primero;
  - un archivo que no es un disco de PS2 se rechaza con un mensaje.
- **E2E** (`tests/e2e/ps2.spec.ts`): demo, colores por captura de pantalla, F5/F9 con miniatura y la imagen `.iso` abierta desde el selector de archivos. En un motor sin WebGL2 en Workers se salta con el motivo.
  - CI: pendiente del run sobre este cambio.

## Pendiente (QA del titular)

- Juegos comerciales propios: qué arranca, a qué velocidad y con qué fallos gráficos, en una GPU real.
- Audio en un juego real (la demo no suena).
- Salir y volver con una Partida de un juego real.
