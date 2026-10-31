# Compatibilidad de mandos, teclado y navegadores — plan QA

**Estado:** casos por ejecutar, **no tabla de compatibilidad validada**. Se aplica a todas las consolas sin diseñar código de input mientras la PR #2 desarrolla H1-A.

## Principios

- Gamepad API es el baseline; `mapping === "standard"` indica layout reconocido, pero `mapping === ""` exige UI de asignación asistida.
- `Gamepad.id`, `index`, `mapping` y buttons/axes son pistas, **no identidad estable del dispositivo**; un índice puede reutilizarse al reconectar.
- La Gamepad API depende de navegador, sistema, driver, conexión, permisos/foco y políticas de seguridad; no prometer todos los mandos.
- Rumble/vibración son capacidades opcionales sujetas a `vibrationActuator` / `hapticActuators` y sus diferencias de soporte.
- El teclado es siempre ruta de recuperación y la UI se navega con mando/teclado sin ratón.

[Referencia MDN Gamepad API](https://developer.mozilla.org/en-US/docs/Web/API/Gamepad_API/Using_the_Gamepad_API) · [mapping](https://developer.mozilla.org/en-US/docs/Web/API/Gamepad/mapping) · [vibración](https://developer.mozilla.org/en-US/docs/Web/API/Gamepad/vibrationActuator).

## Matriz *a probar*, no resultados

| Plataforma / navegador | Teclado | Xbox USB/Bluetooth | DualShock/DualSense USB/Bluetooth | Genérico / Switch-compatible | PWA instalada | Resultado |
|---|---|---|---|---|---|---|
| Windows + Chrome/Edge actual | P0 | P0 | P0 | P1 | P0 | Pendiente |
| Windows + Firefox actual | P0 | P0 | P0 | P1 | N/A o según instalación real | Pendiente |
| macOS + Safari/Chrome/Firefox actuales | P0 | P1 | P0 | P1 | Según navegador | Pendiente |
| Linux + Firefox/Chromium actuales | P0 | P1 | P1 | P1 | Según navegador | Pendiente |
| Android + Chrome PWA | P0 (si existe) | P1 | P1 | P2 | P0 | Pendiente |
| iOS/iPadOS + Safari/PWA | P0 (si existe) | P1 | P1 | P2 | P0 | Pendiente |

`P0/P1/P2` = prioridad de ensayo, **no afirmación de soporte**. No marcar `PASS` sin dispositivo real y versión registrada. Cuando el navegador no ofrece instalación PWA nativa, documentar la ruta real o marcar N/A.

## Escenarios mínimos GAMEPAD-01

1. Autorización inicial/gesto de interacción, sondeo con `navigator.getGamepads()` y conexión/desconexión; no depender solo del evento.
2. Layout standard: D-pad, 2 sticks, ABXY, gatillos analógicos, Start/Select, presión/release; deadzone configurable donde haga falta.
3. Mapping vacío: wizard que detecta botón/axis y confirma colisiones; persistencia por perfil local con opción de reset; perfiles nunca aplicados ciegamente entre modelos.
4. Hot-plug: conectar después del inicio y durante partida; reconectar y reutilización de índice; cambiar mando/teclado mientras juega.
5. Dos a cuatro jugadores (según núcleo): asociación explícita del dispositivo a P1–P4, sin compartir input accidental; si núcleo solo soporta uno, UI no ofrece otros.
6. Blur/focus, alt-tab, suspensión móvil, recarga y salida: enviar entrada neutral, pausar si seguro, no quedarse con botones atascados.
7. Navegación de toda la PWA con mando y teclado: foco visible, Enter/A, Back/B, lector de pantalla, idioma y pérdida de conexión.
8. Rumble opcional: detectar soporte concreto, aceptar rechazo de la promesa sin bloquear juego, no reclamar soporte inexistente.
9. Inputs fantasma o ruidosos: jitter de ejes, diagonales, triggers invertidos, controladores compartidos; registrar dispositivo de forma anónima cuando se consienta.
10. Seguridad/privacidad: no almacenar identificadores únicos de mandos en servidores; métricas locales y telemetría desactivada por defecto.

## Registro de ejecución por combinación

```yaml
test_id: GAMEPAD-01
date_utc: null
hardware: null           # modelo y firmware; evitar seriales
connection: null         # USB / Bluetooth
os_version: null
browser_version: null
mode: null               # tab / installed
gamepad_mapping: null
buttons_count: null
axes_count: null
steps: []
expected: null
actual: null
result: pending          # pass / fail / blocked / pending
evidence: null           # video/log reproducible, sin IDs sensibles
issue: null
```

### Criterio de aceptación

Para lanzamiento H1 NES: teclado y al menos **un mando físico** probado en el navegador/SO objetivo, desconexión segura y navegación básica; el resto de combinaciones continúan pendientes. La simulación Playwright no equivale a prueba de un mando real. Antes de anunciar «compatibilidad amplia», completar matriz con al menos tres familias de dispositivos y dos motores de navegador, y documentar limitaciones.
