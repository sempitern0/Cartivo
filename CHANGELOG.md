# Changelog

## Unreleased

- Shell Svelte/Vite con diagnóstico claramente identificado y NES deshabilitada hasta integración.
- Controlador de sesión tipado, validación de mensajes y pruebas de transiciones y sesiones obsoletas.
- Workspace pnpm, lockfile, comprobación de tipos, build y workflow de CI.
- Guía de validación manual y límites del primer incremento H1-A.

### Segunda iteración H1-A

- Paleta propia coral/azul/turquesa/dorado, tokens compartidos y entrada minimalista.
- Laboratorio plegado y separado del flujo de juego.
- Worker de diagnóstico con correlación, timeout, cancelación y limpieza.
- Pruebas de transporte y test Chromium del Worker real, añadido a CI.

### H1-B: entrada, después de integrar main

- Merge de main conservando la implementación; investigación existente como base para la selección NES aún pendiente.
- Prueba de teclado y mando P1 con estado visible, zona muerta, asignación manual y perfiles locales explícitos.
- Neutralización al perder foco/desconectar; reactivación y liberación obligatoria antes de aceptar nuevas entradas.
- Validación de perfiles y E2E con Gamepad API sintética; guía de prueba Windows y gates de hardware pendientes.

### Corrección de detección y asignación de teclado

- Selección automática del primer mando visible; evento de conexión más sondeo y respeto de Solo teclado elegido manualmente.
- Estados de conexión útiles: permisos/API/contexto seguro o mando no expuesto; instrucciones para la interacción inicial exigida por el navegador.
- Teclas A=X y B=Z visibles, reasignación de las ocho acciones, rechazo de colisiones, persistencia local y restablecimiento.
- Regresiones de conexión tardía, preferencia de teclado y remapeo con recarga.
