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

## Foco de juego y pantalla completa

Durante la ejecución, el reproductor captura las teclas de la página (incluidos Tab/espacio/flechas), mantiene el foco en el canvas y bloquea scroll por rueda. Escape pausa, neutraliza entradas y devuelve el foco a Reanudar; libera la navegación normal. Los atajos con Ctrl/Meta/Alt del navegador/SO y la pérdida de ventana no se bloquean: perder ventana/visibilidad sigue pausando. Las acciones explícitas del reproductor permanecen disponibles con ratón; el fondo de la página no captura clics de juego.

Pantalla completa incluye reproductor, acciones y avisos; salir pausa. Se detecta Fullscreen API y los rechazos se muestran junto al vídeo. El canvas conserva 4:3. Información técnica/copias queda en desplegables, estado/acciones encima del vídeo y errores en un aviso superior que se desplaza a la vista al aparecer.

Probar: jugar y pulsar Tab/Shift+Tab/espacio/flechas, girar rueda; no debe moverse el foco ni la página. Escape debe pausar y enfocar Reanudar. Entrar/salir de pantalla completa; comprobar relación 4:3 y acciones visibles. Cargar archivo inválido: el error debe aparecer antes del vídeo. La prueba automatizada de fullscreen es Chromium; otros navegadores y dispositivos físicos siguen pendientes.

## Selector central y arranque directo (31-10-2026)

El flujo visible comienza en el escenario central NES con **Añadir juego** y un enlace secundario **Probar demo**. Al seleccionar un archivo `.nes` o elegir la demo original, `App.svelte` monta `Player.svelte` con `autostart`, sin paso adicional «Jugar». La ejecución comienza en el mismo espacio visual; un archivo inválido deja visible el error y ofrece volver sin conservar una sesión rota. Se mantiene una sola sesión y los guardados SRAM existentes.

La cabecera conserva únicamente el logotipo Cartivo y **Ajustes**; el footer desaparece. Laboratorio de sesión y asignación de controles están bajo Ajustes, no en el recorrido de juego. Mensajes operativos y errores críticos usan regiones accesibles; información sobre el núcleo y detalles avanzados permanecen plegados o solo para lector de pantalla cuando no aportan valor visual.

Controles por defecto: WASD/flechas, **L = A** y **K = B**. Los perfiles locales anteriormente predeterminados X/Z se migran respectivamente a L/K sin reemplazar remapeos deliberados; el usuario siempre puede restaurar o cambiar la asignación. `F` permanece reservado a Focus. La migración no identifica dispositivos por índices persistentes.

**Audio web:** el lanzamiento automático nunca espera a que un navegador desbloquee AudioContext. Si no se puede activar automáticamente, se ofrece **Activar sonido** como acción voluntaria, sin impedir juego ni SRAM.

Este cambio es de UX e input; **no** demuestra por sí mismo soporte adicional de ROMs, sistemas o firmware. Las transiciones no desmontarán/reiniciarán el núcleo al cambiar Focus, pantalla completa o Ajustes. Respetar `prefers-reduced-motion` en animaciones futuras.
