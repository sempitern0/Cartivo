# Cartivo — Plan técnico

> **Revisión 3 · 1 de noviembre de 2026.** Sustituye a la revisión 2 (30-10-2026), que era una propuesta sin código. Esta revisión parte de lo implementado en la PR #2 y ordena el trabajo restante.
> **Producto:** PWA *local-first* para jugar consolas retro desde el navegador, sin BIOS propietarias, sin ROMs distribuidas y sin servidor de juego.
> **Fuente de verdad del estado:** README y `docs/compatibility/`. Reglas de trabajo: `AGENTS.md`. Decisiones: `docs/adr/`.

## 1. Objetivo y reglas innegociables

El usuario abre una URL o la app instalada, **elige consola, elige juego y juega**, con teclado o mando, sin configurar nada. Todo lo avanzado existe, pero fuera del recorrido principal.

1. **Instalable y offline.** HTTPS, manifest y service worker propio. La app y los núcleos usados funcionan sin red; los juegos los aporta el usuario y nunca salen de su dispositivo.
2. **Sin BIOS propietarias externas.** Solo núcleos sin BIOS, con firmware libre o con HLE. Si un sistema no lo cumple, no se publica.
3. **Licencias: uso privado.** Cartivo usa PolyForm Noncommercial 1.0.0 para su código y hoy no se distribuye a terceros (ADR-005, revisión 2026-11-01): se admiten núcleos con cualquier licencia libre o de código disponible identificada, conservando licencias y avisos. Cada núcleo pasa el gate CORE-LEGAL-01 como registro; antes de publicar se revisa la compatibilidad.
4. **Partidas a salvo.** Generaciones recuperables, escritor único, exportación siempre disponible. Ninguna actualización recarga una sesión activa ni borra partidas.
5. **Fidelidad por defecto.** Aspecto y velocidad originales; las mejoras que alteren la imagen o el tiempo son opcionales y vienen desactivadas.
6. **Solo capacidades reales.** La UI no ofrece lo que el núcleo y la build no hacen (rewind, threads, resolución interna…). Guardar partida en cualquier momento es un requisito de producto: cada núcleo debe ofrecer instantáneas para la capa «Partidas» (ADR-009).

**Fuera de V1:** escribir emuladores propios, netplay, cuentas o nube, logros, catálogo o descarga de ROMs, telemetría identificable.

## 2. Estado actual (PR #2)

| Área | Implementado | Pendiente para cerrar H1 |
|---|---|---|
| Shell y UX | Svelte 5 + Vite; inicio «Elige una consola», reproductor con barra (Gráficos, Cargar ROM, Salir), Focus, pantalla completa, panel Gráficos con preferencias por sistema | Navegación completa de la UI con mando; biblioteca y «Continuar» |
| PWA | Manifest, iconos originales, SW generado en build (`tools/pwa-plugin.mjs`), offline, actualización que espera a no tener juego activo, «Abrir con» `.nes`, arrastrar y soltar | QA de instalación en Android/iOS y despliegue HTTPS (Cloudflare Worker, decidido por el titular) |
| NES | **TetaNES 0.17.0 en WebAssembly** por defecto (ADR-008); JSNES 2.1.0 como alternativa (ADR-007). iNES NTSC, mappers 0–4 | QA física con mando y audio; Firefox/Safari; ampliar mappers con pruebas |
| Entrada | Teclado (WASD/flechas, L/K/Q/Enter) y Gamepad API con perfiles, remapeo, zona muerta, neutralización al perder foco | Mando físico certificado; P2 |
| Partidas | «Partidas» para cualquier juego: instantáneas en 3 ranuras + «Al salir», «Continuar donde lo dejaste», F5/F9 (ADR-009). SRAM de batería con dos generaciones, Web Lock, export/import, compartida entre núcleos | 100 ciclos automatizados con fallos inyectados; exportar instantáneas |
| Calidad | CI: verify:core, lint, svelte-check, tests unitarios (Node), build, E2E Playwright en dev y en build de producción, capturas de UI | Matriz de navegadores real; presupuestos de rendimiento medidos |

Detalle y evidencias: [H1-B NES (JSNES)](compatibility/H1-B-NES.md), [H1-B Entrada](compatibility/H1-B-INPUT.md), [H1-C PWA](compatibility/H1-C-PWA.md), [H0-WASM-NES (TetaNES)](compatibility/H0-WASM-NES.md).

## 3. Catálogo V1 y núcleos candidatos

Estados: `candidate → evaluating → accepted | blocked`. Solo `accepted` puede publicarse, siempre como `experimental`, `beta` o `stable` por build y plataforma. La popularidad no demuestra viabilidad web ni derecho a distribuir.

| Sistema | Objetivo | Núcleo | Estado | Notas para el gate |
|---|---|---|---|---|
| NES | V1 estable | TetaNES 0.17.0 (WASM); JSNES 2.1.0 comparador | **accepted** | Ampliar mappers solo con fixtures y expediente; FDS excluido |
| Game Boy / Color | V1 estable | mGBA (MPL-2.0) o SameBoy (Expat, boot ROMs libres) | candidate | Siguiente sistema recomendado. mGBA cubre GB/GBC/GBA con un solo núcleo y tiene save states |
| Game Boy Advance | V1 estable | mGBA (BIOS HLE integrada) | candidate | Flash/EEPROM/SRAM/RTC; sin BIOS externa |
| SNES | V1 estable | ares (ISC) o Snes9x (licencia no comercial propia) | candidate | Chips especiales con firmware por título: excluirlos si lo requieren; medir rendimiento de ares en WASM |
| Master System / Mega Drive | V1 estable | Genesis Plus GX (condiciones no comerciales) u otra alternativa | candidate | Riesgo de licencia; Mega-CD fuera de V1 |
| N64 | V1 beta | Mupen64Plus-Next (GPL-2.0) o ares | candidate (uso privado) | Backend gráfico web, Controller Pak, instantáneas |
| PlayStation | V1 beta | PCSX-ReARMed / Beetle PSX (GPL-2.0, HLE/OpenBIOS) | candidate (uso privado) | Memory cards, multidisco, lectura por bloques |
| PSP | V1 beta | PPSSPP (GPL-2.0-or-later, HLE) | candidate (uso privado) | Port web, Memory Stick, rendimiento |
| PS2 | Laboratorio opt-in | Play! (BSD-2, HLE) | candidate | Fuera del compromiso V1; sin soporte móvil general |

Pospuestos: Game Gear, DS (V1.1), Dreamcast. Fuera: Saturn, 32X, Mega-CD, arcade, accesorios especiales. Matriz y fuentes: [CORE_LICENSE_AND_FIRMWARE_MATRIX](research/CORE_LICENSE_AND_FIRMWARE_MATRIX.md).

**Licencias:** con la política de uso privado, GPL (N64, PS1, PSP), MPL (mGBA) y licencias no comerciales (Snes9x, Genesis Plus GX) son admisibles. Si algún día se publica Cartivo, esos núcleos requieren revisión previa (retirarlos, sustituirlos o resolver la licencia). Para elegir núcleo pesan ahora el rendimiento en WASM, la calidad y que ofrezca **instantáneas** para «Partidas».

**Política de firmware:** auditar por sistema + modo + formato + juego. Se admite firmware libre reimplementado y HLE. No se extrapola la compatibilidad nativa de un emulador a su port web.

## 4. Experiencia de usuario

Recorrido: **Elegir consola → Jugar (abrir juego) → partida**. Mando o teclado se detectan solos; pantalla y rendimiento en «Automático». Guía visual en [DESIGN.md](DESIGN.md): paleta propia (coral, azul, turquesa, dorado), sin logos ni arte de terceros, una acción principal por pantalla.

Pantallas actuales: inicio con tarjetas de consola, «Configurar controles», reproductor con paneles Gráficos y Partidas, aviso «Continuar donde lo dejaste» al reabrir un juego y «Acerca de esta prueba» (núcleo y licencias). Próximas, por orden:

1. **Continuar desde el inicio:** recordar el último juego y reanudarlo con un clic sin volver a elegir el archivo (copia local de la ROM bajo consentimiento, OPFS).
2. **Biblioteca local mínima:** juegos abiertos, sistema, última partida; sin red.
3. **UI navegable con mando:** foco con cruceta, A acepta, B vuelve, menú de pausa con mando.
4. **Carátulas e identidad regional** (H3), siempre opcionales y con fallback local.

Requisitos permanentes: contraste AA, objetivos de 44 px, foco visible, `prefers-reduced-motion`, español (inglés en H3), sin conceptos técnicos en el recorrido principal.

## 5. Arquitectura

**Monorepo pnpm, TypeScript estricto, Svelte 5 + Vite sin SSR.** El framework no participa en el bucle de emulación. Cada núcleo corre en un Worker con un protocolo versionado; la UI solo conoce identificadores de núcleo.

```text
apps/web/src/            UI (App, Player, ControlsPanel, GameStage), worker NES, AudioWorklet, PWA
packages/adapters/       contract.ts (contrato de núcleo), registry.ts (módulos por sistema), ines.ts, jsnes.ts, tetanes.ts
packages/runtime/        systems.ts (registro de sistemas para la UI), protocol.ts (v1 genérico), client.ts, preferencias
packages/input/          normalización de teclado y Gamepad API, perfiles
packages/media/          audio, escalado de vídeo, preferencias de pantalla
packages/storage/        SRAM con generaciones (IndexedDB + Web Locks)
packages/fixtures/       ROM de prueba original (control-demo)
cores/jsnes/             manifiesto y hashes de JSNES (npm, sin parches)
cores/tetanes/           envoltorio Rust + dist/ WASM, manifest, SBOM (generados por CI)
tools/                   verify-jsnes, verify-tetanes, build-tetanes, pwa-plugin
tests/  tests/e2e/       unitarios (node:test) y E2E (Playwright)
```

Paquetes nuevos solo con consumidor real. Dirección de dependencias: `apps → runtime/adaptadores → input/media/storage`; los adaptadores no se importan entre sí. **Añadir una consola** sigue la checklist de [ADDING_A_SYSTEM](ADDING_A_SYSTEM.md): registrar un `CoreModule` y una entrada en `systems.ts`; inicio, reproductor, Gráficos, Partidas y selección de núcleo salen del registro.

### Ruta de un núcleo

1. **Selección y gate legal** (skill `cartivo-core-gate`): versión fijada, SBOM, licencias, firmware, decisión registrada.
2. **Build en CI**, nunca en el equipo del desarrollador: toolchain fijada, lockfile, rutas reasignadas, `cargo deny` o equivalente. Rust usa `wasm-bindgen` (TetaNES); C/C++ usará Emscripten con la misma disciplina.
3. **Artefactos versionados** en `cores/<id>/dist` con `manifest.json` (SHA-256, toolchain) y `sbom.json`; una recompilación independiente debe dar los mismos hashes; `pnpm verify:core` los comprueba en cada CI.
4. **Adaptador** con la superficie común (`input`, `advance`, `save`, `dispose`) y validación de formato compartida por sistema.
5. **Pruebas:** unitarias en Node contra el WASM versionado con fixtures propias, E2E en dev y build de producción, y expediente en `docs/compatibility/`.

### Ejecución

- Una sesión activa; cerrar o cambiar de ROM pasa siempre por pausa con flush de SRAM y `dispose` del núcleo (libera memoria WASM).
- El host marca el ritmo: lotes de 1–3 frames a 60 pasos/s; una pausa larga no acelera el juego.
- Vídeo RGBA transferido al canvas 2D (`GameStage`, escalado sin tocar el framebuffer). Los núcleos 3D futuros presentarán con su propio renderer (WebGL/OffscreenCanvas), sin forzar lecturas GPU→CPU.
- Audio mono a 48 kHz por AudioWorklet con cola acotada; se activa tras un gesto del usuario sin bloquear el arranque.
- Hilos y SIMD son builds distintas y requieren COOP/COEP; no se usan hasta que un núcleo lo necesite y se mida.
- Un Worker del mismo origen no es un sandbox: solo se ejecutan núcleos auditados y fijados.

### Despliegue

Hosting estático HTTPS (Cloudflare Worker previsto) con `application/wasm`, caché inmutable para assets con hash y revalidación de HTML y `sw.js`. Cuando haya hilos: `Cross-Origin-Opener-Policy: same-origin` y `Cross-Origin-Embedder-Policy: require-corp`, verificados con `crossOriginIsolated`. Hoy todo el bundle se precachea; los packs de núcleo bajo demanda llegarán cuando el tamaño lo justifique (núcleos 3D).

## 6. Contrato de núcleos

**Implementado (protocolo v1 genérico, ADR-002):** mensajes con versión, sesión e ID de petición, validación en ambos lados, una petición activa, timeout de 10 s, descarte de respuestas obsoletas. Comandos: `load` (con `system` y `core`), `advance` (devuelve RGBA con `width`/`height`), `pause`, `save`, `import`, `reset` y `state-list/save/load/delete`. Un único Worker resuelve el `CoreModule` en `registry.ts`; la UI usa `systems.ts`. Todo núcleo pasa `tests/core-conformance.test.ts`.

**Siguiente:** acciones de entrada por sistema (L/R, X/Y, C), ajustes de núcleo declarados por schema y capacidades opcionales. Ciclo de vida `idle → loading → running ↔ paused → stopping → stopped`, con `failed` desde cualquier fase y `dispose` idempotente. Capacidades opcionales (`save-state`, `rewind`, `disc-swap`, `multiplayer`, `internal-resolution`…) solo cuando el núcleo y la build las implementen y estén probadas.

Precedencia de ajustes: `valores verificados → sistema → núcleo → juego exacto → usuario → sesión`, con restablecer por juego y global. Las opciones se marcan `live`, `requires-reset` o `unsupported`; nada fuera del schema llega al WASM.

## 7. Datos, partidas y archivos

- **Hoy:** SRAM de 8 KB por hash de ROM, dos generaciones en una transacción IndexedDB, Web Lock por juego, commit cada 120 frames y al pausar o cerrar, copias JSON versionadas con checksum. No depende de `beforeunload`.
- **Siguiente:** copia opcional de la ROM en OPFS para «Continuar» (con tamaño y consentimiento), `navigator.storage.persist()` en la app instalada (ya implementado), aviso de cuota.
- **Discos grandes (H4):** lectura por bloques sin copiar la imagen entera al heap WASM; el adaptador debe demostrar una ruta síncrona válida (OPFS síncrono en Worker, Asyncify/JSPI o puente de IO). Hash incremental en Worker.
- **Partidas (instantáneas, ADR-009):** IndexedDB `cartivo-states`, ranuras «Al salir» + 3 por hash de ROM, SHA-256, tope 8 MB, miniatura; ligadas a núcleo y versión (un estado de otro núcleo o versión se rechaza sin borrarse). Guardado automático al salir, al cambiar de ROM y al ocultarse la pestaña. Separadas de la SRAM, que sigue siendo la partida interna del cartucho.

## 8. Identidad de juegos y carátulas (H3)

Detección por cabecera y estructura, no por extensión. Cartuchos por hash (CRC32/SHA-1, conservando el hash original); discos por serial interno (`SYSTEM.CNF`, `PARAM.SFO`). Resolución `(sistema, serial, región, revisión, disco, hash)` hacia una edición concreta. Proveedores (Libretro DB/Thumbnails, ScreenScraper con credenciales en un gateway, nunca en el cliente) solo tras revisar sus condiciones para una web pública. Sin coincidencia: carátula genérica o la del usuario; nunca otra región sin avisar.

## 9. Entrada

Implementado: abstracción en `packages/input` (teclado y Gamepad API `standard`, perfiles manuales, zona muerta, neutralización al perder foco o desconectar, D-pad sin direcciones opuestas). Pendiente: navegación de UI con mando, P2–P4 donde el núcleo lo permita, controles táctiles para móvil en sistemas 2D, vibración opcional. Los tests con mando sintético no certifican hardware.

## 10. Vídeo y audio

Implementado: escalado puro (`display-scaler.ts`: Ajustar, Píxel entero, 4:3 entero; 4:3 de televisor o píxeles cuadrados), suavizado opcional, preferencias por sistema, aviso cuando el escalado no cabe. Pendiente: perfiles por sistema (GB/GBA conservan su proporción portátil), filtros CRT opcionales con coste medido, latencia extremo a extremo medida aparte de los FPS.

## 11. Rendimiento

Detectar capacidades en runtime (WASM SIMD/threads, WebGL2, `crossOriginIsolated`, AudioWorklet) sin fiarse del User-Agent. Perfiles `compatibilidad`, `equilibrado` (por defecto), `calidad` y `personalizado`; el ajuste adaptativo baja primero postprocesado y resolución interna, con histéresis, y nunca altera la velocidad del juego ni el audio en silencio.

Dato actual (informativo, CI en Node): TetaNES ≈ 2,0 ms/frame y JSNES ≈ 1,1 ms/frame con la fixture. Presupuestos a validar en H1/H2: shell con respuesta < 100 ms y sin tareas > 50 ms en el hilo principal; bundle inicial sin núcleos ≤ 350 KiB gzip; velocidad emulada 0,98–1,02× durante 10 minutos para promover un sistema a estable.

## 12. Seguridad y privacidad

Validar cabeceras, tamaños y referencias antes de cargar; límites de descompresión. Núcleos auditados y fijados en Worker con timeout. CSP mínima al desplegar (`script-src 'self' 'wasm-unsafe-eval'`, `worker-src 'self'`). Sin claves de proveedores en el cliente. Sin analítica identificable; diagnóstico local exportable a voluntad. Avisos de terceros en `LICENSES.md` y `apps/web/public/licenses/`.

## 13. QA y gates

**CI actual** (`Foundation CI`): `pnpm install --frozen-lockfile`, `verify:core`, `lint`, `check`, `test`, `build`, E2E en dev y en preview, capturas de UI como artefacto. **Núcleos** (`Core TetaNES`): gate de licencias, build, commit de artefactos y recompilación de verificación.

Gate por sistema para promover a estable: build reproducible y licencia `accepted`; arranque, entrada, audio y partida probados con fixtures autorizadas; al menos 10 casos representativos legales (incluido estrés y un caso de fallo); 100 ciclos de guardado/reinicio/import sin corrupción; offline tras 20 reinicios; QA en hardware real (mando, audio, instalación, suspensión móvil). Chromium headless no sustituye Firefox, Safari ni iOS instalado.

Matriz de QA manual: Chrome/Edge, Firefox, Safari · Windows, macOS, Linux, Android, iOS · teclado, mando Xbox, PlayStation y genérico · pestaña e instalada.

## 14. Roadmap

| Hito | Estado | Salida |
|---|---|---|
| H0-NES | **Hecho** | TetaNES WASM aceptado y reproducible; JSNES como comparador |
| H1 — Primera ruta jugable | **En curso (PR #2)** | Falta: QA física (mando, audio), Firefox/Safari, 100 ciclos de partida automatizados, instalación en móvil |
| H1.5 — Sin fricción | Siguiente | Continuar último juego, biblioteca local mínima, UI con mando, despliegue HTTPS |
| H2 — 8/16 bits | Pendiente | GB/GBC → GBA → SNES → SMS/Mega Drive, un sistema por incremento con su gate |
| H3 — Biblioteca y experiencia | Pendiente | Identidad regional, carátulas con licencia y fallback, ajustes por juego, inglés |
| H4 — 3D | Pendiente | N64, PS1, PSP con núcleos GPL admitidos por uso privado; rendimiento web por medir |
| H5 — Publicación V1 | Pendiente | Sistemas aceptados, despliegue real, rollback, avisos completos |
| Laboratorio PS2 | Pendiente | Play! opt-in con límites publicados |

### Próximos incrementos recomendados

1. **Cerrar H1:** test E2E de 100 ciclos de guardado (SRAM y Partidas) con fallos inyectados; exportar/importar Partidas; E2E en Firefox además de Chromium; checklist de QA física.
2. **Continuar + biblioteca mínima** (mayor reducción de fricción): ROM en OPFS bajo consentimiento, tarjeta «Continuar» en inicio, borrado selectivo que nunca toque partidas.
3. **GB/GBC/GBA con mGBA** (o SameBoy para GB/GBC): build en CI con el patrón de `cores/tetanes` (Emscripten), adaptador con instantáneas para Partidas y perfiles de pantalla 10:9 y 3:2.
4. **Despliegue en Cloudflare** con cabeceras reales y smoke test offline del dominio.

## 15. Backlog

| ID | Épica | Estado | Terminado cuando |
|---|---|---|---|
| E-01 | Licencias y firmware | En curso | Expediente por build; decisión sobre GPL registrada |
| E-02 | Contrato y runtime | Hecho (contrato, registros, protocolo genérico) | Ajustes de núcleo por schema y entrada por sistema |
| E-03 | PWA y despliegue | Parcial | Instalación verificada en plataformas y dominio HTTPS con cabeceras |
| E-04 | Persistencia | Parcial (SRAM + Partidas) | 100 ciclos con fallos inyectados; exportar Partidas; OPFS para ROMs |
| E-05 | Entrada y foco | Parcial | UI completa con mando; P2; mando físico certificado |
| E-06 | NES | Experimental | QA física y mappers ampliados con pruebas |
| E-07 | GB/GBC/GBA | Pendiente | Gate, build reproducible y expediente |
| E-08 | SNES, SMS, Mega Drive | Pendiente | Gate de licencia y rendimiento |
| E-09 | Biblioteca, identidad y carátulas | Pendiente | Sin falsos positivos, corrección manual, fallback |
| E-10 | Perfiles de pantalla y ajustes por juego | Parcial (pantalla NES) | Schema, precedencia y restablecer |
| E-11 | N64, PS1, PSP | Pendiente (uso privado) | Gate por sistema, rendimiento web e instantáneas |
| E-12 | Rendimiento y diagnóstico | Pendiente | Presupuestos medidos por build |
| E-13 | QA, seguridad y releases | Parcial | Matriz real, SBOM por núcleo, rollback |
| E-14 | PS2 laboratorio | Pendiente | Prueba web reproducible y canal opt-in |

## 16. Definición de terminado

Un incremento está terminado cuando: tiene pruebas proporcionales (unitarias y E2E de flujos críticos) verdes en CI; respeta TypeScript estricto y contratos validados; no bloquea el hilo principal; tiene fallback ante APIs ausentes o permisos denegados; no pierde ni migra partidas destructivamente; actualiza README, `docs/compatibility/`, CHANGELOG y el ADR afectado; y no introduce ROMs, BIOS ni arte sin derechos. Lo no verificado se marca pendiente con su criterio de aceptación.

## 17. Riesgos abiertos

1. Publicar en el futuro exigiría revisar los núcleos GPL, MPL y no comerciales admitidos por la política de uso privado.
2. Rendimiento de núcleos más pesados (ares, 3D) en WASM sin hilos, sobre todo en móvil.
3. iOS/Safari: memoria, Gamepad API, almacenamiento y PWA offline.
4. Lectura de imágenes de disco grandes sin copiarlas al heap.
5. Permisos de uso de carátulas y metadatos en una web pública.
6. Desalojo de almacenamiento del navegador: la exportación de partidas sigue siendo necesaria.

Fuentes primarias de licencias y firmware: matriz de `docs/research/` y expedientes por núcleo. Las referencias de la revisión 2 que no se han revalidado se consideran pistas, no evidencia.
