# ADR-014 — Master System y Mega Drive con Genesis Plus GX en WebAssembly

Estado: aceptado (experimental). Fecha: 2026-11-02.

## Contexto

H2 termina con las dos consolas de Sega. El titular eligió **Genesis Plus GX**: un solo núcleo cubre Master System y Mega Drive con buena precisión, no necesita BIOS y ofrece instantáneas. La alternativa para Mega Drive, PicoDrive, es más rápida pero menos precisa y no aporta nada a Master System.

## Decisión

- **Núcleo:** Genesis Plus GX `a5834b3` (upstream sin tags), compilado por CI a WebAssembly autónomo con Emscripten 6.0.12 sobre la plantilla común (`wasm-host.ts`, ABI `cartivo_*`).
- **Puente** (`cores/genesis-plus-gx/src/cartivo.c`, MIT): conduce el frontend libretro de upstream, enlazado estáticamente.
  - La ROM se entrega en memoria (`GET_GAME_INFO_EXT`), con una extensión que fija el sistema (`.md` o `.sms`); el puente comprueba que el núcleo arrancó el sistema pedido.
  - Vídeo normalizado: **320×224** en Mega Drive (el modo H32 se estira) y **256×192** en Master System, recortando las líneas extra alrededor del centro.
  - Audio remuestreado a 48 kHz mono.
  - Batería: búfer fijo de 64 KB cuando el cartucho la tiene.
- **Un WASM, dos sistemas:** dos `CoreModule` (`sms` y `md`) con id `genesis-plus-gx` sobre el mismo binario; el sistema se elige al crear la instancia. Cada partida usa una instancia propia, sin globales compartidos.
- **`setjmp`/`longjmp` nativos de WebAssembly** (`-sSUPPORT_LONGJMP=wasm`): Musashi los usa para los errores de dirección del 68000. `wasm-host.ts` admite un único import de tipo etiqueta (`env.__c_longjmp`) y lo crea con `WebAssembly.Tag`, presente en todos los navegadores de destino.
- **Validación** (`sega-header.ts`):
  - Mega Drive: «SEGA» en `$100`; se rechazan Mega-CD, 32X y volcados SMD intercalados. Los cartuchos solo PAL se admiten desde la revisión del 2026-11-06.
  - Master System: se rechazan Game Gear (región de la cabecera «TMR SEGA») y cartuchos de Mega Drive.
- **Botones:** sin acciones nuevas, gracias a las doce de la PR A, y con etiquetas por sistema en `systems.ts`.
  - Mega Drive: A/B/C sobre Y/B/A de Cartivo, X/Y/Z sobre L/X/R y Mode sobre Select (mando de seis botones).
  - Master System: 1/2 sobre B/A y Pause sobre Start.
- **Sistemas:**
  - `sms`: `.sms`.
  - `md`: `.md`, `.gen` y `.bin`. `.bin` va a Mega Drive porque ningún otro sistema disponible la usa. Si alguno lo hace en el futuro (PS1), el reparto se decidirá entonces por contenido.
  - Ambos 4:3 y 53 693 175 / (3 420 × 262) ≈ 59,92 fps.

## Alternativas descartadas

- **PicoDrive:** menos preciso; solo compensa en hardware muy lento.
- **BlastEm:** solo Mega Drive y sin frontend libretro mantenido para WASM.
- **Excepciones de JavaScript para `longjmp`:** añadirían cuatro imports de pegamento Emscripten al host; las nativas no necesitan JavaScript.

## Consecuencias

- Licencias no comerciales (Genesis Plus GX, Musashi, el Z80 de MAME, el SVP y Nuked OPLL): admitidas mientras Cartivo sea de uso privado, con revisión antes de publicar (expediente, apartado 3).
- La instalación de la PWA crece ≈ 2,3 MB; las actualizaciones posteriores no vuelven a descargarlo si no cambia.
- **Límites:** Mega-CD, 32X, Game Gear, SG-1000, pistola Light Phaser, multitap y teclados.

## Evidencia

[GENESIS_PLUS_GX_CORE_GATE](../research/GENESIS_PLUS_GX_CORE_GATE.md) y [H2-SEGA](../compatibility/H2-SEGA.md).

## Revisión: cartuchos PAL (2026-11-06)

El puente exporta `cartivo_frame_rate` (`av.timing.fps`): Genesis Plus GX elige la región por la cabecera y emula PAL a 53 203 424 / (3420 × 313) ≈ 49,70 Hz, y el host avanza a esa cadencia (ADR-002). Las líneas extra se recortaban ya a la resolución fija. Solo cambia el puente, no las fuentes, la versión ni la licencia: un build deliberado regenera `dist`, el manifiesto y el SBOM (registro CORE-LEGAL-01 sin cambios de decisión). Master System recibe la cadencia por la misma vía, sin fixture PAL que lo pruebe. Prueba: `mdControlDemo({ pal: true })`.
