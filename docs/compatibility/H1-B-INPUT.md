# H1-B Entrada: teclado y mando

**Estado:** implementado y probado con mandos sintéticos en Chromium y Firefox. El mando físico está pendiente de QA. Decisión: [ADR-006](../adr/006-input-probe.md).

## Implementado

- **Estado de entrada** (`packages/input/src/nes-input.ts`): un jugador, independiente del núcleo.
  - Tiene **catorce acciones**: cruceta, A, B, X, Y, L, R, L2, R2, Select y Start (L2/R2 desde PlayStation, ADR-015). Las direcciones opuestas se neutralizan.
  - Cada sistema declara en `packages/runtime/src/systems.ts` qué acciones usa (`buttons`) y cómo se llaman en su mando (`labels`): Mega Drive A/B/C/X/Y/Z/Mode y Master System 1/2/Pause.
  - Los núcleos ignoran las acciones que no tienen.
- **Teclado por defecto:**
  - WASD y flechas;
  - L = A, K = B, U = X, J = Y, I = L, O = R;
  - Q = Select, Enter = Start.
  
  Una tecla reasignada tiene prioridad sobre un valor por defecto. Los perfiles antiguos se completan sin pisar reasignaciones.
- **Mando:** Gamepad API con sondeo y evento de conexión, y selección automática del primer mando visible.
  - Distribución `standard` por posición física: oeste = Y, norte = X, LB/RB = L/R.
  - Asignación manual de botones y ejes, con zona muerta ajustable.
  - Mensajes útiles si el navegador no expone el mando (contexto seguro, permisos, primera pulsación).
- **Asignar controles:**
  - espera a soltar y rechaza colisiones;
  - Escape cancela;
  - los perfiles locales se validan por mando y se aplican de forma explícita, nunca a ciegas al reconectar.
- **Neutralizar la entrada:** blur, pestaña oculta, desconexión o cambio de dispositivo la neutralizan, y al reactivar hay que soltar todo. Los índices no identifican dispositivos.
- **Captura durante la partida:** es del juego, pero cualquier control de la página (botones, enlaces, campos) sigue funcionando.
- **Interfaz con mando** (`ui-navigation.ts` y `apps/web/src/pad-navigation.svelte.ts`): la cruceta o el stick (zona muerta 0,5, repetición a los 400 ms y cada 120 ms) mueven el foco al control más cercano en esa dirección; A pulsa; B envía Escape y, si nadie lo atiende, pulsa el control `[data-pad-back]` (volver de Controles). Select+Start pausa la partida y sale de la prueba. El reproductor en marcha y la prueba o asignación de Controles suspenden la navegación; al reanudarse se ignoran los botones que sigan pulsados. Solo mandos `standard`.
- **Modo consola** (`input-mode.svelte.ts`, `PauseMenu.svelte`, `PadHints.svelte`, `InterfacePreference.svelte`): interfaz automática, «Teclado y ratón» o «Mando» en Ajustes; leyenda de botones, carrusel de consolas y menú de pausa modal (Reanudar, Partidas, Gráficos, Controles, Reiniciar, Salir del juego).
- **Pantalla «Configurar controles»** (`#controles`):
  - dibujos que se iluminan durante la prueba;
  - chips solo para los botones que usa alguna consola disponible;
  - notas generadas sobre qué consolas los usan y cómo se llaman ([DESIGN](../DESIGN.md)).

## Evidencia automática

E2E con Gamepad API sintética, en Chromium y Firefox:
- foco y Tab;
- mando standard, desconexión y reutilización de índice, y aparición tardía del mando;
- asignación manual y persistencia;
- reasignación de teclado con colisiones y recarga;
- L/R y X/Y;
- WASD junto a flechas;
- Gamepad API denegada;
- pantalla a 360 px sin desbordamiento;
- interfaz con mando: la cruceta mueve el foco entre tarjetas y A arranca la demo; Select+Start pausa y A reanuda; A abre Partidas y B lo cierra devolviendo el foco; en Controles la prueba retiene el foco, Select+Start la detiene y B vuelve al inicio (`pad-navigation.spec.ts`; intenciones y foco espacial en `tests/ui-navigation.test.ts`);
- modo consola: el mando cambia la interfaz automática y el ratón la devuelve; «Mando» fijado persiste tras recargar; Select+Start abre el menú con foco en Reanudar; Partidas se abre y B vuelve al menú; B reanuda; «Salir del juego» vuelve al inicio.

Las notas de Controles se generan y prueban a partir de `systems.ts`. **No certifican hardware.**

## QA manual pendiente

1. En **Ajustes → Configurar controles**, pulsa «Activar prueba» y comprueba el teclado.
2. Conecta un mando, pulsa un botón y verifica la cruceta o el stick y los botones de cada consola.
3. Asigna los controles si el mando no es standard.
4. Desconecta el mando con una dirección pulsada: todo debe liberarse.
5. Recarga y usa «Aplicar perfil guardado».
6. Sin tocar ratón ni teclado: recorre el inicio con la cruceta, arranca una demo con A, pausa con Select+Start, abre y cierra Partidas (A y B) y vuelve de Controles con B.
7. Modo consola: al usar el mando aparecen la leyenda y el carrusel; Select+Start abre el menú de pausa con foco en Reanudar; «Salir del juego» vuelve al inicio; el ratón devuelve la interfaz de escritorio salvo con «Mando» fijado en Ajustes.

Registra el modelo (sin número de serie), la conexión, el sistema operativo y el navegador en [GAMEPAD_BROWSER_QA](../research/GAMEPAD_BROWSER_QA.md).

**Abiertos:** segundo jugador, vibración y lectores de pantalla.
