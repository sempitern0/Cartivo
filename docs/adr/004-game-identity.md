# ADR-004 — Identidad regional y carátulas

Estado: propuesto. Fecha: 2026-10-30.

## Decisión propuesta

Separar juego canónico, edición regional/revisión/disco y contenido local. Identificar cartuchos con hashes normalizados según DAT y conservar hash original; discos por estructura y serial cuando exista. N64 requiere normalizar endianness `.z64/.v64/.n64`. GB/GBA y Mega Drive no ofrecen siempre un identificador único suficiente en cabecera.

Región no se infiere solo por idioma, nombre de archivo o prefijo de serial. Patched/homebrew/hacks permanecen distinguibles. Un nombre aproximado no genera una coincidencia exacta. Guardar método/evidencia y ambigüedad; no mostrar probabilidades inventadas.

Fuentes mediante adaptadores con permiso documentado, política de cuota/caché y atribución. Secrets en gateway, nunca en frontend. Gateway sin proxy arbitrario, con allowlist, límites, caché y protección SSRF/redirecciones. Solo recibe identificadores explícitamente autorizados, sin archivos ni rutas.

Carátula de edición/región exacta; si no existe, portada genérica o del usuario. Alternativas regionales requieren elección visible. Sin proveedor, toda la biblioteca y emulación siguen funcionando.

## Validación

Fixtures con mismo nombre/diferente región, mismo serial/diferente revisión, multidisco, ROM alterada, formatos N64 y datos sin coincidencia. Medir falsos positivos antes de expandir proveedores; probar rate-limit, gateway caído y offline.
