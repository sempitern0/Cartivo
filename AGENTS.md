# Cartivo: reglas de desarrollo

## Fuente de verdad y alcance

Antes de implementar, leer `docs/PLAN_TECNICO_CARTIVO.md` (objetivos, estado, roadmap), los ADRs afectados y `docs/compatibility/`. El plan es una especificación; el estado real y sus pruebas viven en README y `docs/compatibility/`, que se actualizan en cada incremento.

V1: NES, SNES, GB, GBC, GBA, SMS, Mega Drive, N64, PS1 y PSP; las tres últimas dependen de aceptación individual y PS2 es laboratorio. No añadir sistemas ni accesorios sin una decisión de producto registrada. Un bloqueo de licencia no impide avanzar en tareas independientes, pero sí declarar completo el núcleo afectado.

Para añadir una consola, seguir `docs/ADDING_A_SYSTEM.md` (contrato `CoreModule`, registros `registry.ts` y `systems.ts`, conformidad obligatoria).

Trabajo por incrementos: un sistema o feature cada vez, en la rama de trabajo (nunca en `main`), con plan previo para cambios no triviales. Las decisiones técnicas rutinarias dentro del alcance se concretan con evidencia y se registran en su ADR; la licencia propia y las excepciones de licencia de terceros las decide el titular.

## Ingeniería

- TypeScript estricto y contratos versionados con validación runtime.
- La UI no conoce APIs internas de núcleos (solo `packages/runtime/src/systems.ts`); el Worker resuelve núcleos con `packages/adapters/src/registry.ts`. Sin globals compartidos entre emuladores.
- Un juego activo; lifecycle, errores, cancelación y limpieza explícitos (`dispose` libera la memoria WASM).
- No bloquear el hilo de UI con parsing, hashing o IO voluminoso.
- No prometer WebGPU, threads, rewind, JIT ni lectura incremental sin evidencia del port y build concretos. Las «Partidas» (instantáneas) existen para NES (ADR-009); cada núcleo nuevo debe implementarlas o declarar que no puede.
- Aspecto y velocidad originales por defecto; las mejoras que alteren fidelidad son opcionales y vienen desactivadas.
- Paquetes nuevos solo con consumidor real; sin scaffolding vacío.

## Datos y seguridad

- Sin BIOS propietarias, ROMs comerciales, claves ni arte sin derechos en git o CI.
- Archivos, partidas y rutas del usuario permanecen locales; metadatos remotos opcionales y transparentes.
- Un Worker del mismo origen no es un sandbox de privilegios.
- Partidas con generaciones recuperables, escritor único, exportación y commit confirmado; no depender de eventos de cierre.
- Ninguna actualización del SW o del núcleo recarga una sesión activa ni borra partidas para liberar caché.

## Licencias y núcleos

El código original de Cartivo usa **PolyForm Noncommercial 1.0.0** (`LICENSE`, ADR-005); no se aplica a núcleos ni librerías de terceros ni anula los derechos concedidos con la LGPL-2.1 anterior. No integrar ni publicar un núcleo con expediente bloqueado; se puede investigar su viabilidad sin redistribuirlo.

**Política vigente: uso privado** (revisión de ADR-005). Cartivo no se distribuye a terceros, así que se admiten núcleos con cualquier licencia libre o de código disponible identificada (incluidas GPL, MPL y no comerciales). Se rechazan componentes sin licencia o de fuentes no verificadas. Antes de cualquier publicación se rehace el análisis de compatibilidad por núcleo.

Cada núcleo pasa el gate CORE-LEGAL-01 (skill `cartivo-core-gate`) como registro: fuentes primarias, versión y toolchain fijadas, SBOM, licencias, firmware y decisión. No inventar permisos, benchmarks ni compatibilidad web a partir de una versión nativa.

**NES:**
- TetaNES (`tetanes-core` =0.17.0) es el núcleo por defecto (ADR-008, `docs/compatibility/H0-WASM-NES.md`). Se compila solo en CI (`core-tetanes.yml`), que versiona `cores/tetanes/dist`, `manifest.json`, `sbom.json` y `Cargo.lock`: no editarlos a mano. Cambiar `cores/tetanes/src` o dependencias repite el gate (`cargo deny` con la lista de uso privado).
- JSNES 2.1.0 queda como alternativa (ADR-007): no editar fuentes de `node_modules`.
- La validación iNES es común (`packages/adapters/src/ines.ts`); ampliar mappers exige fixtures, pruebas y expediente. La UI no accede a la ABI de SRAM de ningún núcleo.
- La fixture propia está en `packages/fixtures`: preservar hash, licencia y oráculo.

## Verificación

Con código: `pnpm verify:core`, `check`, `lint`, `test`, `build` y E2E de los flujos afectados; en dev y en preview cuando cambien Worker, audio, assets o PWA. QA real para GPU, mandos, audio, instalación y suspensión móvil: los gamepads sintéticos y Chromium headless no la sustituyen. Para documentación: enlaces relativos, fences y coherencia del alcance; no declarar tests ejecutados cuando solo hay documentos.

No confundir documentación, shell con mock, ruta jugable y release estable. Registrar por criterio el commit o build, la prueba y el resultado; lo pendiente conserva su estado. Entregar qué cambió, evidencia y límites, y actualizar README, `docs/compatibility/`, CHANGELOG y el ADR afectado.

## Experiencia

Seguir `docs/DESIGN.md` y los tokens de `apps/web/src/theme.css`: paleta propia, sin logos ni arte de terceros, una acción principal por pantalla, valores automáticos y corrección manual accesible. Laboratorio y detalles de núcleo solo en opciones avanzadas. Respetar foco, contraste y navegación con teclado y mando.

La configuración de controles (`#controles`, `ControlsPanel.svelte`) es una utilidad permanente del jugador fuera del laboratorio; reutilizar `packages/input` para normalizar entrada y conectar pausa y neutralización con la sesión antes de aceptar entradas.
