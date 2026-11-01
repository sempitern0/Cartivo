# H2-GB — Game Boy y Game Boy Color (SameBoy)

Estado: **experimental.** GB y GBC funcionan de extremo a extremo con SameBoy v1.0.4 en WebAssembly ([ADR-010](../adr/010-gb-sameboy.md)): archivo local o demo → Worker → vídeo, audio, SRAM y Partidas.

## Expediente

| Campo | Evidencia |
|---|---|
| Núcleo | SameBoy v1.0.4 (`98da08c`), Expat; expediente [SAMEBOY_CORE_GATE](../research/SAMEBOY_CORE_GATE.md) |
| Build | `core-sameboy.yml` sobre `c6b1750`: emsdk 6.0.12 y rgbds v1.0.4; artefacto del bot `7c8c798`, `dist/sameboy.wasm` SHA-256 `65131c5958e2…` (189 824 bytes) |
| Firmware | Boot ROMs libres de SameBoy, por hash en `cores/sameboy/manifest.json`; sin BIOS de Nintendo |
| Cartuchos | Sin mapper, MBC1, MBC2, MBC3 (+reloj) y MBC5, ≤ 8 MB, con checksum de cabecera (`packages/adapters/src/gb-header.ts`) |
| Hardware | DMG-B o CGB-E según `$0143` de la cabecera |

## Fixture original

`packages/fixtures/src/gb-control-demo.ts`: ensamblador SM83 y programa propios de Cartivo, generados en memoria. Cartucho MBC1+RAM+batería de 32 KB con el área del logo en blanco.

| Variante | SHA-256 |
|---|---|
| DMG (`$0143 = $00`) | `345ade5be97b87b75e7d9146dc1fc5417644d1c12b941ca17ab6e35404eb358d` |
| CGB (`$0143 = $80`) | `bd7372a3adc67eab4074c2d40f7215f0509657e696f2ffb8c2b90f7f803f764e` |

Oráculo:
- La cruceta mueve un cuadrado.
- A incrementa `$A000` en la SRAM y alterna el color de fondo: gris en DMG, verde o azul en CGB.
- B emite un pulso por el canal 1.

## Evidencia

| Prueba | Resultado |
|---|---|
| Arnés C nativo (gcc, mismas fuentes y flags) | DMG y CGB: imagen, la entrada mueve el cuadrado, 803,5 muestras por frame (59,73 Hz), SRAM 8 KB y contador, instantánea ida y vuelta con repetición idéntica, estado corrupto rechazado sin alterar la máquina, recarga de batería |
| Adaptador TS + WASM del bot en Node | Las mismas comprobaciones con `dist/sameboy.wasm`; ~2,6 ms por frame |
| `pnpm test` (local en Node 22 y en CI con Node 24) | 66/66, incluida la conformidad de `gb/sameboy` y `gbc/sameboy` |
| `tests/gb.test.ts` (WASM del bot en Node) | La cabecera elige el hardware: la fixture DMG solo produce grises y la CGB, color. MBC3+reloj: `saveBytes` = 8 KB + 48 B (pie vba64); la marca de tiempo es la hora real; con la app «cerrada» tres horas, el reloj avanza unas 3 h al reabrir y la RAM se conserva |
| E2E `tests/e2e/gb.spec.ts` | Demo GB y GBC con 160×144 y SRAM conservada al reabrir; F5/F9; `.gbc` soltado abre GBC; archivo dañado rechazado; Gráficos sin opciones redundantes. **CI sobre `9fdb533`** (Foundation CI, run 41311681735): 6/6 en dev y 6/6 en preview; suite completa 48 superados en dev y 47 en preview, `svelte-check` sin errores |

## QA manual pendiente

1. Demo de Game Boy y de Game Boy Color: mover, A cambia el color, B suena; salir y reabrir conserva el color.
2. Un juego propio de GB y otro de GBC (solo en local): arranque, partida de batería, Partidas, F5/F9.
3. Un juego con reloj (MBC3), con un juego real: la hora avanza con el sistema también tras cerrar la app (el automatismo ya lo comprueba con la fixture).
4. Mando físico y audio reales; Firefox/Safari; móvil.

Límites: un jugador, audio mono, sin Super Game Boy, cable link, cámara, impresora ni sensores. El RTC no es determinista tras restaurar una instantánea.
