# Cartivo

PWA para jugar consolas retro en el navegador: **elige consola, abre tu juego y juega**. Todo ocurre en tu dispositivo: sin BIOS propietarias, sin ROMs incluidas y sin servidor de juego.

## Estado

| | |
|---|---|
| **Consolas** | NES (experimental): iNES NTSC, mappers 0–4 · Game Boy y Game Boy Color (experimental): sin mapper, MBC1/2/3/5 · Game Boy Advance (experimental): SRAM, Flash y EEPROM |
| **Núcleos** | NES: TetaNES 0.17.0 en WebAssembly por defecto, JSNES 2.1.0 como alternativa (Acerca de esta prueba) · GB/GBC: SameBoy 1.0.4 en WebAssembly · GBA: mGBA 0.10.5 en WebAssembly (BIOS HLE) |
| **App** | Instalable como PWA con todos los núcleos incluidos; funciona sin conexión (build de producción) y cada actualización solo descarga lo que cambia |
| **Controles** | Teclado y mando (Gamepad API) con remapeo; L/R para GBA (I/O, LB/RB) |
| **Partidas** | Guarda en cualquier juego (3 ranuras + «Al salir», continuar al reabrir, F5/F9) y conserva la memoria de batería del cartucho |
| **Pendiente** | QA con mando físico, Firefox/Safari, móviles, continuar último juego, más consolas |

Catálogo previsto (V1): NES, SNES, GB, GBC, GBA, Master System, Mega Drive, N64, PS1 y PSP; PS2 como laboratorio. Cada sistema se publica solo cuando su núcleo supera el gate técnico y de licencia. Plan completo: [docs/PLAN_TECNICO_CARTIVO.md](docs/PLAN_TECNICO_CARTIVO.md).

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

## Comandos

| Comando | Qué hace |
|---|---|
| `pnpm dev` | Servidor de desarrollo |
| `pnpm build` / `pnpm preview` | Build de producción con PWA / servirla en local |
| `pnpm check` | Tipos (svelte-check) |
| `pnpm lint` | Formato (Prettier) |
| `pnpm test` | Tests unitarios, incluida la conformidad de todos los núcleos WASM |
| `pnpm test:e2e` / `pnpm test:e2e:preview` | E2E Playwright en dev / en la build de producción |
| `pnpm verify:core` | Integridad de JSNES y TetaNES contra sus manifiestos |

Los WASM de TetaNES, SameBoy y mGBA están versionados en `cores/*/dist`: la CI normal no compila Rust ni C, solo comprueba hashes y licencias con `verify:core`. Se regeneran **una vez por cambio deliberado** del núcleo con `.github/workflows/core-tetanes.yml`, `core-sameboy.yml` o `core-mgba.yml` (manuales; ver [ADR-008](docs/adr/008-nes-tetanes-wasm.md), [ADR-010](docs/adr/010-gb-sameboy.md) y [ADR-011](docs/adr/011-gba-mgba.md)). La CI omite los cambios que solo tocan documentación.

## Jugar

- **Jugar** en la tarjeta NES abre un `.nes`; también puedes arrastrarlo a la ventana o, con la app instalada, usar «Abrir con → Cartivo». **Probar demo** arranca una ROM de prueba original.
- Teclado: **WASD/flechas** cruceta · **L** = A · **K** = B · **Q** = Select · **Enter** = Start · **Escape** pausa · **F** modo Focus.
- Mando: se detecta solo; ajustes en **Ajustes → Configurar controles**.
- En partida: **Gráficos** (escalado, proporción, suavizado), **Partidas** (guardar y cargar en ranuras), **Cargar ROM** (guarda y cambia de juego) y **Salir**.
- **F5** guarda rápido y **F9** carga rápido. Al salir se guarda solo, y al volver a abrir el juego puedes **Continuar donde lo dejaste**.
- La primera vez que abres un juego, Cartivo pregunta si quieres **recordar tus juegos en este dispositivo**. Si aceptas, la tarjeta **Continuar** del inicio reanuda el último juego con un clic, sin volver a elegir el archivo, y **Tus juegos** lista los demás. La copia se guarda solo en tu navegador; quitar un juego de la lista conserva sus partidas ([ADR-012](docs/adr/012-library-continue.md)).
- Algunos menús usan **Select** para elegir opción; por ejemplo, «1/2 PLAYERS» en Contra.

## Estructura

```text
apps/web/          PWA (Svelte 5 + Vite): UI por componentes, Worker de emulación, AudioWorklet, service worker
packages/          adapters (contrato y registro de núcleos), runtime (sistemas, protocolo), input, media, storage, fixtures
cores/             jsnes (manifiesto), tetanes (envoltorio Rust) y sameboy y mgba (envoltorios C); WASM generado por CI
tools/             verificación de núcleos, build de TetaNES, generador del service worker
tests/             unitarios (node:test) y e2e (Playwright)
docs/              plan técnico, diseño, ADRs, compatibilidad e investigación
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
