# Cartivo — instrucciones para agentes

## Contexto mínimo (lectura progresiva)

1. Lee este archivo una vez. Para localizar código y pruebas consulta `docs/ai/CONTEXT.md` **solo si hace falta**; no cargues todo el árbol.
2. Antes de programar, busca en el inventario **§2 (Hecho)** de `docs/PLAN_TECNICO_CARTIVO.md` si la capacidad ya existe: amplía o reutiliza, no reimplementes. Para elegir el siguiente incremento consulta **§3 (Pendiente)**. El estado demostrado está en `README.md` y `docs/compatibility/README.md`.
3. Lee exclusivamente los archivos del área afectada, sus pruebas, el ADR pertinente y la ficha de compatibilidad correspondiente. Lee `docs/DESIGN.md` para UX; `docs/ADDING_A_SYSTEM.md` y `cores/AGENTS.md` para núcleos.
4. Busca primero nombres de archivos (`rg --files`, `rg -l`); después símbolos (`rg -n` con rutas acotadas); lee rangos concretos. No vuelques de entrada `CHANGELOG.md`, `pnpm-lock.yaml`, `cores/*/dist`, artefactos, logs ni módulos completos ajenos a la tarea.

## Alcance y arquitectura (obligatorio)

- Trabaja por incrementos, en rama distinta de `main`; prepara un plan breve solo para cambios no triviales. No hagas push, abras PR ni modifiques `LICENSE`, `LICENSES.md` o `docs/adr/005-licensing.md` sin petición expresa.
- Una capacidad nueva, consola o accesorio requiere decisión de producto; V1 y roadmap están en el plan técnico. No inventes compatibilidad, benchmarks ni capacidades de núcleos. Las decisiones técnicas rutinarias se registran en su ADR; la licencia propia y las excepciones de licencia de terceros las decide el titular.
- **Nunca** compiles Rust/C/C++/WASM en la CI normal (por commit, PR o refactor), tampoco al tocar `.github/`: `pnpm verify:core` comprueba los artefactos existentes. Builds deliberados y gate legal: `cores/AGENTS.md`.
- TypeScript estricto; contratos versionados y validación runtime. La UI conoce sistemas mediante `packages/runtime/src/systems.ts`; el Worker resuelve implementaciones en `packages/adapters/src/registry.ts`. Un juego activo, sin estado global compartido entre núcleos; gestionar errores, cancelación y `dispose` de WASM.
- Parsing, hashing e IO pesados fuera del hilo de UI. Un Worker del mismo origen no es un sandbox de privilegios. No crear paquetes o scaffolding sin consumidor real.
- Fidelidad original por defecto; mejoras visuales o de temporización opcionales y desactivadas inicialmente. No afirmar soporte de WebGPU, threads, rewind, JIT ni lectura incremental sin evidencia.
- Archivos, partidas y rutas del usuario permanecen locales; cualquier futura sincronización requiere decisión y ADR específicos. **Nunca** subir ROMs comerciales, BIOS propietarias, datos de usuario o arte sin derechos. Las partidas necesitan recuperabilidad, escritor único, exportación y commit confirmado, sin depender de eventos de cierre. Una actualización de SW/núcleo no debe recargar partidas activas ni borrar saves.
- Diseño: `docs/DESIGN.md` y `apps/web/src/theme.css`; una acción principal por pantalla, valores automáticos con corrección accesible, foco, contraste, teclado y mando; paleta propia, sin logos ni arte de terceros; detalles de núcleo solo en opciones avanzadas. Los controles son una utilidad permanente (`ControlsPanel.svelte`, `packages/input`); el mando también maneja la interfaz (`pad-navigation.svelte.ts`) y quien lo lea para otra cosa lo reserva con `claimPadWhile`.

## Verificación proporcional, nunca omitida

- Mientras implementas: ejecutar pruebas unitarias/E2E del área modificada y revisar solo errores relevantes; evitar repetir suites globales tras cada edición.
- Antes de entregar **código**: `pnpm verify:core`, `pnpm check`, `pnpm lint`, `pnpm test` y `pnpm build`. E2E de flujos afectados; **en dev y preview** si cambian Worker, audio, assets o PWA. CI mantiene la matriz de navegadores. No afirmar que una prueba pasó si no se ejecutó. GPU, mandos, audio, instalación y suspensión móvil requieren QA real: mandos sintéticos y navegadores headless no la sustituyen.
- Para **solo documentación**: comprobar rutas relativas, formato Markdown, alcance y consistencia; no simular pruebas de código.
- Evidencia final breve: cambios, comandos con resultado, límites/QA manual pendiente. Actualiza **solo cuando aplique** README, `docs/compatibility/`, CHANGELOG y ADR; no generes actualizaciones vacías. Distingue mock, demo jugable, experimental y estable; por criterio, registra commit o build, prueba y resultado, y lo pendiente conserva su estado.

## Gestión de contexto y salida

- Prefiere diffs y archivos acotados a lecturas masivas; no releas documentación que no cambió. No pegues tests completos ni grandes logs: indica estado, fallos y líneas útiles, preservando el código de salida.
- Prioriza una solución completa y verificable sobre ahorrar tokens a costa de omitir validación, accesibilidad, seguridad o regresiones.
