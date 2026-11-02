# H1-B Entrada: teclado y mando

**Estado:** implementado y probado con mandos sintéticos en Chromium y Firefox. El mando físico está pendiente de QA. Decisión: [ADR-006](../adr/006-input-probe.md).

## Implementado

- **Estado de entrada** (`packages/input/src/nes-input.ts`): un jugador, independiente del núcleo.
  - Tiene **doce acciones**: cruceta, A, B, X, Y, L, R, Select y Start. Las direcciones opuestas se neutralizan.
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
- pantalla a 360 px sin desbordamiento.

Las notas de Controles se generan y prueban a partir de `systems.ts`. **No certifican hardware.**

## QA manual pendiente

1. En **Ajustes → Configurar controles**, pulsa «Activar prueba» y comprueba el teclado.
2. Conecta un mando, pulsa un botón y verifica la cruceta o el stick y los botones de cada consola.
3. Asigna los controles si el mando no es standard.
4. Desconecta el mando con una dirección pulsada: todo debe liberarse.
5. Recarga y usa «Aplicar perfil guardado».

Registra el modelo (sin número de serie), la conexión, el sistema operativo y el navegador en [GAMEPAD_BROWSER_QA](../research/GAMEPAD_BROWSER_QA.md).

**Abiertos:** navegación de la UI con mando (H1.5), segundo jugador, vibración y lectores de pantalla.
