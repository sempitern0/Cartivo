# Primer incremento H1-A — base de sesión

**Estado actual:** ya existe una ruta NES NROM experimental con audio y SRAM; ver [H1-B NES](H1-B-NES.md). Las notas sin núcleo de abajo describen incrementos anteriores.

Estado: shell y controlador síncrono de diagnóstico implementados. H1-A completo y H0-NES siguen pendientes. No hay emulador, audio, guardados, PWA instalable ni offline todavía. La segunda iteración incorpora Worker de diagnóstico.

## Cómo probar

Requisitos: Node 24.22.1, pnpm 11.25.0. Ejecutar desde la raíz:

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm lint
pnpm build
pnpm dev
```

Abrir http://127.0.0.1:5173.

1. Verificar que NES figura pendiente y Jugar está deshabilitado.
2. En diagnóstico, Iniciar → Pausar → Reanudar → Detener. Comprobar estados y botones habilitados.
3. Nueva sesión devuelve idle y permite volver a iniciar.
4. Recorrer con Tab/Shift+Tab y activar botones con Enter/Espacio; el foco debe ser visible.
5. Reducir ventana a 360 px: tarjetas apiladas y controles accesibles sin scroll horizontal.
6. Recargar: sesión vuelve a idle; no se promete persistencia.

## Evidencia automatizada local

Node 24.22.1; pnpm 11.25.0; Svelte 5.57.3; Vite 8.3.5; TypeScript 5.9.3; svelte-check 4.7.7. TypeScript 7 fue descartado tras incompatibilidad observada con la API del comprobador inicial.

Pruebas de ciclo completo, mensajes de sesión obsoleta, payloads inválidos, transiciones rechazadas y dispose idempotente. El script lint verifica formato del runtime y sus pruebas; no es un analizador semántico global. CI reproduce comprobación de tipos, pruebas, formato y build.

Pendiente: prueba visual en navegador, E2E, hardware y ejecución de CI remota. No hay evidencia de gamepad real ni instalación PWA.

## H0-NES: investigación inicial

binjnes documenta compilación WASM y battery saves en https://github.com/binji/binjnes/blob/main/README.md y licencia MIT en https://github.com/binji/binjnes/blob/main/LICENSE (consultados 2026-10-30). Es candidato, no núcleo aceptado. Las referencias son mutables; fijar commit, auditar submódulos y compilar antes de aceptación. Emscripten no estaba instalado en este entorno; no se ha realizado build del núcleo.

Prioridad provisional histórica: binjnes. Tras integrar main el 31-10-2026, se sigue el orden TetaNES/JSNES de docs/research/H0_NES_CORE_CANDIDATES.md; ninguno está aceptado. El Worker con timeout/cancelación ya está implementado. La continuación y los resultados actuales están en [H1-B entrada](H1-B-INPUT.md). No cerrar H1 jugable hasta probar importar → jugar → guardar → cerrar → reabrir.

## Segunda iteración: Worker y diseño minimalista

El controlador ya se ejecuta en un Worker de módulo. El cliente correlaciona sesión y petición, rechaza concurrencia, cancela/termina, aplica timeout y limpia listeners. No ejecuta emulación. Se añade test de navegador Chromium que abre el laboratorio, recorre el ciclo real del Worker y comprueba ausencia de errores y desbordamiento a 360 px.

Arranque Windows: `npm.cmd install -g pnpm@11.25.0`, después `pnpm.cmd install --frozen-lockfile` y `pnpm.cmd dev` con Node 24.22.1.

Validar manualmente: laboratorio cerrado al entrar; una acción principal; foco visible al pulsar Tab; abrir laboratorio y recorrer Iniciar prueba → Pausar → Reanudar → Finalizar → Nueva sesión. Tras crear otra sesión no deben aparecer estados de la anterior. La paleta y reglas están en docs/DESIGN.md.

Pruebas: `pnpm test`, `pnpm check`, `pnpm lint`, `pnpm build`; para navegador, `pnpm exec playwright install chromium` y `pnpm test:e2e`. Gamepads y Safari/Firefox reales siguen pendientes.

Resultado local de segunda iteración: 8 tests unitarios aprobados y tipos sin errores. La descarga de Chromium devolvió archivos truncados; E2E y revisión visual quedan pendientes, no se declaran aprobados.

## Actualización tras integrar main

El primer incremento de [entrada H1-B](H1-B-INPUT.md) añade prueba de teclado/mando y remapeo. La limitación anterior de E2E local se resolvió con un Chromium temporal: cinco E2E aprobados y captura móvil revisada. El mando físico y la emulación continúan pendientes.
