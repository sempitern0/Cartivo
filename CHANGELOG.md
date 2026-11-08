# Changelog

## Unreleased

- Shell Svelte/Vite con diagnóstico claramente identificado y NES deshabilitada hasta integración.
- Controlador de sesión tipado, validación de mensajes y pruebas de transiciones y sesiones obsoletas.
- Workspace pnpm, lockfile, comprobación de tipos, build y workflow de CI.
- Guía de validación manual y límites del primer incremento H1-A.

### Segunda iteración H1-A

- Paleta propia coral/azul/turquesa/dorado, tokens compartidos y entrada minimalista.
- Laboratorio plegado y separado del flujo de juego.
- Worker de diagnóstico con correlación, timeout, cancelación y limpieza.
- Pruebas de transporte y test Chromium del Worker real, añadido a CI.

### H1-B: entrada, después de integrar main

- Merge de main conservando la implementación; investigación existente como base para la selección NES aún pendiente.
- Prueba de teclado y mando P1 con estado visible, zona muerta, asignación manual y perfiles locales explícitos.
- Neutralización al perder foco/desconectar; reactivación y liberación obligatoria antes de aceptar nuevas entradas.
- Validación de perfiles y E2E con Gamepad API sintética; guía de prueba Windows y gates de hardware pendientes.

### Corrección de detección y asignación de teclado

- Selección automática del primer mando visible; evento de conexión más sondeo y respeto de Solo teclado elegido manualmente.
- Estados de conexión útiles: permisos/API/contexto seguro o mando no expuesto; instrucciones para la interacción inicial exigida por el navegador.
- Teclas A=X y B=Z visibles, reasignación de las ocho acciones, rechazo de colisiones, persistencia local y restablecimiento.
- Regresiones de conexión tardía, preferencia de teclado y remapeo con recarga.

### Zona de controles del jugador

- Pantalla Controles accesible desde la cabecera y URL #controles, independiente del laboratorio técnico.
- Panel reutilizable para prueba y remapeo; limpieza de entrada al salir sin borrar perfiles guardados.
- Navegación Atrás/Volver con foco en el título y prueba E2E de reapertura neutral y pantalla móvil.

### Primera ruta NES real (experimental)

- JSNES 2.1.0 fijado y verificado contra 51 archivos upstream; Apache-2.0 y avisos incluidos. JavaScript en Worker; WASM pendiente explícito en ADR-007.
- Demo NROM original generada desde fuente, teclado/mando/remapeo aplicados al juego, vídeo 4:3 y audio AudioWorklet tras gesto del usuario.
- Importación local estricta NROM NTSC; pausa/foco/desconexión, cancelación y salida. Otros formatos se rechazan.
- SRAM real con escritor único, dos generaciones SHA-256 en transacción IndexedDB, export/import por identidad y recuperación de corrupción.
- E2E del núcleo y almacenamiento real en dev y preview; integridad del núcleo añadida a CI. Sin declarar PWA offline, compatibilidad general ni hardware probado.

### Carga de cartuchos y movimiento predeterminado

- Ampliación experimental iNES NTSC a MMC1/UxROM/CNROM/MMC3; límites por board y mensajes con mapper/tamaño en lugar del rechazo NROM genérico.
- Fixtures originales de arranque/entrada/SRAM por mapper y carga E2E de MMC1 mayor que el antiguo límite.
- WASD junto a flechas en Controles y juego, respetando asignaciones personalizadas y colisiones.

### Foco y presentación del reproductor

- Captura de teclado/foco y bloqueo de scroll mientras se juega; Escape pausa y libera navegación, con foco en Reanudar.
- Fullscreen API con acciones dentro del reproductor, aspecto 4:3 y pausa al salir; rechazo visible si falla.
- Barra de acciones/estado antes del vídeo y errores destacados que se llevan a la vista.
- E2E de foco, scroll, Escape, pantalla completa y posición del aviso de error.

### PWA instalable y offline

- Manifiesto con iconos originales, `file_handlers` para `.nes` y botón **Instalar app** cuando el navegador lo ofrece.
- Service worker generado en el build sin dependencias nuevas: precache completo, reapertura sin red, limpieza solo de sus cachés y actualización que espera a que no haya juego activo.
- Arrastrar y soltar `.nes`, «Abrir con Cartivo» y cola del archivo si ya hay una partida en curso.
- Persistencia de almacenamiento solicitada solo con la app instalada.
- CI: formato corregido y prioridad de reasignaciones explícitas sobre teclas predeterminadas en colisión.

### Interfaz H1-D

- Inicio «Elige una consola» con tarjeta NES (Jugar, ajustes, demo, arrastrar y soltar) y arte abstracto original.
- «Configurar controles» con dibujos propios de teclado y mando que se iluminan durante la prueba, chips de asignación y opciones avanzadas plegadas.
- Reproductor con barra superior (Gráficos, Cargar ROM, Salir), marco del vídeo y pie con estado de mando y teclado; «Cargar ROM» cierra la sesión con guardado confirmado antes de abrir otra.
- Capturas de interfaz generadas por los E2E y publicadas como artefacto del CI.
- Panel **Gráficos** con opciones visuales de escalado y proporción, suavizado opcional, aviso cuando el escalado no cabe y preferencias recordadas por sistema.
- Tarjeta NES centrada y arte desplazado para no tapar textos ni botones.

### H0-WASM-NES: TetaNES en WebAssembly

- Envoltorio `cores/tetanes` sobre `tetanes-core` 0.17.0 compilado a WASM en CI con toolchain fijada, `cargo deny`, manifiesto de hashes, SBOM y recompilación reproducible; los artefactos se versionan en la rama.
- Adaptador TetaNES con la misma superficie que JSNES, validación iNES compartida, protocolo con campo `core` y preferencia por sistema (TetaNES por defecto, JSNES en Acerca de esta prueba).
- La partida SRAM se comparte entre núcleos; pruebas unitarias del WASM y E2E de cambio de núcleo.
- Expediente CORE-LEGAL-01 y avisos de licencia (TetaNES MIT/Apache-2.0; excepción MPL-2.0 para `option-ext` aprobada por el titular).

### Documentación

- Plan técnico revisión 3: estado real, catálogo con núcleos candidatos, ruta de un núcleo (gate → build en CI → artefactos verificados), roadmap y backlog con estado y próximos incrementos.
- README, DESIGN, AGENTS y compatibilidad compactados al estado actual con comandos clave; se retiran la guía H0/H1, el plan de Focus y el registro H1-A (cubiertos por el plan, DESIGN y el historial).

### Partidas y licencias de uso privado

- «Partidas» para cualquier juego NES: instantáneas de TetaNES y JSNES en tres ranuras y «Al salir», miniaturas, «Continuar donde lo dejaste» al reabrir y F5/F9 (ADR-009). La memoria de batería sigue funcionando aparte.
- Escritor único por juego también sin batería; el protocolo NES añade `state-list/save/load/delete`.
- Política de licencias de uso privado (revisión de ADR-005): se admiten núcleos con cualquier licencia libre identificada; `cargo deny` y `verify-tetanes` la aplican.

### Base multiconsola

- Contrato de núcleo (`EmulatorCore`, `CoreModule`), registro de núcleos en el Worker y registro de sistemas para la UI.
- Protocolo v1 genérico (`system`, `core`, tamaño de imagen), `EmulatorClient` y un único `emulator.worker.ts`; SRAM de tamaño configurable sin romper las partidas NES existentes.
- Inicio, reproductor, Gráficos, Partidas y núcleos salen del registro; archivos asignados por extensión.
- Prueba de conformidad para todo núcleo registrado y guía `docs/ADDING_A_SYSTEM.md`.

### Endurecimiento previo al merge (PR #2)

- Integridad de partidas: E2E de 100 ciclos alternando núcleos, partidas dañadas o de otra versión, cancelación del selector, pestaña oculta y ausencia de Workers huérfanos; prueba de tiendas sin Web Locks.
- Reproductor dividido en `PlayerToolbar`, `GraphicsPanel` (etiquetas desde el vídeo del sistema), `SavePanel` y `SnapshotThumb`, sin cambios visuales.
- Nombres de almacenamiento por sistema (`formats.ts`) con los de NES intactos; mensaje de núcleo incompatible derivado del registro; sin tamaños 256×240 por defecto fuera del núcleo.
- Pruebas de coherencia manifest ↔ `systems.ts` y de ausencia de ids de sistema en la interfaz; mapa de archivos para GB/GBC en `ADDING_A_SYSTEM.md`.
- Medición de carga y precache; carga diferida por núcleo pospuesta al segundo sistema (H1-C-PWA). Matriz de QA en `docs/compatibility/H1-QA.md`.

### CI más ligera

- TetaNES se compila solo bajo petición explícita; la CI cotidiana verifica los artefactos versionados sin Rust.
- Una ejecución por cambio: sin duplicados push/PR, cancelación de ejecuciones superadas, omisión de cambios solo de documentación y límite de 10 min.
- Playwright muestra la duración de cada test.

### H2-GB: Game Boy y Game Boy Color con SameBoy

- Tarjetas «Game Boy» (`.gb`) y «Game Boy Color» (`.gbc`) con SameBoy 1.0.4 en WebAssembly autónomo; el modelo DMG o CGB se elige según la cabecera del cartucho (ADR-010).
- Gate CORE-LEGAL-01 de SameBoy (Expat, boot ROMs libres compiladas desde su código); boytacean descartado por incrustar boot ROMs de Nintendo.
- Build solo bajo petición (`core-sameboy.yml`, emsdk 6.0.12, rgbds v1.0.4), `verify-sameboy` en `verify:core` y aviso de licencia en `NOTICE.txt`.
- Fixture original SM83 (MBC1+batería, variantes DMG y CGB) y validación de cabecera (sin mapper, MBC1/2/3/5).
- Contrato: el tamaño de la SRAM lo da cada núcleo (`saveBytes`) y el reproductor avanza al ritmo de cada sistema (`frameRate`; GB a 59,73 Hz).
- SameBoy se carga solo al jugar a GB/GBC (`import()` en Workers ES); Gráficos oculta las opciones de proporción cuando el píxel es cuadrado.
- Pruebas: conformidad de `gb`/`gbc`, cabecera, sistemas y E2E de demo, SRAM, F5/F9, soltar `.gbc` y archivo dañado.

### H2-GBA: botones L y R

- Acciones L y R para Game Boy Advance: I/O en teclado y LB/RB en mando estándar, con chips en Controles y hombros en el dibujo del mando; NES y Game Boy las ignoran.
- Los perfiles de teclado y mando guardados antes de L/R se completan sin perder asignaciones.

### H2-GBA: Game Boy Advance con mGBA

- Tarjeta «Game Boy Advance» (`.gba`) con mGBA 0.10.5 en WebAssembly autónomo, BIOS HLE y arranque directo; L/R funcionan en el juego (ADR-011).
- Gate CORE-LEGAL-01 de mGBA (MPL-2.0; blip_buf LGPL-2.1+, inih BSD-3-Clause): accepted para uso privado, con las obligaciones si se publicara.
- Build solo bajo petición (`core-mgba.yml`, emsdk 6.0.12) con lista de fuentes versionada en lugar de CMake; `verify-mgba` en `verify:core`; avisos en `LICENSES.md` y `NOTICE.txt`.
- Guardado SRAM, Flash o EEPROM en un búfer fijo de 128 KB (como libretro), así que `saveBytes` no cambia.
- `wasm-host.ts`: carga, imports de sistema y `BridgeCore` comunes para SameBoy y mGBA.
- Fixture original ARM (modo 3) y validación de cabecera GBA; conformidad de `gba/mgba` y E2E de demo, L/R en píxeles, SRAM, F5/F9, soltar `.gba` y archivo dañado.

### Revisión previa al merge de H2 (GB, GBC y GBA)

- Game Boy: pruebas de que la cabecera elige el hardware (DMG en grises, CGB en color) y de que el reloj de MBC3 se guarda con la SRAM y avanza mientras la app está cerrada.
- GBA: variantes propias de la fixture con los protocolos reales de Flash y EEPROM; el juego relee su partida tras reabrir. Prueba sin chip de guardado y coste del búfer fijo medido.
- `wasm-host.ts`: lista explícita de imports permitidos (un import desconocido falla en `prepare()` nombrándolo) y núcleo cerrado que rechaza llamadas.
- Backlog: descriptor de entrada por sistema y precache selectivo de núcleos antes de SNES y de núcleos pesados.

### CI de núcleos

- Los workflows de núcleo ya no se disparan por `.build-request` en `main` (al fusionar una PR); allí se usa `workflow_dispatch`.
- Reproducibilidad confirmada: las compilaciones de SameBoy y mGBA relanzadas en `main` dieron los mismos hashes que los artefactos versionados.

### H1-LIB: biblioteca local y «Continuar»

- Pregunta única al abrir el primer juego desde archivo: «¿Recordar tus juegos en este dispositivo?»; se cambia en «Tus juegos». Las demos no se recuerdan.
- Copia de la ROM en OPFS (`roms/<sha256>`), escrita, releída y verificada en el Worker antes de registrarla en IndexedDB `cartivo-library`; sin espacio, el juego sigue y se avisa.
- Tarjeta **Continuar** en inicio: carga el último juego desde el dispositivo y sigue desde «Al salir» sin aviso. Una copia dañada o desaparecida se rechaza con un mensaje claro.
- **Tus juegos**: lista por fecha con Jugar y Quitar (con confirmación; las Partidas y la SRAM se conservan), espacio ocupado e interruptor.
- Protocolo v1: `load { stored }`, `remember` y `library-add`, con validación. ADR-012 y [H1-LIB](docs/compatibility/H1-LIB.md).

### Ajustes de experiencia (PR #7)

- Anillo de foco más discreto (2 px, translúcido) y sin borde sobre la imagen del juego.
- Pantalla completa separada de Focus: solo el juego, también en pausa, con una capa mínima para reanudar o salir.
- Reiniciar consola reinicia y vuelve a jugar al momento, sin dejar el último fotograma congelado.
- El logo enlaza al inicio.
- En Controles, la barra de prueba va junto a los dibujos que se iluminan.
- Tarjetas de consola alineadas, de igual altura y con títulos más contenidos.

### Base para H2

- `Player.svelte` dividido de 1104 a 773 líneas sin cambiar comportamiento: `PlayerActions`, `DeviceStatus`, `ResumeOffer`, `FullscreenPause`, `BackupPanel`, `AboutCore`, `display.svelte.ts`, `sound.svelte.ts` y `game-capture.ts`.
- Botones declarados por sistema (`buttons` en `systems.ts`): Controles muestra solo los que usa alguna consola y genera sus notas.
- PWA: se instala todo (decisión del titular) y una actualización copia de la caché anterior los archivos sin cambios en lugar de volver a descargarlos. El build informa del tamaño precargado.
- Plan técnico, revisión 4: «Hecho — no reimplementar» y «Pendiente» en orden; Snes9x y Genesis Plus GX elegidos; hito futuro H6 de cuentas online con Supabase.

### H2-SNES: Super Nintendo con Snes9x

- Snes9x 1.63 compilado por CI a WebAssembly una sola vez (`core-snes9x.yml`, solo bajo petición), con un puente C++ propio sobre su frontend libretro: vídeo 256×224, audio a 48 kHz, SRAM e instantáneas.
- Expediente CORE-LEGAL-01: **accepted (uso privado)**, licencia no comercial; snes_spc/snes_ntsc LGPL. Sin BIOS; BS-X, Sufami Turbo, Super Game Boy, ST018 y cartuchos PAL se rechazan con un mensaje claro.
- Botones X (U, norte) e Y (J, oeste) con migración de perfiles; Controles los muestra con su nota y dibuja los botones frontales en rombo.
- `wasm-host.ts` resuelve con ENOSYS dos imports de archivos que Snes9x nunca usa; el registro carga los núcleos con un `onDemand` común.
- Fixture 65816 original y pruebas: cabecera, oráculo completo en WASM, conformidad y E2E. ADR-013 y [H2-SNES](docs/compatibility/H2-SNES.md).

### H2-SEGA: Master System y Mega Drive con Genesis Plus GX

- Genesis Plus GX `a5834b3` compilado por CI a WebAssembly (`core-genesis-plus-gx.yml`, solo bajo petición), con un puente C propio sobre su frontend libretro. Un solo WASM sirve a las dos consolas: vídeo 256×192 o 320×224, audio a 48 kHz, batería e instantáneas.
- Expediente CORE-LEGAL-01: **accepted (uso privado)**. Varios componentes son no comerciales (Genesis Plus GX, Musashi, Z80 de MAME, SVP, Nuked OPLL) y otros LGPL. Sin BIOS. Mega-CD, 32X, Game Gear, volcados SMD y cartuchos de Mega Drive solo PAL se rechazan con un mensaje claro.
- Mega Drive con mando de seis botones y Master System con 1/2/Pause, sin acciones nuevas: cada sistema declara sus etiquetas, que aparecen en las notas de Controles y en la ayuda de pausa de la demo.
- `wasm-host.ts` admite `setjmp`/`longjmp` nativos de WebAssembly (la etiqueta `env.__c_longjmp`), que Musashi necesita para los errores de dirección del 68000.
- `.sms`, `.md`, `.gen` y `.bin` en el selector, al soltar y en «Abrir con».
- Fixtures Z80 y 68000 originales y pruebas: cabeceras, oráculos completos en WASM, conformidad y E2E. ADR-014 y [H2-SEGA](docs/compatibility/H2-SEGA.md).

### Fiabilidad (auditoría del titular)

- **Biblioteca:** una copia verificada ya no se reescribe, así que un fallo al recordar otra vez un juego no puede borrarla. Al quitar un juego se borra antes la entrada que la copia, y las copias huérfanas con más de 24 h se podan en segundo plano (ADR-012).
- **Durante la partida** funcionan todos los controles de la página, como «Ajustes» o el logo. Un clic en una zona vacía sigue devolviendo el foco al juego.
- **Guardar en una ranura** avisa si la instantánea se guardó pero falló la memoria del cartucho.
- **Núcleos C:** si el servidor no entrega `application/wasm`, se compilan desde los bytes; una descarga fallida tiene su propio mensaje.
- **Tiempos de espera:** 60 s para abrir un juego (compilar el núcleo y calcular el hash) y 10 s para el resto.
- **PWA:** se instala con 6 descargas a la vez, y «sin conexión» solo se indica cuando la caché está completa, con su manifiesto y todos sus archivos.
- **Plan técnico:** nuevo punto «Fiabilidad y portabilidad» con lo pendiente (Firefox/WebKit, pruebas de fallo en navegador, modo sin persistencia, subruta) y reglas de sincronización para H6.

### Cerrar H1: exportar e importar Partidas

- Cada ranura de **Partidas** se puede exportar como archivo (`cartivo-state-v1`: JSON con la instantánea en base64, su SHA-256 y la miniatura) e importar después, también en otro navegador o dispositivo con el mismo juego.
- Importar devuelve la partida a su ranura de origen y pide confirmación si está ocupada. Rechaza con un mensaje claro una partida de otro juego, de otra versión del núcleo o dañada; acepta la de otro núcleo del mismo sistema.
- La descarga de archivos es común a Partidas y Copias de partida. ADR-009 revisado.

### Cerrar H1: E2E en Firefox

- Playwright tiene los proyectos `chromium` y `firefox`. La CI ejecuta la suite completa en Firefox, en dev y en preview, en un job paralelo; los scripts nuevos son `pnpm test:e2e:firefox` y `pnpm test:e2e:preview:firefox`.
- Firefox necesita un servidor de sonido en Linux: la CI usa PulseAudio con un sumidero nulo, así que el audio también se comprueba en Firefox.
- La prueba de pantalla completa compara con la altura real de la ventana en ese modo, en lugar de con el viewport configurado. Ninguna prueba se omite por ser Firefox.

### CI más rápida y sin duplicados

- Las cuatro tandas E2E (Chromium y Firefox, en dev y en preview) corren en paralelo en una matriz. La CI completa baja de unos 8 minutos a unos 4.
- La preparación (pnpm, Node, instalación) vive en una acción común, `.github/actions/setup`, en lugar de copiarse en cada job.
- El build se hace solo donde se usa (preview).
- En la CI, una prueba que falla una vez se reintenta y se marca como «flaky», con traza. Los resultados de cada tanda, capturas incluidas, se suben como artefacto.

### La memoria de batería se guarda sin frenar la imagen

- El guardado automático de la memoria del cartucho (cada 120 frames) ya no retiene el siguiente frame mientras IndexedDB escribe. Antes, una escritura lenta podía pausar el juego con «La ejecución se ha retrasado».
- Las operaciones que dependen del guardado (pausa, Partidas, reinicio, importar, salir) siguen esperando a que termine. Nunca hay dos escrituras a la vez y el éxito solo se informa tras confirmarse. ADR-007 revisado.

### Portabilidad: E2E en WebKit (motor de Safari)

- La CI ejecuta la suite E2E también en WebKit, en dev y en preview, en la misma matriz paralela. Usa una pantalla virtual porque, sin ella, WebKit en Linux anima unas 2 veces por segundo. Scripts nuevos: `pnpm test:e2e:webkit` y `pnpm test:e2e:preview:webkit`.
- **Arreglado (afectaba a Safari):** en la build de producción, al cargar el núcleo de Game Boy, GBA, SNES o Sega, WebKit volvía a evaluar el Worker y la partida se cortaba con «Sesión obsoleta o no cargada». El Worker de emulación es ahora un solo archivo; el WebAssembly de cada núcleo se sigue descargando solo al empezar un juego de ese sistema.
- **Arreglado:** una parada puntual (el primer fotograma mientras el navegador compila el núcleo, el recolector de basura) ya no pausa el juego con «La ejecución se ha retrasado». Se descarta el retraso, sin acelerar nunca, y solo tres paradas en cinco segundos pausan con un aviso (`FramePacer`).
- La biblioteca no se prueba en WebKit, porque el perfil efímero de Playwright no tiene OPFS, como una ventana privada de Safari. Queda en la QA manual.

### Portabilidad: publicar bajo una subruta

- Cartivo funciona publicado en una subcarpeta del dominio: `pnpm build --base /cartivo/`. El manifest (`id`, `start_url`, `scope`, iconos, «Abrir con») usa rutas relativas a sí mismo, y en la raíz se resuelven igual que antes. Las licencias y el logo usan la base de la app.
- Prueba E2E de la build bajo `/cartivo/` en la matriz de CI: demo, manifest, licencias, logo, service worker con su ámbito, juego sin conexión y ninguna petición fuera de la subruta. Una prueba unitaria comprueba que cada licencia es relativa y existe.
- Plan técnico: Safari, macOS e iOS pasan a prioridad baja por decisión del titular.

### Fiabilidad: aviso cuando el navegador guarda menos

- En una ventana privada sin OPFS, el inicio explica que no se guardan copias de los juegos y recomienda exportar las partidas. Cartivo ya no pregunta por recordar juegos que no podría guardar.
- Sin Web Locks o IndexedDB, el juego arranca igual y avisa de que no se guardará el progreso: Partidas se desactiva, F5 explica por qué y salir no pide confirmación. Las tiendas siguen negándose a abrir sin escritor único, y un juego abierto en otra pestaña se sigue rechazando.
- `idb.ts` reúne la comprobación de Web Locks y la apertura de IndexedDB que repetían las dos tiendas. ADR-003 revisado.

### Fiabilidad: fallos inyectados en navegador real

- Nuevas E2E (`tests/e2e/faults.spec.ts`) con fallos provocados a propósito:
  - un núcleo servido con el MIME incorrecto arranca igual;
  - sin espacio al recordar un juego, se sigue jugando, se explica y no queda nada a medias;
  - al cerrar la pestaña a mitad de partida, la memoria de batería se reabre sin errores.
- Con esto, el punto «Fiabilidad y portabilidad» del plan técnico pasa a hecho. Lo que no se puede forzar en un navegador automático (actualizar la app con otra pestaña jugando, suspensión larga en móvil) queda en la QA manual de H1.

### Limpieza: fuera el laboratorio de H0

- Se retira de Ajustes el «Laboratorio · Diagnóstico sin emulación», una prueba de sesión de H0 sin utilidad para el jugador, con su Worker, `worker-client.ts`, `session.ts` y sus pruebas. El juego usa el protocolo real (`client.ts`, `protocol.ts`, `emulator.worker.ts`), que no cambia.
- La prueba de Controles mantiene lo que comprobaba (URL directa, salir y volver, prueba de entrada); el inicio a 360 px ya lo cubre `ui.spec.ts`.

### H1.5: la interfaz se maneja con el mando

- La cruceta o el stick mueven el foco al control más cercano, A pulsa y B cierra el panel abierto o vuelve (de Controles al inicio). Izquierda y derecha cambian deslizadores y selectores. El anillo de foco se ve con mando y desaparece al usar el ratón.
- **Select+Start** pausa la partida (la pausa enfoca Reanudar juego) y detiene la prueba de Controles. El juego y la prueba se reservan el mando mientras lo leen; al devolverlo, los botones aún pulsados no cuentan.
- Lógica pura y probada en `packages/input/src/ui-navigation.ts`; integración en `apps/web/src/pad-navigation.svelte.ts`; E2E con mando sintético en `pad-navigation.spec.ts`. El mando real queda en la QA manual.
- El despliegue en Cloudflare se aplaza por decisión del titular.

### Instrucciones para agentes con menos contexto

- `AGENTS.md` se reduce a las reglas transversales y a un método de lectura progresiva; las reglas de núcleos, artefactos WASM y licencias pasan a `cores/AGENTS.md` (con `cores/CLAUDE.md` para que Claude Code las cargue en esa carpeta).
- Nuevo `docs/ai/CONTEXT.md`: tabla área → archivos y pruebas por donde empezar, para no leer el árbol entero. `CLAUDE.md` solo enlaza ambos.

### Tus juegos, sin preguntas

- Abrir un archivo lo recuerda en el dispositivo sin preguntar; el interruptor de «Tus juegos» lo desactiva. La respuesta antigua a la pregunta deja de contar (`cartivo:library:remember:v2`) y se retiran `RememberPrompt.svelte` y la petición `library-add`.
- El inicio muestra los tres juegos más recientes (la tarjeta grande Continuar y dos compactos) y enlaza a la nueva página `#juegos`: búsqueda sin acentos, filtro por consola, orden reciente o por nombre, Continuar y Quitar. Lógica pura en `viewGames`.

### Modo consola: una interfaz para el mando

- La interfaz es automática: al usar el mando pasa al modo consola y vuelve a la de escritorio con el ratón o el teclado. En **Ajustes → Interfaz** se puede fijar «Teclado y ratón» o «Mando».
- Modo consola: leyenda de botones abajo, consolas en carrusel y la pausa como menú vertical modal (Reanudar juego, Partidas, Gráficos, Controles, Reiniciar consola, Salir del juego), con B para reanudar. Solo cambia la presentación: núcleos y protocolo intactos.

### Fiabilidad, entrada y diagnóstico (2026-11-06)

- Activación de actualizaciones limitada a una única pestaña (la que la pide, que se recarga) y bloqueo de inicio durante la actualización; las cachés de versiones anteriores se borran al activar.
- Verificación offline ligada al Worker activo; manifiestos vacíos o inválidos no acreditan disponibilidad. Fallos de persistencia opcional quedan manejados.
- Cambio de dispositivo durante la partida sin interferir con la reserva del mando (configurar el mando en Controles no cambia la interfaz); navegación limitada a controles visibles del diálogo actual.
- Diagnóstico local en pausa: cadencia emulada y media/p95 de ida y vuelta del Worker, con muestras acotadas y sin cambiar temporización.

### pnpm 12

- pnpm 12.16.1 fijado en `packageManager` (el lockfile registra su versión). La CI toma la versión de ahí, sin un segundo pin en `.github/actions/setup`.

### Cadencia por juego: cartuchos PAL en SNES y Mega Drive

- Los puentes de Snes9x y Genesis Plus GX exportan `cartivo_frame_rate` (la frecuencia que el núcleo elige por la cabecera) y el reproductor avanza a esa cadencia: un cartucho PAL va a 50 Hz. Sin ese dato se usa la nominal del sistema (`EmulatorCore.frameRate`, opcional).
- Se admiten los cartuchos PAL de SNES y Mega Drive, antes rechazados. «Acerca de esta prueba» muestra la cadencia del juego.
- Las fixtures de SNES y Mega Drive tienen una variante PAL (región Europa) para las pruebas; la versión por defecto conserva su hash.

### CI: navegadores de Playwright en caché

- El espejo apt del runner se atascaba minutos con frecuencia. La CI guarda en caché, por versión de Playwright y navegador, los navegadores y los paquetes .deb de las librerías que falten; omite las fuentes opcionales de Playwright (ninguna prueba lee texto renderizado). La instalación tiene su propio límite para fallar pronto.

### Un solo mapa de contexto para agentes

- `tools/context-areas.mjs` es el único mapa de áreas (archivos y pruebas por tema). `pnpm context <área>` lo consulta y `pnpm context --write-doc` genera la tabla de `docs/ai/CONTEXT.md`; `tests/context.test.ts` falla si la tabla y el mapa no coinciden o si un patrón deja de encontrar archivos. Áreas: `ui`, `input`, `load`, `runtime`, `cores`, `storage`, `media`, `pwa`, `ci`.

### PlayStation con PCSX-ReARMed y discos bajo demanda

- PlayStation jugable con PCSX-ReARMed `7b0e8f8` en WebAssembly y su BIOS HLE: nunca se busca la BIOS de Sony (ADR-015, expediente CORE-LEGAL-01 `accepted (uso privado)`, GPL-2.0-or-later).
- Los discos no se copian a memoria: el núcleo lee por la VFS de libretro solo los sectores que necesita, desde los archivos que abre el jugador (`FileReaderSync` en el Worker). Su identidad son resúmenes WebCrypto por bloques de 16 MiB.
- Se pueden abrir o arrastrar varios archivos a la vez: un `.cue` arranca con sus pistas `.bin`; también `.iso`, `.bin` de una pista y `.exe`. Un `.bin` suelto de hasta 10 MiB sigue siendo de Mega Drive.
- Imagen fija de 640×480 a 4:3 para todos los modos; cadencia del juego (PAL 50 Hz); tarjeta de memoria 1 guardada como la batería de un cartucho; Partidas de unos 4,4 MB.
- Nuevas acciones L2/R2 (gatillos del mando estándar, Y y P en el teclado), con migración de perfiles guardados. Cruz/Círculo/Cuadrado/Triángulo y L1/R1 se nombran en Controles.
- Demo: un PS-EXE original que la BIOS HLE arranca como un disco de un archivo.
- Límites: los discos aún no se recuerdan en la biblioteca; sin CHD, `.pbp`, multidisco ni mando analógico. N64 queda aplazado: necesita WebGL2 o hilos.

### Perfiles de jugador

- «¿Quién juega?» al abrir Cartivo: varios perfiles en el mismo dispositivo, cada uno con sus Partidas, su batería o tarjeta de memoria, sus juegos recordados y sus controles (ADR-016). Sin contraseña; crear, renombrar y borrar (con sus datos) desde «Gestionar perfiles». El primer perfil conserva todo lo guardado antes, sin migrar nada.
- Las copias de los juegos se comparten entre perfiles: quitar un juego solo borra la copia si ningún otro perfil lo recuerda.
- En Controles, la asignación guardada de un mando ya no se llama «perfil».
- Documentación: retirados la investigación preliminar de núcleos NES (H0) y el informe puntual de rendimiento de carga, ya completados; el plan técnico solo lista lo pendiente.
- Selector de perfiles rediseñado: fichas con avatar de iniciales y color, empieza en quien jugó por última vez, «Añadir perfil» como ficha, edición de nombre y color y borrado con confirmación dentro de la propia ficha; chip de perfil con avatar en la cabecera.
- Mando: al salir de un juego, el foco vuelve al control que lo inició; mientras se juega, el mando solo recorre el reproductor.
- PlayStation: un `.cue` abierto sin sus pistas ya no falla al arrancar; la tarjeta indica qué pistas faltan y permite elegirlas. Se aceptan una pista renombrada y hojas guardadas con BOM. Nueva imagen de CD de prueba original (ISO 9660 + `.cue`).

### Preparado para los siguientes incrementos

- El plan técnico (revisión 8) convierte lo pendiente en una cola para agentes: cada entrada indica por dónde empezar, cuándo está terminada y qué queda fuera. La QA del titular va aparte. El siguiente paso es recordar discos de PlayStation en la biblioteca, y después el vídeo WebGL2 que necesitan N64, PSP y PS2.
- `docs/ai/CONTEXT.md` añade «Recetas» (patrones ya resueltos: datos por perfil, sistemas de disco, foco con `data-launch` y `data-pad-scope`, botones nuevos, fixtures) y «Trampas conocidas» (Prettier 3.6 frente a uno global, entorno sin `node_modules`, `FileList`, opciones de Playwright, builds de núcleo).

### N64 en laboratorio (experimental, sin integrar)

- `experiments/n64` arranca una sesión real: Mupen64Plus-Next con GLideN64 dibuja por WebGL2 en un Worker. No usa hilos (libco sobre fibers/Asyncify) ni lee el framebuffer en cada fotograma.
- Demo original de 1 MiB sin código de Nintendo: dibuja con el RDP y lee el mando por el PIF. Comprobada en Chromium headless: 60 Hz, oráculo de colores y botones.
- Receta de build local `build-core.mjs` con un parche mínimo documentado e inventario de licencias en `docs/research/N64_CORE_GATE.md`.
- Sesión 3: audio, con una onda propia de 500 Hz en la demo que el oráculo mide a 500,09 Hz, y una cola de Web Audio acotada. Una pérdida del contexto WebGL detiene la sesión con aviso. Primeras medidas: unos 6 ms por fotograma en SwiftShader y 256 MiB de memoria, tras evitar la reserva de 512 MiB del núcleo. Se confirma que Emscripten 6.0.12 necesita su LLVM 24.
- Sesión 4:
  - estados explícitos, pausa y segundo plano;
  - ritmo de emulación guiado por la cola de audio (1,00× con la demo, sin descartes);
  - métricas de fase 3 (velocidad, percentiles, arranque, underruns);
  - un registro copiable para diagnosticar la pantalla negra que vio el titular con el build fijado en su equipo.
- N64 sigue sin estar disponible en la app. Quedan pendientes el gate y la medición con juegos reales.


### Inicio más limpio y con movimiento

- Cada consola tiene una insignia propia de la marca Cartivo (marco turquesa a coral, sello «C» y una silueta genérica de hardware, sin logotipos de terceros) en lugar del campo de píxeles.
- La tarjeta entera es «Jugar»: sin botón azul ni «Probar demo». Los formatos pasan a chips compactos; al pasar el ratón o enfocar, la tarjeta se eleva y despliega «Jugar». Un archivo soltado sobre una tarjeta se abre con esa consola («Suelta para jugar»).
- Las demos originales solo se abren con la entrada oculta `#demo/<consola>`, que usan las pruebas.
- El chip del perfil tiene aire alrededor del avatar y del nombre.
- Entradas de vista y de tarjetas y fichas escalonadas, respuesta al pulsar y realce al arrastrar. Todo se desactiva con «reducir movimiento».
- Repaso de diseño: el acento de cada tarjeta indica el soporte (coral cartucho de sobremesa, oro portátil, violeta disco); el inicio pierde el lema en mayúsculas y las etiquetas van en minúsculas normales; la entrada escalonada de las tarjetas ocurre una sola vez por visita.
- Segunda ronda tras la QA del titular: el inicio va directo a las consolas, sin título visible. Sin icono de controles en cada tarjeta (están en Ajustes). Al pasar el ratón solo se ilumina el botón de reproducción. Se ven todos los formatos (sin «+N»). Un clic en cualquier punto de la tarjeta abre el selector: antes solo respondía el botón, porque el hundimiento al pulsar encogía la zona de clic.
- «Continuar» y los recientes forman una franja compacta en el acento de su consola. «Ver todos tus juegos» es una estantería de cartuchos con el número de juegos que se abre en abanico.
- `systems.ts` declara `handheld`. El acento por soporte (`accent.ts`) ya no depende de identificadores de consola en la UI.

### Sticks analógicos y núcleo N64 en CI

- **Sticks analógicos:**
  - el mando estándar envía sus dos sticks, normalizados y con zona muerta radial;
  - en PS1 el mando es un DualShock: digital como antes hasta que el juego lo pasa a analógico o se pulsa L1+R1+Select;
  - el stick izquierdo sigue moviendo la cruceta.
- **N64:**
  - Mupen64Plus-Next se compila en CI (`cores/mupen64plus-next`) y CORE-LEGAL-01 queda aceptado para uso privado. El build con emsdk 6.0.12 coincidía con el del titular, pero se cuelga en el primer fotograma, así que el núcleo fija emsdk 4.0.10, el que arranca la demo; la causa sigue en investigación;
  - el laboratorio usa ese núcleo, sin compilar nada en local;
  - la app aún no ofrece N64.
