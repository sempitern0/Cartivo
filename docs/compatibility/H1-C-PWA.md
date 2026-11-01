# H1-C — PWA instalable y offline

Fecha: 2026-11-01. **Experimental.** Shell instalable con manifiesto, service worker propio y reapertura sin conexión de la build de producción. No cambia el núcleo (JSNES en Worker, ADR-007) ni su alcance.

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
- No hay packs de núcleos bajo demanda: todo el bundle actual se precachea (es pequeño).
