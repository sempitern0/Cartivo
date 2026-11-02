# Registro de decisiones

La existencia de un ADR no acredita implementación ni elimina un bloqueo de licencia. Para aceptar un ADR: fecha, decisión del responsable, alternativas descartadas y evidencia (commit/build y pruebas cuando haya código). Cambiar una decisión requiere un ADR sucesor o una revisión explícita.

| ADR | Tema | Estado |
|---|---|---|
| [001](001-platform-and-scope.md) | Catálogo, stack y distribución | Propuesto; stack aplicado (pnpm, Svelte/Vite, TS estricto) |
| [002](002-core-runtime.md) | Contrato de núcleos, registros y protocolo genérico | Aceptado (implementado) |
| [003](003-local-data.md) | Archivos locales, saves y offline | Propuesto; SRAM en ADR-007, ROMs en OPFS en ADR-012 |
| [004](004-game-identity.md) | Identificación regional y proveedores | Propuesto (H3) |
| [005](005-licensing.md) | PolyForm Noncommercial para código propio; política de uso privado para núcleos | Aceptado (revisión 2026-11-01) |
| [006](006-input-probe.md) | Entrada P1 y perfiles explícitos | Aceptado |
| [007](007-nes-experimental-js.md) | NES con JSNES en Worker; SRAM transaccional | Aceptado; JSNES pasa a alternativa |
| [008](008-nes-tetanes-wasm.md) | NES con TetaNES en WebAssembly, build reproducible en CI | Aceptado; núcleo por defecto |
| [009](009-save-states.md) | «Partidas»: instantáneas para guardar cualquier juego | Aceptado |
| [010](010-gb-sameboy.md) | Game Boy y Game Boy Color con SameBoy en WebAssembly | Aceptado (experimental) |
| [011](011-gba-mgba.md) | Game Boy Advance con mGBA en WebAssembly; botones L/R | Aceptado (experimental) |
| [012](012-library-continue.md) | Biblioteca local y «Continuar» (ROM en OPFS con consentimiento) | Aceptado (experimental) |
| [013](013-snes-snes9x.md) | SNES con Snes9x en WebAssembly; botones X/Y | Aceptado (experimental) |
| [014](014-sms-md-genesis-plus-gx.md) | Master System y Mega Drive con Genesis Plus GX en WebAssembly | Aceptado (experimental) |
