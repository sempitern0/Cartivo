# H2-GBA — Game Boy Advance (mGBA)

Estado: **experimental.** GBA funciona de extremo a extremo con mGBA 0.10.5 en WebAssembly ([ADR-011](../adr/011-gba-mgba.md)): archivo local o demo → Worker → vídeo, audio, partida del cartucho y Partidas, con los botones nuevos L/R.

## Expediente

| Campo | Evidencia |
|---|---|
| Núcleo | mGBA 0.10.5 (`26b7884`), MPL-2.0; expediente [MGBA_CORE_GATE](../research/MGBA_CORE_GATE.md) |
| Build | `core-mgba.yml` sobre `8caee2b`: emsdk 6.0.12; artefacto del bot `122bdd6`, `dist/mgba.wasm` SHA-256 `a655c20f1331…` (574 942 bytes) |
| Firmware | BIOS HLE de mGBA (MPL), sin BIOS de Nintendo; arranque directo |
| Cartuchos | Cabecera con `$96` y checksum, ≤ 32 MB (`packages/adapters/src/gba-header.ts`); guardado SRAM, Flash o EEPROM en un búfer fijo de 128 KB |
| Entrada | Diez acciones: L = I y R = O en teclado, LB/RB en mando estándar |

## Fixture original

`packages/fixtures/src/gba-control-demo.ts`: ensamblador ARM y programa propios de Cartivo en modo 3, generados en memoria. ROM de 64 KB con el área del logo en blanco. SHA-256 `5fe534ccabfbf97f6b784fba1bcf8a3e46d6538dc9185c399957433502ec7b2e`.

Oráculo:
- La cruceta mueve un cuadrado blanco.
- A incrementa la SRAM (`$0E000000`) y alterna el fondo entre azul y verde.
- B suena.
- **L lo pinta amarillo y R magenta.**

## Evidencia

| Prueba | Resultado |
|---|---|
| Arnés C nativo (gcc, mismas fuentes y definiciones) | Imagen opaca, movimiento, L/R, audio a 48 kHz (1605 muestras por 2 frames), SRAM, instantánea determinista (397 312 bytes), estados corto y basura rechazados, recarga de batería; 0,78 ms por frame |
| Adaptador TS + WASM del bot en Node | Las mismas comprobaciones; 0,88 ms por frame; colores exactos 255,255,0 (L) y 255,0,255 (R) |
| `pnpm test` (local, Node 22) | 71/71, con la conformidad de `gba/mgba` y la migración de perfiles L/R |
| E2E `tests/e2e/gba.spec.ts` e `input.spec.ts` | Demo 240×160 con L/R comprobados en los píxeles del canvas; SRAM conservada al reabrir; F5/F9; `.gba` soltado; archivo dañado; L/R en Controles y asignación de diez controles. Resultado de CI en la descripción de la PR |

## QA manual pendiente

1. Demo: mover, L/R cambian el color, A cambia el fondo, B suena; salir y reabrir conserva el fondo.
2. Juegos propios de GBA (solo en local) con SRAM, Flash y EEPROM: partida del cartucho, Partidas y F5/F9.
3. Mando con LB/RB y audio reales; rendimiento en móvil.

Límites: juegos que dependen de la BIOS real; RTC y sensores no garantizados; sin link cable ni e-Reader; un jugador y audio mono.
