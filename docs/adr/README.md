# Registro de decisiones

La existencia de un ADR no acredita implementación ni elimina un bloqueo de licencia. Para aceptar un ADR: fecha, decisión del responsable, alternativas descartadas y evidencia (commit/build y pruebas cuando haya código). Cambiar una decisión requiere un ADR sucesor o una revisión explícita.

| ADR | Tema | Estado |
|---|---|---|
| [001](001-platform-and-scope.md) | Catálogo, stack y distribución | Propuesto; stack aplicado (pnpm, Svelte/Vite, TS estricto) |
| [002](002-core-runtime.md) | Contrato de núcleos, registros y protocolo genérico | Aceptado (implementado) |
| [003](003-local-data.md) | Archivos locales, saves y offline | Propuesto; excepción SRAM NES en ADR-007 |
| [004](004-game-identity.md) | Identificación regional y proveedores | Propuesto (H3) |
| [005](005-licensing.md) | PolyForm Noncommercial para código propio; política de uso privado para núcleos | Aceptado (revisión 2026-11-01) |
| [006](006-input-probe.md) | Entrada P1 y perfiles explícitos | Aceptado |
| [007](007-nes-experimental-js.md) | NES con JSNES en Worker; SRAM transaccional | Aceptado; JSNES pasa a alternativa |
| [008](008-nes-tetanes-wasm.md) | NES con TetaNES en WebAssembly, build reproducible en CI | Aceptado; núcleo por defecto |
| [009](009-save-states.md) | «Partidas»: instantáneas para guardar cualquier juego | Aceptado |
| [010](010-gb-sameboy.md) | Game Boy y Game Boy Color con SameBoy en WebAssembly | Aceptado (experimental) |
