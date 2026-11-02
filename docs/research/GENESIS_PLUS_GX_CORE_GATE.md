# Expediente CORE-LEGAL-01 — Genesis Plus GX (Master System y Mega Drive) en WebAssembly

Fecha: 2026-11-02. Responsable de la decisión: titular de Cartivo. Resultado: **accepted (uso privado)**.

Genesis Plus GX y varios de sus componentes tienen licencias **no comerciales**, que la política de uso privado admite (ADR-005). Si se publicara Cartivo, habría que revisarlas (apartado 3). No es asesoramiento jurídico: registra la evidencia y la decisión.

## 1. Identificación

- **Núcleo:** [ekeeke/Genesis-Plus-GX](https://github.com/ekeeke/Genesis-Plus-GX), repositorio original del autor, commit `a5834b3df455c49bb97bfaa328c20845831f576b` (2026-10-27). No publica tags ni versiones, así que se fija el commit y la versión de las instantáneas es `a5834b3`.
- **Licencia:** [LICENSE.txt](https://github.com/ekeeke/Genesis-Plus-GX/blob/a5834b3df455c49bb97bfaa328c20845831f576b/LICENSE.txt), propia y de estilo BSD con tres condiciones:
  - no se puede vender ni usar en un producto o actividad comercial;
  - quien redistribuya una versión modificada debe incluir el código completo de todo lo que compone el binario;
  - hay que reproducir el aviso.
  Copia en `apps/web/public/licenses/genesis-plus-gx-LICENSE.txt`. Incluye también los textos de Nuked OPN2 (LGPL), Tremor (BSD) y minimp3 (CC0).
- **Envoltorio propio:** `cores/genesis-plus-gx/src/cartivo.c`, código original de Cartivo bajo MIT, como los de SameBoy, mGBA y Snes9x. Conduce el frontend libretro de upstream (`libretro/libretro.c`), enlazado estáticamente.
- **Sin parches:** `patchedFiles: []`. La lista de fuentes (`cores/genesis-plus-gx/sources.txt`, 82 archivos) es la del target libretro de upstream (`libretro/Makefile.common`) sin CHD y con libretro-common y zlib, que el target estático deja al frontend.

## 2. Inventario del artefacto

- **Opciones:** las de `Makefile.libretro` para Emscripten (`LSB_FIRST`, `ALIGN_LONG`, `HAVE_ZLIB`, `USE_LIBTREMOR`, `USE_16BPP_RENDERING`, `HAVE_YM3438_CORE`, `HAVE_OPLL_CORE`, overclock shift 20). Sin `USE_LIBCHDR`.
- **Detalles de compilación:**
  - Las macros `fseeko`/`ftello`/`flac_*` de upstream solo sirven al FLAC de CHD y no compilan con Emscripten, así que se omiten.
  - `-sSUPPORT_LONGJMP=wasm`: Musashi emula los errores de dirección del 68000 con `setjmp`/`longjmp`, que así usan excepciones nativas de WebAssembly en lugar del pegamento JavaScript de Emscripten.
- **Toolchain:** emsdk 6.0.12 (`35ff8a6`).
- **Salida:** un único `dist/genesis-plus-gx.wasm` autónomo.
- **SBOM** (`cores/genesis-plus-gx/sbom.json`):

| Componente | Licencia |
|---|---|
| Genesis Plus GX (núcleo y frontend libretro; partes derivadas de MAME: YM2612, YM2413, SN76489) | LicenseRef-GenesisPlusGX-noncommercial |
| Musashi 3.3 (Karl Stenerud), 68000 | LicenseRef-Musashi-noncommercial: «free for any non-commercial purpose» ([readme](../../apps/web/public/licenses/musashi-readme.txt)) |
| Z80 de Juergen Buchmueller (MAME) | LicenseRef-MAME-Z80-noncommercial: «freeware for non-commercial purposes», en la cabecera de `core/z80/z80.c` |
| SVP/SSP1601 de notaz (Virtua Racing) | LicenseRef-notaz-SVP-noncommercial: «free for non-commercial use», en la cabecera de `ssp16.c` |
| Nuked OPLL (Nuke.YKT) | LicenseRef-NukedOPLL-noncommercial: mismos términos que Genesis Plus GX |
| Nuked OPN2 (Nuke.YKT) | LGPL-2.1-or-later |
| blip_buf, sms_ntsc y md_ntsc (Shay Green) | LGPL-2.1-or-later |
| Tremor (Xiph.org) | BSD-3-Clause |
| minimp3 | CC0-1.0 |
| Ecualizador (`core/sound/eq.c`) | Dominio público |
| zlib 1.3.1 | Zlib |
| Cabecera libretro y libretro-common | MIT |
| Bibliotecas de Emscripten 6.0.12 | MIT OR NCSA; musl MIT; compiler-rt Apache-2.0 WITH LLVM-exception; dlmalloc CC0-1.0 |

No se compilan libchdr, zstd, lzma, los frontends de consola (gx, psp2, sdl) ni el depurador.

## 3. Licencias y política

Todas las licencias están identificadas y la política de uso privado las admite.

**Si se publicara Cartivo:**
- **No comercial:** cinco componentes (Genesis Plus GX, Musashi, el Z80, el SVP y Nuked OPLL) prohíben el uso comercial. El Z80 y el SVP piden contactar con su autor para ese uso.
- **Código fuente:** la licencia de Genesis Plus GX obliga a publicar el código completo del binario si se modifica. El envoltorio de Cartivo no modifica los fuentes, pero conviene revisarlo.
- **LGPL-2.1+:** Nuked OPN2, blip_buf y los filtros NTSC van enlazados estáticamente, así que habría que permitir reenlazarlos. La receta reproducible (`tools/build-genesis-plus-gx.mjs`) lo hace posible.
- **Resto:** conservar los avisos BSD, Zlib y MIT.

## 4. BIOS y firmware

No hace falta BIOS para cartuchos:
- **Mega Drive:** arranca directamente; el TMSS es opcional y la opción viene desactivada.
- **Master System:** la BIOS también es opcional.

El puente no ofrece directorio de sistema y entrega la ROM en memoria, así que el frontend nunca abre un archivo de BIOS.

Cartivo **rechaza antes de cargar** (`packages/adapters/src/sega-header.ts`):
- Mega-CD, que necesita BIOS.
- 32X, Game Gear y SG-1000, fuera del catálogo actual.
- Volcados SMD intercalados.
- Cartuchos de Mega Drive solo PAL.

## 5. Partidas

- **Instantáneas** (`retro_serialize`, unos 1 012 KB): deterministas en el arnés nativo; estados de otro tamaño o corruptos rechazados.
- **Batería:** el frontend libretro informa del tamaño de la parte modificada, que cambia durante la partida. El puente usa siempre el búfer completo de 64 KB que Genesis Plus GX mapea (`sram.sram`) cuando el cartucho tiene RAM, como el búfer fijo de mGBA. Así `saveBytes` es estable.

## 6. Evidencia previa a la compilación en CI

Arnés C nativo (gcc, mismas fuentes y opciones) con las fixtures originales `md-control-demo.ts` y `sms-control-demo.ts`:

- **Mega Drive** (0,43 ms/frame):
  - la cruceta mueve el sprite;
  - C cuenta en la SRAM (`$200001`) y cambia el fondo; B lo pone rojo;
  - A, X, Y y Z (mando de 6 botones) dan cuatro colores;
  - instantánea determinista; la batería se conserva al reabrir.
- **Master System** (0,23 ms/frame):
  - la cruceta mueve el sprite; el botón 2 cuenta en la RAM del cartucho (`$8000`) y el botón 1 lo pinta amarillo;
  - con 32 KB no había RAM: Genesis Plus GX, como el hardware real, solo activa el mapper de Sega por encima de 48 KB. La fixture usa 64 KB.
- Audio a ≈ 48 kHz en las dos consolas; sin mensajes superpuestos.

## 7. Trazabilidad

- **Build en CI solo bajo petición:** `.github/workflows/core-genesis-plus-gx.yml`, con `.build-request` en una rama de trabajo o `workflow_dispatch`; `branches-ignore: [main]`.
- El commit se descarga exacto (sin tags), con rutas deterministas y hash en `manifest.json`.
- Los avisos se comparan byte a byte con los del commit fijado (`LICENSE.txt` y `core/m68k/readme.txt`).
- `pnpm verify:core` (`tools/verify-core.mjs genesis-plus-gx`) comprueba hashes y licencias sin compilar.

## 8. Decisión

**accepted (uso privado).** Se integra para Master System y Mega Drive (ADR-014).
