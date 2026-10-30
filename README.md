# Cartivo

PWA de emulación local: **elige consola, mando o teclado, juego y pantalla; empieza a jugar**.

**Estado: planificación técnica.** El repositorio contiene la especificación; todavía no hay una PWA ejecutable ni núcleos integrados. No se distribuyen juegos ni BIOS propietarias.

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
- [Reglas de desarrollo](AGENTS.md): límites y evidencias exigidas durante la implementación.

La documentación define el arranque de implementación; H0-NES y H1 todavía están pendientes. El merge documental permite comenzar shell, contratos y almacenamiento. La selección e integración de un núcleo requiere su expediente de licencia y viabilidad; el funcionamiento se acreditará con las pruebas de la guía.

## Arquitectura prevista

Svelte/Vite y TypeScript para la PWA; C/C++ y Emscripten para núcleos WASM independientes; Workers y adaptadores tipados para sesiones; IndexedDB/OPFS para datos locales. Hosting estático con cabeceras de aislamiento, packs de núcleos bajo demanda y gateway opcional de metadatos.

El primer incremento será una ruta NES completa con un juego de prueba autorizado, teclado/mando, guardado exportable y reapertura offline. No hay comandos de instalación o prueba todavía: se añadirán con el código real.

## Licencia: decisión pendiente

El archivo [LICENSE](LICENSE) actual contiene **LGPL-2.1**. La intención de producto discutida es restringir redistribución del código propio, lo que requiere resolver esta discrepancia antes de publicar. Esta documentación no sustituye ni modifica la licencia existente.

Las licencias de emuladores y recursos de terceros se evalúan por separado. Separar un núcleo en un Worker o descargarlo bajo demanda no permite ignorar sus condiciones. Véase [ADR-005](docs/adr/005-licensing.md).
