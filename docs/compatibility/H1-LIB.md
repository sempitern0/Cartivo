# H1-LIB — Biblioteca local y «Continuar»

Estado: **experimental.** Un juego abierto desde archivo puede recordarse en el dispositivo y reanudarse desde el inicio con un clic, sin volver a elegir el archivo ([ADR-012](../adr/012-library-continue.md)).

## Alcance

| Pieza | Implementación |
|---|---|
| Consentimiento | Una pregunta la primera vez que se abre un juego desde archivo; interruptor en «Tus juegos». Demos excluidas |
| Copia | OPFS `roms/<sha256>`, escrita y verificada (relectura + SHA-256) en el Worker antes de registrar la entrada |
| Índice | IndexedDB `cartivo-library`, validado en runtime; miniatura de «Al salir» actualizada al guardar esa ranura |
| Carga | Protocolo v1 `load { stored }`; el Worker rechaza una copia cuyo SHA-256 no coincide |
| Inicio | Tarjeta «Continuar» (juego más reciente, sigue desde «Al salir» sin aviso) y lista «Tus juegos» (Jugar, Quitar con confirmación, espacio ocupado) |
| Borrado | Quita la copia y la entrada; Partidas y SRAM intactas |

## Evidencia

| Prueba | Resultado |
|---|---|
| `tests/library.test.ts` | Validación de entradas (hash, sistema, nombre, tamaños, miniatura), orden por última partida, preferencia con almacenamiento bloqueado, protocolo `stored`/`remember`/`library-add` (una sola fuente por carga, solo archivos se recuerdan). `node --test` local: 88/88 |
| E2E `tests/e2e/library.spec.ts` | Recordar → salir → recargar → «Continuar» juega desde «Al salir» sin selector, aviso ni pregunta; «No» no crea copias y no vuelve a preguntar; quitar conserva las Partidas; copia dañada en OPFS rechazada con mensaje; inicio a 375 px sin desbordamiento; «Continuar» sin conexión en preview. CI: pendiente de registrar |

## Límites

- El navegador puede borrar OPFS por falta de espacio (sobre todo Safari en iOS fuera de la app instalada). «Continuar» lo explica y el archivo se puede volver a abrir; las Partidas siguen.
- Dos pestañas: la que juega tiene el cerrojo del juego; quitarlo de la lista desde otra pestaña no interrumpe la sesión, pero la siguiente carga desde la lista fallará con mensaje claro.
- Sin carátulas ni nombre del juego: se muestra el nombre del archivo (H3).

## QA manual pendiente

1. App instalada y sin conexión: «Continuar» tras reiniciar el equipo.
2. Móvil (Android Chrome, iOS Safari instalada): cuota real, copia de un juego GBA de 16–32 MB y borrado por presión de almacenamiento.
3. Teclado y lector de pantalla en la tarjeta «Continuar» y en «Tus juegos».
