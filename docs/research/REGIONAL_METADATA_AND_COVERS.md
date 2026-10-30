# Catálogo, identificación regional y carátulas — investigación

**Estado:** contrato de evaluación, no implementación. Complementa [ADR-004](../adr/004-game-identity.md), sin sustituirlo.

## Objetivo

Una biblioteca local debe identificar con rigor **sistema, obra, edición, región, revisión, disco/UMD, variante y archivo local**, mostrar carátula solo si existe una fuente autorizada y permitir corrección manual. El usuario juega aun sin internet, proveedor o carátula.

## Identidad ≠ nombre del archivo

| Soporte | Señales principales | Riesgos y validación |
|---|---|---|
| NES/SNES/SMS/Mega Drive | CRC32/MD5/SHA-1/SHA-256 sobre contenido definido por DAT; normalización de cabeceras si corresponde | Cabeceras, trainers, overdumps, hacks, parches y revisiones; hash exacto siempre ligado a una regla de normalización versionada |
| GB/GBC/GBA | Hash de ROM y campos internos *solo como pistas* | Cabeceras/títulos truncados o repetidos; región no inferida por idioma |
| N64 | Canonicalizar endianness `.z64`, `.v64`, `.n64` **sin cambiar la fuente** | Misma ROM puede tener distintas representaciones; conservar bytes hash originales y canonización usada |
| PS1 | Serial extraído de metadatos/estructura de disco cuando sea verificable; hash de manifest/imagen | Serial solo no distingue siempre revisión, edición o disco; formatos BIN/CUE/PBP/CHD requieren rutas de lectura diferentes |
| PSP | Identificadores disponibles dentro de la imagen UMD y hash | Títulos físicos/digitales, múltiples ediciones; no asumir identidad por `ULUS/ULES` solamente |
| PS2 (lab) | Serial de disco y huella de imagen/manifest | Región/disco/revisión distintas; extraction no garantizada para todos los formatos |

No inventar region IDs ni decodificar serial a carátula directamente: **serial + sistema → edición candidata; validación por hashes/atributos → edición confirmada**. Títulos/homebrew sin coincidencia quedan como `unmatched`, nunca falsamente exactos.

### Entidades sugeridas (no schema de producción)

```text
GameWork { workId, canonicalTitle }
GameEdition { editionId, workId, systemId, region[], languages[], revision?, discIndex?, discCount?, sourceIds[] }
LocalContent { localId, editionId?, fileKind, rawSha256?, normalizedHash?, normalizationId?, serial?, confidenceMethod, source }
ArtworkCandidate { editionId?, provider, providerItemId, region?, imageType, rights, attribution, expiresAt?, exactMatch }
UserOverride { localId, selectedEditionId?, customCover?, appliedAt }
```

Reglas de identificación: `exact-hash`, `verified-serial-plus-manifest`, `manual`, `heuristic`, `unmatched`; **no usar una puntuación porcentual sin calibración**. Una coincidencia heurística se muestra como sugerencia sin atribución de edición exacta.

## Pipeline propuesto

1. Usuario selecciona archivo/ficheros locales; comprobar formato y límite; conservar datos en el dispositivo.
2. Extraer señales en Worker con cancelación; para ISOs grandes, leer rangos para firma/serial y calcular hash total **solo si se acepta el coste**, con progreso y sin bloquear UI.
3. Reconciliar contra DAT autorizado en la versión exacta y proveedor elegido; guardar procedencia, tipo de hash, URL/versión y evidencia.
4. Separar `GameWork` de `GameEdition`; para multidisco agrupar por edición y dejar cada disco identificable.
5. Solicitar metadatos y arte únicamente con permiso y política de datos aplicable: claves en gateway autorizado, cuotas, atribución, caché, baja de contenido y términos de uso.
6. Fallback: carátula exacta regional → genérica autorizada del mismo título **con aviso de región distinta** → cubierta local del usuario → placeholder original de Cartivo.
7. Permitir corregir región/título/caratula, ver fuente, eliminar caché y ejecutar completamente offline sin lookup.

## Proveedores a evaluar, sin autorización asumida

| Fuente | Valor | Diligencia pendiente |
|---|---|---|
| [Libretro Database](https://github.com/libretro/libretro-database) | Identificación de dumps por checksum y nombre unificado | Derecho a redistribuir DAT, procedencia de sus fuentes, formato por sistema y actualizaciones |
| [Libretro Thumbnails](https://github.com/libretro-thumbnails) | Carátulas asociadas por nombres | Licencias y derechos de cada imagen; el nombre coincidente no garantiza región exacta |
| [ScreenScraper](https://www.screenscraper.fr/) | Región, medios y ROM hashes; conocido por integraciones como RomM | Condiciones API, autorización, claves developer, límites, caché y derechos de imágenes; no copiar credenciales de RomM |
| [IGDB](https://api-docs.igdb.com/) | Descripción, ediciones e imágenes | Cuenta y secreto, términos de exposición/caché/atribución; evitar enviar ROMs |
| [Hasheous](https://hasheous.org/) | Consulta por huella y reconciliación | Verificar servicio/condiciones, datos compartidos, disponibilidad y privacidad; no depender de uno solo |

[RomM: referencia de proveedores](https://github.com/rommapp/docs/blob/main/docs/getting-started/metadata-providers.md) muestra integración práctica, pero **sus credenciales y licencias de uso no se transfieren a Cartivo**.

## Pruebas identificativas (fixtures legales únicamente)

- Dos regiones del mismo juego, mismo nombre de archivo: seleccionar carátulas distintas, si autorizadas.
- Mismo serial, distinta revisión o disco: **no fusionar** sin otras evidencias.
- N64 mismo contenido en los tres byte-orders → identidad normalizada común, hashes originales diferentes.
- ROM modificada, hack o traducción → no reclasificar como dump original de forma automática.
- ISO grande con lectura parcial, cancelación y error I/O: sin corrupción de biblioteca.
- Sin conexión, 429, 403, provider timeout, respuesta corrupta o arte no autorizado → placeholder y posibilidad de jugar.
- Usuario selecciona otra carátula y deshace selección; conservar preferencia local.

### Condiciones de aceptación META-01

No registrar falsos positivos en corpus controlado, mostrar procedencia y nivel de evidencia, y comprobar importación/selección offline. Antes de liberar carátulas automáticas: autorización documentada para API **y** imágenes; auditoría de caché, borrado y atribución. No incorporar un dataset de ROMs comerciales o carátulas de terceros al repositorio.
