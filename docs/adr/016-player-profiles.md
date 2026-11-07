# ADR-016 — Perfiles de jugador locales

> Revisión: [ADR-017](017-shared-library-ux.md) sustituye el ámbito del catálogo y documenta la migración. Las partidas y los recientes siguen separados por perfil.
Estado: aceptado. Fecha: 2026-11-06.

## Contexto

Varias personas comparten la misma PWA en un dispositivo y necesitan separar sus partidas y, en el futuro, sus logros. El titular decidió lo siguiente:
- son propios de cada perfil: **partidas, juegos recientes y biblioteca, y controles**;
- los perfiles van **sin protección** (en un mismo navegador, un PIN no sería seguridad real);
- el selector aparece **siempre al abrir** Cartivo.

Las cuentas online siguen siendo el hito H6, posterior a V1, con su propio ADR.

## Decisión

- **Modelo:** `packages/storage/src/profiles.ts`.
  - Lista en `localStorage` (`cartivo:profiles:v1`) con id (`[a-z0-9]{1,16}`), nombre (1–24 caracteres) y color de la paleta propia. Se valida al leer.
  - Hay un máximo de 8 perfiles y siempre existe el primero, `principal` («Jugador 1» por defecto).
- **Ámbito por nombre, sin migración:**
  - `scoped(nombre, perfil)` devuelve el nombre original para el primer perfil y `nombre@<id>` para los demás.
  - Se aplica a las bases de datos `cartivo-saves` (batería y tarjeta), `cartivo-states` (Partidas) y `cartivo-library` (biblioteca), a sus Web Locks y a las preferencias de controles (teclado y asignaciones de mando).
  - Todo lo guardado antes de los perfiles pertenece al primero sin mover un byte: actualizar no puede perder partidas.
  - El mismo juego puede abrirse en dos perfiles a la vez (escritores distintos); dentro de un perfil sigue habiendo un único escritor.
- **Copias de ROM compartidas:** OPFS (`roms/<sha256>`) es común a todos los perfiles para no duplicar espacio.
  - Quitar un juego de un perfil borra la copia solo si ningún otro perfil lo recuerda (`forgetGame`).
  - La poda de huérfanas usa la unión de todas las bibliotecas (`rememberedBy`).
- **Protocolo:** `load` lleva `profile` (validado; si falta, el primer perfil). El Worker abre las tiendas de ese perfil durante toda la sesión.
- **Interfaz:**
  - «¿Quién juega?» (`ProfilePicker.svelte`) aparece en cada visita, antes del inicio, con una acción principal: elegir. Empieza enfocado en quien jugó por última vez (`lastUsedAt`), así que Enter o A juegan al momento.
  - Cada perfil es una ficha con su avatar (iniciales sobre un color de la paleta) y su nombre. La última ficha es «Añadir perfil»; «Gestionar perfiles» muestra en cada ficha editar (nombre y color) y borrar. Los formularios y la confirmación ocurren dentro de la ficha, y Escape o B los cierran. El primero no se borra.
  - La elección dura la pestaña (`sessionStorage`), así que recargar o actualizar no vuelve a preguntar.
  - En la cabecera, el chip del perfil permite cambiar de perfil cuando no hay partida en curso.
  - Un archivo abierto antes de elegir perfil espera en su tarjeta.
  - En Controles, el «perfil» del mando pasa a llamarse «asignación guardada» para no confundirlo con el del jugador.
- **Borrar un perfil** elimina sus tres bases de datos y sus preferencias (`…@<id>`). Si otra pestaña aún tiene abierta una base de datos, el navegador la borra al cerrarla. Sus copias de ROM quedan huérfanas y se podan después.
- **Común al dispositivo:** pantalla (escalado y suavizado), modo de interfaz, núcleo elegido por sistema y el interruptor «Recordar juegos nuevos».

## Alternativas descartadas

- **Migrar los datos existentes a un espacio de nombres nuevo:** arriesga partidas sin ningún beneficio.
- **Un campo `profile` dentro de cada registro:** obliga a migrar los esquemas, y borrar un perfil exigiría recorrer cada almacén.
- **PIN:** en el mismo navegador no protege nada y añade fricción.
- **Copias de ROM por perfil:** duplican cientos de MB.

## Consecuencias

- Los logros (H6) y una futura cuenta se vincularán a un perfil local.
- La exportación de partidas sigue siendo por juego y perfil. No existe exportar ni importar un perfil completo.
- Las E2E empiezan con el primer perfil elegido (`tests/e2e/fixtures.ts`), salvo `profiles.spec.ts` (`profile: ""`).
- **QA manual pendiente:** el selector con mando físico y el cambio de perfil en móvil.
