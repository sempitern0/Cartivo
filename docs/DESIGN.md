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

**Sin arte de terceros:** nada de logotipos, tipografías de marca, fotos de consolas, personajes ni capturas de juegos. Cada consola se identifica con su nombre en la tipografía de Cartivo y una insignia propia (`ConsoleIcon.svelte`): el marco de la marca, con borde turquesa a coral, brillo diagonal y sello «C», alrededor de una silueta genérica de hardware dibujada para Cartivo (cartucho, portátil, mando o disco), nunca el logotipo de la consola. Iconos propios en `apps/web/src/icons.ts`, decorativos (`aria-hidden`); el nombre accesible lo lleva el control.

## Principios

- **Una acción principal por pantalla.** Lo técnico (núcleo, diagnóstico, laboratorio) vive plegado en opciones avanzadas.
- **Automático primero, corrección manual accesible.** Mando y teclado se detectan; pantalla con valores fieles al original.
- **Accesible:** contraste AA, objetivos de 44 px, anillo de foco discreto (2 px, blanco cálido translúcido) y nunca sobre la imagen del juego, estados con texto además de color, `prefers-reduced-motion`.
- **Movimiento sobrio:** un único momento orquestado por pantalla (las tarjetas de consola entran escalonadas solo la primera vez que se ve el inicio en la visita, igual que las fichas de perfil), entradas de vista breves y respuestas a lo que hace el usuario: elevación al pasar o enfocar, leve hundimiento al pulsar y realce al arrastrar un archivo. Todo se apaga con `prefers-reduced-motion` (regla global en `theme.css`).

## Pantallas

### ¿Quién juega? (perfiles, ADR-016)
Aparece en cada visita, antes del inicio, y empieza enfocado en quien jugó por última vez: Enter o A juegan al momento. Las fichas de perfil van centradas, cada una con un avatar de iniciales sobre un color de la paleta y el nombre debajo; al enfocarla o pasar el ratón, la ficha se eleva y el avatar se rodea de su color (sin movimiento si el sistema pide reducirlo). La última ficha es **Añadir perfil**, con un avatar discontinuo y «+». **Gestionar perfiles** atenúa los avatares y muestra en cada ficha editar (lápiz) y borrar (papelera; el primer perfil no se borra). Crear, editar (nombre y color con muestras accesibles) y confirmar el borrado ocurren dentro de la propia ficha, y Escape o B los cierran. Sin contraseña. Ajustes y Tus juegos no se ofrecen hasta elegir. En la cabecera, el chip del perfil (avatar redondo y nombre) vuelve a este selector cuando no hay partida.

**Foco al jugar:** mientras hay un juego abierto, el mando solo recorre los controles del reproductor. Al salir, el foco vuelve al control que lo inició (Jugar o Continuar), y no al principio de la página.

### Inicio · «Elige una consola»
El logo de la cabecera lleva siempre al inicio. Rejilla de tarjetas de igual altura (cuatro por fila en escritorio, una en móvil) que crece con cada sistema aceptado; hoy, NES, Game Boy, Game Boy Color, Game Boy Advance, SNES, Master System, Mega Drive y PlayStation. Solo aparecen consolas jugables (sin tarjetas «próximamente»). El título «Elige una consola» es solo para lectores de pantalla y como destino del foco: el titular pidió no mostrarlo, porque las tarjetas se explican solas. El acento de cada tarjeta dice qué soporte usa la consola (coral para cartuchos de sobremesa, oro para portátiles y violeta para discos, según `handheld` y `disc` de `systems.ts`) y colorea su realce, el botón de reproducción y el aviso al soltar. Las etiquetas sobre los títulos van en minúsculas normales, sin espaciado ni mayúsculas, y solo cuando informan. Cada tarjeta es una sola acción: un clic en cualquier punto abre las extensiones de esa consola, y con teclado o mando el destino es su botón redondo de reproducción («Jugar» para lectores de pantalla). Arriba va la insignia; al pie, todos los formatos como chips (pasan a otra línea si no caben). Los controles son globales: se llega por **Ajustes** en la cabecera, no desde cada tarjeta. Al pasar el ratón o enfocar, la tarjeta se eleva, la insignia gira y solo se ilumina el botón de reproducción, sin texto que tape el contenido. Al arrastrar un archivo, todas las tarjetas se marcan con un borde discontinuo y la que queda bajo el puntero muestra «Suelta para jugar» y lo abre con esa consola; soltarlo fuera de las tarjetas elige la consola por la extensión. No hay botón «Probar demo»: las ROM de prueba originales solo se abren con la entrada oculta `#demo/<consola>`, para pruebas y diagnóstico. Un archivo abierto desde el sistema durante una partida queda en espera como «Jugar {archivo}». El aviso «Actualizar ahora» aparece aquí, nunca durante una partida. Si el navegador guarda menos (ventana privada sin OPFS, o sin Web Locks/IndexedDB), una línea discreta en dorado bajo el título lo explica; nunca un modal que impida jugar.

Con juegos recordados (ADR-012), encima de la rejilla hay una sola franja compacta. **Continuar** (miniatura de «Al salir», nombre, consola y fecha, con el borde, el degradado y el botón relleno en el acento de su consola) ocupa la parte principal y es lo de mayor contraste del inicio. A su lado, los dos siguientes como filas con miniatura y un botón redondo de continuar. La franja termina en **Ver todos tus juegos**: una estantería de tres cartuchos con el número de juegos en la etiqueta del frontal, que se abren en abanico al pasar el ratón o enfocar. En la cabecera, **Tus juegos** junto a Ajustes. En pantallas estrechas la franja se apila.

### Tus juegos (`#juegos`)
Página propia con volver al inicio. Búsqueda por nombre, chips de consola (solo las que tienen juegos, si hay más de una) y orden **Recientes** o **Nombre**. Rejilla de tarjetas con miniatura, nombre, consola, fecha y tamaño, **Jugar**, **Continuar** o **Cargar partida** según los guardados compatibles del perfil (ADR-018). **Opciones** separa tres alcances:
- **Ocultar para mí:** solo lo quita de la lista de este perfil, sin confirmación. Se recupera desde **Ocultos para ti**, al pie, o al abrir otra vez el archivo.
- **Borrar mi progreso:** las Partidas y la batería de este perfil. Pide confirmación y respeta el candado del juego abierto en otra pestaña.
- **Eliminar del dispositivo:** para todos los perfiles, liberando su copia. Pide confirmación, en rojo; las partidas se conservan.

Las confirmaciones aparecen en la propia tarjeta, con el foco en la acción, y Cancelar lo devuelve a **Opciones**. Los discos de PlayStation también se recuerdan: se copian mientras se juega, con aviso de tamaño. Búsqueda y orden se conservan al volver de jugar. Al pie, el espacio ocupado, el interruptor «Recordar juegos nuevos en este dispositivo» (activado por defecto) y la nota de privacidad. Con un juego abierto no se ofrece.

### Ajustes (`#controles`)
Seis categorías estables, con accesos arriba que llevan el foco a cada una. El título «Ajustes» recibe el foco al entrar.
- **Pantalla:** se elige una consola y se ven las mismas opciones que en «Ajustes del juego» (`DisplayOptions.svelte`).
- **Sonido:** volumen y silencio para todos los juegos, recordados en el dispositivo.
- **Controles:** la tarjeta descrita abajo.
- **Interfaz:** modo automático, teclado y ratón, o mando.
- **Almacenamiento:** lo que usa Cartivo y el acceso a «Tus juegos».
- **Avanzado:** el núcleo de cada consola que tiene más de uno, y dónde ver el rendimiento.
La barra **Activar prueba** y la zona de prueba van justo encima de los dibujos del teclado y del mando, para ver qué se ilumina sin desplazarse.
Tarjeta de teclado y tarjeta de mando genérico (dibujos propios) que se iluminan durante la prueba. Chips para reasignar los botones que usa alguna consola disponible (A, B, X, Y, Start, Select, L y R), con notas generadas sobre qué consolas usan cada uno («X e Y solo los usan SNES y Mega Drive») y, si una consola llama distinto a sus botones, dónde están («En Mega Drive, A, B, C… están en Y, B, A…»). La ayuda de pausa de cada demo usa esas etiquetas; el mando dibuja los cuatro botones frontales en rombo; **Mover** despliega **Avanzado** con las direcciones. Selector de mando, asignación manual y zona muerta en la tarjeta del mando. Salir desmonta el sondeo; al volver no queda ninguna tecla pulsada. Abrirla durante una partida pausa y neutraliza la entrada.

### Reproductor
- Barra superior: **Gráficos**, **Partidas**, **Cargar ROM** (cierre seguro con guardado y nueva ROM) y **Salir**.
- Vídeo 4:3 en un marco con brillo azul y pie de estado «Mando conectado / Sin mando · Teclado conectado».
- **La pausa tiene las mismas acciones y en el mismo orden con teclado, ratón o mando:** Reanudar juego · Guardar ahora (ranura 1, como F5) · Partidas · Ajustes del juego · Guardar y salir.
  - Con teclado y ratón, las dos primeras van en las acciones bajo el vídeo, junto a Reiniciar consola, sonido, Focus y pantalla completa. Las otras tres están en la barra superior, en ese orden.
  - «Guardar y salir» confirma el guardado antes de cerrar. Si falla, la sesión sigue abierta. Pasa a «Salir» solo cuando el navegador no puede guardar.
- **Focus** (F) oculta la página dentro de la ventana mientras se juega; en pausa vuelve la interfaz y un botón flotante permite salir. **Pantalla completa** es otro modo: solo el juego, sin barra ni acciones ni siquiera en pausa; al pausar aparece una capa mínima con **Reanudar juego** y **Salir de pantalla completa**, y Escape sale y pausa. Durante el juego se capturan las teclas y la rueda; Escape pausa y devuelve el foco a Reanudar. Los atajos del navegador con Ctrl/Meta/Alt no se bloquean.
- Errores en un aviso por encima del vídeo, llevado a la vista.
- «Copias de partida» (exportar/importar la memoria de batería) y «Acerca de esta prueba» (núcleo TetaNES/JSNES y licencias) plegados, solo en pausa o error.
- Al reabrir un juego con partida «Al salir», un aviso sobre el vídeo ofrece **Continuar** o **Empezar de nuevo**, con miniatura y fecha.

### Panel Partidas
Mismo estilo que Ajustes del juego (pausa al abrir). Tarjeta «Al salir» (automática) y tres ranuras con miniatura, fecha y núcleo; **Guardar aquí**, **Cargar** (pide confirmar porque sustituye el progreso no guardado), **Exportar** (descarga un archivo de esa ranura) y **Borrar**. Al pie, **Importar partida…** devuelve un archivo a su ranura de origen; si está ocupada, pide **Sustituir** o **Cancelar** en línea. F5 guarda en la ranura 1 y F9 la carga, con confirmación breve bajo el vídeo. Si el juego tiene batería, se aclara que su partida interna se guarda aparte.

### Panel Ajustes del juego
Panel propio (pausa la partida al abrirse). Tarjetas con diagrama para **Escalado** (Ajustar, Píxel entero, «4:3 entero» según la proporción del sistema) y **Proporción** («4:3 original», Píxeles cuadrados con la resolución del sistema), interruptor **Suavizado** (desactivado por defecto) y **Restablecer**. Los cambios se ven al momento y se recuerdan por sistema (`cartivo:display:nes:v1`). Si el escalado no cabe, se avisa y se usa Ajustar. Escape o **Listo** cierran y devuelven el foco a **Ajustes del juego**. Incluye un enlace a Controles.

## Comportamiento

- **Audio:** el arranque nunca espera a que el navegador desbloquee el audio; si no puede activarse solo, aparece **Activar sonido**.
- **Teclas por defecto:** WASD/flechas, L = A, K = B, Q = Select, Enter = Start; F reservado a Focus. Los perfiles antiguos se migran sin pisar reasignaciones deliberadas.
- **Mando en la interfaz:** la cruceta o el stick llevan el foco al control más cercano en esa dirección (sin dar la vuelta), A lo pulsa y B equivale a Escape: cierra Partidas o Ajustes del juego y, si no hay nada que cerrar, vuelve (de Controles al inicio). En deslizadores y selectores, izquierda y derecha cambian el valor. El foco se ve con el mismo anillo que con teclado; el ratón lo oculta. **Select+Start** a la vez pausa la partida (la pausa enfoca **Reanudar juego**) y sale de la prueba de Controles. Mientras el juego corre o la prueba está activa, el mando es suyo y no mueve la interfaz. Solo mandos con distribución estándar.
- **Modo consola** (interfaz de mando): en **Ajustes → Interfaz** se elige **Automática** (por defecto: cambia sola al usar el mando y vuelve con el ratón o el teclado), **Teclado y ratón** o **Mando**. Solo cambia la presentación:
  - leyenda fija abajo «A Aceptar · B Volver · Select + Start Pausa», oculta mientras se juega;
  - las consolas conservan su rejilla, sin saltos al alternar mando y ratón;
  - la pausa es un **menú vertical modal** sobre el juego: Reanudar juego, Guardar ahora, Partidas, Ajustes del juego, Controles, Reiniciar consola y Guardar y salir. El foco empieza en Reanudar; B o Escape reanudan, y al cerrar Partidas o Ajustes del juego se vuelve al menú.
  - El selector de archivos del sistema no se maneja con mando: con mando se juega desde los recientes y «Tus juegos».
- **Instalación:** **Instalar app** en la cabecera cuando el navegador ofrece el prompt; en iOS se instala desde Compartir.

## Pendiente

Controles táctiles en móvil e inglés. Los perfiles de pantalla por sistema ya están implementados.
