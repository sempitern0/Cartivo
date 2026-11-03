# Cartivo

PWA para jugar consolas retro en el navegador: **elige consola, abre tu juego y juega**. Todo ocurre en tu dispositivo: sin BIOS propietarias, sin ROMs incluidas y sin servidor de juego.

## Estado

| | |
|---|---|
| **Consolas** | NES · Game Boy · Game Boy Color · Game Boy Advance · SNES · Master System · Mega Drive (todas **experimentales**, cartuchos NTSC) |
| **Núcleos** | TetaNES 0.17.0 (NES; JSNES 2.1.0 como alternativa) · SameBoy 1.0.4 (GB/GBC) · mGBA 0.10.5 (GBA, BIOS HLE) · Snes9x 1.63 (SNES) · Genesis Plus GX (Master System y Mega Drive). Todos en WebAssembly y sin BIOS propietarias |
| **App** | PWA instalable con todos los núcleos; funciona sin conexión y cada actualización solo descarga lo que cambia |
| **Controles** | Teclado y mando (Gamepad API) con remapeo; cada consola usa sus botones y nombres (mando de seis botones en Mega Drive) |
| **Partidas** | 3 ranuras + «Al salir» en cualquier juego, F5/F9, exportar e importar cada ranura; la memoria de batería del cartucho se guarda sola sin frenar la imagen |
| **Biblioteca** | «Continuar» y «Tus juegos»: con tu permiso, la copia del juego se guarda en el navegador |
| **Calidad** | CI con pruebas unitarias, conformidad de núcleos y E2E en Chromium, Firefox y WebKit (dev y build de producción) |
| **Pendiente** | QA física (mando real, móviles Android, audio), UI navegable con mando y consolas 3D (N64, PS1, PSP); Safari/iOS con prioridad baja |

Catálogo previsto (V1): NES, SNES, GB, GBC, GBA, Master System, Mega Drive, N64, PS1 y PSP; PS2 como laboratorio. Cada sistema entra solo cuando su núcleo supera el gate técnico y de licencia. Qué está hecho y qué falta, en orden: [plan técnico](docs/PLAN_TECNICO_CARTIVO.md).

## Empezar

Requisitos: **Node.js 24.22.1** (ver `.node-version`) y **pnpm 11.25.0**. No hace falta Rust ni Emscripten: los núcleos WASM ya vienen compilados en el repositorio.

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

Los WASM de TetaNES, SameBoy, mGBA, Snes9x y Genesis Plus GX están versionados en `cores/*/dist`: la CI normal no compila Rust ni C, solo comprueba hashes y licencias con `verify:core`. Se regeneran **una vez por cambio deliberado** del núcleo con `.github/workflows/core-tetanes.yml`, `core-sameboy.yml`, `core-mgba.yml`, `core-snes9x.yml` o `core-genesis-plus-gx.yml` (manuales; ver [ADR-008](docs/adr/008-nes-tetanes-wasm.md), [ADR-010](docs/adr/010-gb-sameboy.md), [ADR-011](docs/adr/011-gba-mgba.md), [ADR-013](docs/adr/013-snes-snes9x.md) y [ADR-014](docs/adr/014-sms-md-genesis-plus-gx.md)). La CI omite los cambios que solo tocan documentación.

## Jugar

- **Jugar** en la tarjeta de una consola abre sus juegos (`.nes`, `.gb`, `.gbc`, `.gba`, `.sfc`/`.smc`, `.sms`, `.md`/`.gen`/`.bin`); también puedes arrastrarlo a la ventana o, con la app instalada, usar «Abrir con → Cartivo». **Probar demo** arranca una ROM de prueba original.
- Teclado: **WASD/flechas** cruceta · **L** = A · **K** = B · **U** = X · **J** = Y · **I** = L · **O** = R · **Q** = Select · **Enter** = Start · **Escape** pausa · **F** modo Focus. En Mega Drive, A/B/C están en J/K/L y X/Y/Z en I/U/O; en Master System, 1/2 en K/L. La ayuda de cada demo y la pantalla de Controles lo indican.
- Mando: se detecta solo; ajustes en **Ajustes → Configurar controles**.
- En partida: **Gráficos** (escalado, proporción, suavizado), **Partidas** (guardar, cargar, exportar e importar ranuras), **Cargar ROM** (guarda y cambia de juego) y **Salir**.
- **F5** guarda rápido y **F9** carga rápido. Al salir se guarda solo, y al volver a abrir el juego puedes **Continuar donde lo dejaste**.
- La primera vez que abres un juego, Cartivo pregunta si quieres **recordar tus juegos en este dispositivo**. Si aceptas, la tarjeta **Continuar** del inicio reanuda el último juego con un clic, sin volver a elegir el archivo, y **Tus juegos** lista los demás. La copia se guarda solo en tu navegador; quitar un juego de la lista conserva sus partidas ([ADR-012](docs/adr/012-library-continue.md)).
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
