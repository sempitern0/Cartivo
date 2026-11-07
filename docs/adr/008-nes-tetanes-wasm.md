# ADR-008 — Núcleo NES en WebAssembly con TetaNES

Estado: **aceptado para el incremento experimental H0-WASM-NES**, 2026-11-01. Sustituye a JSNES como núcleo NES por defecto; JSNES (ADR-007) queda como alternativa y comparador. No cierra H1 estable.

## Contexto

ADR-007 dejó abierto el gate WASM porque el entorno no tenía toolchain Rust. La investigación preliminar de candidatos (retirada al completarse; queda en el historial de git) priorizó TetaNES por su licencia permisiva y su soporte wasm32. El entorno del agente sigue sin poder descargar crates, así que la compilación se traslada a GitHub Actions con resultados versionados y verificables.

## Decisión

- **Núcleo:** crate publicado `tetanes-core = "=0.17.0"` (MIT OR Apache-2.0), sin parches, envuelto por `cores/tetanes` (`wasm-bindgen`). El envoltorio solo emula: sin sistema de archivos, `localStorage` ni hilos; la SRAM entra y sale como bytes para que `SramStore` siga siendo el único escritor. Vídeo `Pixellate` (un píxel RGBA por píxel PPU, aspecto original; el filtro NTSC compuesto no se activa), región NTSC y RAM inicial a ceros.
- **Build reproducible:** Rust 1.90.0 fijado (`rust-toolchain.toml`), `Cargo.lock` versionado, `wasm-bindgen-cli` de la misma versión que el lock, rutas reasignadas (`--remap-path-prefix`), LTO y `codegen-units = 1`. `tools/build-tetanes.mjs` produce `dist/`, `manifest.json` (SHA-256, toolchain, versión upstream) y `sbom.json`. El workflow `core-tetanes.yml` aplica `cargo deny` (licencias y fuentes), compila, versiona los artefactos en la rama y lanza una recompilación independiente que debe dar los mismos hashes. `pnpm verify:core` comprueba en cada CI que `dist/` coincide con el manifiesto y que el SBOM solo contiene licencias admitidas.
- **Licencias:** solo permisivas, salvo la excepción del titular para `option-ext 0.2.0` (MPL-2.0, sin modificar, vía `dirs` → `dirs-sys`). Expediente: `docs/research/TETANES_CORE_GATE.md`.
- **Integración:** `packages/adapters/src/tetanes.ts` ofrece la misma superficie que el adaptador JSNES (`input`, `advance`, `save`, `dispose`). `packages/adapters/src/ines.ts` comparte la validación iNES: mismos mappers (0–4) y límites que ADR-007, sea cual sea el núcleo. El Worker recibe `core` en `load` (protocolo v1, campo opcional validado; ausente = JSNES). La preferencia se guarda por sistema (`cartivo:core:nes:v1`, por defecto `tetanes`) y se cambia en **Acerca de esta prueba**; se aplica al siguiente arranque.
- **Partidas:** SRAM de 8 KB por hash de ROM, compartida entre núcleos. Las copias exportadas siguen el formato `cartivo-nrom-sram-v1`.
- **Fallos:** si el WASM no se instancia, el error lo dice y sugiere JSNES; no hay cambio silencioso de núcleo.

## Consecuencias

- El desarrollo local no necesita Rust; cambiar el envoltorio sí requiere pasar por el CI de núcleo.
- Cada actualización de `tetanes-core` vuelve a pasar el gate CORE-LEGAL-01 y la recompilación reproducible.
- Pendiente: QA física (mando, audio), Firefox/Safari, rendimiento real en dispositivos, ampliar mappers con pruebas, 100 ciclos. No se anuncian save states, rewind, threads ni SIMD.


## Política de cuota de GitHub Actions (2026-11-01)

El WebAssembly TetaNES compilado está versionado en `cores/tetanes/dist`, con manifiesto, hashes y SBOM. No tiene sentido volver a compilar Rust para cada actualización del reproductor, documentación o PR.

`core-tetanes.yml` se ejecuta exclusivamente por petición deliberada: `workflow_dispatch` (una vez disponible desde la rama predeterminada) o un cambio explícito a `cores/tetanes/.build-request` en esta rama. `build` actualiza los binarios y metadatos comprometidos; `verify` recompila para comprobar reproducibilidad, **solo manualmente**. Ningún build dispara una segunda compilación pesada.

El CI cotidiano mantiene `pnpm verify:core`, que valida SHA-256 de los archivos y licencia del SBOM existente sin instalar Rust. **Advertencia:** verificar los hashes del binario almacenado no prueba que concuerde con una modificación nueva de fuentes. Cambios en `cores/tetanes/src`, `Cargo.toml`, `Cargo.lock`, toolchain, parches o receta de build deben acompañarse de una regeneración explícita de artefactos antes de integrar esos cambios. Registrar la causa y evidencia; no prometer reproducibilidad sin correr el modo `verify`.

Como el manifiesto no guarda hashes de las fuentes, `Foundation CI` añade en cada PR una comprobación sin Rust: si cambian `src/`, `Cargo.toml`, `rust-toolchain.toml` o `build.rs` de un núcleo y no cambia su `manifest.json`, falla y pide regenerar los artefactos una vez.

## Disparo solo en ramas de trabajo (2026-11-01)

Al fusionar las PR #4 y #5, el push a `main` traía los `.build-request` de SameBoy y mGBA y relanzó sus compilaciones (runs 41338393160 y 41338891480). No hubo daño: los hashes salieron idénticos y el bot no hizo commit. Desde entonces, el disparador por `.build-request` ignora `main` en los tres workflows de núcleo; en `main`, una compilación deliberada se lanza con `workflow_dispatch`.
