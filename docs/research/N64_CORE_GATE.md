# N64 — admisión y primer incremento experimental

Fecha: 2026-11-07. **CORE-LEGAL-01: accepted (uso privado)**, ver la [decisión](#core-legal-01-decisión). El núcleo se compila en CI (`cores/mupen64plus-next`, `tools/build-mupen64plus-next.mjs`). Solo lo carga el laboratorio; la app no lo registra hasta el gate de viabilidad.

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

## CORE-LEGAL-01: decisión

**accepted (uso privado).** Todas las licencias están identificadas y son libres. Habilita compilar y versionar el núcleo mientras Cartivo no se distribuya; no lo convierte en publicable.

- **Licencias:** las del [inventario](#inventario-del-artefacto) y el SBOM que genera la receta (`cores/mupen64plus-next/sbom.json`). Textos en `apps/web/public/licenses/mupen64plus-next-LICENSE.txt` (GPL-2.0 raíz; el workflow lo compara con el checkout) y `mupen64plus-next-NOTICES.txt` (GLideN64 y sus terceros, libpng, mupen64plus-core y zlib, copiados del commit fijado).
- **Si se publicara Cartivo:**
  - la GPL enlazada estáticamente obligaría a ofrecer las fuentes correspondientes (receta reproducible, commit, parche y frontend) y afectaría a la licencia del conjunto, que hoy es PolyForm Noncommercial;
  - GLideN64 declara GPL-2.0 sin «or later» e incluye código derivado de gles2n64 bajo LGPL-3.0, una combinación que conviene revisar jurídicamente antes de distribuir.
  - No es asesoramiento legal.
- **Firmware:** ninguno externo, solo cartuchos N64 (sin 64DD, Transfer Pak ni BIOS). PIF y CIC son HLE del núcleo e IPL3 viene en cada cartucho.
- **Partidas (ADR-009):** el núcleo implementa `retro_serialize`. Se integra o se rechaza con motivo en la fase 5, con su formato ligado a núcleo y versión.
- **Trazabilidad:** build en CI con emsdk 6.0.12 (LLVM 24), `--verify` para reproducibilidad y hashes en `manifest.json`. `pnpm verify:core` lo comprobará en cuanto existan los artefactos del bot.
- **Worker y carga diferida** no crean independencia jurídica del trabajo combinado.

## Inventario del artefacto

Lo enlazado por `tools/build-mupen64plus-next.mjs` (antes por la receta del laboratorio): 270 objetos del target `emscripten` de upstream, con GLES3, sin dynarec y sin hilos usados. Las licencias se leyeron en los archivos del checkout fijado.

| Componente | Objetos | Licencia (archivo del checkout) |
|---|---|---|
| mupen64plus-core (CPU, intérprete en caché, PIF/CIC HLE, memoria) y `custom/mupen64plus-core` | 65 | GPL-2.0-or-later (`mupen64plus-core/LICENSES`) |
| GLideN64 (RDP por GL, uCodes, GLideNHQ, OpenGLContext; el envoltorio con hilos se enlaza pero no se usa) | 131 | GPL-2.0-only (`GLideN64/LICENSE`: «version 2»; la mayoría de sus fuentes no tienen cabecera). Terceros en `GLideN64/licenses/`: gles2n64 LGPL-3.0, GLSL-FXAA MIT, Glow MIT, readerwriterqueue BSD-2-Clause y Zlib |
| mupen64plus-rsp-hle | 14 | GPL-2.0-or-later (`mupen64plus-rsp-hle/LICENSES`) |
| Frontend libretro del núcleo (`libretro/libretro.c`) | 1 | GPL-2.0-or-later (cabecera; `LICENSE` raíz con la GPL-2.0) |
| libretro-common (audio, glsm, glsym, VFS, streams…; su libco.o queda en el archivo, pero no se enlaza) | 23 | MIT |
| libpng 1.6.34 y zlib 1.2.8 incluidos (`custom/dependencies`) | 30 | Libpng y Zlib |
| minizip y md5 (`mupen64plus-core/subprojects`) | 4 | Zlib y licencia de L. Peter Deutsch (tipo zlib) |
| `cores/mupen64plus-next/src/frontend.c` y `cooperative.c` (Cartivo) | 2 | código original del repositorio |

- **No se compilan:** paraLLEl-RDP, paraLLEl-RSP (con GNU lightning), cxd4, angrylion ni el dynarec.
- **Parche aplicado:** `cores/mupen64plus-next/patches/emu-thread-entry.patch`, dos funciones en `libretro/libretro.c`. La entrada de la corutina se llama con el tipo `void (void)` que espera libco, porque WebAssembly detiene las llamadas indirectas con otro tipo. Es candidato a enviarse upstream.
- **Firmware:** ninguno externo. El PIF y el CIC son HLE del núcleo, y cada cartucho trae su propio IPL3; la demo de Cartivo lo sustituye por código original.

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

## Verificación de la sesión 2 (2026-11-07)

- **Build local exploratorio:** Emscripten 4.0.10 con LLVM 21, no la toolchain fijada, porque el registro de Emscripten 6.0.12 no era accesible en este entorno. Resultado: `n64-core.wasm` de 3,2 MB con 407 imports y Asyncify. Ese binario no se versiona.
- **Chromium headless (SwiftShader) con la demo original:**
  - Asyncify y las fibers ejecutan el hilo del emulador; el núcleo carga el cartucho («CIC desconocido → 6102»);
  - GLideN64 presenta los 484 fotogramas de 8 s (60 Hz) en el framebuffer del canvas transferido;
  - oráculo: centro `[33,33,99]` sin botones, A `[255,0,0]`, B `[0,255,0]`, Start `[255,255,0]`; cuadrado blanco en (16,16);
  - al detener se termina el Worker.
- **Sin evidencia:** GPU física, Firefox y WebKit, juegos reales y rendimiento sostenido. El audio, la pérdida de contexto y una primera medida del coste se cubren en la sesión 3.

## Verificación de la sesión 3 (2026-11-07)

- **Toolchain:** Emscripten 6.0.12 exige LLVM 24. Sobre LLVM 21 no compila su libc (faltan `__builtin_wasm_memory_copy` y `__builtin_wasm_memory_fill`). La receta solo considera fijada la pareja emcc 6.0.12 más clang 24, y lo registra en la evidencia. El binario de esta sesión sigue siendo exploratorio (4.0.10, LLVM 21).
- **Memoria:** con `-sMAXIMUM_MEMORY=512 MiB` falla la reserva de 512 MiB del «full mem base» y Mupen64Plus usa su disposición compacta, sin parchear el núcleo. Pasa de 730 MiB a 256 MiB.
- **Audio:** la demo alimenta la AI con una onda propia de 500 Hz. El frontend recibe 44,1 kHz y el oráculo mide 500,09 Hz. Asyncify pierde el valor de retorno de `n64_run`, así que el recuento sale por `n64_audio_frames()`. El núcleo produce más muestras por segundo de reloj que el tiempo real, y la página descarta bloques más allá de 250 ms.
- **Pérdida de contexto:** detiene la sesión con un mensaje y libera el canvas.
- **Coste por fotograma** (SwiftShader, demo): media de unos 5,7 ms y p95 de unos 9 ms. No vale como referencia de juegos reales.

## Build con la toolchain fijada (titular, 2026-11-07)

Primer build reproducible, hecho por el titular en WSL (Ubuntu) con emsdk 6.0.12. Enlazarlo con Emscripten 6 exigió `-sDEFAULT_TO_CXX`, porque desde la 5 emcc ya no añade libc++ y GLideN64 es C++.

| Campo | Valor |
|---|---|
| Núcleo | `libretro/mupen64plus-libretro-nx` `15bada85906593376e8fd697f1b0b3af3a20f512` |
| Parche | `cores/mupen64plus-next/patches/emu-thread-entry.patch` |
| emcc | 6.0.12 (`5488e0871d46d19a3209988190fa6a653126256f`) |
| clang | 24.0.0git |
| `reproducible` | `true` |
| `n64-core.wasm` | 3 201 180 bytes, SHA-256 `269939ab35ed02229edb82d763f0dd064697882e7967f69a985b975fc08b6a6b` |
| Imports | 407 |

El binario no se versiona (laboratorio, fuera de `cores/`). Falta repetirlo en un segundo entorno para comprobar que el hash coincide.

## Siguiente acción concreta

1. La E2E del laboratorio con Vite sobre el build fijado, y QA del titular con GPU y juegos propios.
2. Control de tasa de audio (pautar por la cola) antes de cualquier integración.
3. Después medir overhead de Asyncify, profundidad de pila, consumo de CPU, audio y estabilidad sostenida; comprobar si el intérprete cumple. Solo una sesión jugable y repetible permite pasar a integración de producto. Si no cumple, registrar no-go o soporte experimental limitado en vez de ampliar abstracciones.
