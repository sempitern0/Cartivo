# H1-B — primera emulación NES real

Fecha: 2026-10-31. **Experimental: iNES NTSC, mappers 0–4, con JSNES en Worker.** Sustituye como estado actual las notas históricas «sin núcleo» de H1-A/H1-B-INPUT. No es todavía la PWA instalable/offline ni la build WASM del plan.

## Expediente de distribución

| Campo | Evidencia |
|---|---|
| Núcleo | JSNES 2.1.0, JavaScript, no WASM |
| Fuente fija | https://github.com/bfirsh/jsnes/tree/cbad9f1db57dfb275b90ffa26f9c479c355d8d5c |
| SPDX | Apache-2.0; Copyright 2020 Ben Firshman |
| Integridad npm | `sha512-LUa++E5Dfs1A6ZYB5HiSOR4JrUzrZEXGLZ5Imczhu9lkg7f+94SqnLZ/MXwGa7oc02+j/xYyHR0azGQ6LCU68g==` |
| Dependencias runtime | Ninguna en package.json fijado; no dependencias transitivas runtime |
| Fuente consumida | Export ESM `src/index.js`; tree shaking de Vite. No se usa `jsnes.Browser`, dist upstream, web frontend ni ROMs upstream |
| Verificación | 51 archivos src/tipos/package/LICENSE coinciden por git blob SHA con el árbol del commit. `node tools/verify-jsnes.mjs` reproduce la comprobación local |
| Parches | Ninguno al núcleo; adaptador propio separado |
| Avisos | `apps/web/public/licenses/`, distribuidos en el build; LICENSES.md |
| Firmware | Sin BIOS externa para el único formato admitido; FDS y modos especiales rechazados |
| Toolchain | Node 24.22.1, pnpm 11.25.0, TypeScript 5.9.3, Svelte 5.57.3, Vite 8.3.5; lockfile fijado |
| Decisión | Aceptado para experimento NROM por ADR-007; no selección final de WASM ni certificación general de licencia de otros núcleos |

La investigación TetaNES/JSNES de `docs/research/` se conserva. TetaNES no se ha compilado en este entorno (sin rustc/cargo/wasm-pack); sigue pendiente su expediente por build. No se repite su investigación preliminar ni se declara rechazada esa opción por ausencia local de herramientas.

## Fixture autorizada y reproducible

`packages/fixtures/src/control-demo.ts` contiene un ensamblador mínimo y programa 6502 originales de Cartivo, bajo PolyForm Noncommercial-1.0.0 del repositorio. No copia código/binarios/arte de juegos o test ROMs externos. Se genera en memoria en el Worker, sin descarga de juegos.

- ID: `cartivo-nes-controls-sram-v1`; autoría: código original del proyecto Cartivo.
- NROM-128, iNES NTSC, CHR 8 KB, batería/SRAM 8 KB, **24 592 bytes**.
- SHA-256: `5e4c943666130bd0dba705b585bd029fc19f939a6509fc956d2ae443b09afd71`.
- Reproducción: llamar `controlDemo()` con Node 24.22.1 y su soporte TypeScript; `pnpm test` ejecuta esa generación y el núcleo real.
- Oráculo: un cuadrado blanco sobre fondo de color; cruceta cambia posición; A incrementa `$6000` una vez por pulsación y cambia fondo; B activa pulso APU. Exportar confirma el byte real escrito por la CPU. Reinstanciar/reabrir conserva el valor de SRAM, no la posición del cuadrado.
- CI: autorizado para esta fuente original. No se añade una ROM comercial ni licencia sobre material ajeno.

## Qué funciona

Elegir un archivo `.nes` local admitido o Probar demo NES → Jugar. Worker independiente; framebuffer y audio transferidos con una petición activa; AudioWorklet después del gesto de usuario. Un juego por pestaña; el mismo juego con batería exige escritor único entre pestañas.

Teclado configurado y mando standard o perfil manual confirmado en Controles. Abrir Controles, perder foco/visibilidad o desconectar mando pausa; al volver se reanuda explícitamente. El panel conserva la preferencia de esa sesión si el dispositivo sigue siendo el mismo; no aplica ciegamente perfiles persistidos al reconectar. No hay navegación completa de UI con mando aún.

Partida automática cada 120 frames y al pausar; dos generaciones verificadas, copia JSON export/import por hash del juego. Un fallo de cuota/commit produce estado sin confirmar; la exportación lee la SRAM actual sin exigir escribir en disco. No hay garantía de persistencia absoluta ni salvado en cierre forzoso.

## Evidencia ejecutada

- `node tools/verify-jsnes.mjs`: 51 archivos fijados coincidentes, sin dependencias runtime.
- `pnpm check`, `pnpm lint`, `pnpm test`, `pnpm build`: tipos/formato/build y 20 pruebas unitarias/integración del núcleo/transporte.
- 17 E2E en Chromium headless 153.0.8010.0 / Linux, ejecutados contra Vite dev y contra `pnpm preview` del build. Las pruebas nuevas cubren emulación real, SRAM/export/reapertura/importación, rechazo de archivo y de copia ajena, escritor único, recuperación de generación dañada, entrada de gamepad sintético/desconexión y remapeo de teclado aplicado al núcleo y cancelación de carga.
- Audio: muestras finitas no nulas de APU y creación de AudioWorklet en navegador; **no equivale a escucha física** ni a benchmark de underruns.
- Capturas de la demo inspeccionadas; resolución framebuffer 256×240, presentación 4:3. Pruebas previas de interfaz a 360 px se mantienen.
- No se han medido p95/p99, batería, memoria móvil, latencia física, compatibilidad de juegos comerciales o fidelidad amplia de CPU/PPU/mappers. No hay cifras de rendimiento inventadas.

## Probar en Windows

```powershell
git fetch origin
git switch feat/h1-session-foundation
git pull --ff-only
pnpm.cmd install --frozen-lockfile
pnpm.cmd dev
```

Abrir http://127.0.0.1:5173 y elegir **Probar demo NES → Jugar**.

1. Mover el cuadrado con flechas o cruceta. Por defecto X=A cambia el fondo; Z=B debe emitir un tono mientras se pulsa. Se usan las asignaciones de Controles, no los defaults del frontend JSNES.
2. Con mando USB/Bluetooth: pulsar un botón para que lo exponga el navegador, configurar si no es standard y reanudar. Verificar botones, stick/cruceta y liberación. Registrar modelo/conexión/navegador reales en GAMEPAD_BROWSER_QA; las pruebas sintéticas no sustituyen este paso.
3. Cambiar el color; Pausar juego y esperar «Partida guardada en este dispositivo». Cerrar juego, abrir demo otra vez: debe conservar el fondo. La posición no se guarda porque la propia demo solo persiste el contador.
4. En pausa, Copias de partida → Exportar. Importar esa copia en el mismo juego desde otro perfil del navegador y reanudar: debe recuperar el color. Una copia de otro hash o corrupta debe rechazarse sin alterar la partida.
5. Abrir Controles durante la partida, cambiar una tecla y volver al juego: permanece en pausa, conserva el frame; Reanudar aplica la nueva asignación. Alt-tab/desconexión deben pausar sin botones atascados.
6. Abrir la misma demo en otra pestaña: debe rechazar el segundo escritor. Cerrar la primera permite cargarla en la segunda.
7. Opcional: elegir un cartucho propio/autorizado **iNES NTSC mapper 0** (PRG 16/32 KB, CHR 0/8 KB). Otros mappers, NES2, PAL, trainers, FDS y archivos truncados se rechazan. Un `.nes` cualquiera no implica soporte.

Para probar el build servido:

```powershell
pnpm.cmd build
pnpm.cmd preview
```

Abrir http://127.0.0.1:4173. Puertos 5173 y 4173 son orígenes distintos: no comparten partidas. Usa export/import para moverlas.

## Gates que siguen abiertos

**H1 completo no está cerrado:** instalación/SW/offline, actualización protegida, WASM reproducible, QA físico del emulador con audio/mando, Firefox/Safari, suspensión móvil, tests de cuota/interrupción más amplios, 100 ciclos de resistencia y presupuestos reales. Solo NES NROM, un jugador, audio mono; sin fullscreen dedicado, touch controls ni save states. Las demás consolas siguen en planificación.

## Corrección de límite de ROM y WASD

El límite inicial de ~40 KB rechazaba cartuchos NTSC mayores antes de informar su mapper. Ahora se lee y valida la cabecera y se admiten experimentalmente mappers 0, 1, 2, 3 y 4 con los límites por board de ADR-007. Un error muestra el mapper o el tamaño declarado/real. NTSC es región/timing, no formato de cartucho. Las restricciones NROM descritas arriba corresponden al incremento anterior.

22 pruebas unitarias/integración incluyen fixtures originales derivadas en mappers 1–4; E2E adicional carga un MMC1 local de 64 KB PRG y comprueba frames reales. No son pruebas exhaustivas de banking/IRQ ni garantía de compatibilidad con una ROM concreta. No se ha recibido ni distribuido el archivo del usuario.

Movimiento predeterminado: flechas **y WASD**, disponible tanto en Controles como en la partida. Las asignaciones personalizadas prevalecen y no se sobrescriben perfiles guardados. Probar W/A/S/D por separado, soltar cada tecla y comprobar diagonales y neutralización de opuestos.

## Foco de juego y pantalla completa

Durante la ejecución, el reproductor captura las teclas de la página (incluidos Tab/espacio/flechas), mantiene el foco en el canvas y bloquea scroll por rueda. Escape pausa, neutraliza entradas y devuelve el foco a Reanudar; libera la navegación normal. Los atajos con Ctrl/Meta/Alt del navegador/SO y la pérdida de ventana no se bloquean: perder ventana/visibilidad sigue pausando. Las acciones explícitas del reproductor permanecen disponibles con ratón; el fondo de la página no captura clics de juego.

Pantalla completa incluye reproductor, acciones y avisos; salir pausa. Se detecta Fullscreen API y los rechazos se muestran junto al vídeo. El canvas conserva 4:3. Información técnica/copias queda en desplegables, estado/acciones encima del vídeo y errores en un aviso superior que se desplaza a la vista al aparecer.

Probar: jugar y pulsar Tab/Shift+Tab/espacio/flechas, girar rueda; no debe moverse el foco ni la página. Escape debe pausar y enfocar Reanudar. Entrar/salir de pantalla completa; comprobar relación 4:3 y acciones visibles. Cargar archivo inválido: el error debe aparecer antes del vídeo. La prueba automatizada de fullscreen es Chromium; otros navegadores y dispositivos físicos siguen pendientes.

## UX actual: carga directa y atajos (31-10-2026)

El selector inicial de la PWA es ahora un **escenario vacío** con «Añadir juego» y «Probar demo». Elegir archivo `.nes` o la demo monta el reproductor e inicia la emulación **sin segundo clic en «Jugar»**. El laboratorio de diagnóstico está plegado bajo **Ajustes**, junto al área de controles; la cabecera solo muestra marca y Ajustes, sin footer. Las instrucciones históricas de arriba describen incrementos anteriores.

El teclado predeterminado conserva WASD/flechas y cambia **Z → K (B)**, **X → L (A)**. Los perfiles locales de teclado con las dos asignaciones antiguas intactas se migran, respetando remapeos personalizados; F está reservado a Focus. `Escape` pausa y permite recuperar la navegación. El audio no puede bloquear la ejecución si el navegador exige otro gesto; «Activar sonido» permanece disponible cuando se necesita. La demo sigue escribiendo SRAM mediante A.

Validación requerida para cerrar este incremento: `pnpm lint`, `pnpm check`, `pnpm test`, `pnpm build` y E2E tanto dev como preview del build, más revisión visual móvil y escritorio; no sustituir pruebas de mando físico ni Firefox/Safari por Chromium sintético. La compatibilidad de núcleos, offline y otras consolas no cambia.
