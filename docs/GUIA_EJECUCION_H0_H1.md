# Guía de ejecución — H0 y primer incremento H1

Este prompt adapta la propuesta original al estado del repositorio. La antigua Fase 0 corresponde a H0; la primera iteración de Fase 1 corresponde al primer incremento de H1. El documento adjunto original es antecedente: la especificación mantenida es [PLAN_TECNICO_CARTIVO.md](PLAN_TECNICO_CARTIVO.md).

## Prompt de trabajo

Actúa como Principal Software Engineer especializado en WebAssembly, emulación, PWA, TypeScript y sistemas de alto rendimiento.

Continúa en la rama de trabajo existente. Inspecciona primero su estado actual, cambios locales, AGENTS.md, el plan técnico, los ADR y los informes de compatibilidad. Conserva trabajo ajeno y evita regenerar componentes ya implementados.

Usa `docs/PLAN_TECNICO_CARTIVO.md` como especificación mantenida y los ADR aceptados como decisiones de implementación. Si hay contradicciones, documéntalas y resuélvelas antes de ejecutar la parte afectada. No vuelvas al alcance del adjunto antiguo ni amplíes el catálogo.

Objetivo inmediato: completar la investigación necesaria de H0 para NES y construir el primer incremento jugable de H1. El catálogo completo y la preparación para producción son objetivos progresivos, no condiciones que puedan declararse logradas por una demo.

### 1. Investigación y decisión reproducibles

- Consulta fuentes primarias y registra fecha, URL, versión/commit, licencia y dependencias de cada candidato NES. Comprueba disponibilidad de código y build WASM reproducible; una captura o demo upstream no acredita integración.
- Verifica versiones compatibles de Node, pnpm, Svelte/Vite, TypeScript y Emscripten; fija las elegidas en configuración, lockfile y recetas. No actualizar a la última versión por inercia.
- Compara un conjunto pequeño de candidatos NES por licencia, firmware, port web, mappers, input, audio y save data. Documenta selección o bloqueo con evidencia.
- Respeta la política sin BIOS propietarias externas. Revisa también firmware de modos especiales.
- Resuelve el expediente del núcleo antes de integrarlo o distribuirlo. ADR-005 registra el conflicto entre LGPL existente e intención propietaria; no cambies LICENSE ni supongas una elección del titular.
- Si esa decisión bloquea un candidato, continúa con contratos, shell, almacenamiento, mocks y pruebas independientes que sí estén autorizados. No declares H1 completado sin núcleo real aceptado.
- Registra los spikes del resto de sistemas como pendientes: no bloquear la primera ruta NES por terminar toda la investigación 3D.

### 2. Implementación incremental

1. Inicializa o completa pnpm workspaces, Svelte/Vite estático, TypeScript estricto y CI con versiones fijadas.
2. Implementa contrato mínimo, schema de mensajes, gestor de sesión y adaptador simulado para probar errores, cancelación y limpieza. Identifica visiblemente el mock en desarrollo.
3. Integra un único núcleo NES aceptado, con fixture homebrew de licencia comprobada. Prueba un fixture que realmente escriba save data para acreditar persistencia.
4. Implementa importación local con validación, teclado y Gamepad API, remapeo mínimo, pausa, foco, desconexión y salida segura. No envíes archivos ni rutas al servidor.
5. Presenta vídeo con aspecto correcto y audio tras activación del usuario, sin bloquear la UI. Expón solo capacidades verificadas de la build.
6. Añade persistencia recuperable, exportación/importación y manejo de cuota. Distingue save data de save states; no anuncies estos últimos si el port no los ofrece.
7. Implementa manifest, SW, disponibilidad offline por juego y actualización que espere a terminar la sesión. La instalación no implica que ROM y núcleo estén disponibles offline.
8. Añade pruebas y guía de ejecución/despliegue reproducible, con cabeceras reales de staging cuando se pueda validar.

### 3. Evidencias de aceptación del incremento

| Área | Evidencia exigida |
|---|---|
| Emulación | Fixture legal ejecutado con build identificada, input efectivo, imagen y audio |
| Guardado | Progreso escrito por el juego, confirmado, conservado al reiniciar y recuperado tras export/import |
| Entrada | Teclado y mando real; desconexión/foco probados. Simulación automatizada etiquetada como tal |
| Offline | Reabrir sin red con shell, núcleo y archivo disponibles; documentar reselección si aplica |
| Actualización | Sesión activa protegida y partida conservada tras activar una nueva release |
| Calidad | Tipos, lint, unidades e integración relevantes, E2E de la ruta crítica y build |
| Plataforma | Navegador/SO/versiones realmente probados; pruebas pendientes explícitas para otros entornos |
| Rendimiento | Método, hardware, duración y datos medidos; sin extrapolar resultados de un mock |

No reemplaces pruebas reales de mando, instalación o Safari/iOS por resultados de mocks o Playwright WebKit. Si el entorno carece de hardware o acceso necesario, entrega instrucciones concretas y deja el gate correspondiente pendiente.

### 4. Entrega y continuidad

Mantén README, AGENTS.md, ADR, compatibilidad, CHANGELOG, avisos de terceros y CI sincronizados con lo implementado. Crea documentos nuevos cuando haya información real que registrar, no certificados vacíos.

Por incremento entrega commits, archivos relevantes, comandos ejecutados, resultados, navegadores probados, limitaciones y siguiente tarea concreta. Distingue implementado, probado, pendiente y bloqueado. No declares producción, compatibilidad universal ni benchmarks que no puedas demostrar.

Prioriza una ruta completa y fiable: importar → jugar → guardar → cerrar → reabrir. No avances a más consolas o mejoras avanzadas antes de que esa ruta supere sus criterios. Evita reescribir el plan repetidamente como sustituto de implementar cuando se solicite ejecutar esta guía.
