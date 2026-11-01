# H1-B Entrada — teclado y mando

Estado: **implementado y probado con mandos sintéticos; mando físico pendiente de QA.** Decisión: [ADR-006](../adr/006-input-probe.md).

## Implementado

- `packages/input/src/nes-input.ts`: estado NES P1 independiente del núcleo; teclado, layout `standard` y asignaciones manuales de botones y ejes. Direcciones opuestas se neutralizan.
- Teclado por defecto: WASD y flechas, L = A, K = B, Q = Select, Enter = Start. Una tecla reasignada tiene prioridad sobre un valor por defecto que use la misma tecla. Perfiles antiguos (X/Z, Mayús derecha) se migran sin pisar reasignaciones.
- Gamepad API con sondeo y evento de conexión; selección automática del primer mando visible; mensajes útiles si el navegador no expone el mando (contexto seguro, permisos, primera pulsación).
- Asignación de los ocho controles: espera a soltar, rechaza colisiones, Escape cancela. Perfiles locales validados por mando; se aplican de forma explícita, nunca al reconectar a ciegas. Zona muerta ajustable.
- Blur, pestaña oculta, desconexión o cambio de dispositivo neutralizan la entrada; al reactivar hay que soltar todo. Los índices no identifican dispositivos.
- Pantalla «Configurar controles» (`#controles`) con dibujos que se iluminan durante la prueba ([DESIGN](../DESIGN.md)).

## Evidencia automática

E2E con Gamepad API sintética: foco y Tab, mando standard, desconexión y reutilización de índice, aparición tardía del mando, asignación manual y persistencia, reasignación de teclado con colisiones y recarga, WASD junto a flechas, Gamepad API denegada y pantalla a 360 px sin desbordamiento. **No certifican hardware.**

## QA manual pendiente

En **Ajustes → Configurar controles**: Activar prueba y comprobar teclado; conectar un mando, pulsar un botón y verificar cruceta/stick, A, B, Select y Start; asignar controles si no es standard; desconectar con una dirección pulsada (todo debe liberarse); recargar y «Aplicar perfil guardado». Registrar modelo (sin serial), conexión, sistema y navegador en [GAMEPAD_BROWSER_QA](../research/GAMEPAD_BROWSER_QA.md).

Abiertos: navegación de la UI con mando, P2, vibración, lectores de pantalla, Firefox/Safari.
