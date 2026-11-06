# H2-SNES — Super Nintendo (Snes9x)

Estado: **experimental.** SNES funciona de extremo a extremo con Snes9x 1.63 en WebAssembly ([ADR-013](../adr/013-snes-snes9x.md)): archivo local o demo → Worker → vídeo, audio, batería del cartucho y Partidas, con los botones nuevos X/Y.

## Expediente

| Campo | Evidencia |
|---|---|
| Núcleo | Snes9x 1.63 (`921f9f7`), licencia no comercial propia; expediente [SNES9X_CORE_GATE](../research/SNES9X_CORE_GATE.md) |
| Build | `core-snes9x.yml` sobre `7d02636`, emsdk 6.0.12; commit del bot `ac8ab35`; `dist/snes9x.wasm` SHA-256 `10477cc67fcd…` (2 268 757 bytes) |
| Firmware | Ninguno. Chips emulados en código; BS-X, Sufami Turbo, Super Game Boy y ST018 rechazados |
| Cartuchos | LoROM, HiROM y ExHiROM NTSC, ≤ 8 MB (+512 de cabecera copier) |
| Entrada | Doce acciones: X = U e Y = J en teclado; norte y oeste del mando estándar |

## Fixture original

`packages/fixtures/src/snes-control-demo.ts`: emisor 65816 y programa propios de Cartivo; LoROM de 32 KB con 2 KB de SRAM con batería. SHA-256 `f173f52b44b65eeccc5880c41376ee6eb90534aed8456bd4b6a74a20022709d1`.

**Oráculo:**
- La cruceta mueve un sprite blanco.
- A incrementa la SRAM (`$70:0000`); su paridad decide el fondo, azul (par) o verde (impar).
- B lo pone rojo mientras se mantiene.
- X, Y, L y R pintan el sprite amarillo, cian, magenta y naranja.

## Evidencia

| Prueba | Resultado |
|---|---|
| Arnés C++ nativo (g++, mismas fuentes y opciones) | Ver el expediente, apartado 6; 0,42 ms/frame |
| `tests/snes.test.ts` (WASM del bot) | Cabecera (LoROM, cabecera copier; BS-X, Sufami, SGB, ST018 y archivos dañados rechazados; PAL admitido); orden de bits libretro; oráculo completo; ≈ 48 000 muestras/s; la batería se relee al reabrir; ≈ 1,2 ms/frame en Node |
| `tests/core-conformance.test.ts`, `wasm-host.test.ts` | Contrato completo; solo imports permitidos; estados de tamaño erróneo rechazados sin parar el núcleo; `dispose` seguro |
| E2E `tests/e2e/snes.spec.ts` | Demo 256×224 con X/Y/L/R comprobados en el canvas; SRAM exportada (`cartivo-snes-sram-v1`, 2048 bytes) y conservada al reabrir; F5/F9; `.sfc` soltado; archivo dañado; X e Y en Controles. **CI sobre `7df7716`** (Foundation CI, run 41419426567): 5/5 SNES en dev y en preview; suite completa 66 superados en dev y 66 en preview, `svelte-check` sin errores ni avisos; Snes9x 0,94 ms/frame en el runner; precarga total 32 archivos, 4,4 MB |

## QA manual pendiente

1. Demo con mando: X/Y en los botones norte y oeste, L/R en LB/RB.
2. Juegos propios (solo en local): LoROM y HiROM con batería, uno con Super FX o SA-1, uno de alta resolución o entrelazado; Partidas y F5/F9.
3. Rendimiento en móvil (Snes9x es el núcleo más pesado hasta ahora).

**PAL (2026-11-06):** `tests/wasm-host.test.ts` comprueba que el núcleo informa ≈ 60,10 Hz (NTSC) y ≈ 50,01 Hz (fixture con región Europa); `tests/e2e/pal.spec.ts` comprueba que juega a menos de 55 fotogramas/s y muestra «50,01 Hz (PAL)». Falta la QA con un cartucho PAL real.
