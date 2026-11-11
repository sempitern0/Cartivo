# Cartivo — Plan técnico

> **Revisión 10 · 11 de noviembre de 2026.** Ocho consolas jugables (hasta PlayStation, con discos leídos bajo demanda) y perfiles de jugador locales; §3 es una cola de incrementos con criterio de terminado. PS2 (Play!) como siguiente hito; PSP, GameCube y Dreamcast aplazados. Separa lo **hecho** (no reimplementar) de lo **pendiente** (la única lista de trabajo).
> **Producto:** PWA *local-first* para jugar consolas retro desde el navegador, sin BIOS propietarias, sin ROMs distribuidas y sin servidor de juego.
> **Fuentes de verdad:** reglas en `AGENTS.md`; estado y evidencias en README y `docs/compatibility/`; decisiones en `docs/adr/`.

**Para agentes de IA:** antes de proponer o escribir código, lee §2. Todo lo que aparece allí existe, está probado y se **reutiliza**, no se reescribe. Elige trabajo solo de §3.2, en su orden, y sigue la skill `cartivo-increment` (y `cartivo-core-gate` si hay núcleo nuevo).

## 1. Objetivo y reglas innegociables

El usuario abre la app, **elige consola, elige juego y juega**, con teclado o mando, sin configurar nada ni decidir nada técnico.

1. **Instalable y offline.** La app instalada trae **todos** los núcleos. El jugador nunca elige qué descargar; los juegos los aporta él y no salen de su dispositivo.
2. **Sin BIOS propietarias externas.** Solo núcleos sin BIOS, con firmware libre o con HLE.
3. **Licencias: uso privado** (ADR-005). Se admite cualquier licencia libre o de código disponible identificada, con sus avisos. Cada núcleo pasa el gate CORE-LEGAL-01. Antes de publicar se revisa la compatibilidad.
4. **Partidas a salvo.** Generaciones recuperables, escritor único y exportación. Ninguna actualización recarga una sesión activa ni borra partidas.
5. **Fidelidad por defecto.** Aspecto y velocidad originales; las mejoras que alteren la imagen o el tiempo son opcionales.
6. **Solo capacidades reales.** Cada núcleo ofrece instantáneas para «Partidas» (ADR-009) o declara que no puede.

**Fuera de V1:** emuladores propios, netplay, catálogo o descarga de ROMs y telemetría identificable. Las cuentas online, la nube y los logros son el hito futuro H6 (§4), posterior a V1.

## 2. Hecho — no reimplementar

| Capacidad | Dónde vive | Decisión | Evidencia |
|---|---|---|---|
| Contrato de núcleo, registro y protocolo v1 genérico (`load`, `advance`, `pause`, `save`, `import`, `reset`, `state-*`, `library-add`) | `packages/adapters/src/contract.ts`, `registry.ts`; `packages/runtime/src/protocol.ts`, `client.ts`; `apps/web/src/emulator.worker.ts` | ADR-002 | `tests/core-conformance.test.ts`, `client.test.ts` |
| Plantilla para núcleos C/C++ → WASM con Emscripten (ABI `cartivo_*`, imports permitidos, `BridgeCore`); carga diferida común (`onDemand` en `registry.ts`) | `packages/adapters/src/wasm-host.ts`, `registry.ts`; `cores/sameboy`, `cores/mgba`, `cores/snes9x`, `cores/genesis-plus-gx` (puente sobre libretro; `setjmp`/`longjmp` nativos de WASM), `cores/pcsx-rearmed` | ADR-010/011/013/014/015 | `tests/wasm-host.test.ts` |
| Builds de núcleo reproducibles, solo bajo petición (`.build-request` en una rama de trabajo o `workflow_dispatch`; nunca en `main` al fusionar) | `.github/workflows/core-*.yml`, `tools/build-*.mjs`, `tools/verify-*.mjs` | ADR-008 | `pnpm verify:core` en cada CI |
| **NES:** TetaNES 0.17.0 (WASM, por defecto) y JSNES 2.1.0 (alternativa); iNES NTSC, mappers 0–4 | `packages/adapters/src/tetanes.ts`, `jsnes.ts`, `ines.ts` | ADR-007/008 | `tests/nes.test.ts`, `tetanes.test.ts`, `tests/e2e/nes.spec.ts` |
| **GB/GBC:** SameBoy 1.0.4; DMG o CGB según la cabecera; MBC1/2/3/5 | `packages/adapters/src/sameboy.ts`, `gb-header.ts` | ADR-010 | `tests/gb.test.ts`, `tests/e2e/gb.spec.ts`, [H2-GB](compatibility/H2-GB.md) |
| **GBA:** mGBA 0.10.5 con BIOS HLE; SRAM, Flash y EEPROM | `packages/adapters/src/mgba.ts`, `gba-header.ts` | ADR-011 | `tests/gba-saves.test.ts`, `tests/e2e/gba.spec.ts`, [H2-GBA](compatibility/H2-GBA.md) |
| **SNES:** Snes9x 1.63 (C++ sobre su frontend libretro); NTSC y PAL (50 Hz) LoROM/HiROM/ExHiROM, chips emulados; botones X/Y | `packages/adapters/src/snes9x.ts`, `snes-header.ts`; `cores/snes9x` | ADR-013 | `tests/snes.test.ts`, `tests/e2e/snes.spec.ts`, [H2-SNES](compatibility/H2-SNES.md) |
| **Master System y Mega Drive:** Genesis Plus GX `a5834b3`, un WASM y dos `CoreModule`; cartuchos NTSC y PAL (Mega-CD, 32X, Game Gear y SMD rechazados); mando de seis botones con etiquetas por sistema; `.bin` suelto de hasta 10 MiB | `packages/adapters/src/genesis-plus-gx.ts`, `sega-header.ts`; `cores/genesis-plus-gx` | ADR-014 | `tests/sega.test.ts`, `tests/e2e/sega.spec.ts`, [H2-SEGA](compatibility/H2-SEGA.md) |
| **PlayStation:** PCSX-ReARMed `7b0e8f8` con su BIOS HLE (nunca la de Sony), intérprete; `.m3u` multidisco con cambio desde la barra y la pausa, `.cue` con sus pistas, `.chd` (CHD v5 con libchdr), `.iso`, `.bin` y `.exe`; 640×480 fijo a 4:3; tarjeta de memoria 1 como batería; DualShock (digital con L2/R2, y sticks cuando el juego pasa a analógico). Los discos se recuerdan: sus archivos se copian a `roms/<identidad>/` mientras se juega, con aviso de espacio, y «Continuar» abre la copia | `packages/adapters/src/pcsx-rearmed.ts`; `cores/pcsx-rearmed`; `packages/storage/src/library.ts` (`rememberDisc`, `storedDisc`); `apps/web/src/DiscMenu.svelte` | ADR-015 | `tests/ps1.test.ts`, `tests/e2e/ps1.spec.ts`, [H4-PS1](compatibility/H4-PS1.md) |
| **Nintendo 64:** Mupen64Plus-Next `15bada8` con GLideN64 sobre WebGL2 en el Worker (`SurfaceModule`: la página transfiere el lienzo); `.z64`/`.n64`/`.v64`; stick analógico (teclado: dirección completa) y botones C; batería de 296 960 bytes; Partidas comprimidas con zlib, con miniatura leída de la GPU | `packages/adapters/src/n64.ts`, `n64-header.ts`; `cores/mupen64plus-next`; `apps/web/src/surface.ts` | ADR-017 | `tests/n64.test.ts`, `tests/e2e/n64.spec.ts`, [H4-N64](compatibility/H4-N64.md) |
| Discos bajo demanda: `DiscModule` en el contrato, `prepareDisc` (identidad por bloques WebCrypto, sin leer el disco entero), VFS de libretro sobre `FileReaderSync` (`cartivo_vfs_*`), varios archivos por `load` (`extra`) y `gameForFiles` para elegir el juego | `packages/adapters/src/disc.ts`, `contract.ts`; `packages/storage/src/disc-identity.ts`; `packages/runtime/src/prepare-rom.ts`, `systems.ts` | ADR-015 | `tests/disc.test.ts`, `disc-identity.test.ts`, `systems.test.ts` |
| Fixtures originales con hash y oráculo (NES, GB/GBC, GBA, SNES, Master System, Mega Drive, PlayStation) | `packages/fixtures/src/` | — | Pruebas de cada sistema |
| Cadencia por juego: el núcleo libretro informa de la frecuencia del juego cargado (`cartivo_frame_rate`, 50 Hz en PAL) y el host la usa; sin ese dato, la nominal del sistema | `EmulatorCore.frameRate`, `wasm-host.ts`, `Player.svelte`; puentes de `cores/snes9x` y `cores/genesis-plus-gx` | ADR-002 | `tests/wasm-host.test.ts`, `tests/e2e/pal.spec.ts` |
| SRAM con dos generaciones, Web Lock y exportación/importación; commit periódico en segundo plano que no frena la imagen | `packages/storage/src/sram.ts`, `formats.ts`, `background-commit.ts` | ADR-003/007 | `tests/storage.test.ts`, `tests/e2e/integrity.spec.ts` (100 ciclos) |
| «Partidas»: 3 ranuras + «Al salir», miniaturas, F5/F9, ligadas a núcleo y versión; exportar e importar una ranura (`cartivo-state-v1`) | `packages/storage/src/states.ts`, `state-file.ts`, `apps/web/src/SavePanel.svelte` | ADR-009 | `tests/snapshots.test.ts`, `state-file.test.ts`, `tests/e2e/saves.spec.ts` |
| Biblioteca local y «Continuar» (ROM en OPFS, recordada por defecto con interruptor); tres recientes en el inicio y página `#juegos` con búsqueda, filtro por consola y orden; copias que nunca se reescriben si ya están verificadas, orden índice/copia recuperable y poda de huérfanas | `packages/storage/src/library.ts` (`rememberGames`, `viewGames`), `apps/web/src/{ContinueCard,RecentGames,LibraryPage}.svelte`, `game-source.ts` | ADR-012 | `tests/library.test.ts`, `tests/e2e/library.spec.ts`, [H1-LIB](compatibility/H1-LIB.md) |
| Entrada: teclado y Gamepad API, perfiles, remapeo, zona muerta, neutralización; durante la partida, la captura deja funcionar cualquier control de la página; catorce acciones (L/R, X/Y, L2/R2); botones y etiquetas declarados por sistema | `packages/input/src/`; `systems.ts` (`buttons`, `controlButtons`, `buttonNotes`); `apps/web/src/ControlsPanel.svelte` | ADR-006 | `tests/input.test.ts`, `capture.test.ts`, `tests/e2e/input.spec.ts`, `controls-page.spec.ts` |
| Pantalla: Ajustar, Píxel entero y entero por proporción; aspecto del sistema; suavizado; preferencias por sistema | `packages/media/src/display-scaler.ts`, `display-preferences.ts`; `apps/web/src/GraphicsPanel.svelte`, `display.svelte.ts` | — | `tests/display-*.test.ts` |
| Reproductor dividido: sesión y bucle en `Player.svelte`; acciones, capas, copias, núcleo, sonido y captura de entrada en módulos propios | `apps/web/src/Player.svelte` y `PlayerActions`, `PlayerToolbar`, `ResumeOffer`, `FullscreenPause`, `BackupPanel`, `AboutCore`, `DeviceStatus`, `sound.svelte.ts`, `game-capture.ts` | — | `tests/e2e/nes.spec.ts`, `ui.spec.ts` |
| PWA: SW propio que precarga **todo** el build (núcleos incluidos), 6 descargas a la vez; una actualización solo descarga lo que cambió y cada descarga se comprueba contra el SHA-256 de la build; toda la app va aislada (COOP/COEP, ADR-020) y con Content Security Policy sin salidas a otros orígenes (ADR-021); «sin conexión» solo con la caché completa verificada; nunca recarga una sesión activa; «Abrir con», arrastrar y soltar; `persist()` en la app instalada | `tools/pwa-plugin.mjs`, `apps/web/src/pwa.svelte.ts` | — | `tests/pwa.test.ts`, `tests/e2e/pwa.spec.ts`, [H1-C](compatibility/H1-C-PWA.md) |
| Inicio, Focus y pantalla completa distintos, foco discreto, logo al inicio, tarjetas alineadas | `apps/web/src/App.svelte`, `theme.css`, [DESIGN.md](DESIGN.md) | — | `tests/e2e/ui.spec.ts` |
| Fiabilidad y portabilidad (auditoría del titular): escrituras recuperables de la biblioteca, captura acotada, guardado SRAM separado y en segundo plano, carga WASM con alternativa, timeouts por operación, «sin conexión» verificado, E2E en Firefox y WebKit (Worker de un solo archivo, `FramePacer`), subruta (`--base`), avisos cuando el navegador guarda menos y fallos inyectados en navegador real | `packages/storage/src/{library,background-commit,persistence,idb}.ts`, `wasm-host.ts`, `client.ts`, `offline-cache.ts`, `frame-pacer.ts` | ADR-003/007/012 | `tests/e2e/{faults,storage,subpath}.spec.ts`, [H1-QA](compatibility/H1-QA.md) |
| **Perfiles de jugador:** «¿Quién juega?» en cada visita (la elección dura la pestaña); cada perfil con sus Partidas, batería/tarjeta, biblioteca y controles; copias de ROM compartidas por hash; el primer perfil conserva los datos anteriores sin migrar; crear, renombrar y borrar (con sus datos), sin contraseña | `packages/storage/src/profiles.ts` (`scoped`), `apps/web/src/profile.svelte.ts`, `ProfilePicker.svelte`; protocolo `load.profile` | ADR-016 | `tests/profiles.test.ts`, `tests/e2e/profiles.spec.ts` |
| **Biblioteca común y experiencia (PR #38):** catálogo de títulos compartido por los perfiles (cartuchos y discos), progreso, recientes y capturas por perfil; reanudación según el guardado real («Jugar»/«Continuar»/«Cargar partida»); «Ocultar para mí», «Borrar mi progreso» y «Eliminar del dispositivo»; pausa unificada con teclado, ratón y mando; Ajustes en pestañas (Pantalla, Sonido, Controles, Interfaz, Almacenamiento, Avanzado; `#ajustes/<pestaña>`); vista previa de antes y después de la pantalla; componentes de Bits UI (pestañas, menú «⋯», diálogo de confirmación) con transiciones de Svelte | `packages/storage/src/{catalogue,state-index,progress}.ts`, `library.ts`; `apps/web/src/{LibraryPage,SettingsPage,DisplayOptions,DisplayPreview,PauseMenu}.svelte`, `display-sample.ts`; `packages/media/src/sound-preferences.ts` | ADR-018, ADR-019 | `tests/{shared-library,library,sound-preferences,display-sample}.test.ts`, `tests/e2e/{library,controls-page,pad-navigation,saves}.spec.ts`, [QA-PR38](compatibility/QA-PR38-VISUAL.md) |
| Interfaz con mando: la cruceta o el stick mueven el foco al control más cercano, A pulsa, B equivale a Escape (cierra paneles) o vuelve atrás, Select+Start pausa la partida y sale de la prueba de Controles; el juego y la prueba se apropian del mando mientras lo leen | `packages/input/src/ui-navigation.ts`, `apps/web/src/pad-navigation.svelte.ts` | ADR-006 | `tests/ui-navigation.test.ts`, `tests/e2e/pad-navigation.spec.ts` |
| Modo consola: interfaz automática según el último dispositivo, o fijada en Ajustes («Teclado y ratón» o «Mando»); leyenda de botones, carrusel de consolas y menú de pausa modal con Salir del juego. Solo presentación | `apps/web/src/input-mode.svelte.ts`, `PauseMenu.svelte`, `PadHints.svelte`, `InterfacePreference.svelte`; `parseUiPreference`/`resolveUiMode` en `ui-navigation.ts` | ADR-006 | `tests/ui-navigation.test.ts`, `tests/e2e/pad-navigation.spec.ts` |
| CI: job `verify` (`verify:core`, Prettier, svelte-check, unitarias) y seis jobs `e2e` en paralelo (Chromium, Firefox y WebKit × dev y preview, más Chromium con la build bajo `/cartivo/`, build solo en preview, audio virtual en Firefox, pantalla virtual en WebKit, un reintento con traza), con preparación común en `.github/actions/setup`; unos 4 min en total; workflow `Dependencies` que sincroniza `pnpm-lock.yaml` y relanza la CI; omite cambios solo de documentación | `.github/workflows/ci.yml` | — | Foundation CI |

## 3. Pendiente (lista de trabajo, en orden)

Cada punto es un incremento con rama y PR propias. «Terminado» significa su criterio **y** la definición de §8. Prioridad del titular: **un MVP jugable hasta PS2** antes que pulir la CI o publicar.

### 3.1 Del titular (no es trabajo de agentes)

- **QA física:**
  - PS1 con sus discos: `.cue` de *Crash Bandicoot*, juegos PAL y velocidad del intérprete ([H4-PS1](compatibility/H4-PS1.md));
  - selector de perfiles con mando y móvil;
  - lo manual de [H1-QA](compatibility/H1-QA.md): audio en altavoces, instalación, suspensión en móvil y actualización con otra pestaña jugando.
  - Safari, macOS e iOS tienen prioridad baja.
- **Decisiones aplazadas:** despliegue en Cloudflare con cabeceras reales y prueba sin conexión en el dominio.

### 3.2 Cola para agentes

Cada entrada dice por dónde empezar (área de `pnpm context`), cuándo está terminada y qué queda fuera. Si una entrada necesita una decisión de producto que no está aquí, se pregunta antes de programar.

1. ~~**PS1 · multidisco.**~~ ✔ Hecho: `.m3u` con cambio de disco desde la barra y la pausa (`DiscMenu`), fixture de dos discos, tests unitarios y E2E. ADR-015 revisado.
2. ~~**PS1 · CHD.**~~ ✔ Hecho: compilado con `HAVE_CHD` (libchdr, LZMA SDK, Zstandard, dr_flac), licencias en el SBOM y LICENSES.md, fixture CHD v5, tests unitarios y E2E.
3. **N64 · pulido tras la QA en la app.** N64 ya está en la app como experimental ([ADR-017](adr/017-n64-gpu-surface.md), [H4-N64](compatibility/H4-N64.md)).
   - *Registrado como límite:*
     - underruns de audio inherentes al modelo sin hilos (el Worker se retrasa → el AudioWorklet se vacía → silencio);
     - emsdk 6.0.12 (LLVM 24) se cuelga en el primer fotograma: el núcleo usa emsdk 4.0.10 (LLVM 21).
   - *Empieza por:* `packages/adapters/src/n64.ts`, `cores/mupen64plus-next/src/frontend.c` y el relevo de [experiments/n64/README.md](../experiments/n64/README.md#estado-de-relevo).
   - *Terminado cuando:* la QA del titular confirma batería, Partidas y salir/volver con un juego propio. Los dos puntos anteriores están registrados como límites en [H4-N64](compatibility/H4-N64.md).
4. **PS2** (Play! `1f27232`, BSD-2-Clause, HLE), sobre la superficie WebGL2 de ADR-017 (`SurfaceModule`), con JIT WASM nativo de CodeGen. Requiere pthreads (SharedArrayBuffer + COOP/COEP). Gate CORE-LEGAL-01: `investigation` — legal muy favorable (todo permisivo).
   - **Hecho:** el núcleo compila en CI (`tools/build-play.mjs`, build `a56f8b2`: `play.js` + `play.wasm` de 2,4 MiB, en `verify:core`) y la app está aislada ([ADR-020](adr/020-cross-origin-isolation.md)) y con CSP que admite el JIT ([ADR-021](adr/021-content-security-policy.md)).
   - **Falta:** el adaptador (cargar `play.js` en el Worker, OffscreenCanvas en `#cartivo-canvas`, disco con WORKERFS), una fixture homebrew, rendimiento medido y decidir la persistencia de memory cards (hoy solo Partidas).
   - *Empieza por:* [expediente PLAY_CORE_GATE](research/PLAY_CORE_GATE.md), `cores/play/src/cartivo.cpp` y `packages/adapters/src/n64.ts` (el otro núcleo con superficie propia).
   - *Terminado cuando:* un homebrew PS2 arranca en Cartivo con WebGL2, save states y entrada.
5. **PSP, GameCube y Dreamcast** aplazados para iteraciones posteriores. PSP: gate `investigation` ([expediente PPSSPP](research/PPSSPP_CORE_GATE.md)), sin port WASM. Dreamcast: BIOS propietaria requerida (bloqueado por AGENTS.md). GameCube: requiere SharedArrayBuffer, sin audio, rendimiento insuficiente.

### 3.3 Deuda técnica conocida (cuando toque su área)

- **App.svelte (≈830 líneas):** extraer el flujo de pistas de `.cue` (`missingTracks`, `incomplete`, `pickTracks`) a su propio módulo antes de añadir más casos de disco.
- **Prettier:** el repositorio usa 3.6.2, y una instalación global más nueva formatea distinto (ver `docs/ai/CONTEXT.md`, «Trampas conocidas»). Para subirla basta cambiar `package.json`: el workflow `Dependencies` regenera el lockfile.
- Sincronía A/V fina; ajustes de núcleo declarados por schema; P2–P4 (varios mandos en una partida); GBA RTC y sensores; paletas DMG opcionales; presupuestos de rendimiento medidos por núcleo (§7).
- **H3 · biblioteca y experiencia:** identidad por cabecera y hash (ADR-004), carátulas con licencia y alternativa local, ajustes por juego e inglés.

### 3.4 Después del MVP

- **H5 · publicación V1:** revisión de licencias para distribución, despliegue real, vuelta atrás y avisos completos.
- **H6 · cuentas online (Supabase):** ver §4.

## 4. Hito futuro H6 — Cuentas online con Supabase

**Objetivo:** que el jugador pueda, si quiere, tener una cuenta para:
- conservar sus partidas en la nube y recuperarlas en otro dispositivo;
- desbloquear logros;
- aparecer en rankings por juego.

Sin cuenta, Cartivo sigue funcionando igual: local y offline. Una cuenta se vincula a un perfil local (ADR-016), que ya separa partidas y controles (la biblioteca es común, ADR-018); los logros serán de cada perfil.

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
| N64 | Mupen64Plus-Next `15bada8` (GPL-2.0) | **accepted (uso privado)**; en la app como experimental (ADR-017) |
| PlayStation | PCSX-ReARMed `7b0e8f8` (GPL-2.0-or-later, BIOS HLE) | **accepted (uso privado)** |
| PS2 | Play! `1f27232` (BSD-2-Clause, HLE, JIT WASM) | **investigation**; legal favorable, núcleo compilado (`a56f8b2`), sin integrar |
| PSP | PPSSPP `9dc79eb` (GPL-3.0 del conjunto, HLE) | **investigation**; aplazado |

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
  - Las E2E automáticas (Chromium, Firefox y el WebKit de Linux) no sustituyen un navegador real, Safari ni iOS instalado.

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
3. iOS/Safari: memoria, Gamepad API, almacenamiento y PWA offline. Prioridad baja (decisión del titular: el público de Cartivo usa sobre todo Windows, Linux y Android).
4. Tamaño de la instalación al crecer el catálogo (instalarlo todo es una decisión del titular). Las actualizaciones ya solo descargan lo que cambia; con los núcleos 3D habrá que vigilar la cuota en móvil.
5. H6 introduce servidor, cuentas y datos personales: cambia el modelo de privacidad y requiere su propio ADR antes de cualquier código.
