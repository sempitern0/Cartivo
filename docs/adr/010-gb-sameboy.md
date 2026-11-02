# ADR-010 — Game Boy y Game Boy Color con SameBoy en WebAssembly

Estado: **aceptado para el incremento experimental H2-GB**, 2026-11-01.

## Contexto

GB/GBC es el siguiente sistema del roadmap y la primera prueba real de la base multiconsola (ADR-002, `docs/ADDING_A_SYSTEM.md`). El titular eligió SameBoy para GB/GBC y dejó GBA para un incremento posterior con mGBA y botones L/R, con **dos tarjetas** en inicio. Expediente: `docs/research/SAMEBOY_CORE_GATE.md` (accepted).

## Decisión

- **Núcleo:** SameBoy v1.0.4 (`98da08c`, Expat), sin parches, con el envoltorio `cores/sameboy/src/cartivo.c`:
  - Solo emula: ROM, SRAM e instantáneas entran y salen como bytes. No hay sistema de archivos, hilos ni ritmo de host.
  - Fuentes y flags del build libretro de SameBoy (sin depurador, trucos, rewind ni temporización propia).
  - Hardware: DMG-B o CGB-E según la cabecera del cartucho (`$0143` bit 7), no según la extensión ni la tarjeta. Un juego compatible con color se ve en color.
  - Vídeo: RGBA 160×144 con la corrección de color por defecto de SameBoy (*modern balanced*) y su paleta gris para DMG. Audio: filtro de paso alto *accurate*, mezclado a mono a 48 kHz.
  - Semilla aleatoria fija: SameBoy solo la usa para el patrón de RAM al encender, así que los arranques son reproducibles.
- **Firmware:** boot ROMs libres de SameBoy (`dmg_boot`, `cgb_boot`), ensambladas en CI con rgbds desde su código y registradas por hash. No muestran ni verifican arte de Nintendo si la cabecera no lo trae.
- **Build:**
  - WebAssembly autónomo (`STANDALONE_WASM`, `dist/sameboy.wasm`, ~190 KB), sin JS de Emscripten. `packages/adapters/src/sameboy.ts` lo instancia sobre el host común `wasm-host.ts` (desde ADR-011), que aporta los imports de sistema: reloj, log descartado y stubs «no soportado».
  - Toolchain fijada en `cores/sameboy/toolchain.json`: emsdk 6.0.12 y rgbds v1.0.4.
  - `core-sameboy.yml` compila **solo bajo petición** (`cores/sameboy/.build-request` o `workflow_dispatch`); `pnpm verify:core` comprueba hashes y licencias sin compilar.
- **Compilación:** el disparo por `.build-request` solo actúa en ramas de trabajo (ver ADR-008, «Disparo solo en ramas de trabajo»). Una compilación independiente en `main` reprodujo el mismo binario.
- **Contrato:**
  - El tamaño de la SRAM pasa del módulo al núcleo (`EmulatorCore.saveBytes`): en Game Boy varía por cartucho (0–128 KB, más el reloj de MBC3). NES sigue con 8 KB y sus partidas no cambian.
  - `SystemInfo.frameRate` hace que el reproductor avance al ritmo del hardware: 4 194 304 / 70 224 ≈ 59,73 Hz en GB, mientras que NES sigue a 60. Sin esto, el audio a 48 kHz se acumularía.
- **Carga diferida:** el Worker importa el adaptador de SameBoy con `import()` y compila el WASM solo al empezar un juego de GB/GBC; Vite emite los Workers como módulos ES. El service worker sigue precacheando todo (≈190 KB más) para jugar sin conexión.
- **Cartuchos:** sin mapper, MBC1, MBC2, MBC3 (con reloj) y MBC5 (rumble ignorado), de hasta 8 MB, con checksum de cabecera. MMM01, MBC6, MBC7, Pocket Camera, TAMA5 y HuC1/3 se rechazan nombrando el tipo (`packages/adapters/src/gb-header.ts`).
- **Partidas:** las instantáneas de SameBoy van en las mismas ranuras (ADR-009). La SRAM se guarda como `gb-sram-v1:<hash>` y `gbc-sram-v1:<hash>`, y las copias exportadas como `cartivo-gb-sram-v1` y `cartivo-gbc-sram-v1`.

## Consecuencias

- Añadir GB/GBC tocó lo que preveía el mapa de `ADDING_A_SYSTEM.md`, más dos cambios de base que salieron de la evidencia (`saveBytes` y `frameRate`) y un ajuste de interfaz: Gráficos oculta las opciones de proporción cuando el píxel es cuadrado.
- En juegos con reloj (MBC3+TIMER), el RTC sigue la hora del sistema: tras restaurar una instantánea, la repetición no es determinista.
- Pendiente: QA física con juegos propios de GB y GBC, mando y audio reales, Firefox/Safari y rendimiento en móvil. Tampoco hay paletas DMG alternativas, opciones de corrección de color, Super Game Boy ni cable link.
