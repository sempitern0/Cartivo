# Expediente CORE-LEGAL-01 — mGBA (Game Boy Advance) en WebAssembly

Fecha: 2026-11-01. Responsable de la decisión: titular de Cartivo. Resultado: **accepted (uso privado)**. Incluye un componente LGPL-2.1+ y es MPL-2.0, ambos admitidos por la política de uso privado (ADR-005). Si se publicara Cartivo, habría que cumplir sus obligaciones (apartado 3). No es asesoramiento jurídico; registra la evidencia y la decisión.

## 1. Identificación

- Núcleo: [mgba-emu/mgba](https://github.com/mgba-emu/mgba) tag **0.10.5**, commit `26b7884bc25a5933960f3cdcd98bac1ae14d42e2` (2025-03-08). Es la última versión estable; master está en desarrollo y no tiene versión publicada.
- Licencia: [LICENSE](https://github.com/mgba-emu/mgba/blob/0.10.5/LICENSE), **MPL-2.0**, Copyright © 2013–2022 Jeffrey Pfau. Copia en `apps/web/public/licenses/mgba-MPL-2.0.txt`.
- Envoltorio propio: `cores/mgba/src/cartivo.c`, código original de Cartivo bajo MIT, igual que el de SameBoy (criterio del titular del 2026-11-01).
- Sin parches: `patchedFiles: []`. CMake se sustituye por una lista de fuentes versionada (`cores/mgba/sources.txt`), con un `flags.h` y un `version.c` equivalentes a los que generaría CMake.

## 2. Inventario del artefacto

- Fuentes: las 84 del target libretro de mGBA configurado solo para GBA y sin dependencias (`M_CORE_GB=OFF`, `DISABLE_DEPS`, sin scripting ni depuradores), salvo el frontend libretro y el renderer OpenGL. Más `version.c` y el envoltorio. Definiciones: `DISABLE_THREADING`, `MINIMAL_CORE=2` (no busca BIOS en disco) y `MGBA_STANDALONE`; color de 32 bits.
- Toolchain: emsdk 6.0.12 (`35ff8a6`), igual que SameBoy.
- Salida: un único `dist/mgba.wasm` autónomo (`STANDALONE_WASM`, sin JS de Emscripten).
- SBOM (`cores/mgba/sbom.json`):

| Componente | Licencia |
|---|---|
| mGBA 0.10.5 (core, GBA, ARM, util) | MPL-2.0 |
| BIOS HLE de mGBA (`src/gba/hle-bios.c`) | MPL-2.0 |
| blip_buf 1.1.0 (Shay Green) | LGPL-2.1-or-later ([texto](../../apps/web/public/licenses/blip_buf-LGPL-2.1.txt)) |
| inih (Ben Hoyt) | BSD-3-Clause ([texto](../../apps/web/public/licenses/inih-BSD-3-Clause.txt)) |
| MurmurHash3 (`src/util/hash.c`) | Dominio público |
| Bibliotecas de sistema de Emscripten 6.0.12 | MIT OR NCSA; musl MIT; compiler-rt Apache-2.0 WITH LLVM-exception; dlmalloc CC0-1.0 |

## 3. Licencias y política

Todas las licencias están identificadas y la política de uso privado las admite. **Si se publicara Cartivo:**
- **MPL-2.0:** ofrecer el código fuente de los archivos de mGBA (sin modificar) y conservar sus avisos.
- **LGPL-2.1+ (blip_buf):** está enlazado estáticamente dentro del WASM, así que habría que permitir sustituirlo. Para eso habría que ofrecer los objetos o la receta para reenlazar (la receta y los fuentes ya son reproducibles en `tools/build-mgba.mjs`), además de su texto de licencia.
- **BSD-3-Clause (inih):** conservar su aviso.

Ninguna de estas licencias se aplica al código propio de Cartivo, que sigue con PolyForm Noncommercial.

## 4. BIOS y firmware

No hace falta BIOS. Con `MINIMAL_CORE=2`, mGBA no busca `gba_bios.bin`: usa su **BIOS HLE** propia (ensamblada desde `src/gba/hle-bios.s`, MPL) y el envoltorio arranca directamente el cartucho (`skipBios`), sin comprobar el logo. Algunos juegos dependen de detalles de la BIOS real; queda como límite de compatibilidad.

## 5. Partidas

Las instantáneas de `mCore` (`stateSize`/`saveState`/`loadState`, unos 388 KB) son deterministas en el arnés nativo. Se rechaza un estado de otro tamaño o con basura y la imagen no cambia.

La memoria del cartucho es un búfer fijo de 128 KB (Flash 1M, el tamaño máximo) que mGBA mapea según el tipo que detecta (SRAM, Flash o EEPROM), igual que el port libretro. Así `saveBytes` no cambia aunque el tipo se descubra con el juego en marcha.

## 6. Evidencia previa a la compilación en CI

Arnés C nativo (gcc, mismas fuentes y definiciones) con la fixture original `packages/fixtures/src/gba-control-demo.ts`:
- Imagen 240×160 opaca y la cruceta mueve el cuadrado.
- **L y R cambian el color del cuadrado.**
- Audio a 48 kHz (1605 muestras por 2 frames) y B suena.
- La SRAM cuenta las pulsaciones de A.
- Instantánea con repetición idéntica; estados corruptos rechazados.
- Recarga de batería; 0,78 ms por frame en nativo.

Revisión previa al merge (`tests/gba-saves.test.ts`): variantes propias de la fixture escriben con los protocolos reales de SRAM, Flash y EEPROM, y el juego relee su partida tras reabrir. Ver [H2-GBA](../compatibility/H2-GBA.md).

## 7. Trazabilidad

- Build en CI **solo bajo petición** (`.github/workflows/core-mgba.yml`: `cores/mgba/.build-request` o `workflow_dispatch`).
- Commit comprobado, rutas deterministas, hash en `manifest.json` y avisos comparados con los del commit fijado.
- `pnpm verify:core` (`tools/verify-mgba.mjs`) comprueba hashes y licencias sin compilar.

## 8. Decisión

**accepted (uso privado).** Se integra para GBA (ADR-011).

Primer build (`core-mgba.yml`, run sobre `8caee2b`, commit del bot `122bdd6`): `dist/mgba.wasm` de 574 942 bytes, SHA-256 `a655c20f1331…` (completo en `manifest.json`). Los tres avisos de licencia coinciden con los del commit fijado y `verify-mgba` pasa sin errores. Imports del binario: `clock_time_get`, `fd_write`, `fd_close`, `environ_sizes_get`, `environ_get` y `emscripten_notify_memory_growth`, todos resueltos por `wasm-host.ts`. La reproducibilidad (`mode=verify`) queda a petición.
