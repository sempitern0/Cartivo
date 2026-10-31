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

### Zona de controles del jugador

- Pantalla Controles accesible desde la cabecera y URL #controles, independiente del laboratorio técnico.
- Panel reutilizable para prueba y remapeo; limpieza de entrada al salir sin borrar perfiles guardados.
- Navegación Atrás/Volver con foco en el título y prueba E2E de reapertura neutral y pantalla móvil.

### Primera ruta NES real (experimental)

- JSNES 2.1.0 fijado y verificado contra 51 archivos upstream; Apache-2.0 y avisos incluidos. JavaScript en Worker; WASM pendiente explícito en ADR-007.
- Demo NROM original generada desde fuente, teclado/mando/remapeo aplicados al juego, vídeo 4:3 y audio AudioWorklet tras gesto del usuario.
- Importación local estricta NROM NTSC; pausa/foco/desconexión, cancelación y salida. Otros formatos se rechazan.
- SRAM real con escritor único, dos generaciones SHA-256 en transacción IndexedDB, export/import por identidad y recuperación de corrupción.
- E2E del núcleo y almacenamiento real en dev y preview; integridad del núcleo añadida a CI. Sin declarar PWA offline, compatibilidad general ni hardware probado.

### Carga de cartuchos y movimiento predeterminado

- Ampliación experimental iNES NTSC a MMC1/UxROM/CNROM/MMC3; límites por board y mensajes con mapper/tamaño en lugar del rechazo NROM genérico.
- Fixtures originales de arranque/entrada/SRAM por mapper y carga E2E de MMC1 mayor que el antiguo límite.
- WASD junto a flechas en Controles y juego, respetando asignaciones personalizadas y colisiones.
