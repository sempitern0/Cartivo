# Cartivo — reglas adicionales para núcleos (`cores/`)

**Lee junto con `../AGENTS.md` solo cuando una tarea afecte a núcleos, adaptadores, manifiestos o sus builds.** Para incorporar un sistema sigue `docs/ADDING_A_SYSTEM.md` (contrato `CoreModule`, registros de `registry.ts` y `systems.ts`, pruebas de conformidad).

## Licencias y admisión

- El código propio usa **PolyForm Noncommercial 1.0.0** (`LICENSE`, ADR-005), respetando los derechos de revisiones anteriores. Los núcleos de terceros conservan sus licencias.
- **Uso privado vigente:** pueden evaluarse núcleos con licencias libres o de código disponible identificadas, incluso GPL, MPL o no comerciales; componentes sin licencia o procedencia verificable quedan bloqueados. **Antes de distribuir Cartivo a terceros, revisar de nuevo cada licencia.** Nunca integrar/publicar un núcleo con gate legal bloqueado.
- Gate **CORE-LEGAL-01**: fuentes primarias, versión/commit, toolchain, SBOM, licencias, firmware y decisión registrada. Usa la skill `cartivo-core-gate` si está disponible; de lo contrario sigue los expedientes en `docs/research/` y `docs/ADDING_A_SYSTEM.md`. No inventes permisos, rendimiento ni compatibilidad web desde builds nativas.
- Sin BIOS propietarias ni ROMs comerciales en repo, CI, fixtures o mensajes. Solo fixtures originales con licencias y oráculos comprobables en `packages/fixtures/`.

## Artefactos WASM: regla crítica

- Los binarios WASM se versionan en `cores/*/dist`; los `manifest.json`/`sbom.json` y toolchains correspondientes, en la carpeta de cada núcleo. **Nunca** edites a mano archivos generados, hashes ni manifiestos para hacer pasar checks.
- **No compiles Rust/C/C++/WASM en el ciclo normal de CI, por cada commit, PR o refactor.** `pnpm verify:core` valida los artefactos existentes sin reconstruirlos.
- Al cambiar fuentes, toolchain, dependencias o receta de compilación: solicita/reproduce **un build deliberado por cambio**, usando `core-*.yml` y el mecanismo `.build-request` únicamente cuando sea necesario; documenta motivo, regeneración y CORE-LEGAL-01. Verificación pesada de reproducibilidad solo bajo petición. No alteres `.build-request` para cambios no relacionados.
- No fusiones fuentes de núcleo con binario/manifiesto incoherentes. Conserva ABI, versión y formato de save state; si cambian, versiona el contrato y añade migración o rechazo explícito.

## Integración y pruebas

- La UI no usa directamente la ABI de un core. `packages/adapters/src/registry.ts` carga en Worker; `packages/runtime/src/systems.ts` describe capacidades visibles. `packages/adapters/src/wasm-host.ts` centraliza el puente C/C++.
- NES: TetaNES `0.17.0` por defecto (ADR-008); JSNES `2.1.0` alternativo (ADR-007), sin tocar `node_modules`. iNES común en `packages/adapters/src/ines.ts`; nuevas variantes/mappers requieren fixtures, tests y expediente. La UI nunca opera sobre la SRAM ABI directamente.
- Cada núcleo integra o rechaza con motivo «Partidas»/save states (ADR-009). Ejecuta conformidad (`tests/core-conformance.test.ts`), pruebas del sistema, E2E relevantes e integridad de artefactos; QA física pendiente se declara, no se sustituye con mocks.
