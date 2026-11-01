# Cartivo

PWA para jugar consolas retro en el navegador: **elige consola, abre tu juego y juega**. Todo ocurre en tu dispositivo: sin BIOS propietarias, sin ROMs incluidas y sin servidor de juego.

## Estado

| | |
|---|---|
| **Consolas** | NES (experimental): iNES NTSC, mappers 0–4 |
| **Núcleo NES** | TetaNES 0.17.0 en WebAssembly por defecto; JSNES 2.1.0 como alternativa (Acerca de esta prueba) |
| **App** | Instalable como PWA y funciona sin conexión (build de producción) |
| **Controles** | Teclado y mando (Gamepad API) con remapeo |
| **Partidas** | Guardado de batería automático, recuperable y exportable |
| **Pendiente** | QA con mando físico, Firefox/Safari, móviles, continuar último juego, más consolas |

Catálogo previsto (V1): NES, SNES, GB, GBC, GBA, Master System, Mega Drive, N64, PS1 y PSP; PS2 como laboratorio. Cada sistema se publica solo cuando su núcleo supera el gate técnico y de licencia. Plan completo: [docs/PLAN_TECNICO_CARTIVO.md](docs/PLAN_TECNICO_CARTIVO.md).

## Empezar

Requisitos: **Node.js 24.22.1** (ver `.node-version`) y **pnpm 11.25.0**. No hace falta Rust: el núcleo WASM ya viene compilado en el repositorio.

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
| `pnpm test` | Tests unitarios, incluido el núcleo WASM |
| `pnpm test:e2e` / `pnpm test:e2e:preview` | E2E Playwright en dev / en la build de producción |
| `pnpm verify:core` | Integridad de JSNES y TetaNES contra sus manifiestos |

El núcleo TetaNES se compila **solo en CI** (`.github/workflows/core-tetanes.yml`), que sube `cores/tetanes/dist` a la rama y comprueba que la build es reproducible.

## Jugar

- **Jugar** en la tarjeta NES abre un `.nes`; también puedes arrastrarlo a la ventana o, con la app instalada, usar «Abrir con → Cartivo». **Probar demo** arranca una ROM de prueba original.
- Teclado: **WASD/flechas** cruceta · **L** = A · **K** = B · **Q** = Select · **Enter** = Start · **Escape** pausa · **F** modo Focus.
- Mando: se detecta solo; ajustes en **Ajustes → Configurar controles**.
- En partida: **Gráficos** (escalado, proporción, suavizado), **Cargar ROM** (guarda y cambia de juego) y **Salir**.
- Algunos menús usan **Select** para elegir opción; por ejemplo, «1/2 PLAYERS» en Contra.

## Estructura

```text
apps/web/          PWA (Svelte 5 + Vite): UI, worker NES, AudioWorklet, service worker
packages/          adapters (núcleos), runtime (protocolo), input, media, storage, fixtures
cores/             jsnes (manifiesto) y tetanes (envoltorio Rust + WASM generado por CI)
tools/             verificación de núcleos, build de TetaNES, generador del service worker
tests/             unitarios (node:test) y e2e (Playwright)
docs/              plan técnico, diseño, ADRs, compatibilidad e investigación
```

## Documentación

- [Plan técnico](docs/PLAN_TECNICO_CARTIVO.md): objetivos, estado, arquitectura, roadmap y backlog.
- [Diseño](docs/DESIGN.md): paleta, principios y pantallas.
- [Compatibilidad](docs/compatibility/README.md): qué está probado y cómo.
- [ADRs](docs/adr/README.md): decisiones registradas.
- [Reglas de desarrollo](AGENTS.md) y [CHANGELOG](CHANGELOG.md).

## Licencia

El código original de Cartivo usa **PolyForm Noncommercial 1.0.0** ([LICENSE](LICENSE)): uso, estudio, modificación y redistribución no comerciales; el uso comercial requiere permiso del titular. No es una licencia OSI. La LGPL-2.1 de la revisión inicial no se revoca para copias anteriores.

Los núcleos y librerías de terceros conservan sus licencias ([LICENSES.md](LICENSES.md), [ADR-005](docs/adr/005-licensing.md)). No se distribuyen juegos ni BIOS.
