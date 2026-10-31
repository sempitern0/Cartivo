# Cartivo

PWA de emulación local: **elige consola, mando o teclado, juego y pantalla; empieza a jugar**.

**Estado: emulación NES experimental (iNES NTSC, mappers 0–4) con JSNES 2.1.0 en Worker.** Demo original, teclado/mando, audio y guardado SRAM con export/import. El núcleo de este incremento es JavaScript, no WASM; instalación PWA y offline siguen pendientes. No se distribuyen juegos ni BIOS propietarias de terceros.

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

La ruta experimental está documentada y probada en [H1-B NES](docs/compatibility/H1-B-NES.md). H0-WASM y H1 completo siguen abiertos: no se anuncia soporte general NES ni producción.

## Arquitectura prevista

Svelte/Vite y TypeScript para la PWA; C/C++ y Emscripten para núcleos WASM independientes; Workers y adaptadores tipados para sesiones; IndexedDB/OPFS para datos locales. Hosting estático con cabeceras de aislamiento, packs de núcleos bajo demanda y gateway opcional de metadatos.

La primera ruta real usa una demo original NROM, controles configurables, audio y SRAM recuperable/exportable. Consulta [las pruebas del incremento](docs/compatibility/H1-B-NES.md); la reapertura offline todavía no está implementada.

## Licencia

**Cartivo: PolyForm Noncommercial 1.0.0** para el código original del proyecto cuyos derechos controle el titular, conforme al [LICENSE](LICENSE). Permite utilizar, estudiar, modificar y redistribuir el software para los fines no comerciales definidos por la licencia; los usos comerciales requieren autorización adicional del titular. La licencia es *source-available*, no una licencia open source reconocida por OSI.

La licencia anterior de la revisión inicial era LGPL-2.1: el cambio no revoca retroactivamente los permisos válidamente concedidos a destinatarios de copias anteriores. No se relicencia código ajeno ni se afirman derechos sobre contribuciones de terceros.

Los núcleos, librerías, herramientas y recursos externos mantienen sus propias licencias; toda integración y distribución requiere revisión por build. No se distribuyen núcleos GPL incompatibles dentro de un conjunto sujeto a restricciones no comerciales sin autorización suficiente o una solución jurídicamente válida. Worker, iframe y descarga diferida no crean excepciones. Véase [ADR-005](docs/adr/005-licensing.md).

## Ejecutar la base

**Requisitos:** Node.js **>=24.22.1 <25** (versión recomendada en [`.node-version`](.node-version): `24.22.1`) y pnpm `11.25.0`.

En Windows, si `pnpm` muestra `Unsupported engine` con Node `24.20.0`, instala [Node.js 24.22.1 LTS desde su distribución oficial](https://nodejs.org/en/blog/release/v24.22.1/) y **abre una terminal nueva**. Es una actualización de seguridad; no conviene rebajar `engines.node` para ocultar el aviso. Si sigue apareciendo una versión antigua, ejecuta `where.exe node` para localizar otras instalaciones en `PATH`.

```sh
node --version
pnpm --version
pnpm install --frozen-lockfile
pnpm dev
```

El `node --version` debe mostrar `v24.22.1` o una revisión posterior compatible con la serie 24. CI emplea la versión fijada en `.node-version`.

Abrir http://127.0.0.1:5173. **Añadir juego** abre una ROM `.nes` local y la ejecuta directamente en el escenario central; **Probar demo** arranca la prueba original sin un segundo botón «Jugar». El área de juego y su ajuste de aspecto comparten el mismo espacio visual. En la cabecera permanecen el logotipo Cartivo y **Ajustes**, donde se encuentran los controles y el laboratorio técnico.

**Teclado NES predeterminado:** WASD o flechas para mover, **L = A**, **K = B**, Mayús derecha = Select y Enter = Start. **F** activa Focus y **Escape** pausa. Los mandos se detectan con Gamepad API; las asignaciones son editables. Cuando el navegador impide el audio automático, puede activarse desde el reproductor.

El núcleo JSNES experimental acepta actualmente iNES NTSC, mappers 0–4 dentro de los límites documentados. Los guardados SRAM y su importación/exportación funcionan en los juegos compatibles. Véanse [H1-B NES](docs/compatibility/H1-B-NES.md) y [Ajustes/controles](docs/compatibility/H1-B-INPUT.md).



La demo y el reproductor ejecutan el núcleo real. El laboratorio técnico de sesión continúa siendo un diagnóstico sin emulación. [Avisos de terceros](LICENSES.md) y [decisión del adaptador](docs/adr/007-nes-experimental-js.md).
