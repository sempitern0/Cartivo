# ADR-012 — Biblioteca local y «Continuar»

Estado: aceptado (experimental). Fecha: 2026-11-01. Acepta parcialmente [ADR-003](003-local-data.md) para la copia de ROMs en OPFS.

## Contexto

Para seguir una partida había que volver a elegir el archivo en cada visita, aunque las Partidas y la SRAM ya se conservaban por hash de ROM. El objetivo del titular es «elegir consola, cargar juego y jugar» con el mínimo de pasos.

## Decisión

- **Consentimiento, una sola vez:** la primera vez que se abre un juego desde archivo, el reproductor pregunta «¿Recordar tus juegos en este dispositivo…?». La respuesta (`cartivo:library:remember:v1`) se aplica a los siguientes y se cambia en «Tus juegos». Las demos nunca se recuerdan.
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

## Alternativas descartadas

- **File System Access (handles persistentes):** no existe en Safari ni Firefox y exige volver a conceder el permiso. Puede añadirse después como alternativa sin copia.
- **Guardar la ROM en IndexedDB:** blobs de hasta 32 MB en la misma base que el índice. OPFS separa los datos voluminosos y permite lectura síncrona en Worker, que hará falta para discos (H4).
- **Recordar siempre sin preguntar:** copia archivos del usuario sin consentimiento explícito.
- **Aviso al pulsar Continuar:** decisión del titular, «seguir directamente».

## Consecuencias

- OPFS puede vaciarse por presión de almacenamiento, sobre todo en iOS fuera de la app instalada. En ese caso «Continuar» explica que hay que volver a abrir el archivo; las Partidas no dependen de la copia. `navigator.storage.persist()` se pide en la app instalada (H1-C).
- «Tus juegos» muestra lo que ocupan las copias y la estimación del navegador.
- No hay identificación por nombre ni carátulas; eso queda para H3 (ADR-004).

## Evidencia

Ver [H1-LIB](../compatibility/H1-LIB.md).
