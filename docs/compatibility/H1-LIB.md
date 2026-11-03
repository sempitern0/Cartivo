# H1-LIB — Biblioteca local y «Continuar»

Estado: **experimental.** Un juego abierto desde archivo puede recordarse en el dispositivo y reanudarse desde el inicio con un clic, sin volver a elegir el archivo ([ADR-012](../adr/012-library-continue.md)).

## Alcance

| Pieza | Implementación |
|---|---|
| Recordar | Por defecto al abrir un archivo, sin pregunta; interruptor en «Tus juegos» (`cartivo:library:remember:v2`, solo guarda «off»). Demos excluidas; sin OPFS, nada |
| Copia | OPFS `roms/<sha256>`, escrita y verificada (relectura + SHA-256) en el Worker antes de registrar la entrada |
| Índice | IndexedDB `cartivo-library`, validado en runtime; miniatura de «Al salir» actualizada al guardar esa ranura |
| Carga | Protocolo v1 `load { stored }`; el Worker rechaza una copia cuyo SHA-256 no coincide |
| Inicio | Los tres más recientes: tarjeta grande «Continuar» y dos compactos, todos desde «Al salir» sin aviso; enlace «Ver todos tus juegos (N)» |
| `#juegos` | Búsqueda sin mayúsculas ni acentos, filtro por consola, orden reciente o por nombre (`viewGames`), Continuar, Quitar con confirmación, espacio ocupado e interruptor |
| Borrado | Quita la copia y la entrada; Partidas y SRAM intactas |

## Evidencia

| Prueba | Resultado |
|---|---|
| `tests/library.test.ts` | Validación de entradas (hash, sistema, nombre, tamaños, miniatura), orden por última partida, preferencia con almacenamiento bloqueado, protocolo `stored`/`remember`/`library-add` (una sola fuente por carga, solo archivos se recuerdan). `node --test` local: 88/88 |
| E2E `tests/e2e/library.spec.ts` | Recordar → salir → recargar → «Continuar» juega desde «Al salir» sin selector, aviso ni pregunta; «No» no crea copias y no vuelve a preguntar; quitar conserva las Partidas; copia dañada en OPFS rechazada con mensaje; inicio a 375 px sin desbordamiento; «Continuar» sin conexión en preview. **CI sobre `7763c80`** (Foundation CI, run 41341756351): 5/5 en dev (la prueba sin conexión solo aplica a preview) y 6/6 en preview; suite completa 58 superados en dev y en preview, `svelte-check` sin errores ni avisos |
| E2E tras la revisión del 2026-11-03 | Abrir un archivo lo recuerda sin preguntar; con cuatro juegos el inicio muestra tres y «Ver todos (4)»; en `#juegos` buscar, «Ningún juego coincide», orden por nombre y Continuar; desactivar el interruptor deja fuera el siguiente; quitar desde `#juegos` conserva las Partidas; sin OPFS no aparece «Tus juegos». Unitarias: `rememberGames` (v1 ignorada y borrada, «off», storage bloqueado) y `viewGames`. CI: ver la PR |

### Revisión de fiabilidad (ADR-012, 2026-11-02)

| Prueba | Resultado |
|---|---|
| `tests/library.test.ts` (OPFS falso con inyección de fallos) | Una copia verificada no se reescribe aunque la escritura vaya a fallar; una copia dañada se sustituye; una escritura fallida no deja copia rota; la poda solo borra archivos sin entrada y antiguos |
| E2E | Biblioteca sin cambios de comportamiento. **CI sobre `9bb62b4`** (Foundation CI, run 41446431302): 72 superadas en dev y 72 en preview |

## Límites

- El navegador puede borrar OPFS por falta de espacio (sobre todo Safari en iOS fuera de la app instalada). «Continuar» lo explica y el archivo se puede volver a abrir; las Partidas siguen.
- Dos pestañas: la que juega tiene el cerrojo del juego; quitarlo de la lista desde otra pestaña no interrumpe la sesión, pero la siguiente carga desde la lista fallará con mensaje claro.
- Sin carátulas ni nombre del juego: se muestra el nombre del archivo (H3).

## QA manual pendiente

1. App instalada y sin conexión: «Continuar» tras reiniciar el equipo.
2. Móvil (Android Chrome, iOS Safari instalada): cuota real, copia de un juego GBA de 16–32 MB y borrado por presión de almacenamiento.
3. Teclado y lector de pantalla en la tarjeta «Continuar» y en «Tus juegos».
