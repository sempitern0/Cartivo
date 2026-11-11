# Cartivo

PWA para jugar consolas retro en el navegador: **elige consola, abre tu juego y juega**. Todo ocurre en tu dispositivo: sin BIOS propietarias, sin ROMs incluidas y sin servidor de juego.

## Estado

| | |
|---|---|
| **Consolas** | NES · Game Boy · Game Boy Color · Game Boy Advance · SNES · Master System · Mega Drive · PlayStation · Nintendo 64 (todas **experimentales**; cartuchos NTSC, y también PAL a 50 Hz en SNES y Mega Drive; discos de PlayStation leídos bajo demanda; Nintendo 64 dibuja con WebGL2) |
| **Núcleos** | TetaNES 0.17.0 (NES; JSNES 2.1.0 como alternativa) · SameBoy 1.0.4 (GB/GBC) · mGBA 0.10.5 (GBA, BIOS HLE) · Snes9x 1.63 (SNES) · Genesis Plus GX (Master System y Mega Drive) · PCSX-ReARMed (PlayStation, BIOS HLE) · Mupen64Plus-Next con GLideN64 (Nintendo 64, WebGL2). Todos en WebAssembly y sin BIOS propietarias |
| **App** | PWA instalable con todos los núcleos; funciona sin conexión y cada actualización solo descarga lo que cambia |
| **Controles** | Teclado y mando (Gamepad API) con remapeo, también para moverse por la interfaz; cada consola usa sus botones y nombres (mando de seis botones en Mega Drive; L2/R2 y sticks en PlayStation; stick analógico y botones C en Nintendo 64) |
| **Partidas** | 3 ranuras + «Al salir» en cualquier juego, F5/F9, exportar e importar cada ranura; la memoria de batería del cartucho (o la tarjeta de memoria de PlayStation) se guarda sola sin frenar la imagen |
| **Perfiles** | «¿Quién juega?» al abrir: cada perfil tiene sus partidas, sus juegos y sus controles en el mismo dispositivo, sin contraseña ([ADR-016](docs/adr/016-player-profiles.md)) |
| **Biblioteca** | Los juegos que abres se recuerdan en el navegador: los tres últimos en el inicio y todos en «Tus juegos», con búsqueda y filtro por consola (los discos de PlayStation se copian mientras juegas, avisando si no caben) |
| **Calidad** | CI con pruebas unitarias, conformidad de núcleos y E2E en Chromium, Firefox y WebKit (dev y build de producción) |
| **Pendiente** | QA física (mando real, móviles Android, audio), despliegue público (aplazado) QA de PlayStation con discos reales y de Nintendo 64 con más juegos, PSP; Safari/iOS con prioridad baja |

Catálogo previsto (V1): NES, SNES, GB, GBC, GBA, Master System, Mega Drive, N64, PS1 y PSP; PS2 como laboratorio. Cada sistema entra solo cuando su núcleo supera el gate técnico y de licencia. Qué está hecho y qué falta, en orden: [plan técnico](docs/PLAN_TECNICO_CARTIVO.md).

## Empezar

Requisitos: **Node.js 24.22.1** (ver `.node-version`) y **pnpm 12.16.1** (fijado en `packageManager`). No hace falta Rust ni Emscripten: los núcleos WASM ya vienen compilados en el repositorio.

```sh
pnpm install --frozen-lockfile
pnpm dev                      # http://127.0.0.1:5173
```

En Windows usa `pnpm.cmd`. Si aparece `Unsupported engine`, instala Node 24.22.1 y abre una terminal nueva (`where.exe node` localiza instalaciones antiguas).

Para probar **instalación y modo sin conexión** hay que usar la build de producción (el service worker no existe en `pnpm dev`):

```sh
pnpm build && pnpm preview    # http://127.0.0.1:4173 → «Instalar app» en la cabecera
```

Usa siempre la misma dirección y puerto: partidas y app instalada quedan ligadas a ese origen.

Para publicarla en una subcarpeta del dominio (por ejemplo `https://ejemplo.com/cartivo/`), construye con `pnpm build --base /cartivo/` y sirve `apps/web/dist` en esa ruta. La base termina siempre en `/`, y la vista previa necesita la misma base que el build:

```sh
pnpm build --base /cartivo/ && pnpm preview --base /cartivo/   # http://127.0.0.1:4173/cartivo/
```

El servidor debe enviar en todas las respuestas las cabeceras de `SECURITY_HEADERS` (`tools/pwa-plugin.mjs`), y servir los archivos de la build sin modificarlos:

- `Cross-Origin-Opener-Policy: same-origin` y `Cross-Origin-Embedder-Policy: require-corp` ([ADR-020](docs/adr/020-cross-origin-isolation.md));
- la `Content-Security-Policy` de la app ([ADR-021](docs/adr/021-content-security-policy.md)).

`pnpm preview` ya las envía todas; `pnpm dev`, solo las dos primeras.

Por defecto, sin `--base`, se publica y se prueba en la raíz. Si al abrir la app la consola muestra `404` y `Manifest: Line 1, column 1, Syntax error`, el build y la vista previa tienen bases distintas: vuelve a construir sin `--base` o pasa la misma a los dos.

## Comandos

| Comando | Qué hace |
|---|---|
| `pnpm dev` | Servidor de desarrollo |
| `pnpm build` / `pnpm preview` | Build de producción con PWA / servirla en local |
| `pnpm check` | Tipos (svelte-check) |
| `pnpm lint` | Formato (Prettier) |
| `pnpm test` | Tests unitarios, incluida la conformidad de todos los núcleos WASM |
| `pnpm test:e2e` / `pnpm test:e2e:preview` | E2E Playwright en Chromium, en dev / en la build de producción |
| `pnpm test:e2e:firefox` / `pnpm test:e2e:preview:firefox` | La misma suite en Firefox |
| `pnpm test:e2e:webkit` / `pnpm test:e2e:preview:webkit` | La misma suite en WebKit (en Linux, con `xvfb-run` y `--headed`, como en la CI). En la CI, las seis tandas navegador × servidor corren en paralelo |
| `pnpm verify:core` | Integridad de todos los núcleos contra sus manifiestos, sin recompilar |

Los WASM de TetaNES, SameBoy, mGBA, Snes9x, Genesis Plus GX y PCSX-ReARMed están versionados en `cores/*/dist`: la CI normal no compila Rust ni C, solo comprueba hashes y licencias con `verify:core`. Se regeneran **una vez por cambio deliberado** del núcleo con `.github/workflows/core-tetanes.yml`, `core-sameboy.yml`, `core-mgba.yml`, `core-snes9x.yml`, `core-genesis-plus-gx.yml` o `core-pcsx-rearmed.yml` (manuales; ver [ADR-008](docs/adr/008-nes-tetanes-wasm.md), [ADR-010](docs/adr/010-gb-sameboy.md), [ADR-011](docs/adr/011-gba-mgba.md), [ADR-013](docs/adr/013-snes-snes9x.md), [ADR-014](docs/adr/014-sms-md-genesis-plus-gx.md) y [ADR-015](docs/adr/015-ps1-pcsx-rearmed-discs.md)). La CI omite los cambios que solo tocan documentación.

## Jugar

- Al abrir, elige tu perfil en «¿Quién juega?» (o crea uno); el chip de la cabecera cambia de perfil.
- **Jugar** en la tarjeta de una consola abre sus juegos (`.nes`, `.gb`, `.gbc`, `.gba`, `.sfc`/`.smc`, `.sms`, `.md`/`.gen`/`.bin`, en PlayStation `.cue` con sus pistas `.bin`, `.iso` o `.exe`: elige o arrastra todos los archivos del disco a la vez; y en Nintendo 64 `.z64`, `.n64` o `.v64`); también puedes arrastrarlo a la ventana o, con la app instalada, usar «Abrir con → Cartivo».
- Teclado: **WASD/flechas** cruceta · **L** = A · **K** = B · **U** = X · **J** = Y · **I** = L · **O** = R · **Y** = L2 · **P** = R2 · **Q** = Select · **Enter** = Start · **Escape** pausa · **F** modo Focus. En Mega Drive, A/B/C están en J/K/L y X/Y/Z en I/U/O; en Master System, 1/2 en K/L; en PlayStation, Cruz/Círculo en K/L y Cuadrado/Triángulo en J/U; en Nintendo 64, WASD/flechas mueven el stick, A/B en K/J, Z en Y, R en P, L en Q y C↑/C↓/C←/C→ en U/L/I/O. La ayuda de cada demo y la pantalla de Controles lo indican.
- Mando: se detecta solo; ajustes en **Ajustes → Configurar controles**. También maneja la interfaz: cruceta o stick mueven el foco, A pulsa, B cierra o vuelve y **Select+Start** pausa la partida. Al usarlo, Cartivo pasa al **modo consola** (leyenda de botones, consolas en carrusel y menú de pausa con Salir del juego); en **Ajustes → Interfaz** puedes fijar «Teclado y ratón» o «Mando».
- En partida: **Gráficos** (escalado, proporción, suavizado), **Partidas** (guardar, cargar, exportar e importar ranuras), **Cargar ROM** (guarda y cambia de juego) y **Salir**.
- **F5** guarda rápido y **F9** carga rápido. Al salir se guarda solo, y al volver a abrir el juego puedes **Continuar donde lo dejaste**.
- Cada juego que abres se recuerda en este dispositivo: el inicio muestra los tres últimos y **Continuar** los reanuda con un clic, sin volver a elegir el archivo. **Tus juegos** los lista todos, con búsqueda, filtro por consola y orden, y permite desactivar el recordatorio. La copia se guarda solo en tu navegador; quitar un juego de la lista conserva sus partidas ([ADR-012](docs/adr/012-library-continue.md)).
- Algunos menús usan **Select** para elegir opción; por ejemplo, «1/2 PLAYERS» en Contra.

## Estructura

```text
apps/web/          PWA (Svelte 5 + Vite): UI por componentes, Worker de emulación, AudioWorklet, service worker
packages/          adapters (contrato y registro de núcleos), runtime (sistemas, protocolo), input, media, storage, fixtures
cores/             jsnes (manifiesto), tetanes (envoltorio Rust), sameboy, mgba y genesis-plus-gx (C) y snes9x (C++); WASM generado por CI
tools/             build y verificación de núcleos (verify-core.mjs), generador del service worker
tests/             unitarios (node:test) y e2e (Playwright)
docs/              plan técnico, diseño, ADRs, compatibilidad y expedientes de núcleos (research/)
.github/           CI (verify + matriz E2E Chromium/Firefox/WebKit × dev/preview + subruta) y builds de núcleo bajo petición
```

## Documentación

- [Plan técnico](docs/PLAN_TECNICO_CARTIVO.md): qué está hecho (no reimplementar) y la lista ordenada de lo pendiente, incluido el hito futuro de cuentas online.
- [Añadir una consola](docs/ADDING_A_SYSTEM.md): checklist para integrar un sistema nuevo.
- [Diseño](docs/DESIGN.md): paleta, principios y pantallas.
- [Compatibilidad](docs/compatibility/README.md): qué está probado y cómo.
- [ADRs](docs/adr/README.md): decisiones registradas.
- [Reglas de desarrollo](AGENTS.md) y [CHANGELOG](CHANGELOG.md).

## Licencia

El código original de Cartivo usa **PolyForm Noncommercial 1.0.0** ([LICENSE](LICENSE)): uso, estudio, modificación y redistribución no comerciales; el uso comercial requiere permiso del titular. No es una licencia OSI. La LGPL-2.1 de la revisión inicial no se revoca para copias anteriores.

Los núcleos y librerías de terceros conservan sus licencias ([LICENSES.md](LICENSES.md)). Cartivo se usa de forma **privada**: se admiten núcleos con cualquier licencia libre identificada y, antes de publicarlo, habría que revisar su compatibilidad ([ADR-005](docs/adr/005-licensing.md)). No se distribuyen juegos ni BIOS.
