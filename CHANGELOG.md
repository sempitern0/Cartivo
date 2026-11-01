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
