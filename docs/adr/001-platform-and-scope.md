# ADR-001 — Plataforma, catálogo y distribución

Estado: propuesto. Fecha: 2026-10-30.

## Contexto

Cartivo debe convivir con varios emuladores y tecnologías nativas sin convertir su interfaz en un conjunto de demos incrustadas. Acceso por URL y datos locales son requisitos; las APIs y la instalación varían por navegador/SO.

## Decisión propuesta

Monorepo pnpm con Svelte/Vite estático y TypeScript estricto. Núcleos C/C++ compilados a WASM mediante toolchain fijada, con artefactos y releases independientes del shell. Python para tooling cuando aporte valor, sin backend adicional obligatorio. Gateway TS opcional para proveedores autorizados.

V1: NES, SNES, GB, GBC, GBA, Master System, Mega Drive, N64, PS1 y PSP. N64/PS1/PSP tienen aceptación beta independiente; los demás tienen objetivo estable, no estado actual estable. PS2 se investiga como laboratorio opt-in. DS, Game Gear y Dreamcast se posponen. Los demás sistemas no reciben trabajo inicial.

Hosting estático que permita HTTPS, MIME WASM, COOP/COEP y CSP. Mismo origen para packs al inicio. Packs versionados por hash, descarga al primer uso y pin offline. No se descarga todo el catálogo de núcleos al instalar.

## Alternativas

SvelteKit/SSR aporta complejidad sin necesidad actual de render servidor. React es viable pero no aporta una ventaja demostrada para este shell. Adoptar EmulatorJS como plataforma completa acelera integración a costa de acoplamiento y una revisión GPL; queda como candidato de evaluación, no dependencia predeterminada.

## Validación y consecuencias

Spike en Chromium, Firefox y Safari reales: aislamiento, AudioWorklet, input, acceso local, memoria e instalación. Rutas fallback se prueban por capacidad, no por marca de navegador. Una consola bloqueada no aparece como jugable. Cualquier recorte del catálogo comprometido se registra antes del anuncio de V1.

## Revisión: actualización y diagnóstico (2026-11-06)

La implementación actual precarga los artefactos del catálogo integrado, a diferencia del diseño inicial de packs bajo demanda. La activación explícita exige que el solicitante sea la única ventana de Cartivo en el scope. Durante la solicitud no puede iniciarse una partida; solo la pestaña solicitante se recarga. Como ninguna otra página queda con la versión anterior, la activación borra las cachés anteriores (en la revisión final se descartó conservarlas mientras hubiera ventanas: la pestaña que actualiza siempre está abierta, así que nunca se limpiaban y cada versión sumaba una build entera al almacenamiento). IndexedDB no se toca. El indicador offline verifica el manifiesto de la versión del Worker activo, no el de una versión antigua.

El reproductor conserva hasta 120 muestras locales de solicitudes `advance`: cadencia de fotogramas emulados y media/p95 de ida y vuelta al Worker. Las muestra plegadas en pausa, también dentro del diálogo de mando, y reinicia la ventana al reanudar. No son FPS de presentación, tiempo exclusivo del núcleo, latencia de entrada ni un benchmark de compatibilidad. Los presupuestos por núcleo y la QA física siguen pendientes.
