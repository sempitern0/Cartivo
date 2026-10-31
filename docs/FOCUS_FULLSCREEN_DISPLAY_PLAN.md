# Plan de integración — Focus, pantalla completa y escalado de vídeo (PR #2)

> **Avance 2026-10-31 (incremento en esta PR):** se han añadido `packages/media/src/display-scaler.ts`, `tests/display-scaler.test.ts`, `apps/web/src/GameStage.svelte` y la integración inicial de Focus, fullscreen y selección de escalado en `Player.svelte`, con cobertura E2E adicional. **F1 y base de F2/F3 implementadas, no validadas por ejecución local**: el entorno disponible utiliza Node 22 y no dispone de pnpm, mientras que Cartivo exige Node >=24.22.1 y pnpm 11.25.0. F0-F5 todavía tienen gates pendientes; la PR debe permanecer Draft. El menú de pausa integral, preferencias y QA físico no están terminados.

**Estado:** planificación; **no implementado todavía**. Actualizado: 2026-10-31.
**Rama de ejecución:** `feat/h1-session-foundation`, PR #2, sin PR adicional.
**Base revisada:** `Player.svelte`, `App.svelte`, `theme.css`, `docs/DESIGN.md`, `H1-B-NES.md`; head observado `9be20b74c5de80b01b1685ba5f55e97b297ec288`. Releer antes de cada incremento: la rama sigue activa.

## 1. Objetivo y límites

Conseguir que al jugar se vea **solamente la imagen**, con transición segura entre:
- **Normal:** página de consola y acciones compactas, con área de juego.
- **Focus:** superficie de juego centrada y maximizada **dentro de la ventana**, sin cabecera/footer ni controles persistentes.
- **Focus + fullscreen:** la superficie de juego ocupa el monitor mediante Fullscreen API; conservar bandas negras si son necesarias, nunca deformar por defecto.

En pausa abrir un **menú flotante pequeño** (Reanudar, Gráficos, ROM, Guardar, Controles, Salir); cerrar el menú devuelve Focus sin reiniciar el emulador. Errores críticos de guardado/carga deben permanecer visibles y accesibles incluso en Focus. El usuario debe poder salir siempre.

**No objetivos en esta iteración:** sustituir el núcleo JSNES, integrar más consolas, guardar *save states* si el núcleo no los ofrece, filtros CRT sofisticados o WebGPU, exigir Pointer Lock/Keyboard Lock, auto fullscreen sin gesto de usuario, incorporar logos oficiales/caratulas sin derechos y atribuciones verificadas. La rediseñada selección por tarjetas de consola y los assets personalizados de mandos pueden evolucionar en un bloque posterior sin bloquear este módulo. No confundir `Guardar` (SRAM real actual) con guardado instantáneo.

## 2. Diagnóstico del estado de la PR #2

| Archivo / componente | Estado observado | Cambio mínimo |
|---|---|---|
| `apps/web/src/Player.svelte` | Contiene Worker, frames/audio, entrada, pausa, save data, fullscreen, UI y CSS (más de 600 líneas) | Extraer presentación y dejar aquí orquestación; preservar API y ciclo de emulación |
| `apps/web/src/App.svelte` | Cabecera/footer y navegación de Controles; monta Player cuando hay partida | Ocultar shell al entrar en Focus; conservar instancia Player al navegar al panel de Controles |
| Canvas NES | `width=256 height=240`; `putImageData`; CSS fuerza `aspect-ratio:4/3` | Mantener framebuffer original y calcular tamaño CSS/dimensión de presentación con política explícita |
| Fullscreen actual | `requestFullscreen()` sobre player; acciones/textos siguen presentes; tamaño usa `100dvh - 240px` | Pantalla exclusiva del escenario y cálculo por contenedor medido, sin altura arbitraria |
| Input/foco actual | Captura teclado y Tab mientras corre, `Escape` pausa; `focusin` y `pointerdown` globales | Enrutar eventos según estado, sin robar foco a overlays o selector de archivo |
| `docs/DESIGN.md` / `H1-B-NES.md` | Describen fullscreen con controles visibles | Actualizar al cierre de cada cambio y conservar límites de QA |

La fuente de `fullscreen` es `document.fullscreenElement` y sus eventos; no confiar en el estado solicitado. Fullscreen requiere activación de usuario y puede fallar o salir por el navegador (Esc/Alt-Tab). Evitar prometer interceptación total de Esc o F11.

## 3. Contrato de presentación propuesto

**Separar estado visual de la emulación**:

```ts
type PresentationMode = 'normal' | 'focus';
type Overlay = 'none' | 'pause' | 'graphics' | 'load' | 'save' | 'error';
type ScaleMode = 'fit' | 'integer' | 'corrected-integer';
type AspectMode = 'native-pixels' | 'display-corrected';

interface VideoDescriptor {
  sourceWidth: number;      // NES: 256
  sourceHeight: number;     // NES: 240
  displayAspect: number;    // NES corrección elegible 4/3, no asumir en todos los núcleos
  pixelArt: boolean;
  dynamicResolution: boolean;
}
```

- `presentationMode` es preferencia de Cartivo; `fullscreenActive` es dato derivado del navegador. **Independientes**, no un único booleano.
- La sesión NES conserva estados `ready/loading/running/paused/error`, Worker, SRAM y audio existentes; los overlays se derivan/sincronizan con ellos.
- Al pasar a Focus cambiar clases, layouts y visibilidad; **no desmontar canvas/Worker ni reescribir `canvas.width/height`**.
- `normal -> focus -> fullscreen` y las rutas inversas deben funcionar con un solo jugador sin reinicio.
- No recuperar automáticamente la emulación al salir de fullscreen por causas externas. Si `fullscreenchange` indica salida inesperada, neutralizar controles y pausar; mostrar menú recuperable.
- Si falla `requestFullscreen` por permisos/navegador, continuar en Focus dentro de la ventana con mensaje claro, **sin perder sesión**.
- Un error de guardado no se oculta al activar Focus; no permitir salir silenciosamente perdiendo datos.

### Gestión de foco / teclado / gamepad

- `F` activa/desactiva Focus mientras el jugador está ejecutando el juego; no repetir con key auto-repeat. Reservar este atajo en la política de remapeo, o exponer un atajo configurable sin colisiones con P1; **no consumir `KeyF` como game input** en la ruta reservada.
- Botón dedicado de fullscreen activa `Focus + fullscreen` con gesto directo. No secuestrar `F11` ni atajos del navegador/SO.
- `Escape` durante juego: pausar, entrada neutral y abrir menú. Dentro del fullscreen puede ser consumido por el navegador antes de la app; `fullscreenchange` garantiza camino de recuperación tras salir. No exigir Keyboard Lock.
- `Start`/acción configurable del mando para menú: evaluar colisión con el botón Start emulado; preferir botón de sistema no mapeado o combinación configurable con pulsación deliberada, y fallback claro en UI. No asumir que todo mando ofrece botón Home/Menu.
- Capturar Tab/rueda/flechas/espacio **solo cuando `phase=running` y `overlay=none`**. Con menú abierto permitir Tab, Shift+Tab y accesibilidad; trap solo en diálogo modal.
- Los listeners globales `focusin` y `pointerdown` actuales no pueden redirigir al canvas al pulsar controles del menú. Los inputs de archivo deben preservar la pausa y manejar cancelación.
- `blur`, `visibilitychange` y desconexión de mando: liberar estados de botones, pausar de forma segura y mantener audio sincronizado. Al reanudar exigir liberación inicial de entradas.
- Soporte teclado y mando simultáneo; ninguna tecla reservada debe romper el perfil personalizado sin explicación.

## 4. Política de escalado (sin acoplarse al núcleo)

Separar:
1. **Framebuffer**: los píxeles lógicos del emulador (NES actual `256×240`).
2. **Aspecto de presentación (DAR)**: `native-pixels = 256/240 = 16:15`, o `display-corrected = 4:3` para esta ruta NES.
3. **Área disponible**: tamaño real del contenedor medido en píxeles CSS, restando safe areas/overlays solo cuando existan.
4. **Escala visual**: CSS/ancho y alto del canvas, sin modificar el framebuffer de emulación.

### Modos

| Modo | Algoritmo | Resultado |
|---|---|---|
| `fit` (por defecto) | `width = min(viewportWidth, viewportHeight * DAR)`; `height=width/DAR` | Máxima área sin crop ni deformación del DAR |
| `integer` | `s=floor(min(W/srcW,H/srcH))`; `size=src*s` con `s>=1` solo si cabe | Píxeles cuadrados en múltiplos CSS enteros, ratio fuente 16:15. Si no cabe 1×, usar ajuste proporcional y avisar en ajustes |
| `corrected-integer` (opcional NES) | Para DAR 4:3 con `256×240`, elegir mayores multiplicadores enteros `sx/sy=5/4` que quepan (ej. `sx=5,sy=4` -> `1280×960`); si no caben usar `fit` | Pixel-grid sin interpolación fraccionaria en CSS, corrección anamórfica 4:3. No generalizar a todos los núcleos |

Ejemplo monitor 1920×1080: `fit + 4:3 = 1440×1080`; `integer + native = 1024×960` (`4×`); `corrected-integer = 1280×960` (`5× horizontal, 4× vertical`). En monitores con DPR fraccionario, múltiplos **CSS** enteros no garantizan una rejilla uniforme de píxeles físicos: probar 125%/150% y ofrecer `fit` y fullscreen sin prometer pixel-perfect universal.

- Usar `image-rendering: pixelated` para framebuffer pixel-art; suavizado/filtros opt-in. No interpolar por accidente ni aplicar CSS `aspect-ratio:4/3` incondicional.
- `ResizeObserver` sobre el contenedor del escenario y actualización batched por `requestAnimationFrame`; evitar loops de resize y layouts que dependan circularmente de su propia anchura.
- Escuchar `fullscreenchange`, `window.resize` cuando aplique y cambios de contenedor. Cambios de resolución de consola en futuro: descriptor nuevo; **no reutilizar lógica NES para PSP/3D**.
- Mantener `canvas.width=256` y `height=240` en la ruta actual salvo que cambie la salida real del núcleo. Modificar atributos de Canvas borra el framebuffer: no hacerlo al redimensionar ventana.
- Cuando el contenedor sea menor que la fuente, `fit` reduce con respeto a DAR. No usar escalado `cover`/recorte por defecto.
- En consolas 3D, diferenciar **resolución interna del renderer** de tamaño de presentación; solo cambiar resolución interna si el adaptador publica esa capacidad.

### API pura de cálculo y tests

Crear `packages/media/src/display-scaler.ts` (o ubicación real de media existente) con tipos/funciones sin DOM para calcular `{width,height,offsetX,offsetY,actualMode}`. Testear la matemática con `tests/display-scaler.test.ts`. Sin feature flags de WASM ni reestructuración de sesión.

## 5. Estructura incremental recomendada

Mantener la **misma PR #2**, commits pequeños, sin merge hasta superar gates:

| Etapa | Alcance | Archivos previsibles | Gate verificable |
|---|---|---|---|
| **F0 — baseline** | Fijar captura reproducible del comportamiento actual (normal/fullscreen/pausa) y tests existentes; conservar regresión | `tests/e2e/nes.spec.ts`, docs | Baseline conocido y limitaciones anotadas |
| **F1 — escalador** | Módulo puro y tests: DAR nativo/corregido, `fit`, entero, fallback, DPR y tamaños pequeños | `packages/media/src/display-scaler.ts`, tests | Valores geométricos exactos, sin NaN/overflow y sin crop |
| **F2 — GameStage** | Extraer solo DOM/CSS de canvas y sizing desde `Player.svelte`; `ResizeObserver`, aspect y sin rerender del núcleo | `apps/web/src/GameStage.svelte`, `Player.svelte` | Demo NES, audio y SRAM iguales; resize sin reiniciar |
| **F3 — Focus + fullscreen** | Estados separados, estilos inmersivos, observación de fullscreen, errores y restauración segura | `GameStage.svelte`, `Player.svelte`, `App.svelte`, `theme.css` | Focus oculta shell, fullscreen llena área, salida externa pausa |
| **F4 — menú y controles** | Overlay de pausa/ajustes gráficos/ROM/guardar; atajos sin colisiones, foco accesible y control por mando cuando haya binding | `Player.svelte`, `ControlsPanel.svelte` si necesario, tests | No botones atascados; controles de menú y guardado operables |
| **F5 — preferencias y QA** | Preferencia visual por sistema/juego cuando exista identidad estable; regresiones y docs | `packages/storage` solo si hay consumidor, `docs/DESIGN.md`, `H1-B-NES.md`, tests | Build/check/lint/unit/E2E y matriz de hardware pendiente explícita |

**Dependencias:** F1 antes de F2; F2 antes de F3; F3 antes de F4. F5 al finalizar. El selector central de consolas por tarjetas/logo y la nueva pantalla visual de teclado/gamepad se implementarán en una iteración visual separable dentro de la PR cuando se disponga de assets y derechos; no mezclar con el escalador ni utilizar imágenes propietarias sin permiso.

## 6. Menú de juego: funcionalidad real vs placeholder

Cuando está corriendo: **sin UI persistente** en Focus. La vista normal puede mantener barra pequeña de Gráficos/ROM/Guardar, pero todo está también accesible en pausa. Menú flotante accesible con foco inicial en `Reanudar`, retorno de foco al canvas al cerrar, y mensajes de error a la vista.

- **Gráficos:** aspecto nativo/4:3, Ajustar/Píxel entero/4:3 entero, filtro pixelado/suavizado solo si implementado; cambios visuales inmediatos sin reiniciar emulación.
- **Cargar otra ROM:** abrir selector y **mantener sesión pausada hasta seleccionar**. En cancelación se conserva sesión; al confirmar, flush SRAM y comprobar errores antes de cambiar la instancia; prohibir pérdida silenciosa. Reutilizar flujo de `App.svelte` sin duplicar input.
- **Guardar:** botón explícito para confirmar *save data* SRAM en almacenamiento local. Si no hay batería/almacenamiento, informar; no mostrar `save state` ficticio. Exportar/importar deben seguir accesibles en pausa y nunca confundirse con autoguardado.
- **Controles:** abrir panel con pausa, entrada neutral, cambiar binding, regresar con reanudación explícita.
- **Salir:** flush y confirmación cuando el guardado está sin confirmar; liberar Worker y AudioWorklet.
- **Errores:** toast/alert accesible aun en Focus, por encima de canvas; un error crítico mantiene la pausa y puede requerir acción.

## 7. Regresión obligatoria

### Unidades (`tests/display-scaler.test.ts`)
- `256×240` -> `fit 4:3` en 1920×1080 = **1440×1080**; `fit` en 2560×1080 = 1440×1080.
- `integer` sobre `256×240` en 1920×1080 -> **1024×960**.
- `corrected-integer` en 1920×1080 -> **1280×960**.
- Ventanas 360×780, 1280×800 y 2560×1440; formato vertical, tamaño 0, contenedores muy pequeños, DPR 1/1.25/1.5/2 y nuevo descriptor dinámico.
- Alineación centrada y sin dimensiones negativas; fallback visible cuando entero no cabe.

### E2E navegador (`tests/e2e/nes.spec.ts` o archivo nuevo)
1. Home -> Demo NES -> Jugar -> Focus: header/footer/menús ocultos, pantalla visible, frames avanzan.
2. Cambiar Focus <-> normal repetidamente: **mismo canvas**, sin duplicar worker/audio, contador de frames sin reset.
3. Fullscreen desde gesto; `document.fullscreenElement` y bounding box vs viewport; fullscreen denegado no destruye sesión.
4. Esc en Focus: pausa y overlay visible, Tab navega, Reanudar devuelve entrada de juego. Esc del navegador que sale de fullscreen: `fullscreenchange` pausa sin depender del keydown.
5. F/Start reservados: no colisión con perfiles y no activación por repetición; controles de juego recuperan input y dejan de capturar al pausar.
6. Cambiar aspecto/escala y resize (incluido portrait y ventana pequeña) sin borrar imagen ni reiniciar; ausencia de barras desplazables involuntarias.
7. Con SRAM real de la fixture: modificar dato, pausar, guardar, cambiar modo, cerrar/reabrir -> dato intacto; error forzado de guardado debe quedar visible en Focus.
8. Cargar otra ROM: cancelar conserva sesión; confirmar sustituye sin perder partida previa; archivo inválido no destruye guardado ni deja Worker huérfano.
9. Volver a Controles / perder ventana / reconectar mando: entrada neutral, sin botones mantenidos, acceso al menú por teclado.
10. Estado error y `requestFullscreen` rechazado, resize en fullscreen y salida externa; asegurar mecanismos de recuperación.

**CI mínima por incremento:** `pnpm check && pnpm lint && pnpm test && pnpm build && pnpm test:e2e`; E2E con Chromium y build servida cuando sea posible. QA físico pendiente hasta ejecutarlo: Firefox/Safari, mando USB/Bluetooth real, monitores 16:9/16:10/21:9, 4K, DPI 125%/150%, móvil/PWA y accesibilidad. Los emuladores sintéticos no prueban hardware.

### Invariantes de seguridad y rendimiento

- Ningún cambio del modo visual envía ROMs/saves a red, recrea emulador o rompe el escritor único de SRAM.
- Resize **no** dispara reinstanciación de `NesClient`, `AudioWorklet` ni modificación de la memoria emulada.
- Durante partida no hay scroll accidental, robo de foco, teclas pegadas o overlays ocultos inaccesibles.
- Guardado y error de cuota se exponen sin cerrar sin confirmación.
- No atribuir resultados de rendimiento ni soporte entre navegadores sin test real.

## 8. Definición de terminado y entrega

- `normal`, `focus` y `focus+fullscreen` funcionan y se recuperan de fallo y salida externa.
- Presets de escalado producen DAR correcto; defecto es `fit` con corrección por sistema; nativo e entero disponibles.
- Todas las acciones del menú se implementan con capacidades reales o se ocultan; sin botones decorativos que no hacen nada.
- Se preserva la ruta actual de jugar, audio, input, SRAM, import/export y cierre seguro.
- Evidencia de tests local/CI, capturas desktop/móvil, y lista de pruebas físicas realmente ejecutadas vs pendientes.
- Actualizar `docs/DESIGN.md`, `docs/compatibility/H1-B-NES.md`, README/AGENTS cuando cambie comportamiento; registrar cualquier decisión arquitectónica duradera en ADR sin duplicar documentación.
- **No fusionar PR #2** antes de cumplir gates del alcance acordado; no declarar H1/PWA/offline terminados por una mejora visual.

## Fuentes de comportamiento del navegador

- [MDN — Fullscreen API](https://developer.mozilla.org/en-US/docs/Web/API/Fullscreen_API)
- [MDN — requestFullscreen](https://developer.mozilla.org/en-US/docs/Web/API/Element/requestFullscreen)
- [MDN — ResizeObserver](https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserver)
- [MDN — image-rendering](https://developer.mozilla.org/en-US/docs/Web/CSS/image-rendering)

**Instrucción de continuidad:** ejecutar F0-F5 sobre la rama abierta sin reemplazar la emulación existente ni crear otra PR. Cada commit debe declarar alcance, pruebas ejecutadas, resultados, bloqueos y siguiente paso.


## Revisión de arquitectura y corrección Focus (31-10-2026)

La incidencia real de interacción se ha aislado en los listeners globales de `Player.svelte`: el antiguo `pointerdown` usaba `preventDefault` incluso en acciones explícitas, y `focusin` forzaba el canvas. Se ha modificado para **permitir clic y foco nativos** en controles con `data-player-action`. Se añade un control flotante «Salir de Focus», visible con hover o foco de teclado, para que no dependa del atajo `F` (que Vimium u otras extensiones pueden interceptar). Se mantiene `Escape` para pausar y un botón accesible para Focus.

Se eliminaron los ocho selectores obsoletos de `App.svelte` tras retirar footer y textos. `DiagnosticLab.svelte` encapsula ahora su propio `WorkerSession`, gestión de estado, controles y limpieza; `App.svelte` limita su responsabilidad a navegación, selector y montaje del jugador. `GameStage.svelte` y `display-scaler.ts` siguen aislando layout/renderizado de la emulación y no alteran el framebuffer.

**Siguiente separación de responsabilidad (pendiente, sin alterar contratos):** convertir `Player.svelte` en coordinador del ciclo de sesión y extraer en incrementos medibles `PlayerToolbar.svelte` (UI de controles/panel), `GameInputCapture` (evento teclado/foco/mandos con scope y cleanup), `NesSessionController` (ciclo Worker/audio, protección SRAM), y `SaveManager` (import/export validado). Evitar una reescritura única de más de 600 líneas: preservar pruebas de escrituras SRAM, foco, audio y recuperación entre extracciones.

**Gates:** `pnpm lint/check/test/build`; E2E con clic real «Modo Focus» → «Salir de Focus», foco de canvas y continuidad de frames; recorrido de laboratorio tras separar componente; Firefox con Vimium habilitado/deshabilitado de forma manual. La extensión puede consumir teclas antes de Cartivo: no se promete capturar F, y el acceso con ratón es obligatorio. Mantener esta PR en Draft hasta verificar CI final, UX de pausa y controles.

