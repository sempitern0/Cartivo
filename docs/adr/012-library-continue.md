# ADR-012 — Biblioteca local y «Continuar»

> Revisión: [ADR-018](018-shared-library-ux.md) sustituye el ámbito del catálogo y documenta la migración. Las partidas y los recientes siguen separados por perfil.
Estado: aceptado (experimental). Fecha: 2026-11-01. Acepta parcialmente [ADR-003](003-local-data.md) para la copia de ROMs en OPFS.

## Contexto

Para seguir una partida había que volver a elegir el archivo en cada visita, aunque las Partidas y la SRAM ya se conservaban por hash de ROM. El objetivo del titular es «elegir consola, cargar juego y jugar» con el mínimo de pasos.

## Decisión

- **Consentimiento, una sola vez** (sustituido por la revisión del 2026-11-03: se recuerda por defecto): la primera vez que se abre un juego desde archivo, el reproductor pregunta «¿Recordar tus juegos en este dispositivo…?». La respuesta (`cartivo:library:remember:v1`) se aplica a los siguientes y se cambia en «Tus juegos». Las demos nunca se recuerdan.
- **Datos:**
  - Índice en IndexedDB `cartivo-library`: hash, sistema, nombre, tamaño, fechas y miniatura de «Al salir». Se valida en runtime al leerlo (`packages/storage/src/library.ts`).
  - Copia de la ROM en OPFS como `roms/<sha256>`, escrita y leída **solo en el Worker** de emulación, con handle síncrono cuando existe y `createWritable` si no.
- **Orden de escritura:** ROM → relectura y SHA-256 → entrada del índice. Si falla (cuota incluida), se borra la copia, el juego sigue y se avisa. No hay transacción atómica entre OPFS e IndexedDB; una entrada sin copia válida falla al cargar con un mensaje claro y no se borra nada.
- **Carga:** `load { stored: <sha256> }` en el protocolo v1. El Worker comprueba que la copia tiene **exactamente** ese SHA-256 antes de validar la cabecera y ejecutarla.
- **«Continuar» en inicio:** el juego recordado más reciente, con miniatura. Carga la ranura «Al salir» y empieza **sin aviso intermedio**; sin esa partida, empieza normal. «Jugar» desde la lista mantiene el aviso «Continuar donde lo dejaste».
- **Quitar de la lista** borra la copia y la entrada. Las Partidas (`cartivo-states`) y la SRAM (`cartivo-saves`) están en otros almacenes y **no se tocan**: al volver a abrir el archivo, el juego sigue donde estaba.
- Los archivos no salen del dispositivo; no hay metadatos remotos.

### Revisión 2026-11-02: escrituras recuperables

Cambios de la auditoría del titular:
- **Copias direccionadas por contenido:** si `roms/<hash>` ya existe y su tamaño y hash coinciden, recordar el juego no la reescribe. Solo se escribe una copia ausente o dañada, y solo esa se borra si no se puede verificar. Un fallo de cuota al recordar otra vez un juego ya no puede borrar su copia válida.
- **Orden índice/copia:** al recordar, primero la copia verificada y después la entrada; al quitar, primero la entrada y después la copia. Una interrupción deja como mucho un archivo huérfano, nunca una entrada que apunte a una copia ausente.
- **Poda:** al abrir el inicio, en segundo plano, se borran los archivos de `roms/` sin entrada con más de 24 h. El margen evita competir con una escritura del Worker en curso.

### Revisión 2026-11-03: recordar por defecto y página «Tus juegos»

Decisión del titular tras usar la app: la pregunta confundía y Cartivo es de uso privado y local.
- **Sin pregunta:** abrir un archivo lo recuerda (`load` con `remember`), salvo que el jugador lo desactive en «Tus juegos». La preferencia pasa a `cartivo:library:remember:v2` y solo guarda `"off"`; la clave v1 ya no se lee, así que la respuesta antigua no cuenta. Si el navegador no deja guardar la preferencia, se recuerda. Las demos siguen sin recordarse y, sin OPFS, no se recuerda nada.
- **Protocolo:** se retira `library-add`, cuyo único uso era responder a la pregunta.
- **Inicio:** los tres juegos más recientes; el primero en la tarjeta grande **Continuar** y dos compactos, todos desde «Al salir», más «Ver todos tus juegos (N)».
- **`#juegos`:** página propia con búsqueda (sin mayúsculas ni acentos), filtro por consola, orden reciente o por nombre, **Continuar** y **Quitar**, espacio ocupado e interruptor. La lógica de la vista es pura (`viewGames` en `library.ts`). Mientras hay un juego abierto, la página no se ofrece, para no sustituir una sesión sin su cierre.

## Alternativas descartadas

- **File System Access (handles persistentes):** no existe en Safari ni Firefox y exige volver a conceder el permiso. Puede añadirse después como alternativa sin copia.
- **Guardar la ROM en IndexedDB:** blobs de hasta 32 MB en la misma base que el índice. OPFS separa los datos voluminosos y permite lectura síncrona en Worker, que hará falta para discos (H4).
- ~~**Recordar siempre sin preguntar:** copia archivos del usuario sin consentimiento explícito.~~ Reconsiderada en la revisión del 2026-11-03: la copia nunca sale del navegador y el interruptor la desactiva.
- **Aviso al pulsar Continuar:** decisión del titular, «seguir directamente».

## Consecuencias

- OPFS puede vaciarse por presión de almacenamiento, sobre todo en iOS fuera de la app instalada. En ese caso «Continuar» explica que hay que volver a abrir el archivo; las Partidas no dependen de la copia. `navigator.storage.persist()` se pide en la app instalada (H1-C).
- «Tus juegos» muestra lo que ocupan las copias y la estimación del navegador.
- No hay identificación por nombre ni carátulas; eso queda para H3 (ADR-004).

## Evidencia

Ver [H1-LIB](../compatibility/H1-LIB.md).

### Revisión 2026-11-06: coste de carga

`prepareRom` lee una vez y calcula una sola identidad. En la biblioteca, ese hash se verifica contra la copia solicitada antes de preparar el núcleo; no se confía únicamente en el nombre OPFS. En archivos nuevos se valida la cabecera antes de preparar y se solapan hash y preparación del núcleo. WebCrypto recibe la vista exacta sin una copia JavaScript adicional (excepto memoria compartida). La lista de partidas y la actualización de biblioteca se consultan en paralelo después de abrir el almacenamiento. Una carga fallida libera sus locks y recursos sin borrar partidas.

Se conserva la verificación tras escribir OPFS y se espera a confirmar la biblioteca antes de declarar la carga completa. Diferirla hasta después del primer frame requiere otro contrato de cierre; no se cambia para ganar tiempo a costa de una copia incompleta. El diagnóstico en pausa muestra el tiempo de preparación desde la creación del Worker hasta la respuesta `load`, sin espera del jugador ni restauración posterior de un snapshot.
