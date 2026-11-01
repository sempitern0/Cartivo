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

`packages/fixtures/src/gba-control-demo.ts`: ensamblador ARM y programa propios de Cartivo en modo 3, generados en memoria. ROM de 64 KB con el área del logo en blanco. Cuatro variantes guardan el contador con el protocolo real de cada chip:

| Variante | Protocolo | SHA-256 |
|---|---|---|
| `sram` (por defecto, la demo) | Escrituras de byte en `$0E000000` | `5fe534ccabfbf97f6b784fba1bcf8a3e46d6538dc9185c399957433502ec7b2e` |
| `flash` | Escritura en `$0E005555` (detección) y programa `$AA`/`$55`/`$A0` | `72dcd416bbf088cbf663ee10117e04e2c1ecef918af608040c7533a8f78d2f2e` |
| `eeprom` | Peticiones serie de 9 y 73 bits por DMA 3 a `$0D000000` (chip de 512 B) | `4532a510d7ac21eb03881a8901f67fcf550b1e8fd98456fa5c1f629c152939e3` |
| `none` | Sin chip: contador en la RAM de trabajo | `526a5a4b2d764d6ca4b6c85435b434101e230a3a4e7b1217a39974aa72130533` |

Los búferes de EEPROM están en la IWRAM: si los literales de una ROM pequeña apuntan sobre todo a la EWRAM, la heurística de mGBA la trata como imagen multiboot (`GBAIsMB`) y la ejecuta desde la EWRAM.

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
| `tests/gba-saves.test.ts` (WASM del bot) | **SRAM, Flash y EEPROM**: con el chip recién borrado el contador es `$FF`; A lo pone a `$00` en el primer byte del chip; al reabrir con esa partida el juego **lo relee** (fondo verde) y una segunda pulsación escribe `$01`. En Flash, `$5555` y `$2AAA` siguen borrados: los comandos van al chip, no hay caída a SRAM. Sin chip, el búfer queda entero a `$FF` |
| `tests/wasm-host.test.ts` | Los dos núcleos solo importan funciones permitidas; un módulo con un import desconocido se rechaza nombrándolo; estados de tamaño erróneo rechazados sin parar el núcleo; tras `dispose` toda llamada falla con error claro |
| Coste del búfer fijo | `SramStore` solo escribe cuando cambia el SHA-256: un juego sin guardado escribe 128 KB una vez (y la generación anterior). Calcular el SHA-256 de 128 KB cada 120 frames cuesta unos 0,24 ms (Node 22) |
| `pnpm test` (local en Node 22 y en CI con Node 24) | 82/82, con la conformidad de `gba/mgba`, la migración de perfiles L/R y el protocolo v1 sin L/R |
| E2E `tests/e2e/gba.spec.ts` e `input.spec.ts` | Demo 240×160 con L/R comprobados en los píxeles del canvas; SRAM conservada al reabrir; F5/F9; `.gba` soltado; archivo dañado; L/R en Controles y asignación de diez controles. **CI sobre `03b88df`** (Foundation CI, run 41316064341): 4/4 GBA y L/R en dev y en preview; suite completa 53 superados en dev y 52 en preview, `svelte-check` sin errores |

## QA manual pendiente

1. Demo: mover, L/R cambian el color, A cambia el fondo, B suena; salir y reabrir conserva el fondo.
2. Juegos propios de GBA (solo en local) con SRAM, Flash (512 y 1M) y EEPROM (512 B y 8 KB): partida del cartucho tras cerrar y reabrir, Partidas y F5/F9. Los protocolos ya están cubiertos con la fixture; falta comprobarlos con juegos reales y su detección por la tabla de mGBA.
3. Mando con LB/RB y audio reales; rendimiento en móvil.

Límites: juegos que dependen de la BIOS real; RTC y sensores no garantizados; sin link cable ni e-Reader; un jugador y audio mono.
