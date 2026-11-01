# Expediente CORE-LEGAL-01 — SameBoy (Game Boy / Color) en WebAssembly

Fecha: 2026-11-01. Responsable de la decisión: titular de Cartivo. Resultado: **accepted** (licencia permisiva, también publicable con avisos). No es asesoramiento jurídico; registra la evidencia y la decisión.

## 1. Identificación

- Núcleo: [LIJI32/SameBoy](https://github.com/LIJI32/SameBoy) tag **v1.0.4**, commit `98da08c3117a7bf39c7329fc662c0d18cb54707d` (2026-10-09).
- Licencia: [LICENSE](https://github.com/LIJI32/SameBoy/blob/v1.0.4/LICENSE): **Expat (SPDX `MIT`)**, Copyright (c) 2015-2026 Lior Halphon, para todo el repositorio salvo `iOS/` y `HexFiend/`, que no se compilan. Copia en `apps/web/public/licenses/sameboy-LICENSE.txt`; el workflow comprueba que coincide con la del commit fijado.
- Envoltorio propio: `cores/sameboy/src/cartivo.c`. Es código original de Cartivo, declarado MIT para que el artefacto del núcleo tenga una sola licencia (mismo precedente que `cores/tetanes`). **Confirmado por el titular el 2026-11-01.**
- Sin parches ni forks: `patchedFiles: []`.

## 2. Inventario del artefacto

- Fuentes compiladas: `Core/{gb,sgb,apu,memory,mbc,timing,display,camera,sm83_cpu,joypad,save_state,random,rumble}.c` (la lista del build libretro de SameBoy) y el envoltorio. Flags: `GB_DISABLE_TIMEKEEPING`, `GB_DISABLE_REWIND`, `GB_DISABLE_DEBUGGER`, `GB_DISABLE_CHEATS` y `GB_DISABLE_CHEAT_SEARCH`.
- Boot ROMs: `dmg_boot` y `cgb_boot`, ensambladas en CI desde `BootROMs/*.asm` de SameBoy (Expat) con rgbds. Ver apartado 5.
- Toolchain fijada en `cores/sameboy/toolchain.json`:
  - emsdk 6.0.12 (`35ff8a6`, 2026-10-08).
  - rgbds v1.0.4 (`f7b8207`, 2026-09-22), herramienta de host que no forma parte del binario.
- Salida: un único `dist/sameboy.wasm` autónomo (`STANDALONE_WASM`, sin JS de Emscripten ni sistema de archivos). Cartivo lo carga con su propio adaptador.
- SBOM (`cores/sameboy/sbom.json`):

| Componente | Licencia |
|---|---|
| SameBoy Core v1.0.4 | MIT (Expat) |
| SameBoy BootROMs v1.0.4 | MIT (Expat) |
| Bibliotecas de sistema de Emscripten 6.0.12 | MIT OR NCSA |
| musl libc (Emscripten) | MIT |
| compiler-rt (Emscripten) | Apache-2.0 WITH LLVM-exception |
| dlmalloc (Emscripten) | CC0-1.0 |

## 3. Licencias y política

Todas las licencias están identificadas y son permisivas, así que encajan con la política de uso privado (ADR-005) y también permitirían publicar. Si se publicara Cartivo, habría que conservar los avisos de copyright y licencia de SameBoy y de Emscripten (`LICENSES.md` y `apps/web/public/licenses/`). La licencia Expat de SameBoy no impone condiciones sobre el código de Cartivo.

## 4. Candidatos descartados

- **boytacean** (Rust, Apache-2.0): `src/data.rs` incrusta las boot ROMs originales de Nintendo (`DMG_BOOT` empieza por `31 FE FF AF 21 FF 9F…`). Choca con la regla de no tener BIOS ni firmware propietario en git; queda **blocked** salvo que se retiraran con un parche.
- **mGBA** 0.10.5 (MPL-2.0): no tiene plataforma WebAssembly en upstream (`src/platform/` no incluye wasm). Se reserva para GBA, en su propio gate.

## 5. BIOS y firmware

No hace falta BIOS externa. Las boot ROMs de SameBoy son implementaciones propias y libres; se compilan desde su código fuente y se registran por hash en `manifest.json`. Muestran el logo que trae la cabecera del juego, pero no lo verifican, así que la fixture de Cartivo (`packages/fixtures/src/gb-control-demo.ts`) deja ese área en blanco y no incluye arte de terceros.

## 6. Partidas

SameBoy expone `GB_save_state_to_buffer`/`GB_load_state_from_buffer`. El arnés nativo comprobó, con la fixture en DMG y CGB, una instantánea de ida y vuelta con repetición idéntica y el rechazo de un estado corrupto sin alterar la máquina. Hay un límite: en juegos con reloj (MBC3+TIMER) el RTC sigue la hora del sistema, así que la repetición tras restaurar no es determinista.

## 7. Trazabilidad

- Build reproducible en CI, **solo bajo petición** (`.github/workflows/core-sameboy.yml`: `cores/sameboy/.build-request` o `workflow_dispatch`): clonado por tag con el commit comprobado, rutas deterministas (`-ffile-prefix-map`), hashes del binario y de las boot ROMs en `manifest.json`.
- `pnpm verify:core` (`tools/verify-sameboy.mjs`) comprueba hashes y licencias sin recompilar.
- Actualizaciones: cada versión nueva de SameBoy o del toolchain repite este gate y una compilación explícita.

## 8. Decisión

**accepted.** Se integra para GB y GBC (ADR-010).

Primer build (`core-sameboy.yml`, run sobre `c6b1750`, commit del bot `7c8c798`): `dist/sameboy.wasm` de 189 824 bytes, SHA-256 `65131c5958e2…` (completo en `manifest.json`); `verify-sameboy` sin errores. Imports del binario: `clock_time_get`, `fd_write`, `fd_close`, `fd_seek` y `emscripten_notify_memory_growth`, todos resueltos por el adaptador. La reproducibilidad (`mode=verify`) no se ha lanzado: queda a petición.

El titular confirmó el 2026-11-01 la licencia MIT del envoltorio y la entrada de SameBoy en `LICENSES.md`.
