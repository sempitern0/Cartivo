# Compatibilidad: estado y evidencia

Solo un port integrado y probado en Cartivo acredita soporte. Las demos upstream, los tests con mocks y la compatibilidad de un emulador nativo no cuentan.

| Área | Estado | Documento |
|---|---|---|
| NES · TetaNES (WASM, por defecto) | Experimental: iNES NTSC, mappers 0–4 | [H0-WASM-NES](H0-WASM-NES.md) |
| NES · ruta común y JSNES | Experimental; JSNES como alternativa | [H1-B-NES](H1-B-NES.md) |
| Entrada | Teclado y mando con perfiles; hardware pendiente | [H1-B-INPUT](H1-B-INPUT.md) |
| PWA | Instalable y offline; QA en móviles pendiente | [H1-C-PWA](H1-C-PWA.md) |
| Biblioteca local y «Continuar» | Experimental: ROM en OPFS con consentimiento | [H1-LIB](H1-LIB.md) |
| QA de la base NES | Automático en CI; manual parcial | [H1-QA](H1-QA.md) |
| GB y GBC · SameBoy (WASM) | Experimental: sin mapper, MBC1/2/3/5 | [H2-GB](H2-GB.md) |
| GBA · mGBA (WASM) | Experimental: SRAM, Flash y EEPROM; BIOS HLE | [H2-GBA](H2-GBA.md) |
| SNES · Snes9x (WASM) | Experimental: NTSC LoROM/HiROM/ExHiROM, chips emulados | [H2-SNES](H2-SNES.md) |
| Master System y Mega Drive · Genesis Plus GX (WASM) | Experimental: cartuchos NTSC, mando de seis botones, SVP | [H2-SEGA](H2-SEGA.md) |
| SMS, Mega Drive | Pendiente (Genesis Plus GX elegido) | — |
| N64, PS1, PSP | Pendiente; riesgo de licencia GPL | — |
| PS2 | Laboratorio pendiente | — |

## Plantilla de informe por núcleo o build

1. Sistema, núcleo, versión o commit, licencia y dependencias (enlace al expediente CORE-LEGAL-01).
2. Receta de build, toolchain, hashes y verificación reproducible.
3. Equipo, sistema, navegador y modo (pestaña o instalada).
4. Fixture autorizada con licencia, hash y oráculo. Juegos comerciales solo en pruebas privadas, nunca en git ni CI.
5. Pruebas: arranque, entrada, audio, partida, export/import, offline, suspensión y cierre.
6. Velocidad emulada, frames, p95, underruns, memoria; latencia solo con método definido.
7. Fallos, límites de formato y siguiente paso.
8. Conclusión `accepted`/`blocked` y, si procede, `experimental`/`beta`/`stable` por plataforma y build.
