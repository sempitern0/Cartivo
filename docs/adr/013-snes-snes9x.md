# ADR-013 — SNES con Snes9x en WebAssembly

Estado: aceptado (experimental). Fecha: 2026-11-02.

## Contexto

H2 sigue con SNES. El titular eligió **Snes9x**: es rápido, está probado en web, ofrece instantáneas y no necesita BIOS. La alternativa, ares (ISC), es más precisa pero pesada para WASM sin hilos, sobre todo en móvil.

## Decisión

- **Núcleo:** Snes9x 1.63 (`921f9f7`), compilado por CI a WebAssembly autónomo con Emscripten 6.0.12, sobre la misma plantilla que SameBoy y mGBA (`wasm-host.ts`, ABI `cartivo_*`).
- **Puente** (`cores/snes9x/src/cartivo.cpp`, MIT): conduce el frontend libretro de Snes9x, enlazado estáticamente.
  - Vídeo normalizado a **256×224** RGBA: alta resolución promediando columnas, entrelazado con una línea de cada dos y overscan recortado.
  - Audio 32 040 → 48 000 Hz mono por interpolación lineal.
  - SRAM e instantáneas como bytes.
- **Global por instancia:** Snes9x guarda el estado en globales; cada partida usa una instancia WASM propia (`BridgeCore`), así que no se comparte nada entre juegos.
- **Validación** (`snes-header.ts`):
  - LoROM, HiROM o ExHiROM, con cabecera copier de 512 bytes opcional.
  - Se rechazan BS-X, Sufami Turbo, Super Game Boy y ST018.
  - ~~Se rechazan los cartuchos PAL~~: desde la revisión del 2026-11-06 se admiten (ver abajo).
- **Botones:** nuevas acciones `x` (U, botón norte del mando estándar) e `y` (J, oeste). Los perfiles guardados se migran como con L/R y el protocolo v1 las trata como opcionales.
- **Sistema:** `snes`, extensiones `.sfc` y `.smc`, 4:3, 21 477 272 / 357 366 ≈ 60,10 fps.

## Alternativas descartadas

- **ares:** riesgo de rendimiento en WASM sin hilos.
- **bsnes:** misma familia que ares, igual de pesado.
- **Recompilar para quitar los dos imports de archivos:** gastar minutos de CI por funciones que nunca se llaman; el host las cubre con ENOSYS.

## Consecuencias

- Licencia no comercial: admitida mientras Cartivo sea de uso privado; requiere revisión antes de publicar (expediente, apartado 3).
- La instalación de la PWA crece unos 2,2 MB; las actualizaciones posteriores no vuelven a descargarlo si no cambia.
- Límites: reloj S-RTC sin guardar, periféricos (ratón, Super Scope) y multitap.

## Evidencia

[SNES9X_CORE_GATE](../research/SNES9X_CORE_GATE.md) y [H2-SNES](../compatibility/H2-SNES.md).

## Revisión: cartuchos PAL (2026-11-06)

El puente exporta `cartivo_frame_rate` (`av.timing.fps`): Snes9x detecta PAL por la cabecera (región 2–12) y lo emula a 21 281 370 / 425 568 ≈ 50,01 Hz, y el host avanza a esa cadencia (ADR-002). Las líneas extra de PAL ya se recortaban a 256×224 y el audio se remuestrea igual. Solo cambia el puente, no las fuentes, la versión ni la licencia de Snes9x: un build deliberado regenera `dist`, el manifiesto y el SBOM (registro CORE-LEGAL-01 sin cambios de decisión). Prueba: la fixture propia con región Europa (`snesControlDemo({ pal: true })`).
