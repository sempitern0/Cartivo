# Primer incremento H1-A — base de sesión

Estado: shell y controlador síncrono de diagnóstico implementados. H1-A completo y H0-NES siguen pendientes. No hay emulador, audio, guardados, Worker, PWA instalable ni offline todavía.

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

Siguiente gate: expediente y spike binjnes, fixture autorizado que escriba save data, protocolo asíncrono en Worker con timeout/cancelación y pruebas de respuestas tardías. Después: input, media y persistencia. No cerrar H1 jugable hasta probar importar → jugar → guardar → cerrar → reabrir.
