# ADR-019 — Componentes de interfaz con Bits UI y animaciones de Svelte

Estado: **aceptado**. Fecha: 2026-11-08.

## Contexto

La interfaz se escribía entera a mano: pestañas, menús, paneles y confirmaciones con CSS propio y patrones WAI-ARIA reimplementados. Cada componente nuevo repetía foco, teclado, cierre con Escape y posición, y casi no había animaciones. El titular pidió profesionalizar el diseño con librerías estables de terceros, priorizando cadencia de actualizaciones, estabilidad y uso por la comunidad, y levantó la restricción de dependencias ([ADR-005, revisión 2026-11-08](005-licensing.md)).

Condiciones de Cartivo que la librería tiene que respetar:
- Svelte 5 con runas, sin SvelteKit ni Tailwind; el tema vive en `apps/web/src/theme.css`.
- Teclado, mando (`pad-navigation.svelte.ts`, que mueve el foco entre controles reales y envía Escape) y lectores de pantalla.
- Una sola acción principal por pantalla (DESIGN.md): estilo propio, no el de la librería.

## Decisión

- **Bits UI** (MIT, `huntabyte/bits-ui`) para los componentes con comportamiento: pestañas, menús, diálogos, popovers, interruptores, deslizadores y similares.
  - Es *headless*: da estado, foco, teclado y ARIA, y Cartivo pone todo el estilo con sus tokens.
  - Está escrita para Svelte 5 (runas y snippets) y es la base de shadcn-svelte, la colección de componentes más usada en Svelte. Se publica con frecuencia.
- **Animaciones:** primero las de Svelte (`svelte/transition`, `svelte/animate`, `svelte/motion`). Son parte del framework, no añaden peso y respetan `prefers-reduced-motion` con la regla global del tema. Solo se añade una librería de animación cuando haga falta algo que Svelte no da (por ejemplo, animaciones de diseño entre vistas).
- Se adopta por componentes, cuando se toca cada uno: no hay reescritura en bloque. Cada uso nuevo conserva los nombres accesibles que comprueban las E2E.

## Alternativas descartadas

- **shadcn-svelte:** son componentes de Bits UI con estilo de Tailwind copiados al repositorio. Obligaría a introducir Tailwind y a pelear con el tema propio.
- **Melt UI:** API de *builders* nacida para los stores de Svelte 4; su versión para runas aún madura.
- **Ark UI (Zag):** multi-framework; el adaptador de Svelte va por detrás del de React.
- **Skeleton, Flowbite Svelte, DaisyUI:** estilo prefabricado sobre Tailwind, contrario al diseño propio.
- **Seguir a mano:** más código propio que mantener y menos consistencia de accesibilidad.

## Consecuencias

- Una dependencia de ejecución más (con sus dependencias transitivas), fijada en `pnpm-lock.yaml`.
- El lockfile se puede sincronizar desde la CI (workflow `Dependencies`) cuando el cambio se escribe sin acceso al registro.
- Las E2E siguen siendo la red de seguridad: un componente de Bits UI debe dejar los mismos roles y nombres accesibles.
