# ADR-006 — Entrada NES P1 y laboratorio de controles

Estado: aceptado para el incremento de entrada, 2026-10-31. No selecciona núcleo NES ni cierra H1.

## Decisión

Normalizar teclado/mando en `packages/input` sin conocer la ABI del futuro núcleo. El consumidor actual es un laboratorio plegable; se monta solo al abrirlo y elimina sondeo/listeners al cerrarlo. Las ocho acciones NES, el layout standard y los bindings manuales son datos tipados y validados.

El foco delimita la entrada de juego: los controles de la interfaz conservan su navegación normal. Pérdida de foco, visibilidad o mando neutraliza la entrada; reactivar exige soltar controles. Un índice de mando no es identidad. Leer explícitamente las propiedades de Gamepad, que pueden ser getters heredados y no enumerables.

Perfiles pequeños y versionados en localStorage, con validación al recuperar, aplicación explícita y borrado. Se guarda únicamente la asignación, sin telemetría. Esto no es almacenamiento de partidas y no modifica ADR-003. El ID del mando se usa localmente como pista del perfil, nunca como identidad fiable. Zona muerta ajustable solo durante la sesión; persistirla queda pendiente.

## Alternativas y límites

Aplicación automática de perfiles descartada por reutilización de índices y variación de layouts. Capturar el teclado globalmente descartado porque interferiría con la UI. No añadir un proveedor de almacenamiento ni librería de input sin necesidad de este consumidor.

La sesión de emulación incorporará neutralización, pausa y limpieza al integrar el núcleo aceptado. Este laboratorio no demuestra input del emulador, navegación general con mando ni compatibilidad física. Solo P1; no rumble.

## Evidencia

[H1-B entrada](../compatibility/H1-B-INPUT.md), tests unitarios de input y E2E de foco, hot-plug simulado, remapeo/perfil y denegación de Gamepad API. Hardware real pendiente según [plan QA](../research/GAMEPAD_BROWSER_QA.md).

## Revisión: descubrimiento y teclado

El primer mando expuesto se selecciona automáticamente, respetando la elección explícita de Solo teclado. Se escucha conexión y se mantiene sondeo. La exposición depende del navegador; no se promete detección USB anterior al gesto requerido por Firefox.

Se añade perfil local versionado de teclado con las ocho acciones, captura por tecla física, validación de colisiones, etiquetas visibles y restauración. Tab/Escape quedan reservados para navegación/cancelación. No cambia la política de perfiles de mando: su aplicación sigue siendo explícita.
