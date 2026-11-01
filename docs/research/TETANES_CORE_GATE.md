# Expediente CORE-LEGAL-01 — TetaNES (tetanes-core) en WebAssembly

Fecha: 2026-11-01. Responsable de la decisión: titular de Cartivo. Resultado: **accepted**. Desde el 2026-11-01 rige la política de uso privado (ADR-005), que admite cualquier licencia libre identificada; la excepción MPL-2.0 de `option-ext` queda absorbida por ella. No es asesoramiento jurídico; registra la evidencia y la decisión.

## 1. Identificación

- Núcleo: crate `tetanes-core` **0.17.0** de crates.io (repositorio [lukexor/tetanes](https://github.com/lukexor/tetanes), inspeccionado en el commit `a0a6b17f8ba9c5ee451453fb2409753fd06e5a31`, `[workspace.package] version = "0.17.0"`, `license = "MIT OR Apache-2.0"`).
- Licencias upstream: [LICENSE-MIT](https://github.com/lukexor/tetanes/blob/main/LICENSE-MIT) (Copyright (c) 2021 Luke Petherbridge) y [LICENSE-APACHE](https://github.com/lukexor/tetanes/blob/main/LICENSE-APACHE). Copias en `apps/web/public/licenses/`.
- Envoltorio propio: `cores/tetanes` (`cartivo-tetanes`, código original de Cartivo, declarado MIT OR Apache-2.0 para no mezclar PolyForm en el artefacto del núcleo).
- Sin parches ni forks: `patchedFiles: []`.

## 2. Inventario del artefacto

- Toolchain: rustc 1.90.0, cargo 1.90.0, `wasm-bindgen` 0.2.130 (CLI de la misma versión), target `wasm32-unknown-unknown`. Fijados en `rust-toolchain.toml`, `Cargo.lock` y `manifest.json`.
- Dependencias Rust resueltas para wasm32: **49** (`cores/tetanes/sbom.json`, generado con `cargo metadata --filter-platform wasm32-unknown-unknown`). No hay assets, ROMs, BIOS, shaders ni submódulos.
- Fuentes: solo crates.io (`cargo deny check sources`: sin registros ni git desconocidos).

| Crate | Versión | Licencia |
|---|---|---|
| adler2 | 2.0.1 | 0BSD OR MIT OR Apache-2.0 |
| base64 | 0.23.1 | MIT OR Apache-2.0 |
| bincode | 2.0.1 | MIT |
| bitflags | 2.13.2 | MIT OR Apache-2.0 |
| bumpalo | 3.20.3 | MIT OR Apache-2.0 |
| cfg-if | 1.0.5 | MIT OR Apache-2.0 |
| chacha20 | 0.10.2 | MIT OR Apache-2.0 |
| crc32fast | 1.5.3 | MIT OR Apache-2.0 |
| dirs | 6.0.0 | MIT OR Apache-2.0 |
| dirs-sys | 0.5.0 | MIT OR Apache-2.0 |
| flate2 | 1.1.10 | MIT OR Apache-2.0 |
| futures-core | 0.3.34 | MIT OR Apache-2.0 |
| futures-task | 0.3.34 | MIT OR Apache-2.0 |
| futures-util | 0.3.34 | MIT OR Apache-2.0 |
| getrandom | 0.4.3 | MIT OR Apache-2.0 |
| itoa | 1.0.18 | MIT OR Apache-2.0 |
| js-sys | 0.3.107 | MIT OR Apache-2.0 |
| memchr | 2.8.3 | Unlicense OR MIT |
| miniz_oxide | 0.9.1 | MIT OR Zlib OR Apache-2.0 |
| once_cell | 1.21.4 | MIT OR Apache-2.0 |
| option-ext | 0.2.0 | MPL-2.0 |
| pin-project-lite | 0.2.17 | Apache-2.0 OR MIT |
| proc-macro2 | 1.0.107 | MIT OR Apache-2.0 |
| quote | 1.0.47 | MIT OR Apache-2.0 |
| rand | 0.10.3 | MIT OR Apache-2.0 |
| rand_core | 0.10.1 | MIT OR Apache-2.0 |
| rustversion | 1.0.23 | MIT OR Apache-2.0 |
| serde | 1.0.229 | MIT OR Apache-2.0 |
| serde_core | 1.0.229 | MIT OR Apache-2.0 |
| serde_derive | 1.0.229 | MIT OR Apache-2.0 |
| serde_json | 1.0.154 | MIT OR Apache-2.0 |
| simd-adler32 | 0.3.10 | MIT |
| slab | 0.4.12 | MIT |
| syn | 3.0.9 | MIT OR Apache-2.0 |
| tetanes-core | 0.17.0 | MIT OR Apache-2.0 |
| thiserror | 2.0.21 | MIT OR Apache-2.0 |
| thiserror-impl | 2.0.21 | MIT OR Apache-2.0 |
| tracing | 0.1.44 | MIT |
| tracing-core | 0.1.36 | MIT |
| unicode-ident | 1.0.27 | (MIT OR Apache-2.0) AND Unicode-3.0 |
| unty | 0.0.4 | MIT OR Apache-2.0 |
| wasm-bindgen | 0.2.130 | MIT OR Apache-2.0 |
| wasm-bindgen-macro | 0.2.130 | MIT OR Apache-2.0 |
| wasm-bindgen-macro-support | 0.2.130 | MIT OR Apache-2.0 |
| wasm-bindgen-shared | 0.2.130 | MIT OR Apache-2.0 |
| web-sys | 0.3.107 | MIT OR Apache-2.0 |
| web-time | 1.1.0 | MIT OR Apache-2.0 |
| zlib-rs | 0.6.8 | Zlib |
| zmij | 1.0.23 | MIT |

## 3. Licencias y condiciones

- `cargo deny check licenses` con lista permitida: MIT, Apache-2.0 (y con LLVM-exception), BSD-2/3-Clause, ISC, Zlib, Unicode-3.0. Las expresiones con OR se satisfacen por una opción permitida.
- **Excepción:** `option-ext 0.2.0` (MPL-2.0), dependencia de `dirs-sys` → `dirs` → `tetanes-core`. El primer CI la rechazó; el titular aprobó el 2026-11-01 una excepción limitada a ese crate sin modificar (`deny.toml`, `tools/verify-tetanes.mjs`). Obligaciones registradas: conservar el aviso y el texto MPL-2.0 (`option-ext-MPL-2.0.txt`) e indicar dónde obtener su código fuente ([github.com/soc/option-ext](https://github.com/soc/option-ext), commit `20079f31943272573aa0ec1985eb362e56137220`; crates.io). MPL-2.0 aplica a nivel de archivo y no se extiende al código de Cartivo.
- Atribución: `LICENSES.md` y `apps/web/public/licenses/NOTICE.txt`, servidos con el build.

## 4. Combinación con Cartivo

El WASM se carga en un Worker del mismo origen y se comunica por el protocolo NES v1. No se presupone independencia jurídica por el Worker: la conclusión se basa en que todas las licencias del artefacto son permisivas (más la excepción MPL-2.0 a nivel de archivo), compatibles con distribuirse junto a código PolyForm Noncommercial conservando sus avisos. PolyForm no se aplica al núcleo ni a sus dependencias.

## 5. BIOS y firmware

NES no requiere BIOS. El build no lee archivos externos: el envoltorio desactiva el directorio SRAM de TetaNES y recibe ROM y SRAM como bytes. `biosRequired: false`.

## 6. Trazabilidad

- `cores/tetanes/dist/tetanes_bg.wasm`: **942831 bytes**, SHA-256 `c61f83e51186908a022feb26bdd94b86907255ddf20ae6b1bb2ca73a42edf6af`. Resto de archivos y hashes en `cores/tetanes/manifest.json`.
- Construido por `core-tetanes.yml` (commit del bot `195a27a`); recompilación independiente (`mode=verify`) con el mismo resultado.
- `pnpm verify:core` comprueba hashes y licencias en cada CI. Actualizaciones de `tetanes-core` o de dependencias repiten este expediente.

## 7. Resultado

**accepted** para el NES experimental de Cartivo (mappers 0–4 bajo la validación compartida de `packages/adapters/src/ines.ts`). Véanse ADR-008 y `docs/compatibility/H0-WASM-NES.md`.
