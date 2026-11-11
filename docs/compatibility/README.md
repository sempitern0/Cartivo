# Compatibilidad: estado y evidencia

Solo un port integrado y probado en Cartivo acredita soporte. Las demos upstream, los tests con mocks y la compatibilidad de un emulador nativo no cuentan.

| Área | Estado | Documento |
|---|---|---|
| NES · TetaNES (WASM, por defecto) | Experimental: iNES NTSC, mappers 0–4 | [H0-WASM-NES](H0-WASM-NES.md) |
| NES · ruta común y JSNES | Experimental; JSNES como alternativa | [H1-B-NES](H1-B-NES.md) |
| Entrada | Teclado y mando con perfiles, catorce acciones y botones por sistema; hardware pendiente | [H1-B-INPUT](H1-B-INPUT.md) |
| PWA | Instalable y offline; QA en móviles pendiente | [H1-C-PWA](H1-C-PWA.md) |
| Biblioteca local y «Continuar» | Experimental: ROM en OPFS con consentimiento | [H1-LIB](H1-LIB.md) |
| QA de H1 (todos los sistemas, Chromium y Firefox) | Automático en CI; manual pendiente | [H1-QA](H1-QA.md) |
| GB y GBC · SameBoy (WASM) | Experimental: sin mapper, MBC1/2/3/5 | [H2-GB](H2-GB.md) |
| GBA · mGBA (WASM) | Experimental: SRAM, Flash y EEPROM; BIOS HLE | [H2-GBA](H2-GBA.md) |
| SNES · Snes9x (WASM) | Experimental: NTSC LoROM/HiROM/ExHiROM, chips emulados | [H2-SNES](H2-SNES.md) |
| Master System y Mega Drive · Genesis Plus GX (WASM) | Experimental: cartuchos NTSC, mando de seis botones, SVP | [H2-SEGA](H2-SEGA.md) |
| PlayStation · PCSX-ReARMed (WASM) | Experimental: `.cue`/`.bin`, `.chd`, `.iso`, `.exe` y juegos de varios discos (`.m3u`) leídos bajo demanda; BIOS HLE | [H4-PS1](H4-PS1.md) |
| N64 · Mupen64Plus-Next (WebGL2 en el Worker) | Experimental: `.z64`/`.n64`/`.v64`, stick analógico, batería y Partidas; necesita WebGL2 | [H4-N64](H4-N64.md) |
| PS2 · Play! (WASM, pthreads y WebGL2) | En investigación: el núcleo compila en CI, aún sin integrar en la app | [expediente](../research/PLAY_CORE_GATE.md) |
| PSP | Aplazada | [expediente](../research/PPSSPP_CORE_GATE.md) |

## Plantilla de informe por núcleo o build

1. Sistema, núcleo, versión o commit, licencia y dependencias (enlace al expediente CORE-LEGAL-01).
2. Receta de build, toolchain, hashes y verificación reproducible.
3. Equipo, sistema, navegador y modo (pestaña o instalada).
4. Fixture autorizada con licencia, hash y oráculo. Juegos comerciales solo en pruebas privadas, nunca en git ni CI.
5. Pruebas: arranque, entrada, audio, partida, export/import, offline, suspensión y cierre.
6. Velocidad emulada, frames, p95, underruns, memoria; latencia solo con método definido.
7. Fallos, límites de formato y siguiente paso.
8. Conclusión `accepted`/`blocked` y, si procede, `experimental`/`beta`/`stable` por plataforma y build.
