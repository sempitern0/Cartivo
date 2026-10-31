# Cartivo

PWA de emulación local: **elige consola, mando o teclado, juego y pantalla; empieza a jugar**.

**Estado: H1-A con diagnóstico en Worker y primer incremento de entrada H1-B.** Hay una aplicación Svelte arrancable; todavía no hay núcleo NES, instalación PWA ni offline. No se distribuyen juegos ni BIOS propietarias.

## Catálogo inicial propuesto

| Grupo | Consolas | Objetivo sujeto a validación |
|---|---|---|
| Nintendo domésticas | NES, SNES | V1 estable |
| Nintendo portátiles | Game Boy, Game Boy Color, Game Boy Advance | V1 estable |
| Sega | Master System, Mega Drive / Genesis | V1 estable, con licencia del núcleo por resolver |
| Generación 3D | Nintendo 64, PlayStation, PSP | V1 beta por sistema si supera sus pruebas |
| Laboratorio | PlayStation 2 | Experimental opt-in, fuera del compromiso GA V1 |

La aplicación procesa archivos aportados por el usuario en su dispositivo. Catálogo, configuración y partidas son locales; las carátulas y metadatos de red son opcionales. La instalación y las capacidades dependen del navegador y del sistema operativo.

## Documentación

- [Plan técnico maestro](docs/PLAN_TECNICO_CARTIVO.md): arquitectura, contratos, catálogo, UX, almacenamiento, seguridad, QA y roadmap.
- [Guía de ejecución H0/H1](docs/GUIA_EJECUCION_H0_H1.md): prompt de implementación y evidencias de aceptación del primer incremento NES.
- [ADRs](docs/adr/README.md): decisiones propuestas y bloqueo de licencias.
- [Estado de compatibilidad](docs/compatibility/README.md): qué está probado y qué falta demostrar.
- [Diseño y UX](docs/DESIGN.md): paleta propia, una acción principal y configuración automática.
- [Reglas de desarrollo](AGENTS.md): límites y evidencias exigidas durante la implementación.

La documentación define el arranque de implementación; H0-NES y H1 todavía están pendientes. El merge documental permite comenzar shell, contratos y almacenamiento. La selección e integración de un núcleo requiere su expediente de licencia y viabilidad; el funcionamiento se acreditará con las pruebas de la guía.

## Arquitectura prevista

Svelte/Vite y TypeScript para la PWA; C/C++ y Emscripten para núcleos WASM independientes; Workers y adaptadores tipados para sesiones; IndexedDB/OPFS para datos locales. Hosting estático con cabeceras de aislamiento, packs de núcleos bajo demanda y gateway opcional de metadatos.

El primer incremento será una ruta NES completa con un juego de prueba autorizado, teclado/mando, guardado exportable y reapertura offline. Consulta [las pruebas del incremento](docs/compatibility/H1-A-FOUNDATION.md) para arrancar y validar la base.

## Licencia

**Cartivo: PolyForm Noncommercial 1.0.0** para el código original del proyecto cuyos derechos controle el titular, conforme al [LICENSE](LICENSE). Permite utilizar, estudiar, modificar y redistribuir el software para los fines no comerciales definidos por la licencia; los usos comerciales requieren autorización adicional del titular. La licencia es *source-available*, no una licencia open source reconocida por OSI.

La licencia anterior de la revisión inicial era LGPL-2.1: el cambio no revoca retroactivamente los permisos válidamente concedidos a destinatarios de copias anteriores. No se relicencia código ajeno ni se afirman derechos sobre contribuciones de terceros.

Los núcleos, librerías, herramientas y recursos externos mantienen sus propias licencias; toda integración y distribución requiere revisión por build. No se distribuyen núcleos GPL incompatibles dentro de un conjunto sujeto a restricciones no comerciales sin autorización suficiente o una solución jurídicamente válida. Worker, iframe y descarga diferida no crean excepciones. Véase [ADR-005](docs/adr/005-licensing.md).

## Ejecutar la base

Node 24.22.1 y pnpm 11.25.0:

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Abrir http://127.0.0.1:5173. La sesión de diagnóstico es simulada; no ejecuta ROMs. El laboratorio incluye una prueba de teclado y mando real mediante Gamepad API, con asignación manual y perfiles locales. Consulta [H1-B entrada](docs/compatibility/H1-B-INPUT.md) para probarla y conocer los límites.

