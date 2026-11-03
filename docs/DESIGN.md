# Diseño y UX de Cartivo

## Identidad

Paleta propia evocadora de la época PSX, sin su logo, formas de marca ni valores exactos. Tokens en `apps/web/src/theme.css`.

| Token | Color | Uso |
|---|---|---|
| Coral | `#ED5871` | Acento; error siempre acompañado de texto |
| Azul | `#619DE5` | Acción principal, enlaces, brillo de selección |
| Turquesa | `#40C2AE` | Acento secundario, estados activos |
| Dorado | `#E9C45E` | Acento (capturas de tecla, paleta) |
| Fondo | `#111218` | Base, con degradado azul tenue arriba |
| Superficie | `#1B1D26` | Tarjetas y paneles |
| Texto / Secundario | `#F3F1ED` / `#B3B5C2` | Lectura / explicaciones |

**Sin arte de terceros:** nada de logotipos, tipografías de marca, fotos de consolas, personajes ni capturas de juegos. Cada consola se identifica con su nombre en la tipografía de Cartivo y arte abstracto original (campo de píxeles con la paleta). Iconos propios en `apps/web/src/icons.ts`, decorativos (`aria-hidden`); el nombre accesible lo lleva el control.

## Principios

- **Una acción principal por pantalla.** Lo técnico (núcleo, diagnóstico, laboratorio) vive plegado en opciones avanzadas.
- **Automático primero, corrección manual accesible.** Mando y teclado se detectan; pantalla con valores fieles al original.
- **Accesible:** contraste AA, objetivos de 44 px, anillo de foco discreto (2 px, blanco cálido translúcido) y nunca sobre la imagen del juego, estados con texto además de color, `prefers-reduced-motion`.
- **Movimiento sobrio:** solo transiciones breves de entrada de vista y respuestas a acciones del usuario.

## Pantallas

### Inicio · «Elige una consola»
El logo de la cabecera lleva siempre al inicio. Rejilla de tarjetas de igual altura (cuatro por fila en escritorio, una en móvil) que crece con cada sistema aceptado; hoy, NES, Game Boy, Game Boy Color, Game Boy Advance, SNES, Master System y Mega Drive. Solo aparecen consolas jugables (sin tarjetas «próximamente»). Acción **Jugar** (abre las extensiones de esa consola: `.nes`, `.gb`, `.gbc`, `.gba`, `.sfc`/`.smc`, `.sms`, `.md`/`.gen`/`.bin`), icono **Controles de {consola}**, **Probar demo** y arrastrar y soltar. Un archivo abierto desde el sistema durante una partida queda en espera como «Jugar {archivo}». El aviso «Actualizar ahora» aparece aquí, nunca durante una partida. Si el navegador guarda menos (ventana privada sin OPFS, o sin Web Locks/IndexedDB), una línea discreta en dorado bajo el título lo explica; nunca un modal que impida jugar.

Con juegos recordados (ADR-012), encima de la rejilla aparece la tarjeta **Continuar**: miniatura de «Al salir», nombre, consola y fecha; un clic carga el juego desde el dispositivo y sigue desde «Al salir» sin aviso. Debajo, **Tus juegos**: lista por fecha con **Jugar** y **Quitar** (confirmación en línea que recuerda que las partidas se conservan), el espacio ocupado y el interruptor «Recordar juegos nuevos en este dispositivo».

### Configurar controles (`#controles`, desde **Ajustes**)
La barra **Activar prueba** y la zona de prueba van justo encima de los dibujos del teclado y del mando, para ver qué se ilumina sin desplazarse.
Tarjeta de teclado y tarjeta de mando genérico (dibujos propios) que se iluminan durante la prueba. Chips para reasignar los botones que usa alguna consola disponible (A, B, X, Y, Start, Select, L y R), con notas generadas sobre qué consolas usan cada uno («X e Y solo los usan SNES y Mega Drive») y, si una consola llama distinto a sus botones, dónde están («En Mega Drive, A, B, C… están en Y, B, A…»). La ayuda de pausa de cada demo usa esas etiquetas; el mando dibuja los cuatro botones frontales en rombo; **Mover** despliega **Avanzado** con las direcciones. Selector de mando, asignación manual y zona muerta en la tarjeta del mando. Salir desmonta el sondeo; al volver no queda ninguna tecla pulsada. Abrirla durante una partida pausa y neutraliza la entrada.

### Reproductor
- Barra superior: **Gráficos**, **Partidas**, **Cargar ROM** (cierre seguro con guardado y nueva ROM) y **Salir**.
- Vídeo 4:3 en un marco con brillo azul; acciones compactas debajo (Pausar/Reanudar, Select, Start, sonido, Focus, pantalla completa, Reiniciar consola en pausa, que reinicia y vuelve a jugar) y pie de estado «Mando conectado / Sin mando · Teclado conectado».
- **Focus** (F) oculta la página dentro de la ventana mientras se juega; en pausa vuelve la interfaz y un botón flotante permite salir. **Pantalla completa** es otro modo: solo el juego, sin barra ni acciones ni siquiera en pausa; al pausar aparece una capa mínima con **Reanudar juego** y **Salir de pantalla completa**, y Escape sale y pausa. Durante el juego se capturan las teclas y la rueda; Escape pausa y devuelve el foco a Reanudar. Los atajos del navegador con Ctrl/Meta/Alt no se bloquean.
- Errores en un aviso por encima del vídeo, llevado a la vista.
- «Copias de partida» (exportar/importar la memoria de batería) y «Acerca de esta prueba» (núcleo TetaNES/JSNES y licencias) plegados, solo en pausa o error.
- Al reabrir un juego con partida «Al salir», un aviso sobre el vídeo ofrece **Continuar** o **Empezar de nuevo**, con miniatura y fecha.
- La primera vez que se abre un juego desde archivo, una línea discreta bajo la barra pregunta «¿Recordar tus juegos en este dispositivo para continuar con un clic?» con **Sí, recordar** y **No**. No pausa la partida y no vuelve a aparecer.

### Panel Partidas
Mismo estilo que Gráficos (pausa al abrir). Tarjeta «Al salir» (automática) y tres ranuras con miniatura, fecha y núcleo; **Guardar aquí**, **Cargar** (pide confirmar porque sustituye el progreso no guardado), **Exportar** (descarga un archivo de esa ranura) y **Borrar**. Al pie, **Importar partida…** devuelve un archivo a su ranura de origen; si está ocupada, pide **Sustituir** o **Cancelar** en línea. F5 guarda en la ranura 1 y F9 la carga, con confirmación breve bajo el vídeo. Si el juego tiene batería, se aclara que su partida interna se guarda aparte.

### Panel Gráficos
Panel propio (pausa la partida al abrirse). Tarjetas con diagrama para **Escalado** (Ajustar, Píxel entero, «4:3 entero» según la proporción del sistema) y **Proporción** («4:3 original», Píxeles cuadrados con la resolución del sistema), interruptor **Suavizado** (desactivado por defecto) y **Restablecer**. Los cambios se ven al momento y se recuerdan por sistema (`cartivo:display:nes:v1`). Si el escalado no cabe, se avisa y se usa Ajustar. Escape o **Listo** cierran y devuelven el foco a **Gráficos**.

## Comportamiento

- **Audio:** el arranque nunca espera a que el navegador desbloquee el audio; si no puede activarse solo, aparece **Activar sonido**.
- **Teclas por defecto:** WASD/flechas, L = A, K = B, Q = Select, Enter = Start; F reservado a Focus. Los perfiles antiguos se migran sin pisar reasignaciones deliberadas.
- **Instalación:** **Instalar app** en la cabecera cuando el navegador ofrece el prompt; en iOS se instala desde Compartir.

## Pendiente

Navegación completa con mando (cruceta mueve el foco, A acepta, B vuelve), controles táctiles en móvil, perfiles de pantalla por sistema (proporciones portátiles) e inglés.
