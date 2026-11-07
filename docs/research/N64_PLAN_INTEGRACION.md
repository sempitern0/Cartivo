# Cartivo — Plan de integración de Nintendo 64

Fecha: 2026-11-07. Estado: **fases 0–2 en curso** en `feat/n64-gpu-prototype`. El relevo vivo está en [experiments/n64/README.md](../../experiments/n64/README.md#estado-de-relevo) y la evidencia en [N64_CORE_GATE.md](N64_CORE_GATE.md).

## 1. Objetivo y mandato

Demostrar primero una configuración N64 jugable en navegador mediante un prototipo aislado. Integrarla después en Cartivo conservando los sistemas existentes, el rendimiento, la accesibilidad y la experiencia de mando/teclado. N64 es el consumidor inicial; no construir una plataforma abstracta para N64, Dreamcast y GameCube por adelantado.

El usuario ha autorizado trabajar en N64, pero ha pedido este plan antes de comenzar. No modificar la rama de la PR #35 ni interferir con el trabajo activo de PS1. No fusionar ni publicar cambios sin la autorización que exijan las instrucciones vigentes del repositorio. Una autorización anterior para otra PR no se extiende automáticamente a esta.

**Resultado esperado:** una feature experimental verificable, con límites de compatibilidad explícitos y una ruta reversible hacia soporte estable. Un canvas con imagen, un mock o una ROM que arranca no equivalen a soporte jugable.

## 2. Contexto de partida y grado de certeza

Repositorio: https://github.com/sempitern0/Cartivo

La última revisión comunicada en la conversación tomó `main` en `62dc1c7`, con PS1 integrado mediante la PR #34. La PR #35 trabajaba carga CUE, foco y perfiles, y afectaba a reproductor, Worker, protocolo, almacenamiento y entrada. **Es una referencia histórica, no una comprobación del estado remoto actual.**

En esa revisión se identificaron: separación CartridgeModule/DiscModule, VFS de lectura bajo demanda, persistencia de discos, cadencia por juego y métricas de petición al Worker. Los límites pendientes eran salida RGBA obligatoria, host WASM orientado a framebuffer y entrada basada en botones digitales. Confirmar cada punto en la fase 0: no reimplementar capacidades que ya hayan cambiado.

Durante la preparación de este documento se leyeron AGENTS.md y cores/AGENTS.md de una copia local en `19a9158`, anterior a esa referencia. Se han incorporado sus restricciones de lectura progresiva, verificación y admisión de núcleos; el agente ejecutor debe releer las instrucciones del checkout vigente. No se ha verificado aquí un port, compilado un núcleo ni medido rendimiento N64.

## 3. Reglas de trabajo

- Rama propia propuesta: `feat/n64-gpu-prototype`, desde el `main` comprobado al iniciar. Si ya existe, revisar su contenido antes de crear otra o reutilizarla.
- Checkout/worktree separado si hay trabajo ajeno. No resetear, limpiar, sobrescribir ni rebasar cambios de otros agentes.
- Prototipo separado del reproductor de producción. No registrar N64 como sistema soportado ni descargar su núcleo para usuarios de otros sistemas.
- PS1 conserva su ruta actual. Si aparece una necesidad compartida, documentarla y resolverla en un incremento pequeño después de revisar la integración de la PR #35 o su sucesora.
- Mantener ROMs, archivos, partidas y métricas de sesión locales. No subir contenido comercial, BIOS propietarias ni datos del usuario a CI o repositorios.
- No reconstruir C/C++/WASM en la CI habitual. Builds deliberados, toolchain fijada y verificación de artefactos según las reglas vigentes.
- No alterar licencias del proyecto. Completar CORE-LEGAL-01 antes de integrar/publicar artefactos; cualquier decisión reservada al titular permanece reservada.
- No afirmar compatibilidad o rendimiento a partir de builds nativas, mocks, pruebas omitidas o FPS de presentación solamente.

## 4. Fases y dependencias

| Fase | Entrega | Criterio para avanzar |
|---|---|---|
| 0 — Estado real | Mapa acotado del código, PR y baseline | Base y zonas de conflicto identificadas |
| 1 — Admisión técnica | Expediente del núcleo y prueba de build | Procedencia, licencia y ruta web demostrables |
| 2 — Prototipo aislado | ROM local, vídeo, audio, entrada y cierre | Sesión reproducible sin cambiar producción |
| 3 — Viabilidad | Mediciones, QA y decisión | Configuración jugable en dispositivos declarados |
| 4 — Integración | Vídeo alternativo y entrada analógica | Contratos compatibles y regresiones superadas |
| 5 — Producto experimental | Biblioteca, guardado, controles y PWA | Flujo completo recuperable y accesible |
| 6 — Admisión estable | Evidencia sostenida de compatibilidad | Matriz aprobada y limitaciones publicadas |

Las fases son secuenciales en sus dependencias. No convertir trabajo pendiente de fase 1–3 en una integración genérica de producción.

## 5. Fase 0 — Verificar el repositorio antes de editar

- [ ] Leer AGENTS.md vigente y cores/AGENTS.md, además de instrucciones en directorios afectados.
- [ ] Registrar SHA de main, rama de trabajo, estado limpio/sucio y PR abiertas relacionadas. Revisar #35 y sus sucesoras sin modificarlas.
- [ ] Consultar el inventario «Hecho» y «Pendiente» del plan técnico; README y fichas de compatibilidad describen lo demostrado.
- [ ] Usar `pnpm context input`, `pnpm context load` y, cuando corresponda, `pnpm context pwa` para localizar rutas. Confirmar primero que esos comandos siguen existiendo.
- [ ] Leer solo contratos, host, registros y pruebas relevantes; ampliar con docs/ADDING_A_SYSTEM.md y ADR pertinentes.
- [ ] Localizar los equivalentes vigentes de `packages/adapters/src/contract.ts`, `wasm-host.ts`, `registry.ts`, `packages/runtime/src/systems.ts`, InputState, FrameMetrics y `claimPadWhile`.
- [ ] Identificar propietario del canvas, AudioContext, bucle de emulación, entrada y persistencia. Documentar quién crea y libera cada recurso.
- [ ] Ejecutar baseline proporcional y registrar fallos previos por separado. Si faltan artefactos, recuperar los originales; nunca sustituirlos por placeholders para pasar checks.

Salida: SHA real, lista breve de archivos a tocar/no tocar, estado de pruebas y decisión sobre aislamiento. Revalidar las zonas compartidas antes de la fase 4.

## 6. Fase 1 — Núcleo, renderizador y host

**Candidato inicial a evaluar:** Mupen64Plus-Next con WebGL2 y un canvas transferido al Worker. Es una hipótesis técnica, no una selección ya validada. No asumir que el build upstream expone la ABI de Cartivo ni que admite OffscreenCanvas sin adaptación.

- [ ] Fijar commit del núcleo, renderer/plugins, Emscripten, flags y dependencias. Registrar fuentes primarias, licencias, firmware, SBOM y hashes conforme a CORE-LEGAL-01.
- [ ] Comprobar por separado CPU, renderizador y host: intérprete/recompilador real del build web, extensiones GL, importaciones JS, sistema de archivos, audio, bucle y salida.
- [ ] Verificar si necesita glue generado de Emscripten, carga modular, recursos auxiliares y soporte de Worker. Encapsularlo; no forzarlo dentro del host actual si sus supuestos son incompatibles.
- [ ] Probar la creación real del contexto en Worker; la mera presencia de OffscreenCanvas no prueba que funcione la combinación requerida.
- [ ] Determinar si el build usa hilos. Si requiere memoria compartida, verificar aislamiento y despliegue; no imponerlo globalmente a Cartivo sin una decisión explícita.
- [ ] No suponer que desactivar hilos en runtime elimina dependencias del binario. Si se evalúan variantes, fijar y medir cada artefacto por separado.
- [ ] Preparar una receta de build deliberado, reproducible y verificable. No editar hashes o manifiestos a mano.

Salida: expediente corto con candidato, limitaciones, build, comandos y decisión. Si el candidato no encaja, documentar el fallo y evaluar una alternativa concreta; Angrylion/software es una posibilidad a investigar, no un fallback gratuito ni necesariamente rápido.

## 7. Fase 2 — Harness aislado y sesión mínima

Ubicación propuesta, a confirmar con las convenciones del repo: un harness experimental dentro de la estructura existente. Evitar paquetes nuevos sin consumidor real. Desactivado en el flujo normal y sin precache obligatorio del núcleo.

- [ ] Seleccionar contenido local y validar tamaño/cabecera antes de preparar recursos costosos. Definir formatos admitidos y normalización de endianness; no confiar solo en la extensión.
- [ ] Transferir el canvas una sola vez por instancia. Tras transferir su control, no intentar reutilizarlo como canvas convencional; recrearlo cuando sea necesario.
- [ ] Presentar desde la GPU sin readback por fotograma para simular el contrato RGBA. Capturas puntuales, si existen, serán una operación independiente.
- [ ] Mantener UI y controles en el hilo principal, sin tareas pesadas de parsing, hashing o emulación.
- [ ] Implementar entrada analógica mínima de prueba: stick continuo, botones A/B, Start, Z, L/R y C. Documentar el mapeo provisional.
- [ ] Audio con canales/frecuencia reales declarados y una cola acotada. Resolver el inicio mediante gesto del usuario y la recuperación de suspensión.
- [ ] Estados explícitos: idle, loading, running, paused, stopping y error. Cada transición debe ser idempotente o rechazarse con motivo.
- [ ] Cancelación durante descarga/compilación/inicio: ignorar respuestas de sesiones antiguas, cancelar lo abortable y terminar el Worker si es la única vía fiable.
- [ ] Pausar/reanudar sin bucles duplicados; al volver de background, no intentar recuperar todo el tiempo perdido ejecutando una ráfaga ilimitada.
- [ ] Cierre y fallo liberan Worker, audio, canvas/contexto, listeners, referencias y bloqueos. Simular pérdida de contexto y ofrecer recuperación o reinicio explícito sin prometer recuperación transparente.
- [ ] Fixture original o redistribuible con licencia y oráculo verificables. Los juegos propios usados en QA permanecen fuera del repo.

Salida: demo local repetible con comandos de arranque, prueba de fallo/cierre y limitaciones. No afirmar todavía soporte N64 de producto.

## 8. Fase 3 — Medición y gate de viabilidad

Medir por build, navegador/versión, SO, CPU/GPU, RAM, energía y contenido/escena. Separar escritorio y móvil. Fijar la escena, calentamiento y duración antes de comparar.

| Métrica | Definición y cautela |
|---|---|
| Arranque frío/caliente | Separar descarga, compilación, inicialización y primer frame; indicar qué cachés se vaciaron |
| Velocidad de emulación | Tiempo emulado / tiempo real, independiente del contador de presentación |
| Producción y presentación | Contar frames emitidos y presentados; no llamar «visualmente distintos» a frames que no se compararon |
| Regularidad | Intervalos p50/p95/p99 y pausas largas; declarar si son CPU, GPU o mensajería |
| Audio | Underruns, duración del déficit y ocupación de cola; complementar con escucha real |
| Entrada | Tiempo muestreo→consumo; medir input-to-photon aparte si hay instrumentación física |
| Memoria | WASM, buffers y recursos disponibles; declarar límites de observabilidad del navegador |
| Ciclo de vida | Memoria y recursos tras cargar/cerrar repetidamente y tras fallos |

No hacer readPixels continuo solo para medir imágenes distintas. Si se analiza contenido visual, usar una captura diagnóstica separada y declarar su coste. En escenas estáticas, imágenes idénticas no implican por sí mismas un fallo.

Protocolo inicial propuesto: cinco arranques fríos y cinco calientes, sesión sostenida de 30 minutos y diez ciclos de abrir/cerrar; al menos dos dispositivos reales de capacidades diferentes. Probar varias escenas de al menos tres juegos propios cuando estén disponibles, además de la fixture automatizable. Si no hay hardware/contenido suficiente, registrar cobertura incompleta.

Umbrales iniciales de decisión, a fijar antes de medir y justificar si cambian: velocidad media de emulación entre 0,98× y 1,02× en cada escenario aceptado; sin déficit sostenido de audio en estado estable; sin crashes ni crecimiento progresivo no explicado de recursos tras los ciclos. La cadencia visual se compara con la esperada del juego, no con 60 FPS universales. Registrar p95/p99 y acordar presupuesto de arranque por dispositivo con los resultados iniciales, sin inventar cifras alcanzadas.

**Go:** build verificable, host funcional, sesión sostenida jugable y problemas conocidos acotados. **Go limitado:** experimental solo en la combinación demostrada. **No-go:** CPU insuficiente, corrupción, fugas, audio inestable o requisitos incompatibles sin solución viable. En no-go conservar evidencia y detener la integración de producción.

## 9. Fase 4 — Integración incremental en Cartivo

Antes de tocar componentes comunes, actualizar la base y revisar las resoluciones de PS1/foco de #35 o sucesoras. No copiar versiones antiguas de esos archivos.

### 4.1 Vídeo y sesión

- [ ] Añadir una distinción explícita y versionada entre framebuffer y superficie GPU, ortogonal a cartucho/disco.
- [ ] Mantener compatibles los adaptadores existentes; evitar campos ambiguos y validar mensajes en runtime.
- [ ] Separar avance de emulación de presentación. No exigir pixels RGBA a un núcleo que renderiza directamente.
- [ ] Soportar dimensiones variables, resize y límite de resolución/DPR sin cambiar silenciosamente la fidelidad original.
- [ ] Declarar requisitos por núcleo y comprobarlos antes de descargar/iniciar. Mostrar un motivo útil si no se cumplen.
- [ ] Conservar las rutas RGBA y audio existentes; cualquier extensión común necesita regresiones de los sistemas previos, incluido PS1.

### 4.2 Entrada

- [ ] Extender InputState con valores analógicos normalizados y rangos documentados. Mantener la semántica digital existente.
- [ ] Definir deadzone, normalización y mapeo N64 sin perder intensidad ni invertir ejes accidentalmente. Cubrir límites, neutral y drift con tests.
- [ ] Reutilizar propietario de entrada y reserva del mando; nunca crear un segundo navegador de UI que compita con la partida.
- [ ] Cambiar presentación por actividad significativa, respetar preferencias manuales y evitar que un botón sostenido robe el foco.
- [ ] Desconexión, blur y cambio de propietario limpian botones/ejes para evitar entradas atascadas. Volver a teclado debe permitir seguir o pausar.
- [ ] Menú/diálogo consume su entrada sin filtrarla al juego; al cerrar, restaurar un foco válido y visible.
- [ ] Incluir teclado accesible y configuración de controles; una prueba con Gamepad API sintética no sustituye al mando físico.

Salida: incrementos revisables de vídeo, entrada y adaptador, con dependencias explícitas. No introducir Dreamcast/GameCube en estos commits.

## 10. Fase 5 — Feature experimental completa

- [ ] Registro del sistema, importación, biblioteca, iniciar/continuar, errores y cancelar; núcleo bajo demanda.
- [ ] Soporte explícito de saves que realmente exponga el núcleo (EEPROM/SRAM/FlashRAM y accesorios si aplica). No confundir guardado persistente con save states.
- [ ] Identidad estable de ROM, escritor único, commits de guardado confirmados y exportación recuperable; manejar cuota agotada y fallo de escritura.
- [ ] Save states ligados a núcleo/versión/formato: compatibilidad demostrada, migración o rechazo claro. No sobrescribir un estado incompatible.
- [ ] Integrar actualizaciones PWA sin recargar sesiones activas, también con varias pestañas. No eliminar recursos que necesite una sesión abierta.
- [ ] Cachear solo artefactos necesarios, comprobar integridad/versionado y manejar descarga incompleta/offline sin falso éxito. Sin duplicar hashes de ROM existentes.
- [ ] UI de pausa, perfiles y controles coherente con las soluciones vigentes; foco, contraste, teclado, mando y mensajes comprensibles.
- [ ] Documentar experimental, combinaciones verificadas y funciones no implementadas. Ausencia de soporte no se disfraza de botón funcional.
- [ ] Feature flag o registro reversible: desactivar N64 no elimina partidas ni rompe la biblioteca existente.

## 11. Pruebas y CI

Leer package.json y configuraciones vigentes antes de ejecutar. Comandos de referencia, sujetos a cambios: `pnpm verify:core`, `pnpm check`, `pnpm lint`, `pnpm test`, `pnpm build` y E2E relevantes en dev/preview.

- Unitarias: capacidades, formatos de ROM, contrato, validación de mensajes, estados/cancelación, analógico y ownership, persistencia y versiones.
- Integración: Worker real y fixture legal; carga, pausa, cierre, reinicio, fallo, audio y recursos. Las pruebas del harness deben incluirse explícitamente en un script/CI: no asumir que el glob existente las recoge.
- E2E: carga nueva/guardada, capacidades ausentes, errores, foco, menú, gamepad sintético, offline y sesiones múltiples. Matriz Chromium/Firefox/WebKit en las configuraciones admitidas; un skip justificado no cuenta como soporte demostrado.
- QA real: GPU, mando físico, audio, suspensión/reanudación móvil, instalación PWA y temperatura/rendimiento sostenido. Reportar qué falta.
- Regresiones: los sistemas actuales siguen compilando, cargando, guardando y cerrando; PS1 conserva sus pruebas de discos y foco.
- CI: no compilar cores por PR. Validar artefactos existentes; separar benchmark diagnóstico de tests deterministas, evitando umbrales de rendimiento inestables en runners compartidos.

No declarar una entrega «lista para merge» si faltan checks obligatorios, artefactos reales o la evidencia de admisión correspondiente. Explicar bloqueos sin maquillar resultados.

## 12. Entregas sugeridas

| Incremento | Alcance | Excluye |
|---|---|---|
| A | Expediente, build deliberado y harness N64 aislado | Reproductor y PS1 |
| B | Resultados de viabilidad y decisión técnica | Promesas de soporte universal |
| C | Contrato de vídeo y capacidades, con consumidor N64 | Migraciones innecesarias de cores |
| D | Entrada analógica y conexión con ownership existente | Rehacer perfiles/foco en paralelo |
| E | Biblioteca, persistencia, PWA y estado experimental | Dreamcast/GameCube |
| F | Correcciones y admisión estable según evidencia | Ampliación de alcance sin medición |

Cada entrega registra base, commits, pruebas, límites y rollback. Publicación y apertura de PR conforme a autorización vigente; nunca fusionar implícitamente por haber terminado.

## 13. Continuidad para cualquier agente

Leer este plan, instrucciones vigentes y último relevo. Confirmar el estado con Git antes de asumir que una casilla está hecha. No repetir suites o búsquedas ya válidas salvo cambios o evidencia faltante. Priorizar diffs y rutas acotadas sobre volcar el repositorio; nunca cargar binarios, lockfiles o logs completos como contexto inicial.

Mantener un único registro breve de relevo junto al plan cuando empiece la implementación, sin generar documentación duplicada. Usar esta plantilla:

```markdown
### Relevo — fecha y agente
- Base main (SHA):
- Rama / HEAD / PR:
- Cambios locales pendientes y propietario:
- Fase y último criterio completado:
- Archivos modificados y motivo:
- Decisiones confirmadas / hipótesis pendientes:
- Build del core, toolchain y artefactos:
- Pruebas: comando, resultado, commit, evidencia:
- QA física y matriz comprobada:
- Bloqueos y pasos exactos para reproducir:
- Próxima acción concreta:
- No tocar / trabajo de otros agentes:
```

**Primera acción del siguiente agente:** completar fase 0 y abrir el expediente de fase 1; no modificar todavía Player, PS1, el protocolo de producción ni las ramas activas de otros agentes.

## 14. Después de N64

Dreamcast: evaluar su núcleo web, CPU/recompilador, renderer, aislamiento, firmware, formatos de disco y VMU por separado. Reutilizar solo capacidades ya demostradas en N64 y la VFS existente; la VFS no interpreta automáticamente CHD/GDI ni elimina costes de descompresión.

GameCube: mantener como investigación independiente hasta demostrar CPU, renderizado, memoria, audio y compatibilidad. Un backend GPU común no demuestra viabilidad del port ni equivalencia entre FPS de presentación y velocidad de juego.

Ninguna de estas dos consolas es una dependencia de la entrega N64.
