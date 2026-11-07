# N64 — admisión y primer incremento experimental

Fecha: 2026-11-07. **Estado del núcleo: candidate; gate completo pendiente.** Este incremento solo incorpora código original del laboratorio y una microprueba de corutinas. No distribuye fuentes ni un binario del núcleo N64, ni cambia las licencias de Cartivo.

## Identidad fijada y evidencia primaria

Candidato: Mupen64Plus-Next, repositorio `libretro/mupen64plus-libretro-nx`, commit **15bada85906593376e8fd697f1b0b3af3a20f512** (rama develop consultada). Las siguientes conclusiones se obtuvieron leyendo ese checkout:

| Pieza                    | Evidencia                                                                                                                                                                                                                                                                            | Consecuencia                                                                                                            |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| Build web                | [Makefile](https://github.com/libretro/mupen64plus-libretro-nx/blob/15bada85906593376e8fd697f1b0b3af3a20f512/Makefile), bloque emscripten                                                                                                                                            | Vacía WITH_DYNAREC; GLES por defecto. Pedir GLES3 explícitamente y medir CPU                                            |
| Selección de renderer    | [Makefile.common](https://github.com/libretro/mupen64plus-libretro-nx/blob/15bada85906593376e8fd697f1b0b3af3a20f512/Makefile.common)                                                                                                                                                 | GLES3 selecciona glsym_es3; revisar imports/extensiones y linker final                                                  |
| Cooperación con frontend | [libretro.c](https://github.com/libretro/mupen64plus-libretro-nx/blob/15bada85906593376e8fd697f1b0b3af3a20f512/libretro/libretro.c), retro_init/retro_run/retro_deinit                                                                                                               | co_create/co_switch forman parte del ciclo real; no basta añadir un canvas                                              |
| libco incluido           | [libco.c](https://github.com/libretro/mupen64plus-libretro-nx/blob/15bada85906593376e8fd697f1b0b3af3a20f512/libretro-common/libco/libco.c), [sjlj.c](https://github.com/libretro/mupen64plus-libretro-nx/blob/15bada85906593376e8fd697f1b0b3af3a20f512/libretro-common/libco/sjlj.c) | Sin caso específico WASM; fallback usa sigaltstack, sigaction y SIGUSR1. Se propone sustituirlo por un puente de fibers |
| Fibers Emscripten        | [API oficial](https://emscripten.org/docs/api_reference/fiber.h.html) y header del SDK instalado                                                                                                                                                                                     | Requieren Asyncify. La microprueba valida cooperación local, no rendimiento N64                                         |

Toolchain usada para la microprueba: **Emscripten 6.0.12**, compilador `5488e0871d46d19a3209988190fa6a653126256f`; SDK release `6e9f6885cb17a3d6c8fd488a5cff730f50aba61d`. No usar `latest` en una receta del núcleo.

## CORE-LEGAL-01 pendiente del artefacto completo

- LICENSE raíz del candidato: [GPL v2](https://github.com/libretro/mupen64plus-libretro-nx/blob/15bada85906593376e8fd697f1b0b3af3a20f512/LICENSE). Verificar las cabeceras de los componentes efectivamente compilados antes de concluir si cada parte es only/or-later.
- Inventariar GLideN64, RSP HLE, libretro-common, libco, dependencias de imagen/compresión y runtime del compilador. Identificar exclusiones concretas de paraLLEl/Angrylion y componentes no utilizados, no inferirlas solo por el nombre del núcleo.
- El puente experimental es original del repositorio; no se ha copiado código de libco ni asignado una nueva licencia al proyecto. Su incorporación a un artefacto enlazado requiere revisar la licencia resultante según la política vigente.
- Firmware/microcódigo: limitar inicialmente a cartuchos N64, sin 64DD, Transfer Pak, BIOS externas ni recursos propietarios; confirmar los requisitos efectivos del build antes de admitirlo.
- SBOM, manifiesto de fuentes, hashes de artefactos, avisos y decisión de admisión del núcleo: **pendientes**. No generar registros que aparenten un build ya existente.
- Uso privado según política vigente; no inferir que Worker, carga dinámica o repositorios separados resuelven la distribución de un trabajo combinado.

## Decisiones del primer incremento

1. No cambiar contrato RGBA, registros, PS1, Player, PWA ni preferencias. La PR #35 sigue siendo propietaria del trabajo activo de perfiles/foco.
2. Probar primero capacidad real de Worker/OffscreenCanvas/WebGL2 y el mecanismo de cooperación de WASM, por separado.
3. El canvas de diagnóstico hace **un** readback de un píxel para verificar el resultado de clear. La futura presentación GPU no debe leer el framebuffer cada frame.
4. No pedir COOP/COEP globalmente. La microprueba no usa hilos; eso todavía no demuestra que todo el núcleo funcione sin ellos.
5. No simular un núcleo ni exponer N64 como disponible. El laboratorio identifica claramente que no ejecuta juegos.
6. Cero workflows nuevos, cero disparos de compilación remota y ninguna alteración de cachés/matrices. La próxima compilación del núcleo será deliberada y solo después de acotar las dependencias.

## Verificación de este incremento

- PASS: Emscripten 6.0.12, `node experiments/n64/check-fibers.mjs`: 100 sesiones, 10.000 cesiones, pila local restaurada, heap WASM acotado tras calentamiento. Assertions y comprobación de desbordamiento activadas. No es un benchmark.
- PASS: siete unitarias del laboratorio, tipos estrictos y build Vite aislado.
- PASS: integridad de todos los núcleos existentes (`pnpm verify:core`).
- Navegador: instalación Playwright no pudo descargar un ZIP válido. Chromium del sistema tampoco arrancó: `socket() failed: Operation not permitted`. Los E2E dev quedan bloqueados antes del cuerpo de las pruebas; preview y GPU física pendientes. No repetir el mismo lanzamiento en este entorno ni presentarlo como fallo del núcleo.
- PASS: `pnpm check` (cero errores y warnings), `pnpm lint` y `pnpm test` (157/157, incluidas las siete pruebas nuevas). PASS: `pnpm build` y build aislado del laboratorio; el precache de producción conserva sus 32 archivos (7,5 MB), sin assets N64.

## Siguiente acción concreta

Revisar de nuevo main/#35. Mantener el spike aislado. Completar el inventario y preparar un build local del commit fijado con GLES3, intérprete y renderer sin hilos; sustituir el libco seleccionado por el puente comprobado, enlazando Asyncify. Verificar las opciones reales del Makefile (no suponer que STATIC_LINKING produce un módulo listo para cargar).

El frontend debe implementar la negociación libretro de contexto/framebuffer, opciones, entrada analógica, audio, temporización, carga/cierre y callbacks. Elegir glue modular de Emscripten con imports acotados; no emular el framebuffer RGBA actual con readPixels. Probar una fixture original antes de medir juegos locales. Mantener gate bloqueado si falta licencia, procedencia o artefacto reproducible.

Después medir overhead de Asyncify, profundidad de pila, consumo de CPU, audio y estabilidad sostenida; comprobar si el intérprete cumple. Solo una sesión jugable y repetible permite pasar a integración de producto. Si no cumple, registrar no-go o soporte experimental limitado en vez de ampliar abstracciones.
