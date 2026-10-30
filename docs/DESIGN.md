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

Estado actual: Elegir juego deshabilitado porque no existe núcleo integrado. La sección de laboratorio permite probar un Worker real con sesión simulada. No hay importación, partidas, audio ni offline todavía.
