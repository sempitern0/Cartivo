# Expediente CORE-LEGAL-01 — Snes9x (SNES) en WebAssembly

Fecha: 2026-11-02. Responsable de la decisión: titular de Cartivo. Resultado: **accepted (uso privado)**.

Snes9x tiene una licencia propia **no comercial** que la política de uso privado admite (ADR-005). Si se publicara Cartivo, haría falta revisarla (apartado 3). No es asesoramiento jurídico: registra la evidencia y la decisión.

## 1. Identificación

- **Núcleo:** [snes9xgit/snes9x](https://github.com/snes9xgit/snes9x), tag **1.63**, commit `921f9f7b83660eb44ad263022a57a4a029057c37` (2024-07-07), la última versión publicada.
- **Licencia:** [LICENSE](https://github.com/snes9xgit/snes9x/blob/1.63/LICENSE). Permite usar, copiar, modificar y distribuir en binario y en fuente **con fines no comerciales**, conservando el aviso. Es «freeware for PERSONAL USE only»: el uso comercial requiere permiso de los titulares. Copia en `apps/web/public/licenses/snes9x-LICENSE.txt`. Identificador en el SBOM: `LicenseRef-Snes9x-noncommercial`.
- **Envoltorio propio:** `cores/snes9x/src/cartivo.cpp`, código original de Cartivo bajo MIT, como los de SameBoy y mGBA. Conduce el frontend libretro de Snes9x (`libretro/libretro.cpp`), enlazado estáticamente.
- **Sin parches:** `patchedFiles: []`. La lista de fuentes (`cores/snes9x/sources.txt`, 54 archivos) es la del target libretro de upstream (`libretro/Makefile.common`).

## 2. Inventario del artefacto

- **Opciones de compilación:** las de `libretro/Makefile` (release, no MSVC): `-std=c++14 -O3 -DNDEBUG -DRIGHTSHIFT_IS_SAR -D__LIBRETRO__ -DALLOW_CPU_OVERCLOCK -DHAVE_STDINT_H -fno-rtti -fno-exceptions`.
- **Toolchain:** emsdk 6.0.12 (`35ff8a6`), la misma que SameBoy y mGBA.
- **Salida:** un único `dist/snes9x.wasm` autónomo (`STANDALONE_WASM`, sin sistema de archivos).
- **Submódulos de upstream** (zlib, libpng, glslang, SPIRV-Cross, Vulkan, cubeb): ninguno se compila; solo los usan los frontends de escritorio.
- **SBOM** (`cores/snes9x/sbom.json`):

| Componente | Licencia |
|---|---|
| Snes9x 1.63 (núcleo y frontend libretro) | LicenseRef-Snes9x-noncommercial |
| S-SMP de byuu (`apu/bapu/smp`), incluido bajo la licencia de Snes9x según su LICENSE | LicenseRef-Snes9x-noncommercial |
| snes_spc 0.9.0 `SPC_DSP` (Shay Green) | LGPL-2.1-or-later ([texto](../../apps/web/public/licenses/snes9x-LGPL-2.1.txt)) |
| snes_ntsc (Shay Green, `filter/snes_ntsc.c`) | LGPL-2.1-or-later |
| Cabecera de la API libretro y libretro-common | MIT |
| Bibliotecas de Emscripten 6.0.12 | MIT OR NCSA; musl MIT; libc++/libc++abi y compiler-rt Apache-2.0 WITH LLVM-exception; dlmalloc CC0-1.0 |

Según el LICENSE de Snes9x, JMA (GPL/LGPL) y xBRZ (GPLv3) tienen una excepción para Snes9x. No se compilan: no están en el target libretro.

## 3. Licencias y política

Todas las licencias están identificadas y la política de uso privado las admite.

**Si se publicara Cartivo:**
- **Licencia de Snes9x:** solo permite distribución no comercial, con el aviso. Cartivo usa PolyForm Noncommercial, que también es no comercial, pero la combinación y cualquier forma de monetización requieren revisión. El uso comercial necesita permiso de los titulares.
- **LGPL-2.1+ (snes_spc, snes_ntsc):** van enlazados estáticamente en el WASM, así que habría que permitir reenlazarlos. La receta reproducible (`tools/build-snes9x.mjs`) y los fuentes fijados lo hacen posible.
- **MIT:** conservar el aviso de libretro.

Ninguna de estas licencias se aplica al código propio de Cartivo.

## 4. BIOS y firmware

No hace falta BIOS para cartuchos normales. Snes9x emula en código, sin volcados de firmware:
- DSP-1 a DSP-4, Cx4 y ST010/011;
- SA-1, Super FX, S-DD1, SPC7110, OBC1 y S-RTC.

Cartivo **rechaza antes de cargar** (`packages/adapters/src/snes-header.ts`), con un mensaje claro, lo que necesitaría BIOS o no está completo:
- Satellaview (BS-X) y Sufami Turbo, por su BIOS.
- Super Game Boy, que necesita la BIOS de Game Boy.
- El chip ST018.

Sin datos de sistema, el frontend libretro no puede cargar ninguna BIOS (`GET_SYSTEM_DIRECTORY` no está disponible).

## 5. Partidas

- **Instantáneas** (`retro_serialize`, unas 804 KB con la fixture): deterministas en el arnés nativo y en WASM. Se rechaza un estado de otro tamaño o corrupto y el núcleo sigue funcionando.
- **Batería:** la SRAM tiene el tamaño que declara la cabecera (`retro_get_memory_size`, hasta 128 KB). El reloj S-RTC/SPC7110 no se guarda todavía; queda como límite.

## 6. Evidencia previa a la compilación en CI

Arnés C++ nativo (g++, mismas fuentes y opciones) con la fixture original `packages/fixtures/src/snes-control-demo.ts`:
- La cruceta mueve el sprite.
- A cuenta en la SRAM (`$70:0000`) y el fondo pasa de azul a verde; B lo pone rojo.
- X, Y, L y R pintan el sprite amarillo, cian, magenta y naranja.
- Audio a ≈ 48 kHz (47 809 muestras en 60 frames).
- Instantánea determinista; estado de 3 bytes rechazado.
- La batería se conserva al reabrir.
- 0,42 ms por frame; sin mensajes superpuestos en la imagen.

Detalle: Snes9x acepta incluso 512 bytes de ceros como «ROM». La validación de cabecera de Cartivo los rechaza antes de llegar al núcleo.

## 7. Trazabilidad

- **Build en CI solo bajo petición:** `.github/workflows/core-snes9x.yml`, con `cores/snes9x/.build-request` en una rama de trabajo o `workflow_dispatch`; `branches-ignore: [main]`.
- Commit comprobado, rutas deterministas, hash en `manifest.json` y avisos comparados byte a byte con los del commit fijado.
- `pnpm verify:core` (`tools/verify-core.mjs snes9x`) comprueba hashes y licencias sin compilar.

## 8. Decisión

**accepted (uso privado).** Se integra para SNES (ADR-013).

**Primer build:**
- Ejecución `core-snes9x.yml` 41418272714 sobre `7d02636`; commit del bot `ac8ab35`.
- `dist/snes9x.wasm`: 2 268 757 bytes, SHA-256 `10477cc67fcd…` (completo en `manifest.json`).
- Los dos avisos coinciden con los del commit fijado y `verify-core.mjs snes9x` pasa.

**Imports:**
- Los de mGBA, más `fd_read` y `env.__syscall_ftruncate64`, que vienen del código de archivos de Snes9x (películas, streams) que Cartivo no usa.
- `wasm-host.ts` los resuelve con ENOSYS, como `fd_close`/`fd_seek`, en lugar de recompilar.
- `tests/wasm-host.test.ts` comprueba que el binario no pide nada fuera de esa lista.

**Reproducibilidad:** pendiente de una recompilación manual (`workflow_dispatch`, modo `verify`) cuando el titular lo pida.
