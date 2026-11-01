# ADR-003 — Archivos, persistencia y offline

Estado: propuesto. Fecha: 2026-10-30. Aceptado en parte: SRAM transaccional en IndexedDB (ADR-007) y copia de ROMs en OPFS con consentimiento ([ADR-012](012-library-continue.md)).

## Decisión propuesta

IndexedDB guarda catálogo, perfiles e índices de commits; OPFS guarda generaciones de saves y archivos copiados con consentimiento. Cache Storage contiene shell/packs y metadatos prescindibles. Acceso de archivo externo donde exista; selector `File` como fallback con posible reselección al reabrir.

IO aleatorio debe casar con el filesystem del port. No confundir `Blob.slice` asíncrono con lectura síncrona requerida por C++. El spike prueba OPFS sync en Worker, puente de IO o mecanismo asíncrono compatible antes de habilitar imágenes grandes. No cargar una ISO completa en MEMFS por defecto.

Save data independiente de states. Escribir generación nueva y comprobarla antes de confirmar su índice en transacción IndexedDB; conservar generación buena anterior. Recuperación elimina o ignora escrituras incompletas. No hay transacción atómica universal entre OPFS e IndexedDB. Writer lock por juego, con fallback seguro de segunda pestaña bloqueada si no puede coordinarse.

Actualizar solo al terminar la sesión. Pin de build de states, release manifest íntegro, rollback y migraciones no destructivas. Saves fuera del LRU. Ninguna persistencia del navegador sustituye backups exportables.

## Validación

Inyectar fallos antes/después de escribir, finalizar y confirmar índice; agotar cuota, revocar permisos, cerrar forzosamente y abrir dos pestañas. Repetir save/import-export/reinicio y comprobar checksum. Offline solo cuenta cuando shell, build y archivo son accesibles. No basar guardado en `beforeunload` ni afirmar persistencia absoluta en móvil.
