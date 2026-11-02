# H2-SEGA — Master System y Mega Drive (Genesis Plus GX)

Estado: **experimental.** Master System y Mega Drive funcionan de extremo a extremo con Genesis Plus GX en WebAssembly ([ADR-014](../adr/014-sms-md-genesis-plus-gx.md)): archivo local o demo → Worker → vídeo, audio, batería del cartucho y Partidas. Mega Drive usa el mando de seis botones.

## Expediente

| Campo | Evidencia |
|---|---|
| Núcleo | Genesis Plus GX `a5834b3`, licencia no comercial propia; expediente [GENESIS_PLUS_GX_CORE_GATE](../research/GENESIS_PLUS_GX_CORE_GATE.md) |
| Build | `core-genesis-plus-gx.yml` sobre `8cc09ce`, emsdk 6.0.12; commit del bot `7d354d6`; `dist/genesis-plus-gx.wasm` SHA-256 `58c38e7bcf34…` (2 348 726 bytes) |
| Firmware | Ninguno: arranque directo; TMSS y BIOS de Master System nunca se cargan |
| Cartuchos | Mega Drive NTSC o multirregión ≤ 10 MB (Mega-CD, 32X, SMD intercalado y solo PAL, rechazados); Master System ≤ 4 MB (Game Gear rechazado) |
| Entrada | Mega Drive: A/B/C en J/K/L, X/Y/Z en I/U/O, Mode en Select. Master System: 1/2 en K/L, Pause en Start |

## Fixtures originales

Las dos son programas propios de Cartivo, de 64 KB y con RAM de batería.

**`md-control-demo.ts`** (emisor 68000; SRAM en `$200001`). SHA-256 `f100be25d067e91aff81f4f2e0ecc406c372bfc1175aede409b4880c40c9e2ff`.
- La cruceta mueve un sprite.
- C incrementa la SRAM; su paridad decide el fondo, azul (par) o verde (impar).
- B pone el fondo rojo.
- A, X, Y y Z pintan el sprite amarillo, cian, magenta y naranja.

**`sms-control-demo.ts`** (emisor Z80; mapper de Sega y RAM del cartucho en `$8000`). SHA-256 `e8d347fefc7a7cb5a725195981609e0320233a849b3d4ce1bf15d3221a3f2370`.
- La cruceta mueve un sprite.
- El botón 2 cuenta en la RAM y cambia el fondo entre azul y verde.
- El botón 1 pinta el sprite amarillo.

## Evidencia

| Prueba | Resultado |
|---|---|
| Arnés C nativo (gcc, mismas fuentes y opciones) | Ver el expediente, apartado 6: Mega Drive 0,43 ms/frame, Master System 0,23 |
| `tests/sega.test.ts` (WASM del bot) | Cabeceras (Mega-CD, 32X, SMD, PAL, Game Gear, archivos dañados); orden de bits libretro; oráculos completos de las dos consolas; ≈ 48 000 muestras/s; la batería se relee al reabrir; 0,70 (MD) y 0,38 (SMS) ms/frame en Node local |
| `tests/core-conformance.test.ts`, `wasm-host.test.ts` | Contrato completo en los dos sistemas; solo imports permitidos (incluida la etiqueta `__c_longjmp`); estados de tamaño erróneo rechazados; `dispose` seguro |
| E2E `tests/e2e/sega.spec.ts` | Demo de Mega Drive 320×224 con A/B/C/X/Y/Z comprobados en el canvas y ayuda de pausa con las etiquetas propias; demo de Master System 256×192; SRAM exportada (`cartivo-md-sram-v1`, `cartivo-sms-sram-v1`, 65 536 bytes) y conservada al reabrir; F5/F9; `.gen` soltado; `.md` dañado; notas en Controles. Pendiente de CI |

## QA manual pendiente

1. Demos con mando: en Mega Drive, A/B/C en oeste/sur/este y X/Y/Z en LB/norte/RB; Pause de Master System en Start.
2. Juegos propios (solo en local):
   - Mega Drive de 3 y de 6 botones, uno con batería y uno con SVP (Virtua Racing);
   - Master System con y sin batería;
   - Partidas y F5/F9.
3. Rendimiento en móvil.
