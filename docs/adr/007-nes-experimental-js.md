# ADR-007 — Primera ruta NES real con JSNES y NROM

Estado: aceptado para el incremento **experimental**, 2026-10-31. No cierra H0-WASM ni H1 estable. Responsable técnico: implementación de Cartivo; licencia original del producto sin cambios.

## Contexto y decisión

La investigación existente prioriza TetaNES y propone JSNES como comparador. TetaNES requiere una toolchain Rust/WASM que no está instalada en este entorno; no se ha compilado ni descartado su núcleo. No repetimos la matriz de candidatos ni convertimos su demo upstream en evidencia de Cartivo.

Se acepta **JSNES 2.1.0, commit cbad9f1db57dfb275b90ffa26f9c479c355d8d5c**, como primer adaptador experimental: fuentes JavaScript originales del paquete, sin dependencias runtime, sin UI Browser de upstream y sin parches. `cores/jsnes/manifest.json` fija procedencia y hashes; `tools/verify-jsnes.mjs` coteja 51 archivos contra el árbol upstream antes del build. Licencia Apache-2.0 y avisos conservados; no se aplica PolyForm al núcleo.

**Desviación explícita:** esta ruta es JavaScript en Worker, no WebAssembly. La build reproducible de TetaNES y la comparación de fidelidad/rendimiento siguen pendientes. Es una implementación real de los contratos de entrada/medios/guardado, no prueba de que WASM esté resuelto. No se incorpora el binario binjnes explorado anteriormente. La posibilidad de cambiar adaptador se mantiene sin exponer APIs JSNES a la interfaz.

## Límites verificables

Admitir solamente iNES NTSC, mapper 0 (NROM), PRG 16/32 KB, CHR 0/8 KB y SRAM 8 KB. Rechazar NES 2.0, PAL, trainer, VS, FDS, extensiones y otros mappers aunque JSNES pueda implementarlos. Ninguna BIOS ni ROM de terceros. Fixture original ensamblada desde TypeScript, con hash/licencia/oráculo propios.

Worker con protocolo v1, IDs de sesión/petición, validación, una petición activa, cola de comandos, cancelación por terminación y timeout de 10 s. El host regula lotes de 1–3 frames a 60 pasos/s; pausas largas no aceleran el juego para recuperar tiempo. No es un benchmark ni una garantía de timing exacto NTSC. Render 256×240 RGBA, presentación 4:3; AudioWorklet mono a 48 kHz con cola acotada de 250 ms. Sin threads, SIMD, WebGPU, estados rápidos ni rewind.

La UI conserva la sesión al abrir Controles, pero pausa y neutraliza la entrada. Reanudar aplica el teclado actual y el perfil de mando confirmado en esa pestaña. Los botones deben liberarse antes de aceptar input. La misma identidad de índice no basta para recuperar automáticamente un mando distinto. Las asignaciones manuales persistidas siguen exigiendo aplicación explícita tras recarga/reconexión.

## Guardado y excepción acotada a ADR-003

Para SRAM NROM de 8 KB, guardar directamente **dos generaciones en una sola transacción IndexedDB**, con SHA-256 y Web Lock exclusivo por hash de ROM. OPFS no aporta ventajas a estos bloques pequeños y añadiría un commit entre almacenes. Esta decisión no habilita imágenes grandes ni cambia el plan OPFS para otros formatos.

Commit cada 120 frames emulados y al pausar/cerrar explícitamente; confirmar solo `transaction.oncomplete`. No depender de unload. Validar generación actual y recuperar anterior si se corrompe; si ninguna sirve, bloquear carga sin sobrescribir. Copias JSON versionadas con identidad de juego, longitud y checksum, exportables desde SRAM en memoria incluso si falla el commit local. Importar reinicia con el progreso de esa copia. Un fallo no borra generaciones existentes; cerrar descartando cambios requiere una acción explícita del usuario.

El acceso a `cpu.mem[$6000..$7fff]` es ABI privada de JSNES fijada por commit, contenida en el adaptador y probada con SRAM real. No se confunde con `toJSON()` ni con save states. El navegador puede eliminar datos; exportar copias sigue siendo necesario. Un cierre forzoso puede perder los últimos frames aún no confirmados.

## Evidencia y promoción

[Expediente de núcleo y pruebas](../compatibility/H1-B-NES.md). La fixture demuestra CPU/PPU/entrada/APU y escritura/recuperación SRAM. E2E ejecuta Worker real, AudioWorklet y almacenamiento en Chromium, tanto en dev como en el build estático. Gamepad sintético etiquetado como tal; escucha física, mandos reales en juego, Firefox/Safari, cuotas reales, suspensión móvil, 100 ciclos, presupuestos y catálogo de regresión ampliado siguen pendientes. No anunciar H1 completo ni compatibilidad general NES.

## Revisión: cartuchos iNES comunes y WASD

Se amplía el gate experimental a mappers 1 (MMC1), 2 (UxROM), 3 (CNROM) y 4 (MMC3), ya incluidos sin parches en las mismas fuentes verificadas de JSNES. Topes PRG/CHR en KB por mapper: 0=32/8, 1=256/128, 2=256/8, 3=32/256, 4=512/256. Se mantienen iNES NTSC sin trainer, NES2, VS, extensiones ni SRAM superior a 8 KB. No se habilitan variantes de RAM bancaria o boards mayores.

Pruebas originales derivadas de la demo, generadas en memoria, verifican arranque, imagen, input y SRAM/restauración en los cuatro mappers; un E2E carga un archivo MMC1 de más de 40 KB. Son pruebas de integración inicial: no validan cambios de banco exhaustivos, IRQ MMC3 ni compatibilidad de títulos comerciales. No cambian licencia, dependencia ni toolchain; el manifiesto actualiza la lista admitida.

WASD actúa como alias de movimiento junto a las flechas predeterminadas. Las asignaciones primarias del usuario tienen prioridad; al remapear una dirección su alias deja de aplicarse. Se comparten las mismas reglas entre Controles y el reproductor.

## Revisión 2026-11-02: confirmación en segundo plano

El commit periódico de cada 120 frames ya no se espera dentro de `advance`. `BackgroundCommit` (`packages/storage/src/background-commit.ts`) lo lanza sin bloquear y entrega el resultado (`saved` o `saveError`) con un frame posterior.
- **Motivo:** una escritura lenta de IndexedDB (más de unos 200 ms) retenía el frame y el reproductor pausaba con «La ejecución se ha retrasado». Se vio una vez en CI con Firefox.
- **Lo que no cambia:**
  - los bytes se toman de forma síncrona al lanzar el commit;
  - nunca hay dos escrituras a la vez;
  - `SramStore.commit` sigue confirmando solo con `oncomplete` y con dos generaciones.
- **Órdenes que esperan:** pausa, Partidas, reinicio, importar, exportar y cualquier otra orden de la sesión esperan (`settle`) a la escritura en curso antes de leer, escribir o sustituir el núcleo.
- **Si un commit falla:** se informa y se reintenta, y el reproductor pausa con el error, como antes.
