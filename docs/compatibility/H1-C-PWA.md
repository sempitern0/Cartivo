# H1-C — PWA instalable y offline

Fecha: 2026-11-01. **Experimental.** Shell instalable con manifiesto, service worker propio y reapertura sin conexión de la build de producción. No cambia los núcleos (TetaNES por defecto, ADR-008; JSNES alternativo, ADR-007).

## Qué incluye

| Criterio | Implementación | Evidencia automática |
|---|---|---|
| Manifiesto instalable | `apps/web/public/manifest.webmanifest`: nombre, `standalone`, `start_url`/`scope`, colores del tema, iconos 192/512, maskable y SVG originales | E2E `pwa.spec.ts` (dev y preview): manifiesto válido e iconos servidos |
| Abrir con Cartivo | `file_handlers` para `.nes` y `launchQueue` en `App.svelte` (Chromium de escritorio con la app instalada) | Sin E2E: requiere app instalada en un SO real |
| Arrastrar y soltar | Soltar un `.nes` en la ventana inicia el juego; nunca navega fuera de la app | E2E: drop arranca la partida y la URL no cambia |
| Offline | `tools/pwa-plugin.mjs` genera `sw.js` en el build con todos los archivos del bundle (shell, Worker, AudioWorklet, licencias, iconos) y su hash de versión | Unit `pwa.test.ts`; E2E preview: SW controla la página, recarga sin red y la demo ejecuta frames |
| Actualización protegida | La versión nueva espera (sin `skipWaiting` en install). El aviso «Actualizar ahora» solo aparece en la pantalla inicial, sin juego activo; solo entonces se activa y recarga | Unit: `skipWaiting` solo tras el mensaje explícito |
| Saves intactos | El SW solo borra cachés `cartivo-shell-*`; no toca IndexedDB | Unit: sin acceso a `indexedDB` en el SW |
| Persistencia | `navigator.storage.persist()` solo con la app instalada (evita prompts en pestaña) | Sin E2E |
| Un juego activo | Un archivo abierto desde el SO o soltado durante una partida queda en espera («Jugar …») hasta cerrar la sesión actual | Revisión de código |

El service worker solo existe en la build de producción (`pnpm build` / `pnpm preview`); en `pnpm dev` no se registra.

## Medición de carga (etapa D de la PR #2)

Build de CI sobre `2ba0b33` (salida de `vite build`, tamaños sin comprimir / gzip):

| Recurso | Tamaño | Cuándo se descarga |
|---|---|---|
| `index.html` + `index-*.js` + `index-*.css` (shell) | 0,9 + 110,2 + 23,1 kB (≈45 kB gzip) | Al abrir la app |
| `emulator.worker-*.js` (protocolo, JSNES, glue TetaNES, almacenamiento) | 145,4 kB | Al empezar un juego (el Worker se crea en `Player`) |
| `tetanes_bg-*.wasm` | 1.132,9 kB (427,2 kB gzip) | Al preparar TetaNES dentro del Worker |
| AudioWorklet y Worker de diagnóstico | 0,7 + 1,3 kB | Al activar sonido / abrir el laboratorio |

El SW precachea todo (≈1,3 MB sin comprimir) para jugar offline tras la instalación.

**Decisión: posponer la carga diferida por núcleo.** La pantalla inicial ya no carga ningún núcleo: JSNES y TetaNES solo llegan con el Worker. Separar JSNES del Worker ahorraría unos 100 kB a quien use TetaNES, a cambio de más riesgo en la PR (precache por grupos, offline del núcleo alternativo). Pasa a ser necesario con el segundo sistema: entonces `registry.ts` debe cargar cada módulo con `import()` dinámico dentro del Worker y el SW debe separar el shell de los núcleos instalados, sin descargas silenciosas de núcleos no elegidos.

**Actualización H2-GB ([ADR-010](../adr/010-gb-sameboy.md)):** SameBoy ya se carga con `import()` dentro del Worker (Workers como módulos ES), así que quien juega a NES no descarga su adaptador ni compila su WASM. El SW sigue precacheando todo: son unos 190 KB más, y así cualquier consola funciona sin conexión tras instalar. Separar el precache por núcleo queda pendiente hasta que un núcleo pese lo suficiente para justificarlo. Con mGBA (H2-GBA, ~575 KB, también diferido), el total precacheado de núcleos ronda 1,9 MB sin comprimir.

**Decisión del titular (2026-11-02): instalar todo.** La app instalada trae todos los núcleos y el jugador solo elige a qué jugar; no habrá precache selectivo ni packs que decidir. Para que crecer no cueste en cada versión, el SW guarda en su caché un manifiesto con el SHA-256 de cada archivo (`__cartivo-precache.json`). Al instalar una versión nueva copia de la caché anterior los archivos que no cambiaron y solo descarga el resto. El build imprime el número de archivos y los MB precargados. Evidencia: `tests/pwa.test.ts` ejecuta el SW generado con cachés y red simuladas: la primera instalación descarga todo, núcleos incluidos, y una actualización que solo cambia `index.html` descarga solo ese archivo.

## Validación manual pendiente (QA real)

1. `pnpm build && pnpm preview`, abrir http://127.0.0.1:4173 en Chrome/Edge/Brave: aparece **Instalar app** en la cabecera. Instalar y abrir la ventana independiente.
2. Jugar la demo, cerrar la app, desconectar la red y reabrir desde el escritorio/menú inicio: debe abrir y jugar.
3. En el explorador de archivos, **Abrir con → Cartivo** sobre un `.nes` propio.
4. Desplegar una versión distinta con una partida abierta: no debe recargar; tras cerrar el juego aparece **Actualizar ahora**.
5. Android (Chrome) e iOS/iPadOS (Safari → Compartir → Añadir a pantalla de inicio): instalación y reapertura offline. iOS no muestra botón de instalación propio.
6. Firefox de escritorio no instala PWAs: debe seguir funcionando en pestaña, offline incluido.

## Límites

- La instalación real exige un despliegue HTTPS (o `localhost`). No hay todavía hosting ni workflow de publicación.
- Sin E2E de instalación, `file_handlers`, suspensión móvil ni cuota de almacenamiento; Chromium headless no cierra esos gates.
- Sin COOP/COEP: no hacen falta mientras no haya núcleos con hilos WASM.
- No hay packs de núcleos bajo demanda, por decisión: todo se precachea y las actualizaciones solo bajan lo que cambia.
