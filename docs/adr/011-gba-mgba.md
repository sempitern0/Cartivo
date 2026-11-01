# ADR-011 — Game Boy Advance con mGBA en WebAssembly

Estado: **aceptado para el incremento experimental H2-GBA**, 2026-11-01.

## Contexto

Tras GB/GBC con SameBoy (ADR-010), el titular pidió GBA. SameBoy no cubre GBA; la alternativa prevista era mGBA, que no tiene plataforma WebAssembly en upstream. GBA necesita además los botones L/R. Expediente: `docs/research/MGBA_CORE_GATE.md` (accepted, uso privado).

## Decisión

- **Entrada:** la lista común de acciones gana `l` y `r` (I/O en teclado, LB/RB en mando estándar; ADR-006, revisión). Los núcleos sin esos botones los ignoran. Los perfiles guardados se migran sin perder asignaciones.
- **Núcleo:** mGBA 0.10.5 (`26b7884`, MPL-2.0), última versión estable, sin parches, solo GBA. El envoltorio `cores/mgba/src/cartivo.c` (MIT) expone la misma ABI `cartivo_*` que el de SameBoy:
  - **BIOS HLE de mGBA**, sin cargar ninguna BIOS (`MINIMAL_CORE=2`), y arranque directo del cartucho.
  - Vídeo RGBA 240×160 (alfa forzado) y audio de blip_buf mezclado a mono a 48 kHz.
- **Guardado:** el tipo (SRAM, Flash o EEPROM) se conoce por la tabla de overrides de mGBA o cuando el juego accede a él. Para que `EmulatorCore.saveBytes` siga fijo, el envoltorio entrega a mGBA un búfer de **128 KB** (Flash 1M, el máximo) que mapea según el tipo detectado, igual que el port libretro. Toda partida GBA ocupa 128 KB en IndexedDB y en las copias exportadas (`cartivo-gba-sram-v1`). `SramStore` solo escribe cuando cambia el SHA-256.
- **Build:**
  - `cores/mgba/sources.txt` sustituye a CMake: el target libretro de mGBA (solo GBA, sin dependencias) menos el frontend y el renderer OpenGL, con `flags.h` y `version.c` generados.
  - WebAssembly autónomo `dist/mgba.wasm` (~575 KB), compilado una vez en CI y solo bajo petición (`core-mgba.yml`).
- **Compilación reproducida:** una compilación independiente en `main` dio el mismo binario. El disparo por `.build-request` ignora `main` (ADR-008).
- **Host común:** `packages/adapters/src/wasm-host.ts` reúne la carga diferida del WASM, los imports de sistema y `BridgeCore`, el `EmulatorCore` sobre la ABI `cartivo_*`. SameBoy y mGBA solo aportan su orden de botones, sus dimensiones y su `cartivo_create`.
  - Los imports son una **lista explícita** (reloj, entorno vacío, log descartado, sin archivos). Un núcleo recompilado que pida otra cosa se rechaza en `prepare()` nombrando la función que falta.
  - Un núcleo cerrado (`dispose`) rechaza cualquier llamada en vez de usar memoria liberada.
- **Sistema:** tarjeta «Game Boy Advance» (`.gba`), vídeo 240×160 a 3:2 con píxel cuadrado (Gráficos oculta las opciones redundantes) y 16 777 216 / 280 896 ≈ 59,73 Hz. mGBA se importa con `import()` solo al jugar a GBA.

## Consecuencias

- Integrar GBA no tocó el reproductor, el Worker, el protocolo ni el almacenamiento: solo la entrada (L/R), el núcleo, el registro, el sistema y el manifest.
- **Licencias:** MPL-2.0 y blip_buf LGPL-2.1+ enlazado estáticamente. Son admisibles en uso privado; publicar exigiría ofrecer las fuentes y permitir reenlazar (ver el expediente).
- Límites: algunos juegos dependen de la BIOS real; no se garantizan RTC ni sensores de cartucho (solar, giroscopio, inclinación); tampoco hay link cable, e-Reader ni filtros de color. Las instantáneas pesan unos 388 KB.
- Pendiente: QA física con juegos propios, mando con LB/RB, audio y rendimiento en móvil.
