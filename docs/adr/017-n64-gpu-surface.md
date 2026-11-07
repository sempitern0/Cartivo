# ADR-017 — Nintendo 64 con Mupen64Plus-Next y superficie WebGL2 en el Worker

Estado: aceptado (experimental). Fecha: 2026-11-07.

## Contexto

ADR-015 aplazó N64 porque Cartivo solo admitía núcleos que devuelven RGBA dibujado por CPU. El único RDP por software disponible necesitaba hilos con COOP/COEP; Mupen64Plus-Next siempre usa GLideN64, que dibuja con OpenGL.

El laboratorio (`experiments/n64`, [N64_PLAN_INTEGRACION](../research/N64_PLAN_INTEGRACION.md)) demostró el otro camino:
- Mupen64Plus-Next `15bada8` compilado con Emscripten 4.0.10 por la CI;
- GLideN64 dibuja con WebGL2 sobre un `OffscreenCanvas` dentro de un Worker;
- libco funciona sobre fibras de Emscripten con Asyncify, sin hilos;
- gate legal: [N64_CORE_GATE](../research/N64_CORE_GATE.md), **accepted (uso privado)**.

La QA del titular (2026-11-07, Brave en Windows, GPU real) jugó *Super Mario 64* con mando y teclado: velocidad 0,99× y 4,7 ms por fotograma. El titular decidió llevarlo a la app.

## Decisión

**1. Un tercer tipo de módulo: `SurfaceModule`** (`packages/adapters/src/contract.ts`).
- Es ortogonal a cartucho y disco: hoy, un cartucho cuyo núcleo dibuja con la GPU.
- `create(rom, canvas, save)` es asíncrono, porque cada juego es una instancia de Emscripten.
- `advance()` devuelve audio y contador, sin `pixels`. `Frame.pixels` pasa a ser opcional y solo lo omiten estos núcleos.
- `lastFrame()` devuelve vacío: por ahora no hay miniaturas para Partidas ni para «Continuar».

**2. El lienzo se transfiere una vez, al cargar.**
- `SystemInfo.surface = "webgl2"` le dice a la UI que el juego dibuja en su propio lienzo.
- `Player.svelte` transfiere el `<canvas>` de `GameStage` (`transferControlToOffscreen`) en la petición `load`. El cliente acepta objetos transferibles y el protocolo exige el lienzo exactamente en los sistemas `surface`, y lo rechaza en los demás.
- Después la página no vuelve a tocar sus píxeles. El tamaño en pantalla sigue siendo CSS, el mismo de `displayLayout`.
- El navegador presenta cada fotograma al terminar la tarea del Worker.
- Requisitos comprobados antes de descargar nada (`apps/web/src/surface.ts`): `transferControlToOffscreen` y `WebGL2RenderingContext`. Si el contexto no se crea dentro del Worker, el núcleo lo explica con un mensaje.
- Un lienzo tiene un solo juego: crear otro núcleo libera antes los objetos GL del anterior (reinicio, importar copia, cargar con batería).

**3. Adaptador `packages/adapters/src/n64.ts`.**
- El glue `.mjs` y el `.wasm` son assets de la build: el wasm se compila una vez por Worker y se instancia por juego (`instantiateWasm`).
- Audio: 44,1 kHz estéreo a 48 kHz mono, por interpolación lineal con fase continua (`Downmix`).
- Entrada: `libretroInputBits` con el `alt-map` del núcleo, en el que cada botón N64 tiene su bit (C incluidos). Así el teclado juega sin stick derecho. Los sticks llegan por `analog()` (ADR-006); el stick derecho también pulsa los C.
- `SystemInfo.analogStick` evita que el stick izquierdo del mando se lea además como cruceta.

**4. Guardado.**
- **Batería:** el bloque del núcleo de 296 960 bytes (EEPROM, cuatro controller paks, SRAM y FlashRAM), en el formato `cartivo-n64-sram-v1`. Se escribe tras `n64_load`, que lo formatea. El límite de archivo de copia sube a 2 MiB.
- **Partidas:** el estado propio del núcleo (≈ 16 MiB) comprimido con zlib en `frontend.c`, ligado a núcleo y versión como en ADR-009. La demo ocupa 75 KB; un juego real cabe bajo `MAX_STATE_BYTES` (8 MiB) si comprime lo suficiente, y si no la Partida se rechaza con un mensaje.
- Las funciones que cambian de fibra devuelven sus resultados por getters, porque Asyncify pierde el valor de retorno.

## Alternativas descartadas

- **Hilos con COOP/COEP y un RDP por software:** obliga a aislar toda la app y pide más CPU de la que hay en muchos equipos.
- **Leer los fotogramas de la GPU y enviarlos como RGBA:** `readPixels` y una copia por fotograma, cuando el navegador ya puede presentar el lienzo.
- **`create` síncrono con una instancia reutilizada:** el núcleo no garantiza volver a cargar un juego en el mismo proceso, y el factory de Emscripten es asíncrono.
- **Subir `MAX_STATE_BYTES` para estados sin comprimir:** multiplicaría por cuatro el espacio de cada ranura.

## Consecuencias

- La PWA crece unos 3,4 MB (glue y wasm), que se descargan al abrir el primer juego de N64 y se precachean como los demás núcleos.
- El navegador necesita WebGL2 en Workers. Está demostrado en Chromium (QA del titular y E2E). En la CI headless, Firefox y WebKit no lo ofrecen: muestran el mensaje y su E2E se salta.
- Memoria: 256 MiB por instancia. Al cargar con batería existen dos instancias un momento.
- **Límites:**
  - sin miniaturas de Partidas;
  - Transfer Pak, Rumble Pak y 64DD no están;
  - resolución fija de 640×480, sin mejoras;
  - underruns ocasionales de audio cuando el Worker da tirones;
  - compatibilidad solo con lo que ha probado el titular.
- **Pendiente:** el cuelgue con emsdk 6.0.12 ([N64_CORE_GATE](../research/N64_CORE_GATE.md#emscripten-6012-se-cuelga-investigación-abierta)) y QA con más juegos y equipos.
