# Expediente CORE-LEGAL-01 — PCSX-ReARMed (PlayStation) en WebAssembly

Fecha: 2026-11-06. Responsable de la decisión: titular de Cartivo. Resultado: **accepted (uso privado)**.

PCSX-ReARMed es GPL-2.0-or-later. La política de uso privado (ADR-005) lo admite. Si se publicara Cartivo, la GPL afectaría al conjunto (apartado 3). Este documento no es asesoramiento jurídico: registra la evidencia y la decisión.

## 1. Identificación

- **Núcleo:** [libretro/pcsx_rearmed](https://github.com/libretro/pcsx_rearmed), commit `7b0e8f8fadfbce3d170d195b9d9eecaabfa08c8e`.
  - Es la rama libretro que mantienen notaz y libretro.
  - Sus builds libretro no publican versiones, así que se fija el commit. La versión de las instantáneas es `7b0e8f8`.
- **Licencia:** [COPYING](https://github.com/libretro/pcsx_rearmed/blob/7b0e8f8fadfbce3d170d195b9d9eecaabfa08c8e/COPYING) (GPL-2.0).
  - Las cabeceras de los fuentes compilados dicen «version 2 of the License, or (at your option) any later version», o «GPLv2 or later».
  - Hay copia en `apps/web/public/licenses/pcsx-rearmed-COPYING.txt`.
- **Envoltorio propio:** `cores/pcsx-rearmed/src/cartivo.c`, código original de Cartivo bajo MIT, como los demás puentes. Conduce el frontend libretro de upstream (`frontend/libretro.c`), enlazado estáticamente.
- **Sin parches:** `patchedFiles: []`.
  - La lista de fuentes (`cores/pcsx-rearmed/sources.txt`, 56 archivos) sale del target libretro de upstream (`Makefile.libretro`) con estas opciones: `DYNAREC=0`, sin CD-ROM físico, sin hilos asíncronos (CD, GPU, SPU) y sin CHD.
  - `include/revision.h` lo genera la receta igual que el Makefile de upstream, con `git describe`: `#define REV "7b0e8f8"`.

## 2. Inventario del artefacto

- **Opciones de compilación:** las de la plataforma `emscripten` de `Makefile.libretro`, con tres cambios.
  - **Opciones base:** intérprete MIPS (`DRC_DISABLE`), GPU por software `gpu_neon` en su camino SIMD portable (SSE traducido a SIMD de WebAssembly con `-msimd128`), `NO_MMAP`, `NO_DYLIB` y `NO_SOCKET`.
  - **Cambio 1: VFS de libretro activada** (`USE_LIBRETRO_VFS`). Upstream la desactiva en Emscripten, pero Cartivo la necesita para leer los discos desde el host.
  - **Cambio 2: miniz del propio árbol** en lugar del port zlib de Emscripten. El port se descarga durante el build, y Cartivo no quiere descargas en el build.
  - **Cambio 3: CHD habilitado** (`HAVE_CHD`). Se compilan libchdr, LZMA SDK (decodificador), Zstandard (decodificador) y dr_flac.
- **No se compilan:**
  - lightrec ni new_dynarec (recompiladores: no hay JIT en WebAssembly);
  - libpicofe ni los frontends SDL y Pandora;
  - los plugins de GPU `peops` y `unai`.
- **Toolchain:** emsdk 6.0.12 (`35ff8a6`).
- **Salida:** un único `dist/pcsx-rearmed.wasm` autónomo, cuyas importaciones lista `manifest.json`.
  - La receta falla si el módulo importa algo que `wasm-host.ts` no ofrece.
- **SBOM** (`cores/pcsx-rearmed/sbom.json`):

| Componente | Licencia |
|---|---|
| PCSX-ReARMed: libpcsxcore con la BIOS HLE, frontend libretro, gpulib, gpu_neon (Exophase y notaz) y dfsound (P.E.Op.S.) | GPL-2.0-or-later |
| libchdr (lectura de CHD v5) | BSD-3-Clause |
| LZMA SDK 26.02 (decodificador) | LicenseRef-public-domain |
| Zstandard (zstddeclib.c, decodificador) | BSD-3-Clause OR GPL-2.0 |
| dr_flac (decodificador FLAC) | Unlicense OR MIT-0 |
| miniz 3.1.2 (`deps/libchdr/deps`) | MIT |
| Cabecera libretro y libretro-common | MIT |
| Bibliotecas de Emscripten 6.0.12 | MIT OR NCSA; musl MIT; compiler-rt Apache-2.0 WITH LLVM-exception; dlmalloc CC0-1.0 |

## 3. Licencias y política

Todas las licencias están identificadas y la política de uso privado las admite.

**Si se publicara Cartivo:**
- La GPL-2.0-or-later del núcleo, enlazado estáticamente con el puente, obligaría a ofrecer las fuentes correspondientes del binario: la receta reproducible `tools/build-pcsx-rearmed.mjs`, el commit fijado y el puente.
- Probablemente también impondría su licencia al trabajo combinado. Eso choca con la PolyForm Noncommercial del código propio de Cartivo. Ejecutar el núcleo en un Worker o cargarlo bajo demanda **no** crea independencia jurídica automática.
- Esta decisión es del titular y conviene que la revise un jurista antes de cualquier publicación.
- Hay que conservar los avisos MIT de miniz y libretro-common.

## 4. BIOS y firmware

- No se carga ninguna BIOS de Sony:
  - el puente fuerza la opción `pcsx_rearmed_bios=HLE`;
  - no ofrece directorio de sistema (`GET_SYSTEM_DIRECTORY` falla), así que el frontend nunca busca archivos de BIOS;
  - la BIOS HLE es código GPL del propio núcleo (`libpcsxcore/psxbios.c`).
- **Límite conocido:** la BIOS HLE no arranca todos los juegos, ni la pantalla de inicio o el gestor de tarjetas de la BIOS original. Cartivo no admite cargar BIOS propietarias sin una decisión del titular (AGENTS.md).

## 5. Partidas

- **Instantáneas** (`retro_serialize`, unos 4,4 MB): deterministas en la prueba de conformidad. Se rechazan los estados de otro tamaño o corruptos.
  - La cabecera interna lleva la revisión (`STv4 PCSXra 7b0e8f8`).
- **Batería:** la tarjeta de memoria 1, de 128 KiB, en memoria (`pcsx_rearmed_memcard1=libretro`). Se guarda con `SramStore`, igual que la batería de un cartucho.
  - La ranura 2 está vacía.
  - El núcleo nunca escribe archivos: la VFS del puente es de solo lectura.

## 6. Evidencia previa a la compilación en CI

- **Arnés C nativo** (gcc, fuentes de upstream, la `.so` libretro del mismo commit) con la fixture original `ps1-control-demo.ts`:
  - la BIOS HLE carga el PS-EXE e `InitPad`/`StartPad` llenan el búfer del mando;
  - sin botones sale azul oscuro; Cruz da rojo, Círculo verde y Start amarillo;
  - 60 Hz NTSC; estado de 4 456 448 bytes.
- **Build local de comprobación** con Emscripten 4.0.10 y LLVM 21, que **no** es la toolchain fijada y cuyo resultado no se versiona. El mismo puente y la misma receta compilan sin parches.
  - En Node, `tests/ps1.test.ts` y la conformidad pasan: el programa llega por la VFS como un disco, la cruceta y los botones cambian la imagen, la tarjeta de memoria persiste y las instantáneas son deterministas.
  - Las únicas importaciones nuevas son `env.cartivo_vfs_*` y `env.__syscall_getdents64`, este último el listado de directorios de libretro-common, que nunca se usa.
- **Pendiente de evidencia:** compatibilidad y rendimiento con juegos reales. Se medirán en la QA del titular con sus propios discos, nunca en el repositorio ni en la CI.

## 7. Trazabilidad

- **Build en CI solo bajo petición:** `.github/workflows/core-pcsx-rearmed.yml`, con `.build-request` en una rama de trabajo o `workflow_dispatch`; `branches-ignore: [main]`.
- El commit se descarga exacto, con rutas deterministas y su hash en `manifest.json`.
- `COPYING` se compara byte a byte con la copia publicada.
- `pnpm verify:core` (`tools/verify-core.mjs pcsx-rearmed`) comprueba hashes y licencias sin compilar.

## 8. Decisión

**accepted (uso privado).** Se integra para PlayStation (ADR-015). Antes de distribuir Cartivo a terceros hay que revisar de nuevo la GPL.
