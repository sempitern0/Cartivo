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
