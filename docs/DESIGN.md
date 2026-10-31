# Dirección visual y UX de Cartivo

Decisión de producto: paleta propia evocadora de la época PSX, sin reutilizar su logo, formas de marca ni valores exactos de la referencia. Tokens compartidos en apps/web/src/theme.css.

| Token | Color | Uso |
|---|---|---|
| Coral | #ED5871 | Acento y error acompañado de texto |
| Azul | #619DE5 | Acción principal y enlaces |
| Turquesa | #40C2AE | Acento secundario |
| Dorado | #E9C45E | Foco visible y énfasis |
| Fondo | #111218 | Base neutra |
| Superficie | #1B1D26 | Controles y paneles |
| Texto | #F3F1ED | Lectura principal |
| Secundario | #B3B5C2 | Explicaciones |

La mayor parte de la pantalla es neutra. No aplicar los cuatro acentos a todos los controles ni comunicar estados solo mediante color. Mantener contraste, foco de teclado y áreas táctiles mínimas de 44 px.

## Interacción

Una acción principal por pantalla. Elegir juego y, cuando exista una partida, Continuar. Autodetectar consola y mando cuando sea fiable; resolver pantalla y rendimiento con Automático. Mantener selección/corrección manual accesible, sin obligar a recorrer un asistente para cada partida.

El recorrido de cinco decisiones del plan se conserva como capacidades, no cinco pantallas obligatorias. Mostrar detalles técnicos y ajustes por núcleo solo en opciones avanzadas. El laboratorio permanece plegado y separado del flujo de jugar. Ninguna simulación se presenta como emulación funcional.

Estado actual: Elegir juego admite NROM NTSC experimental y Probar demo NES ejecuta una fixture propia. La sección de laboratorio permite probar un Worker real con sesión simulada. La ruta real tiene importación local, audio y SRAM; instalación/offline siguen pendientes.

## Zona permanente de controles

«Controles» es una utilidad del jugador, accesible desde la cabecera y por `#controles` antes de elegir un juego. Tiene pantalla propia para detectar/probar teclado o mando, remapear y restaurar asignaciones. No pertenece al laboratorio de desarrollo ni es un paso obligatorio antes de cada partida.

`ControlsPanel.svelte` contiene la configuración/prueba y consume `packages/input`; no conoce el Worker de diagnóstico. Puede reutilizarse desde los ajustes de la interfaz final. Actualmente el único perfil es NES P1, sin anunciar otros sistemas. Al salir se desmontan sondeo y listeners; al volver no hay controles pulsados ni prueba activa. Los perfiles guardados se conservan. Volver al inicio y Atrás del navegador funcionan; se traslada el foco al título de la pantalla.

Durante la emulación NES, abrir Controles pausa y neutraliza la entrada; volver conserva el frame y exige Reanudar, aplicando las asignaciones actuales.
