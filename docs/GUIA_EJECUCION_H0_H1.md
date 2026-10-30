# Guía de ejecución — H0 y primer incremento H1

Este prompt adapta la propuesta original al estado del repositorio. La antigua Fase 0 corresponde a H0; la primera iteración de Fase 1 corresponde al primer incremento de H1. El documento adjunto original es antecedente: la especificación mantenida es [PLAN_TECNICO_CARTIVO.md](PLAN_TECNICO_CARTIVO.md).

## Prompt de trabajo

Actúa como Principal Software Engineer especializado en WebAssembly, emulación, PWA, TypeScript y sistemas de alto rendimiento.

Continúa en la rama de trabajo existente mientras siga abierta. Tras fusionar la documentación, parte de main actualizado y crea una rama de implementación para H0/H1. Inspecciona primero su estado actual, cambios locales, AGENTS.md, el plan técnico, los ADR y los informes de compatibilidad. Conserva trabajo ajeno y evita regenerar componentes ya implementados.

Usa `docs/PLAN_TECNICO_CARTIVO.md` como especificación mantenida y los ADR aceptados como decisiones de implementación. Si hay contradicciones, documéntalas y resuélvelas antes de ejecutar la parte afectada. No vuelvas al alcance del adjunto antiguo ni amplíes el catálogo.

Objetivo inmediato: completar la investigación necesaria de H0 para NES y construir el primer incremento jugable de H1. El catálogo completo y la preparación para producción son objetivos progresivos, no condiciones que puedan declararse logradas por una demo.

### 1. Investigación y decisión reproducibles

- Consulta fuentes primarias y registra fecha, URL, versión/commit, licencia y dependencias de cada candidato NES. Comprueba disponibilidad de código y build WASM reproducible; una captura o demo upstream no acredita integración.
- Verifica versiones compatibles de Node, pnpm, Svelte/Vite, TypeScript y Emscripten; fija las elegidas en configuración, lockfile y recetas. No actualizar a la última versión por inercia.
- Compara un conjunto pequeño de candidatos NES por licencia, firmware, port web, mappers, input, audio y save data. Documenta selección o bloqueo con evidencia.
- Respeta la política sin BIOS propietarias externas. Revisa también firmware de modos especiales.
- Resuelve el expediente del núcleo antes de integrarlo o distribuirlo. ADR-005 registra la elección del titular de PolyForm Noncommercial 1.0.0 para código propio. No extenderla a terceros ni asumir que cualquier núcleo GPL es integrable; verifica la compatibilidad por build.
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

## Contrato de arranque después del merge

La documentación puede fusionarse con la licencia del código propio decidida en ADR-005: ese merge no aprueba la integración ni la distribución de ningún núcleo externo. Se puede iniciar shell, contratos y persistencia; integrar el núcleo requiere resolver su compatibilidad con el modelo aplicable.

| Paso | Módulos mínimos con consumidor real | Resultado comprobable |
|---|---|---|
| H0-NES | Receta en cores y expediente en docs/compatibility | Candidato seleccionado, licencia/firmware revisados, toolchain fijada y spike reproducible |
| H1-A | apps/web, packages/domain, emulation-api y runtime | Shell arrancable, protocolo validado y ciclo de sesión probado con mock identificado |
| H1-B | packages/adapters del núcleo NES, input, media y storage | Importar archivo, ejecutar núcleo real, controlar, escuchar audio y conservar save data |
| H1-C | Manifest/SW en web, tests y CI | Build reproducible, offline, export/import y actualización sin perder partida |

El catálogo mínimo vive en el dominio y sus servicios de almacenamiento; crear packages/library cuando exista lógica que lo justifique. El registro puede empezar dentro de runtime. No crear un gateway, microservicios, sistema de plugins público ni todos los paquetes del mapa futuro para cumplir un árbol de carpetas.

### Condiciones para cerrar cada etapa

- **Preparación documental:** fuentes de verdad y alcance coherentes, enlaces válidos, dependencias explícitas y limitaciones registradas. No acredita funcionamiento.
- **Arranque H1-A:** comandos reales documentados, tipos/lint/build y pruebas del protocolo disponibles en CI. Los mocks no aparecen como juegos compatibles.
- **H1 jugable:** todas las evidencias de la tabla de aceptación del incremento, incluido núcleo real, save data y pruebas de plataforma. Lo que no pueda probarse queda pendiente y no se declara completo.
- **Sistema estable / publicación:** además, presupuestos y matriz de la sección 11 del plan, derechos de distribución, QA real y release/rollback. Los diez casos por core y ciclos de resistencia son gates de promoción, no requisitos para escribir el primer módulo.

Al cerrar H0-NES actualizar ADRs técnicos con las decisiones demostradas. El resto de H0 puede seguir pendiente por sistema. Registrar un bloqueo con su causa y siguiente acción, y continuar en tareas independientes. No convertir el merge de documentación en una declaración de H0/H1 completado.
