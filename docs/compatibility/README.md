# Compatibilidad: estado y evidencia

Estado por incremento: [H1-B NES](H1-B-NES.md) (núcleo JSNES experimental), [H1-B Entrada](H1-B-INPUT.md) y [H1-C PWA](H1-C-PWA.md) (instalación y offline). Las etiquetas de objetivo del plan no describen soporte logrado.

| Sistema | Estado de evaluación actual | Evidencia mínima para aceptación |
|---|---|---|
| NES | Experimental (JSNES, JS en Worker); gate WASM pendiente | Mapper, input, audio, SRAM y reinicio offline |
| SNES | Pendiente | Chips/firmware por juego, guardado y sincronización |
| GB / GBC | Pendiente | Mapper, RTC, paleta/color y persistencia |
| GBA | Pendiente | BIOS libre integrada, Flash/EEPROM/SRAM y audio |
| SMS / Mega Drive | Pendiente; riesgo de licencia | Núcleo distribuible, región, audio, mando 3/6 botones |
| N64 | Pendiente | Backend web, endianness, 4 mandos y tipos de save/Pak |
| PS1 | Pendiente | HLE sin firmware externo, memory cards y multidisco |
| PSP | Pendiente | Build web funcional, ISO, analógico y Memory Stick |
| PS2 | Pendiente; laboratorio | Play!.js, HLE, ISO grande, input y guardado persistente |

## Plantilla de informe por spike/build

1. Sistema, candidato, URL upstream, commit y licencia/dependencias.
2. Receta reproducible, toolchain, flags, parches, build ID y hashes.
3. Equipo real, SO, navegador/versión, modo pestaña/PWA y cabeceras.
4. Fixture autorizado, licencia, hash, formato y tamaño. Títulos comerciales solo en pruebas privadas obtenidas legítimamente; no subir sus archivos a git/CI.
5. Comandos y pasos de prueba: arranque, input, audio, persistencia, export/import, offline, suspensión y cierre.
6. Duración, velocidad emulada, frames presentados, p95, underruns, pico de memoria y datos brutos. Latencia end-to-end solo con método de medición definido.
7. Casos fallidos, reproducción, límites de formato/archivo, diagnóstico y acción siguiente.
8. Conclusión: accepted/blocked y, solo si se acepta, stable/beta/experimental por plataforma y build.

No copiar estados de compatibilidad del emulador nativo como resultados web. La prueba de mock acredita el contrato; una demo upstream acredita existencia; únicamente el port integrado y probado acredita soporte en Cartivo.
