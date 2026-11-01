# H1-B NES — ruta jugable y JSNES

Estado: **experimental.** NES funciona de extremo a extremo (archivo local o demo → Worker → vídeo, audio y SRAM). El núcleo por defecto es TetaNES en WebAssembly ([H0-WASM-NES](H0-WASM-NES.md)); este documento cubre la ruta común y JSNES 2.1.0, que queda como alternativa y comparador ([ADR-007](../adr/007-nes-experimental-js.md)).

## JSNES: expediente

| Campo | Evidencia |
|---|---|
| Núcleo | JSNES 2.1.0, JavaScript en Worker |
| Fuente | [bfirsh/jsnes @ cbad9f1](https://github.com/bfirsh/jsnes/tree/cbad9f1db57dfb275b90ffa26f9c479c355d8d5c), Apache-2.0, Copyright 2020 Ben Firshman |
| Integridad | `cores/jsnes/manifest.json`: 51 archivos por git blob SHA; `pnpm verify:core` los comprueba antes del build |
| Dependencias y parches | Ninguna dependencia runtime; sin parches; ESM `src/index.js` con tree shaking. No se usa el frontend ni ROMs de upstream |
| Avisos | `LICENSES.md` y `apps/web/public/licenses/` |

## Cartuchos admitidos (todos los núcleos)

`packages/adapters/src/ines.ts`: iNES NTSC sin trainer, VS ni extensiones; SRAM ≤ 8 KB; mappers 0 (NROM), 1 (MMC1), 2 (UxROM), 3 (CNROM) y 4 (MMC3) con topes PRG/CHR por placa. NES 2.0, PAL, FDS y archivos truncados se rechazan con un mensaje que indica el mapper o el tamaño. Que un `.nes` cargue no implica soporte general.

## Fixture original

`packages/fixtures/src/control-demo.ts`: ensamblador y programa 6502 propios de Cartivo (PolyForm), generado en memoria. NROM-128, SRAM 8 KB, 24 592 bytes, SHA-256 `5e4c943666130bd0dba705b585bd029fc19f939a6509fc956d2ae443b09afd71`. Oráculo: un cuadrado blanco sobre fondo de color; la cruceta lo mueve, A incrementa `$6000` y cambia el fondo, B emite un pulso APU. Al reabrir se conserva el contador de SRAM, no la posición.

## Ruta común

- Worker por sesión, protocolo v1 validado, una petición activa, timeout de 10 s; vídeo RGBA del tamaño del sistema (NES 256×240) y audio transferidos.
- AudioWorklet mono a 48 kHz con cola de 250 ms, activado tras gesto del usuario sin bloquear el arranque.
- Abrir Controles, perder foco o visibilidad, o desconectar el mando pausa y neutraliza la entrada; reanudar exige soltar los botones.
- SRAM por hash de ROM: dos generaciones SHA-256 en una transacción IndexedDB, Web Lock de escritor único, commit cada 120 frames y al pausar/cerrar, export/import JSON (`cartivo-nrom-sram-v1`) con identidad y checksum, recuperación de la generación anterior si la actual está dañada. «Reiniciar consola» guarda antes de reiniciar.

## Partidas (instantáneas)

Cualquier juego, con o sin batería, puede guardarse en tres ranuras y en «Al salir», con «Continuar donde lo dejaste» al reabrir y F5/F9 ([ADR-009](../adr/009-save-states.md)). Los estados van ligados a núcleo y versión; los de otro núcleo, otra versión o dañados se rechazan con un mensaje y se conservan.

## Evidencia automática

Unitarios (`tests/nes.test.ts`, `tests/tetanes.test.ts`, `tests/snapshots.test.ts`): fixture, entrada, audio, SRAM y restauración en ambos núcleos y mappers 1–4; instantáneas deterministas en UxROM sin batería; validación de formato, ranuras y protocolo. E2E de Partidas (`tests/e2e/saves.spec.ts`): ranuras, «Continuar», «Empezar de nuevo», F5/F9, cancelar el selector, pestaña oculta y ciclos sin Workers huérfanos. Resistencia (`tests/e2e/integrity.spec.ts`): 100 ciclos alternando núcleos y partidas dañadas o de otra versión. Matriz completa: [H1-QA](H1-QA.md). E2E en Chromium (dev y build de producción): emulación real, SRAM/export/import/reapertura, rechazo de archivo y copia ajena, escritor único, generación dañada, mando sintético y desconexión, remapeo aplicado, cancelación de carga, Focus, pantalla completa, escalado y cambio de núcleo.

## QA manual pendiente

1. Demo: mover, A cambia el color, B suena. Pausar → «Partida guardada»; salir y volver a abrir conserva el color.
2. Copias de partida: exportar e importar en el mismo juego; una copia de otro juego debe rechazarse.
3. Abrir Controles en partida, cambiar una tecla y reanudar: se aplica.
4. Misma demo en dos pestañas: la segunda se rechaza.
5. Contra o cualquier juego sin batería: Partidas → Guardar aquí, Salir, volver a abrir → Continuar; F5/F9.
6. Mando físico (modelo, conexión, navegador) registrado en [GAMEPAD_BROWSER_QA](../research/GAMEPAD_BROWSER_QA.md).

Abiertos: escucha física, Firefox/Safari, suspensión móvil, presupuestos de rendimiento, exportar Partidas. Un jugador, audio mono.
