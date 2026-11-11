# ADR-020 — Aislamiento de origen cruzado (COOP/COEP) en toda la PWA

Estado: **aceptado**. Fecha: 2026-11-11. Decisión del titular: adoptarlo para poder integrar PlayStation 2.

## Contexto

Play!, el núcleo de PlayStation 2 ([expediente](../research/PLAY_CORE_GATE.md)), corre su máquina virtual en un pthread de Emscripten. En el navegador, los pthreads necesitan `SharedArrayBuffer`, y este solo existe en documentos con **aislamiento de origen cruzado** (`self.crossOriginIsolated === true`). Para tenerlo, el documento debe llevar estas cabeceras:

- `Cross-Origin-Opener-Policy: same-origin` (COOP);
- `Cross-Origin-Embedder-Policy: require-corp` (COEP).

Además, cada worker que cree debe llevar también COEP, o el navegador lo bloquea. El gate de Play! lo dejó como condición: «ADR para COOP/COEP: evaluar el impacto de añadir las cabeceras en toda la PWA».

Estado de partida, comprobado en el repositorio:
- **Todo es del mismo origen.** `index.html` no carga CDN, fuentes ni imágenes externas; los núcleos, los logos y el arte se sirven desde la propia build; no hay `iframe` ni `window.open`. Los workers (`emulator.worker.ts` y el worklet de audio) son del mismo origen.
- ADR-001 ya exigía un hosting que permita enviar COOP/COEP; el despliegue público sigue aplazado y Cartivo se usa con `pnpm preview` o un servidor propio.
- El service worker (`tools/pwa-plugin.mjs`) sirve la app desde su caché, guardando cada respuesta con las cabeceras con que llegó, y en cada actualización **reutiliza** las copias de los archivos sin cambios.

## Decisión

1. **Aislamiento para toda la app**, no solo para PS2:
   - `COOP: same-origin` y `COEP: require-corp` en todos los documentos y workers;
   - las dos cabeceras se definen una sola vez, en `ISOLATION_HEADERS` (`tools/pwa-plugin.mjs`).
2. **Servidores de Vite:** `server.headers` y `preview.headers` las envían (`apps/web/vite.config.ts`). Así toda la matriz E2E de la CI (Chromium, Firefox y WebKit, en dev y preview, también en subruta) corre aislada, y es la prueba de regresión de todos los núcleos.
3. **Service worker:** añade las cabeceras a **todo** lo que sirve, navegación incluida, desde la caché o desde la red.
   - Sin esto, tras actualizar desde una versión anterior, una copia reutilizada de un worker sin COEP llegaría a una página aislada y el navegador la bloquearía.
   - Efecto secundario útil: con el SW ya instalado, la app queda aislada aunque el servidor no envíe las cabeceras.
4. **`require-corp`, no `credentialless`:** WebKit/Safari no implementa `credentialless`, y como todo es del mismo origen, `require-corp` no bloquea nada.
5. **Hosting de producción:** debe enviar las dos cabeceras en todas las respuestas, por ejemplo con `_headers` en Cloudflare Pages o Netlify, o `add_header` en nginx. Se concretará con el despliegue público.

## Alternativas descartadas

- **Aislar solo una página de PS2** (otro documento con cabeceras propias): rompe el flujo de una sola pantalla «elige consola, abre tu juego y juega», duplica el arranque y la sesión, y además el cambio de grupo de contexto al navegar pierde el estado de la app.
- **Activar el aislamiento solo al elegir PS2:** las cabeceras van en la respuesta del documento, así que no se pueden activar después de cargar la página sin recargarla.
- **Recargar la página con un SW «coi»** (patrón `coi-serviceworker`) para hosts sin cabeceras: añade una recarga automática en la primera visita, que choca con «una actualización no recarga partidas activas». Aquí el SW añade las cabeceras sin recargar; en un host que no las envía, la primera visita queda sin aislar hasta la siguiente carga, y PS2 deberá decirlo.
- **Compilar Play! sin pthreads:** su VM depende de un hilo propio y el GS sincroniza con él; reescribirlo sale del alcance de un núcleo de terceros.
- **No integrar PS2:** contrario al objetivo del producto (consolas hasta PS2).

## Consecuencias

- **Recursos de otro origen.** Cualquiera que se añada en el futuro necesitará `Cross-Origin-Resource-Policy` o CORS (`crossorigin`), o el navegador lo bloqueará. Afecta, por ejemplo, a imágenes o insignias de un servicio de logros. Las peticiones `fetch` con CORS siguen funcionando.
- **Ventanas emergentes.** COOP `same-origin` corta la relación con ventanas de otros orígenes, lo que afecta a flujos OAuth con popup. Si algún día hace falta, el ADR de esa función decidirá (`same-origin-allow-popups` no da aislamiento).
- **SharedArrayBuffer y reloj.** `SharedArrayBuffer` queda disponible para todos los núcleos. No se afirma que ninguno lo use salvo Play!; por ejemplo, el RDP con hilos de N64 sigue sin probar. `performance.now()` gana resolución.
- **Service worker.** Cambia su contenido, así que llega como una actualización normal: espera a que no haya partida activa y nunca borra partidas (AGENTS.md).
- **Despliegue.** Un hosting sin cabeceras configurables (GitHub Pages) solo da aislamiento desde la segunda carga, gracias al SW. Queda registrado para el despliegue público.

## Evidencia

- **Unitarias** (`tests/pwa.test.ts`): el SW sirve con COOP/COEP la navegación, un archivo en caché guardado sin cabeceras y uno que no estaba en caché, y conserva el resto de cabeceras y el cuerpo.
- **E2E** (`tests/e2e/pwa.spec.ts`): `crossOriginIsolated` es verdadero al cargar, en dev y en preview, y al reabrir sin red servida por el SW; el resto de la suite cubre todos los núcleos con la app aislada.
- **CI:** pendiente del run de la Foundation CI sobre este cambio.
