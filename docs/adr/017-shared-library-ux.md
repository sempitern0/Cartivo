# ADR-017 — Biblioteca común y reanudación por perfil

Estado: aceptado. Fecha: 2026-11-07.

## Objetivo

Elegir consola → cargar ROM → jugar. Los perfiles del dispositivo comparten los títulos disponibles, pero conservan sus partidas, controles, capturas y recientes. Esta decisión sustituye el ámbito de biblioteca personal de ADR-012 y ADR-016; no modifica el aislamiento de las partidas.

## Catálogo y migración

- `cartivo-catalogue` contiene solo hash, sistema, nombre, tamaño y fecha de incorporación. No guarda capturas ni fechas de juego personales.
- Los índices `cartivo-library[@perfil]` conservan el historial personal. Al leer la biblioteca se migran los títulos de los perfiles conocidos al catálogo común, sin borrar sus índices antiguos. Un marcador por perfil hace la importación repetible; las bajas explícitas se registran para que otra migración no resucite títulos eliminados.
- Antes de borrar un perfil se migra su catálogo. La biblioteca compartida permanece, mientras las bases personales se eliminan como antes.
- Quitar un título requiere una confirmación que indica que afecta a todos los perfiles. No elimina SRAM ni Partidas. Las copias OPFS sin título se limpian en una visita posterior, respetando la antigüedad mínima de 24 horas del archivo. El espacio no se libera necesariamente al instante.
- La escritura de una ROM y la poda comparten el Web Lock `cartivo:catalogue`, evitando que una limpieza borre una copia mientras se publica.
- Los juegos en CD siguen abriéndose desde sus archivos; esta PR no añade persistencia de discos, cores ni N64.

## Reanudación

`cartivo-states[@perfil]` pasa a versión 2. La actualización crea `meta` y deriva metadatos de los registros existentes en una sola transacción de actualización. Los bytes y hashes originales no se modifican. Guardar/importar y borrar actualizan `states` y `meta` atómicamente.

El inicio consulta ese índice sin leer todos los snapshots completos:

| Situación | Acción principal |
| --- | --- |
| Guardado «Al salir» compatible | Continuar |
| Solo ranuras manuales compatibles | Cargar partida (la más reciente) |
| Sin snapshot compatible | Jugar |

La selección lleva al reproductor la ranura y el core que corresponden. El Worker sigue comprobando compatibilidad e integridad al cargar; el índice no sustituye esa comprobación. «Jugar» arranca la consola y conserva el funcionamiento habitual de la memoria de batería. No se promete recuperar una sesión que el navegador cerró antes de confirmar su guardado.

Si la actualización está bloqueada por otra pestaña antigua, se informa al usuario. Una apertura que termine después del error cierra su conexión. Una versión anterior de la aplicación que solicite explícitamente la versión 1 no podrá abrir la base ya actualizada: el rollback del código requiere contemplar este cambio de esquema, sin borrar datos del usuario.

## Interfaz

- Entrada a «Tus juegos» siempre visible con un perfil activo, también con la biblioteca vacía.
- Inicio con instrucción visible; recientes exclusivos del perfil actual y etiquetas de acción acordes al snapshot.
- Búsqueda y orden de biblioteca conservados al volver de jugar; restauración del foco en el botón de lanzamiento.
- Gestión de títulos bajo «Opciones» y confirmación explícita de la baja compartida.
- Ajustes con accesos a interfaz, controles y biblioteca; distribución de consolas estable al cambiar de mando a ratón.
- Controles táctiles de al menos 44 px en filtros y acciones modificadas; se conserva la regla global de movimiento reducido. Sin dependencias CSS nuevas.

## Validación y alcance

Pruebas unitarias para aislamiento del catálogo y selección compatible. E2E para compartir un juego entre perfiles, conservar las partidas al borrar un perfil, reanudar una ranura manual, restaurar filtros/foco y migrar índices antiguos sin alterar bytes ni resucitar bajas.

La revisión visual en móvil real y mando físico sigue siendo necesaria. El menú de pausa unificado y una reorganización completa de los paneles del reproductor quedan fuera de esta iteración; se mantiene su comportamiento actual.
