# QA visual — biblioteca compartida y navegación (PR #38)

Estado: pendiente de ejecución manual. No marcar como aprobado por tener el CI verde.

## Preparación

- Usar la rama `feat/shared-library-ux`, registrar su commit (`git rev-parse --short HEAD`) y ejecutar `pnpm install --frozen-lockfile`, `pnpm build` y `pnpm preview`.
- Abrir la URL que indique preview. Para probar instalación y almacenamiento en otro dispositivo, servir el build mediante HTTPS; localhost solo es seguro en el propio dispositivo.
- Probar Firefox y Chrome/Edge en escritorio; Safari/iOS o Chrome/Android en un móvil real. Anotar navegador, versión, dispositivo, resolución y modo navegador/PWA.
- Para el recorrido limpio, usar un perfil de navegador de prueba. Para comprobar la actualización, conservar otro perfil con datos previos y exportar sus partidas antes de empezar. No borrar datos del navegador entre pruebas de persistencia.
- Preparar dos perfiles Cartivo (Ana y Luis), una ROM propia por consola de prueba y títulos largos. Las demos originales se abren con `#demo/nes` o `#demo/gb`; sirven para el reproductor, pero no se incorporan al catálogo.

## Recorrido (25–35 minutos)

| Hecho | Paso | Resultado esperado |
| --- | --- | --- |
| [ ] | 1. Abrir Cartivo, crear/editar un perfil y elegirlo con teclado. | Campos y botones legibles; foco visible; sin saltos ni controles tapados. El selector recuerda el perfil durante la pestaña. |
| [ ] | 2. Revisar inicio a 1440×900, 768×1024 y 360×800; repetir con zoom 200 %. | Título visible, tarjetas alineadas, formatos y nombres sin solaparse. Sin scroll horizontal. Tus juegos y Ajustes siguen accesibles. |
| [ ] | 3. Abrir Tus juegos sin ROMs. Volver, elegir consola y cancelar el selector de archivos. | Estado vacío claro y enlace para elegir consola; cancelar no abre una partida ni deja un cargador bloqueado. |
| [ ] | 4. Cargar una ROM propia, jugar, salir y pulsar Continuar. | Una sola sesión. Se recupera el punto guardado; miniatura y fecha del perfil correcto. Al salir, el foco vuelve al botón de lanzamiento. |
| [ ] | 5. Cambiar de Ana a Luis y abrir Tus juegos. Jugar y guardar con Luis; volver a Ana. | Mismos títulos disponibles; Luis empieza sin recientes ni miniaturas de Ana. Cada perfil recupera su propio progreso. |
| [ ] | 6. Añadir varios títulos y dos sistemas. Buscar, filtrar y ordenar; jugar y volver. | Búsqueda y orden conservados. Nombres largos legibles. Si se quita el último título del sistema filtrado, los juegos restantes vuelven a verse. |
| [ ] | 7. Abrir «⋯» (Opciones) en una tarjeta: Ocultar para mí (y Mostrar desde «Ocultos para ti»), Borrar mi progreso y Eliminar del dispositivo, cancelando y confirmando con Tab/Enter, hasta eliminar el último título. | Ocultar solo afecta a este perfil. Borrar progreso deja «Jugar». Eliminar dice que afecta a todos los perfiles y conserva partidas. Las opciones cubren la tarjeta sin alargarla; Escape o B las cierran con el foco en «⋯»; tras eliminar el último, el foco sigue en la biblioteca y se ve el estado vacío. |
| [ ] | 8. Recargar y volver a abrir el archivo quitado. Borrar un perfil secundario desde Gestionar perfiles. | Los títulos quitados no reaparecen solos. Reabrir el archivo recupera sus partidas. Borrar un perfil conserva los títulos compartidos y el progreso de los demás. |
| [ ] | 9. Entrar en Ajustes y usar Interfaz/Controles; reasignar una tecla y volver con Atrás. | El título Ajustes recibe el foco al entrar. Las pestañas se recorren con flechas y con mando, y recargar conserva la pestaña. No quedan teclas pulsadas al salir de la prueba. |
| [ ] | 10. Conectar un mando real, alternar mando/ratón y recorrer inicio, biblioteca y pausa. | La rejilla no cambia de forma. Cruceta/stick navegan, A activa y B vuelve. Select+Start pausa; el mando no mueve la UI durante el juego. El selector nativo de archivos requiere ratón/teclado. |
| [ ] | 11. Abrir Partidas y Gráficos, guardar/cargar una ranura, usar Focus y pantalla completa. | Paneles sin desbordes, texto y foco visibles, cambios gráficos sin reiniciar. Cerrar un panel devuelve el foco al control correspondiente. Audio y mandos se mantienen. |
| [ ] | 12. Activar movimiento reducido en el sistema; repetir inicio, perfiles y biblioteca. | Sin entradas escalonadas ni movimientos de las tarjetas. Todas las acciones siguen disponibles sin depender de hover, animación o color. |
| [ ] | 13. Instalar/abrir PWA, esperar la caché completa, desconectar la red y reanudar un juego recordado. | Shell, juego y guardado disponibles offline. Un disco recordado se abre desde su copia, sin pedir los archivos. |
| [ ] | 14. En móvil real, jugar, cambiar de app, volver y recargar. Repetir en modo privado. | Al volver no hay entrada atascada. La recuperación corresponde al último guardado confirmado; no se promete sobrevivir al cierre forzado del sistema. En privado/restricciones, el aviso explica qué no se conserva. |
| [ ] | 15. Abrir un disco de PlayStation propio (`.cue` y pistas a la vez) y jugar mientras se copia. | Aviso «Guardando el disco… (N MB)» y después «Disco guardado». Sin tirones apreciables; si no hay sitio, el mensaje dice cuánto ocupa y cuánto queda. Otro perfil lo abre desde «Tus juegos» sin pedir archivos. |
| [ ] | 16. Pausar con teclado y con mando; recorrer las pestañas de Ajustes. | Las mismas acciones en el mismo orden: Reanudar juego, Guardar ahora, Partidas, Ajustes del juego, Guardar y salir. Pantalla, Sonido y Avanzado guardan sus cambios tras recargar. |
| [ ] | 17. En Pantalla (y en «Ajustes del juego»), probar Píxel entero, la proporción y Suavizado; cambiar el tamaño de la ventana. | «Predeterminado» y «Tu elección» muestran la diferencia: bordes, proporción y, en el zum, píxeles nítidos, desiguales o suavizados. El texto indica el factor (×3, ×2,5) y la caída a Ajustar cuando no cabe. Pasar el ratón por un perfil mantiene el avatar centrado. |

## Actualización y errores

- [ ] En el perfil con datos antiguos, abrir la nueva versión: títulos visibles, partidas cargables, capturas personales y ausencia de duplicados.
- [ ] Mantener una pestaña antigua abierta durante la actualización: si bloquea la base, el aviso pide cerrarla y Reintentar permite recuperar la biblioteca.
- [ ] Probar un archivo inválido: error legible, sin modal atrapado; se puede salir y abrir otro.
- [ ] Guardados de otra versión: no presentar Continuar como compatible; conservar el archivo para exportarlo o revisarlo.
- [ ] Si ocurre un fallo real de guardado al salir, la sesión debe permanecer abierta con un mensaje y permitir reintentar. Descartar debe ser una acción explícita. El CI cubre este fallo mediante inyección; no hace falta llenar el disco para el QA visual.

## Registro y aceptación

Por incidencia: commit, dispositivo/navegador, paso, resultado esperado/real, captura y forma de reproducir. Capturar inicio, biblioteca, ajustes y pausa en escritorio y móvil, sin archivos privados en la imagen.

Bloquean la entrega: pérdida o cruce de partidas entre perfiles, salida silenciosa tras fallar un guardado, controles inaccesibles, foco perdido, desbordes que impidan actuar o acciones que solo funcionen con ratón. Diferencias de instalación, audio y mando deben registrarse por dispositivo, no generalizarse desde headless.
