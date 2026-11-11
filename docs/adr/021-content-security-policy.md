# ADR-021 — Content Security Policy e instalación verificada

Estado: **aceptado**. Fecha: 2026-11-11. Surge de la revisión de seguridad del PR de PS1 multidisco y PS2; el titular pidió mejorar la seguridad de la app.

## Contexto

Cartivo promete que los archivos, las partidas y las rutas del jugador se quedan en su dispositivo (AGENTS.md). Hasta ahora esa promesa dependía solo de que ningún código de la app, de sus dependencias o de un núcleo hiciera una petición a otro sitio: el navegador no lo impedía.

Dos hechos, comprobados en el repositorio, permiten cerrarlo sin coste funcional:
- **Todo es del mismo origen** (ADR-020): la app no carga ni contacta nada externo.
- **Nada usa `eval` ni `new Function`:** ni la app, ni los paquetes, ni el código JS de los núcleos (`cores/tetanes/dist/tetanes.js`, `cores/play/dist/play.js`). No hay scripts en línea en `index.html`.

Además, el service worker instalaba lo que descargaba sin comprobarlo, aunque ya conocía el SHA-256 de cada archivo de la build.

## Decisión

1. **Content Security Policy** en todo lo que sirve la app construida. Se define una vez, en `CONTENT_SECURITY_POLICY` (`tools/pwa-plugin.mjs`):

   | Directiva | Valor | Motivo |
   | --- | --- | --- |
   | `default-src` | `'self'` | Nada de otro origen |
   | `script-src` | `'self' 'wasm-unsafe-eval'` | Compilar WebAssembly (todos los núcleos y el JIT de Play!), sin `eval` ni scripts en línea o remotos |
   | `style-src` | `'self' 'unsafe-inline'` | Las transiciones de Svelte y Bits UI ponen estilos en línea |
   | `img-src` | `'self' data: blob:` | Previsualizaciones propias y glifos del CSS |
   | `media-src` | `'self' blob:` | Sonido propio |
   | `connect-src` | `'self' blob:` | **Ninguna petición sale del origen** |
   | `worker-src` | `'self'` | Worker del emulador, worklet de audio, service worker y pthreads |
   | `object-src` | `'none'` | Sin plugins |
   | `base-uri`, `form-action` | `'self'` | Sin redirecciones de base ni envíos fuera |
   | `frame-ancestors` | `'none'` | La app no se incrusta en otra página |

2. **Como cabecera, no como `<meta>`:** un worker toma su política de su propia respuesta, y es en el Worker del emulador donde están las ROM y las partidas. La envían el servidor de preview (`securityHeaders`) y el service worker, junto a COOP/COEP (`SECURITY_HEADERS`). El hosting de producción debe enviarla también.
3. **El servidor de desarrollo no la aplica** (solo aísla): el cliente de Vite (socket de HMR, módulos inyectados) no está escrito para esta política. La CI la prueba en preview, que es lo que se publica.
4. **Instalación verificada:** el service worker comprueba el SHA-256 de cada archivo que descarga contra el de la build.
   - Si no coincide, lo pide otra vez saltándose la caché HTTP (el caso típico: una copia vieja).
   - Si sigue sin coincidir, la instalación falla y la versión anterior sigue sirviendo la app.
   - Las copias reutilizadas de la versión anterior ya se comprobaron al instalarse.

## Alternativas descartadas

- **`<meta http-equiv>` en `index.html`:** no cubre a los workers ni admite `frame-ancestors`.
- **`'unsafe-eval'` por compatibilidad:** permitiría justo lo que la política quiere impedir. El coste es exigir navegadores que entiendan `'wasm-unsafe-eval'` (Chrome 97, Firefox 102, Safari 16).
- **Nonces o hashes para los estilos:** Svelte y Bits UI generan estilos en línea en tiempo de ejecución; no hay punto donde firmarlos. Los estilos no ejecutan código, y `connect-src` e `img-src` ya limitan a dónde podrían apuntar.
- **Subresource Integrity en `index.html`:** solo cubre lo que el HTML enlaza; la verificación del service worker cubre toda la build, núcleos incluidos.

## Consecuencias

- Una dependencia o un núcleo comprometidos no pueden enviar fuera los datos del jugador ni cargar código remoto: el navegador lo bloquea.
- Cualquier función futura que contacte con otro origen (logros en línea, sincronización) tendrá que ampliar `connect-src` o `img-src` en su propio ADR, a la vista de todos.
- **Hosting:** debe servir los archivos de la build sin modificarlos (sin minificación ni inyección de scripts del proveedor) o la instalación sin conexión fallará por integridad; la app seguirá funcionando en línea.
- Navegadores anteriores a los citados no podrán compilar WebAssembly con esta política. No había versiones mínimas documentadas; quedan fijadas aquí.

## Evidencia

- **Unitarias** (`tests/pwa.test.ts`): el service worker añade la política a la navegación, a copias en caché sin cabeceras y a lo que viene de la red; la política no admite `'unsafe-eval'`, comodines ni orígenes remotos; una copia vieja se vuelve a pedir y un archivo alterado hace fallar la instalación sin escribir el manifiesto.
- **E2E** (`tests/e2e/pwa.spec.ts`, preview): la respuesta trae la política, una sesión de juego completa no produce ninguna violación, y una petición a otro origen se bloquea con una violación de `connect-src`. El resto de la suite en preview corre bajo la política en los tres navegadores.
- **CI:** pendiente del run de la Foundation CI sobre este cambio.
