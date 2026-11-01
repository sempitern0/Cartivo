# Compatibilidad: estado y evidencia

Solo un port integrado y probado en Cartivo acredita soporte. Las demos upstream, los tests con mocks y la compatibilidad de un emulador nativo no cuentan.

| Área | Estado | Documento |
|---|---|---|
| NES · TetaNES (WASM, por defecto) | Experimental: iNES NTSC, mappers 0–4 | [H0-WASM-NES](H0-WASM-NES.md) |
| NES · ruta común y JSNES | Experimental; JSNES como alternativa | [H1-B-NES](H1-B-NES.md) |
| Entrada | Teclado y mando con perfiles; hardware pendiente | [H1-B-INPUT](H1-B-INPUT.md) |
| PWA | Instalable y offline; QA en móviles pendiente | [H1-C-PWA](H1-C-PWA.md) |
| QA de la base NES | Automático en CI; manual parcial | [H1-QA](H1-QA.md) |
| SNES, GB, GBC, GBA, SMS, Mega Drive | Pendiente (candidatos en el plan técnico) | — |
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
