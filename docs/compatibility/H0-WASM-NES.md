# H0-WASM-NES — TetaNES en WebAssembly

Fecha: 2026-11-01. **Experimental.** NES usa por defecto TetaNES (`tetanes-core` 0.17.0) compilado a WebAssembly; JSNES (H1-B-NES) queda como alternativa en **Acerca de esta prueba**. Decisión: [ADR-008](../adr/008-nes-tetanes-wasm.md). Expediente legal: [TETANES_CORE_GATE](../research/TETANES_CORE_GATE.md).

| Criterio | Evidencia | Estado |
|---|---|---|
| Build WASM reproducible | `core-tetanes.yml`: Rust 1.90.0, `wasm-bindgen` 0.2.130, `Cargo.lock`; artefactos del bot `195a27a`; recompilación independiente (`mode=verify`) con hashes idénticos | Cumplido |
| Integridad en cada CI | `pnpm verify:core` (`tools/verify-tetanes.mjs`): hashes de `dist/` y licencias del SBOM | Cumplido |
| Licencias | `cargo deny` (licencias y fuentes) con la política de uso privado de ADR-005 | Cumplido |
| Sin BIOS ni archivos externos | Envoltorio sin sistema de archivos ni `localStorage`; ROM y SRAM como bytes | Cumplido |
| Arranque, vídeo, entrada, audio y SRAM | `tests/tetanes.test.ts` con la fixture original: imagen, movimiento, tono con B, SRAM con A y restauración; mappers 1–4 generados en memoria | Automático (Node) |
| Partida compartida entre núcleos | Unit: SRAM de JSNES → TetaNES → JSNES; mismo `SramStore` por hash de ROM | Automático |
| Integración en el navegador | Suite E2E NES con TetaNES por defecto en dev y preview, cambio a JSNES y vuelta, reapertura offline con el `.wasm` precacheado | Automático (Chromium) |
| Rendimiento | Coste por frame medido en Node como dato informativo: en el runner de CI, TetaNES ≈ 2,0 ms/frame y JSNES ≈ 1,1 ms/frame con la fixture | Informativo, sin presupuesto validado |
| Firefox | Suite E2E completa en Firefox headless, dev y preview ([H1-QA](H1-QA.md)) | Automático |
| Mando físico, audio real, Safari, móviles | — | Pendiente (QA manual) |

Tamaño del núcleo: `tetanes_bg.wasm` 942.831 bytes (sin comprimir), precacheado por el service worker.

## Límites

- Mismos cartuchos que H1-B-NES: iNES NTSC, mappers 0–4 y límites de `packages/adapters/src/ines.ts`. TetaNES implementa más mappers, pero no se habilitan sin pruebas y expediente.
- Diferencia con JSNES: en UxROM (mapper 2) y CNROM (mapper 3) TetaNES no expone RAM en `$6000–$7FFF`, igual que esas placas originales; JSNES sí la mapea. Las partidas SRAM aplican a NROM con batería, MMC1 y MMC3.
- Vídeo `Pixellate` (aspecto original); el filtro NTSC compuesto de TetaNES no se expone.
- La preferencia de núcleo se aplica al siguiente arranque; si el WASM no carga, se informa y se puede elegir JSNES.
- Instantáneas con `save_state`/`load_state` de TetaNES (comprimidas; unos cientos de bytes con la fixture) para «Partidas» (ADR-009). Sin rewind, threads ni SIMD.

## Cómo probar en local

`git pull`, `pnpm install --frozen-lockfile`, `pnpm build && pnpm preview` (no hace falta Rust). Jugar la demo y una ROM propia; en pausa, **Acerca de esta prueba** muestra «TetaNES · WebAssembly · en uso». Elegir JSNES, salir y volver a abrir el juego: la partida guardada se conserva.
