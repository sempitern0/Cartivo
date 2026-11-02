# Cartivo — Plan técnico

> **Revisión 5 · 2 de noviembre de 2026.** H2 completo (siete consolas jugables) y la parte automática de H1 cerrada: exportar Partidas, E2E en Firefox, fiabilidad de almacenamiento y CI en paralelo. Separa lo **hecho** (no reimplementar) de lo **pendiente** (la única lista de trabajo).
> **Producto:** PWA *local-first* para jugar consolas retro desde el navegador, sin BIOS propietarias, sin ROMs distribuidas y sin servidor de juego.
> **Fuentes de verdad:** reglas en `AGENTS.md`; estado y evidencias en README y `docs/compatibility/`; decisiones en `docs/adr/`.

**Para agentes de IA:** antes de proponer o escribir código, lee §2. Todo lo que aparece allí existe, está probado y se **reutiliza**, no se reescribe. Elige trabajo solo de §3, en su orden, y sigue la skill `cartivo-increment` (y `cartivo-core-gate` si hay núcleo nuevo).

## 1. Objetivo y reglas innegociables

El usuario abre la app, **elige consola, elige juego y juega**, con teclado o mando, sin configurar nada ni decidir nada técnico.

1. **Instalable y offline.** La app instalada trae **todos** los núcleos. El jugador nunca elige qué descargar; los juegos los aporta él y no salen de su dispositivo.
2. **Sin BIOS propietarias externas.** Solo núcleos sin BIOS, con firmware libre o con HLE.
3. **Licencias: uso privado** (ADR-005). Se admite cualquier licencia libre o de código disponible identificada, con sus avisos. Cada núcleo pasa el gate CORE-LEGAL-01. Antes de publicar se revisa la compatibilidad.
4. **Partidas a salvo.** Generaciones recuperables, escritor único y exportación. Ninguna actualización recarga una sesión activa ni borra partidas.
5. **Fidelidad por defecto.** Aspecto y velocidad originales; las mejoras que alteren la imagen o el tiempo son opcionales.
6. **Solo capacidades reales.** Cada núcleo ofrece instantáneas para «Partidas» (ADR-009) o declara que no puede.

**Fuera de V1:** emuladores propios, netplay, catálogo o descarga de ROMs y telemetría identificable. Las cuentas online, la nube y los logros son el hito futuro H6 (§3), posterior a V1.

## 2. Hecho — no reimplementar

| Capacidad | Dónde vive | Decisión | Evidencia |
|---|---|---|---|
| Contrato de núcleo, registro y protocolo v1 genérico (`load`, `advance`, `pause`, `save`, `import`, `reset`, `state-*`, `library-add`) | `packages/adapters/src/contract.ts`, `registry.ts`; `packages/runtime/src/protocol.ts`, `client.ts`; `apps/web/src/emulator.worker.ts` | ADR-002 | `tests/core-conformance.test.ts`, `worker.test.ts`, `client.test.ts` |
| Plantilla para núcleos C/C++ → WASM con Emscripten (ABI `cartivo_*`, imports permitidos, `BridgeCore`); carga diferida común (`onDemand` en `registry.ts`) | `packages/adapters/src/wasm-host.ts`, `registry.ts`; `cores/sameboy`, `cores/mgba`, `cores/snes9x`, `cores/genesis-plus-gx` (puente sobre libretro; `setjmp`/`longjmp` nativos de WASM) | ADR-010/011/013/014 | `tests/wasm-host.test.ts` |
| Builds de núcleo reproducibles, solo bajo petición (`.build-request` en una rama de trabajo o `workflow_dispatch`; nunca en `main` al fusionar) | `.github/workflows/core-*.yml`, `tools/build-*.mjs`, `tools/verify-*.mjs` | ADR-008 | `pnpm verify:core` en cada CI |
| **NES:** TetaNES 0.17.0 (WASM, por defecto) y JSNES 2.1.0 (alternativa); iNES NTSC, mappers 0–4 | `packages/adapters/src/tetanes.ts`, `jsnes.ts`, `ines.ts` | ADR-007/008 | `tests/nes.test.ts`, `tetanes.test.ts`, `tests/e2e/nes.spec.ts` |
| **GB/GBC:** SameBoy 1.0.4; DMG o CGB según la cabecera; MBC1/2/3/5 | `packages/adapters/src/sameboy.ts`, `gb-header.ts` | ADR-010 | `tests/gb.test.ts`, `tests/e2e/gb.spec.ts`, [H2-GB](compatibility/H2-GB.md) |
| **GBA:** mGBA 0.10.5 con BIOS HLE; SRAM, Flash y EEPROM | `packages/adapters/src/mgba.ts`, `gba-header.ts` | ADR-011 | `tests/gba-saves.test.ts`, `tests/e2e/gba.spec.ts`, [H2-GBA](compatibility/H2-GBA.md) |
| **SNES:** Snes9x 1.63 (C++ sobre su frontend libretro); NTSC LoROM/HiROM/ExHiROM, chips emulados; botones X/Y | `packages/adapters/src/snes9x.ts`, `snes-header.ts`; `cores/snes9x` | ADR-013 | `tests/snes.test.ts`, `tests/e2e/snes.spec.ts`, [H2-SNES](compatibility/H2-SNES.md) |
| **Master System y Mega Drive:** Genesis Plus GX `a5834b3`, un WASM y dos `CoreModule`; cartuchos NTSC (Mega-CD, 32X, Game Gear, SMD y PAL rechazados); mando de seis botones con etiquetas por sistema; `.bin` va a Mega Drive mientras ningún otro sistema la use | `packages/adapters/src/genesis-plus-gx.ts`, `sega-header.ts`; `cores/genesis-plus-gx` | ADR-014 | `tests/sega.test.ts`, `tests/e2e/sega.spec.ts`, [H2-SEGA](compatibility/H2-SEGA.md) |
| Fixtures originales con hash y oráculo (NES, GB/GBC, GBA, SNES, Master System, Mega Drive) | `packages/fixtures/src/` | — | Pruebas de cada sistema |
| SRAM con dos generaciones, Web Lock y exportación/importación; commit periódico en segundo plano que no frena la imagen | `packages/storage/src/sram.ts`, `formats.ts`, `background-commit.ts` | ADR-003/007 | `tests/storage.test.ts`, `tests/e2e/integrity.spec.ts` (100 ciclos) |
| «Partidas»: 3 ranuras + «Al salir», miniaturas, F5/F9, ligadas a núcleo y versión; exportar e importar una ranura (`cartivo-state-v1`) | `packages/storage/src/states.ts`, `state-file.ts`, `apps/web/src/SavePanel.svelte` | ADR-009 | `tests/snapshots.test.ts`, `state-file.test.ts`, `tests/e2e/saves.spec.ts` |
| Biblioteca local y «Continuar» (ROM en OPFS con consentimiento); copias que nunca se reescriben si ya están verificadas, orden índice/copia recuperable y poda de huérfanas | `packages/storage/src/library.ts`, `apps/web/src/{ContinueCard,Library,RememberPrompt}.svelte`, `game-source.ts` | ADR-012 | `tests/library.test.ts`, `tests/e2e/library.spec.ts`, [H1-LIB](compatibility/H1-LIB.md) |
| Entrada: teclado y Gamepad API, perfiles, remapeo, zona muerta, neutralización; durante la partida, la captura deja funcionar cualquier control de la página; doce acciones (L/R, X/Y); botones y etiquetas declarados por sistema | `packages/input/src/`; `systems.ts` (`buttons`, `controlButtons`, `buttonNotes`); `apps/web/src/ControlsPanel.svelte` | ADR-006 | `tests/input.test.ts`, `capture.test.ts`, `tests/e2e/input.spec.ts`, `controls-page.spec.ts` |
| Pantalla: Ajustar, Píxel entero y entero por proporción; aspecto del sistema; suavizado; preferencias por sistema | `packages/media/src/display-scaler.ts`, `display-preferences.ts`; `apps/web/src/GraphicsPanel.svelte`, `display.svelte.ts` | — | `tests/display-*.test.ts` |
| Reproductor dividido: sesión y bucle en `Player.svelte`; acciones, capas, copias, núcleo, sonido y captura de entrada en módulos propios | `apps/web/src/Player.svelte` y `PlayerActions`, `PlayerToolbar`, `ResumeOffer`, `FullscreenPause`, `BackupPanel`, `AboutCore`, `DeviceStatus`, `sound.svelte.ts`, `game-capture.ts` | — | `tests/e2e/nes.spec.ts`, `ui.spec.ts`, `session.spec.ts` |
| PWA: SW propio que precarga **todo** el build (núcleos incluidos), 6 descargas a la vez; una actualización solo descarga lo que cambió; «sin conexión» solo con la caché completa verificada; nunca recarga una sesión activa; «Abrir con», arrastrar y soltar; `persist()` en la app instalada | `tools/pwa-plugin.mjs`, `apps/web/src/pwa.svelte.ts` | — | `tests/pwa.test.ts`, `tests/e2e/pwa.spec.ts`, [H1-C](compatibility/H1-C-PWA.md) |
| Inicio, Focus y pantalla completa distintos, foco discreto, logo al inicio, tarjetas alineadas | `apps/web/src/App.svelte`, `theme.css`, [DESIGN.md](DESIGN.md) | — | `tests/e2e/ui.spec.ts` |
| CI: job `verify` (`verify:core`, Prettier, svelte-check, unitarias) y matriz `e2e` en paralelo (Chromium y Firefox × dev y preview, build solo en preview, audio virtual en Firefox, un reintento con traza), con preparación común en `.github/actions/setup`; unos 4 min en total; omite cambios solo de documentación | `.github/workflows/ci.yml` | — | Foundation CI |

## 3. Pendiente (lista de trabajo, en orden)

Cada punto es un incremento con rama y PR propias. «Terminado» significa lo indicado **y** la definición de §8.

1. **Cerrar H1.** Solo queda la QA física del titular: mando real, audio en altavoces, instalación, Safari y suspensión en móvil ([H1-QA](compatibility/H1-QA.md), sección Manual). Lo automático está hecho.
2. **Fiabilidad y portabilidad** (de la auditoría del titular, 2026-11-02).
   - **Hecho:** escrituras recuperables de la biblioteca, captura acotada, resultado de guardado separado, carga WASM con alternativa, timeouts por operación y «sin conexión» verificado.
   - **Pendiente:**
     - E2E en WebKit (Firefox ya corre la suite completa en CI);
     - pruebas de fallo en navegador real (las de lógica pura ya existen: biblioteca, guardado en segundo plano, caché offline): cierre durante una escritura, `QuotaExceededError`, dos pestañas, actualización con otra pestaña jugando, estado incompatible, suspensión larga;
     - modo degradado visible cuando no hay almacenamiento persistente (ventana privada);
     - despliegue bajo una subruta (rutas absolutas como `/licenses/...`);
     - matriz de QA por navegador y sistema en [H1-QA](compatibility/H1-QA.md).
3. **H1.5 · sin fricción.**
   - UI navegable con mando: la cruceta mueve el foco, A acepta, B vuelve, menú de pausa.
   - Despliegue en Cloudflare con cabeceras reales (`application/wasm`, caché inmutable para assets con hash, revalidación de HTML y `sw.js`) y prueba sin conexión en el dominio.
4. **Deuda técnica conocida.**
   - Cadencia por juego: hoy el host avanza al `frameRate` del sistema; por eso SNES y Mega Drive rechazan los cartuchos PAL (50 Hz). Sincronía A/V fina.
   - Ajustes de núcleo declarados por schema.
   - P2–P4 con perfiles.
   - GBA: RTC y sensores.
   - Paletas DMG opcionales.
   - Perfiles de pantalla por sistema.
   - Presupuestos de rendimiento medidos por núcleo (§7).
5. **H3 · biblioteca y experiencia.** Identidad del juego por cabecera y hash (ADR-004), carátulas con licencia y alternativa local, ajustes por juego e inglés.
6. **H4 · 3D.**
   - N64 (Mupen64Plus-Next o ares), PS1 (PCSX-ReARMed o Beetle PSX) y PSP (PPSSPP).
   - Lectura por bloques de discos sin copiar la imagen al heap WASM.
   - `EmulatorCore` entrega hoy RGBA de tamaño fijo y audio mono a 48 kHz. Las capacidades opcionales (resolución variable, audio y temporización por núcleo) se diseñan con el primer núcleo 3D y su ADR, sin romper los núcleos actuales.
   - Renderer propio (WebGL u OffscreenCanvas). Hilos solo si se miden, con COOP/COEP.
7. **H5 · publicación V1.** Revisar las licencias de cada núcleo para distribución, despliegue real, vuelta atrás y avisos completos.
8. **H6 · cuentas online (Supabase), posterior a V1.** Ver §4.
9. **Laboratorio PS2.** Play! opcional con límites publicados.

## 4. Hito futuro H6 — Cuentas online con Supabase

**Objetivo:** que el jugador pueda, si quiere, tener una cuenta para:
- conservar sus partidas en la nube y recuperarlas en otro dispositivo;
- desbloquear logros;
- aparecer en rankings por juego.

Sin cuenta, Cartivo sigue funcionando igual: local y offline.

**Requisitos previos:**
- **Regla de AGENTS.md.** El titular revisa «Archivos, partidas y rutas del usuario permanecen locales» para que diga «locales por defecto; nube solo con cuenta y consentimiento explícito».
- **ADR propio de H6:** proveedor (Supabase: Auth, Postgres con RLS y Storage), modelo de datos, retención, borrado de cuenta y costes.
- **Partidas sincronizadas:** SRAM y «Partidas», nunca ROMs ni BIOS. Cifradas en tránsito, aisladas por usuario (RLS) y versionadas con el mismo formato y checksum que la exportación local. Ante un conflicto, se conservan las dos versiones y elige el jugador.
- **Logros:** decidir con ADR entre integrar rcheevos/RetroAchievements (cuenta y condiciones de ese servicio, lectura de memoria por núcleo) o un sistema propio. Ningún logro se ofrece para un núcleo que no exponga la memoria necesaria.
- **Arquitectura de la sincronización:**
  - el juego nunca depende de una petición de red;
  - una partida se confirma primero en local y después la sube una cola persistente separada del Worker, con identificadores de operación idempotentes, versión por dispositivo y reintentos;
  - un conflicto nunca se sobrescribe solo;
  - cerrar sesión o un fallo de autenticación no borra nada local;
  - el SW no guarda respuestas privadas de autenticación o API en la caché de recursos.
- **Rankings:** por hash de juego y modo. Cliente no fiable: puntuaciones validadas en el servidor o marcadas como no verificadas. Sin datos personales públicos más allá del alias.

**Terminado cuando:**
- funciona con y sin cuenta;
- borrar la cuenta borra los datos remotos;
- la sincronización sobrevive a desconexión y conflicto con pruebas E2E;
- no se sube nada sin consentimiento.

## 5. Catálogo V1 y núcleos

Estados: `candidate → evaluating → accepted | blocked`. Solo `accepted` se integra.

| Sistema | Núcleo | Estado |
|---|---|---|
| NES | TetaNES 0.17.0 (WASM); JSNES 2.1.0 alternativa | **accepted** |
| Game Boy / Color | SameBoy 1.0.4 (Expat, boot ROMs libres) | **accepted** |
| Game Boy Advance | mGBA 0.10.5 (MPL-2.0, BIOS HLE) | **accepted (uso privado)** |
| SNES | Snes9x 1.63 (licencia no comercial propia) | **accepted (uso privado)** |
| Master System / Mega Drive | Genesis Plus GX `a5834b3` (licencias no comerciales) | **accepted (uso privado)** |
| N64 | Mupen64Plus-Next (GPL-2.0) o ares | candidate (uso privado) |
| PlayStation | PCSX-ReARMed / Beetle PSX (GPL-2.0, HLE/OpenBIOS) | candidate (uso privado) |
| PSP | PPSSPP (GPL-2.0-or-later, HLE) | candidate (uso privado) |
| PS2 | Play! (BSD-2, HLE) | laboratorio opt-in |

- **Pospuestos:** Game Gear, DS y Dreamcast.
- **Fuera:** Saturn, 32X, Mega-CD, arcade y accesorios especiales.
- **Matriz:** [CORE_LICENSE_AND_FIRMWARE_MATRIX](research/CORE_LICENSE_AND_FIRMWARE_MATRIX.md).

## 6. Arquitectura (resumen)

```text
apps/web/src/        UI Svelte 5 (App, Player y sus componentes, ControlsPanel), emulator.worker.ts, AudioWorklet, PWA
packages/adapters/   contrato, registro, wasm-host.ts, adaptadores y validadores por sistema
packages/runtime/    systems.ts (sistemas, botones), protocol.ts (v1), client.ts, preferencias de núcleo
packages/input/      teclado, Gamepad API, perfiles y captura
packages/media/      audio, escalado y preferencias de pantalla
packages/storage/    idb.ts, sram.ts, states.ts, library.ts, formats.ts
packages/fixtures/   ROMs de prueba originales
cores/<id>/          envoltorio, dist/ WASM, manifest, SBOM (generados por CI bajo petición)
tools/               build y verificación de núcleos, pwa-plugin
```

- Dependencias: `apps → runtime/adapters → input/media/storage`; los adaptadores no se importan entre sí.
- La UI solo conoce `systems.ts`; el Worker resuelve los núcleos con `registry.ts`.
- **Añadir una consola:** [ADDING_A_SYSTEM](ADDING_A_SYSTEM.md).

## 7. Rendimiento, seguridad y QA

- **Rendimiento:**
  - Dato en CI (Node), con la fixture: TetaNES ≈ 2,0 ms/frame, JSNES ≈ 1,1, mGBA ≈ 0,9, Snes9x ≈ 0,8–1,2, Genesis Plus GX ≈ 0,6 (Mega Drive) y 0,3 (Master System).
  - Presupuestos: shell < 100 ms sin tareas > 50 ms en el hilo principal; velocidad emulada 0,98–1,02× durante 10 minutos para promover un sistema a estable.
- **Seguridad:**
  - Validar cabeceras y tamaños antes de cargar; núcleos auditados y fijados en el Worker, con timeout.
  - CSP mínima al desplegar (`script-src 'self' 'wasm-unsafe-eval'`).
  - Sin analítica identificable.
- **QA:**
  - Gate para promover un sistema a estable: build reproducible, 10 casos legales, 100 ciclos de guardado sin corrupción, offline tras 20 reinicios y QA en hardware real.
  - Las E2E headless (Chromium y Firefox) no sustituyen un navegador real, Safari ni iOS instalado.

## 8. Definición de terminado

- Pruebas proporcionales (unitarias y E2E de flujos críticos) en verde en CI.
- TypeScript estricto y contratos validados.
- Nada pesado en el hilo principal.
- Alternativa ante APIs ausentes o permisos denegados.
- Ninguna migración destructiva de partidas.
- README, `docs/compatibility/`, CHANGELOG y el ADR afectado actualizados.
- Sin ROMs, BIOS ni arte sin derechos.
- Lo no verificado queda marcado como pendiente.

## 9. Riesgos abiertos

1. Publicar exigiría revisar los núcleos GPL, MPL y no comerciales admitidos por la política de uso privado.
2. Rendimiento de los núcleos pesados (Snes9x en móvil, núcleos 3D) en WASM sin hilos.
3. iOS/Safari: memoria, Gamepad API, almacenamiento y PWA offline.
4. Tamaño de la instalación al crecer el catálogo (instalarlo todo es una decisión del titular). Las actualizaciones ya solo descargan lo que cambia; con los núcleos 3D habrá que vigilar la cuota en móvil.
5. H6 introduce servidor, cuentas y datos personales: cambia el modelo de privacidad y requiere su propio ADR antes de cualquier código.
