# Carga, CI y descubrimiento — 2026-11-06

Base: `main` 5f74afb; esta iteración parte de la PR #30 (`e1f0037`). La PR #31 (`b6c805b`) añade cadencia PAL; no se sustituyen ni recompilan sus núcleos.

## Evidencia y cambios

| Área | Cuello de botella observado | Cambio |
|---|---|---|
| CI | [Run 42214858616](https://github.com/sempitern0/Cartivo/actions/runs/42214858616): instalación WebKit agotada tras 492–493 s, antes de los tests; descarga de `libcodec2` en el espejo Azure/Ubuntu resolute. | Runner E2E fijado a Ubuntu 24.04; caché por SO/arquitectura/Playwright; límites de red apt y espejo oficial archive.ubuntu.com en lugar del espejo Azure observado; instalador oficial de dependencias sin parsear texto ni omitir fuentes. |
| CI | Siete instalaciones E2E para tres navegadores. [Run 42213373610](https://github.com/sempitern0/Cartivo/actions/runs/42213373610): instalación 11–36 s; tests 4–139 s por job. | Tres jobs, cada uno ejecuta dev y preview; Chromium añade subruta. Se conservan las siete combinaciones y sus evidencias en directorios distintos. |
| ROM guardada | SHA-256 en `readRom` y de nuevo en `load`, más una copia JavaScript de la ROM por hash. | Una lectura y un hash verificado; sin copia adicional de ArrayBuffer ordinario. |
| ROM nueva | Preparación del núcleo antes de validar; hash y preparación seriales. | Rechazo temprano y operaciones independientes solapadas. |
| Almacenamiento | Lista de snapshots después de esperar la biblioteca. | Consultas en paralelo; se conserva el orden de escritura/verificación de ROM e índice y la exclusión entre pestañas. |
| Agentes | Abrir Player, Worker, almacenamiento y pruebas completos aporta unos 104 000 caracteres antes de localizar un símbolo. | `pnpm context load` devuelve solo 15 rutas, líneas y tamaños. Los caracteres no se presentan como tokens ni como ahorro facturado. |

El run 42215212100 tardó 15 min 18 s desde su creación hasta completarse, pero incluyó un reintento: el primer WebKit agotó casi diez minutos instalando. No debe confundirse con tiempo de ejecución de tests ni atribuirse todo a cola.

Agrupar jobs reduce instalaciones y consumo agregado; puede alargar el camino crítico cuando todos los runners están disponibles. Se necesita CI antes/después para medir ese equilibrio. No se reduce cobertura ni se considera un reintento una corrección del problema.

## Microbenchmark reproducible

`node tools/bench-rom-hash.mjs`: bytes sintéticos, Node 24.22.1, nueve muestras alternando orden tras calentamiento. Compara el antiguo trabajo de hash de ROM guardada (dos hashes con copia) con uno sin copia adicional.

| Tamaño | Mediana anterior | Mediana nueva |
|---|---:|---:|
| 1 MiB | 1,55 ms | 0,59 ms |
| 8 MiB | 11,64 ms | 4,33 ms |
| 32 MiB | 59,51 ms | 20,97 ms |

No son tiempos de arranque de juegos ni resultados de móvil. La preparación completa ahora se muestra en el diagnóstico de pausa; incluye Worker/ROM/núcleo/almacenamiento, excluye la espera humana y la restauración posterior de snapshot. Sin telemetría ni nombres de archivos en el benchmark.

## Límites y próximos pasos

- Verificación local: 133 tests, núcleos, tipos, formato y build completos. Integración local con #31: 134 tests, núcleos, tipos y build correctos; único conflicto en el apéndice de CHANGELOG de #30/#31, conservando ambos textos. E2E local dev/preview bloqueado por `socket(): Operation not permitted`; la CI remota debe acreditar los navegadores.
- Se conserva la recreación del núcleo cuando existe SRAM: su tamaño exacto depende del núcleo. Evitarla exige un contrato explícito de importación de batería y pruebas de todos los adaptadores.
- La escritura/verificación inicial de OPFS puede seguir dominando en almacenamiento lento. No se difiere sin garantizar el cierre y la recuperabilidad.
- QA física pendiente: suspensión móvil, audio, mando real, almacenamiento restringido y partidas grandes. La caché de navegadores no elimina una caída del espejo apt.
