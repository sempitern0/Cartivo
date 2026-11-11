# Gate CORE-LEGAL-01 — Play! (PS2)

**Fecha:** 2026-11-08 · **Resultado:** `investigation` — legal favorable, port WASM viable pero requiere SharedArrayBuffer (COOP/COEP) y tiene requisitos de integración significativos.

## 1. Identificación

| Campo | Valor |
|---|---|
| Núcleo | Play! |
| Upstream | <https://github.com/jpd002/Play-> |
| SHA evaluado | `1f27232772e484bfb79364b751b84f41f4c87481` (HEAD al 2026-11-08) |
| Fork/port | Ninguno; el upstream trae web target Emscripten (`Source/ui_js/`) y frontend libretro (`Source/ui_libretro/`) |
| Licencia principal | BSD-2-Clause (Jean-Philip Desjardins, 2006-2026) |
| License.txt | <https://github.com/jpd002/Play-/blob/master/License.txt> |

## 2. Inventario del artefacto

### Código propio (BSD-2-Clause, Jean-Philip Desjardins)

- `Source/ee/` — Emotion Engine (CPU principal PS2), EeExecutor, HLE del EE
- `Source/iop/` — I/O Processor (IOP), IopBios.cpp (4096 líneas), 53 archivos Iop_*.cpp (HLE de módulos IOP)
- `Source/gs/` — Graphics Synthesizer, incluyendo `GSH_OpenGL/` (backend OpenGL/WebGL2)
- `Source/saves/` — Memory cards: MemoryCard, Save, importadores/exportadores (PSU, XPS, Max, McDump)
- `Source/states/` — Save states: MemoryStateFile, RegisterState
- `Source/discimages/` — Lectura de imágenes de disco
- `Source/DiskUtils.cpp`, `Source/OpticalMedia.cpp` — Soporte de formatos: `.iso`, `.cso`, `.isz`, `.chd`, `.cue`, `.mds`
- `Source/ui_js/` — Web target Emscripten (Main.cpp, Ps2VmJs, GSH_OpenGLJs, InputProviderEmscripten)
- `Source/ui_libretro/` — Frontend libretro (main_libretro.cpp, GSH_OpenGL_Libretro, SH_LibreAudio, PH_Libretro_Input)
- `Source/ui_shared/` — Código compartido entre frontends

### Dependencias directas (submódulos de jpd002, todos BSD-2-Clause)

| Componente | SHA | Licencia | Descripción |
|---|---|---|---|
| CodeGen | `a5009f7` | BSD-2-Clause (jpd002) | JIT con backend WASM (`CCodeGen_Wasm`, `CWasmFunctionRegistry`) |
| Framework | `587f278` | BSD-2-Clause (jpd002) | Utilidades: streams, XML, hilos, mailbox |
| Nuanceur | `d96578b` | BSD-2-Clause (jpd002) | DSL de shaders |
| libchdr | `284e38b` | BSD-3-Clause (Romain Tisserand / MAME) | Lectura de CHD |
| AltKit | `f799f60` | Sin LICENSE explícita (Riley Testut) | Comunicación con AltServer (iOS/Swift); **no se usa en WASM** |

### Dependencias transitivas (Play-Dependencies `8a5f6b1`)

| Componente | Licencia | En el WASM |
|---|---|---|
| bzip2 1.0.6 | BSD-like (Julian Seward) | Sí (compresión) |
| GLEW 2.0.0 | BSD/MIT (Milan Ikits et al.) | **No**: con Emscripten `TARGET_PLATFORM_JS` activa `USE_GLES` y `FrameworkOpenGl/CMakeLists.txt` no compila GLEW |
| LZMA SDK 18.05 | Dominio público (Igor Pavlov) | Sí (compresión) |
| sqlite 3.20.1 | Dominio público | Probable (almacenamiento) |
| xxHash | BSD-2-Clause (Yann Collet) | Sí (hashing) |
| zlib | Zlib (Gailly & Adler) | Sí (compresión) |
| zstd | BSD-3-Clause (Meta) | Sí (compresión CHD) |
| nlohmann/json | MIT (Niels Lohmann) | Probable (config) |
| ghc::filesystem | MIT | Sí (polyfill FS) |

### Dependencias de libchdr

| Componente | Licencia | En el WASM |
|---|---|---|
| libchdr (fuentes) | BSD-3-Clause (Aaron Giles / MAME) | Sí si CHD |
| zlib 1.3.1 | Zlib | Sí |
| zstd 1.5.6 | BSD-3-Clause (Meta) | Sí |
| LZMA SDK 24.05 | Dominio público | Sí |

### Componentes libretro (si se usa el frontend libretro)
- `ext/libretro.h`: MIT (libretro)

## 3. Licencias reales y encaje

### Licencia del conjunto

**BSD-2-Clause** pura. Todas las dependencias son permisivas (BSD, MIT, Zlib, dominio público). No hay ningún componente GPL, LGPL ni de licencia no comercial en el grafo de dependencias. Esto es **significativamente más favorable** que los demás núcleos de Cartivo (PCSX-ReARMed GPL-2.0, Mupen64Plus GPL-2.0, Snes9x no comercial, Genesis Plus GX no comercial).

### Encaje con Cartivo

- BSD-2-Clause es compatible con PolyForm Noncommercial 1.0.0.
- **Si se distribuyera**: solo requiere conservar los avisos de copyright y la cláusula de renuncia en la documentación o materiales distribuidos. Sin obligación de fuentes correspondientes, sin restricción de uso comercial, sin cláusula de reenlazar.
- AltKit no tiene LICENSE explícita pero es código iOS/Swift que no se compila para WASM; puede excluirse del build sin impacto.

### BIOS/firmware

- Play! usa **HLE completa**: IopBios.cpp (4096 líneas) emula los módulos del IOP, y `Source/ee/` emula la EE OS.
- **No necesita BIOS de Sony** (rom0, rom1) para arrancar discos PS2.
- HLE del IOP: 53 módulos emulados (Iop_Cdvdfsv, Iop_FileIo, Iop_Ioman, Iop_Padman, Iop_Sio2, etc.).
- **Límite**: algunos juegos pueden no funcionar si dependen de módulos IOP no emulados. Se documentará como límite de compatibilidad.

## 4. Save states y memoria

### Save states (Partidas)
- **Frontend libretro**: `retro_serialize` y `retro_unserialize` implementados (`main_libretro.cpp:249-302`).
- Serializa EE, IOP y GS en un archivo ZIP en memoria.
- Tamaño de buffer: 40 MiB (`retro_serialize_size` devuelve `40 * 1024 * 1024`).
- **Implicación**: Partidas de ~40 MiB antes de compresión. Con zlib debería bajar a ~5-15 MiB.

### Memory cards (batería)
- `retro_get_memory_data` expone `RETRO_MEMORY_SYSTEM_RAM` (32 MiB de RAM del EE), **no** memory cards.
- Las memory cards se gestionan internamente por Play! en `Source/saves/MemoryCard.cpp` (8 MiB por card, formato propio).
- **Implicación para Cartivo**: las memory cards del PS2 se gestionan por el emulador, no por `SramStore`. Habría que exponer el directorio de memory cards del emulador o montar un VFS para persistirlas. Alternativa: usar solo Partidas (save states) y documentar que las memory cards del PS2 no se exportan.

### Formatos de disco
- `.iso`, `.cso`, `.isz`, `.chd`, `.cue`, `.mds` (registrados en `DiskUtils::GetSupportedExtensions`).
- `.elf` como ejecutable PS2.
- `need_fullpath = true` en el frontend libretro: el disco se abre por ruta, compatible con VFS.
- Para Cartivo V1 PS2: `.iso` y `.chd` como mínimo.

## 5. Complejidad del port WASM

### Web target existente (`Source/ui_js/`)

Play! **ya tiene un web target funcional** con Emscripten. Características:

1. **JIT WASM nativo**: CodeGen incluye `CCodeGen_Wasm` y `CWasmFunctionRegistry` — un JIT que genera funciones WASM en tiempo de ejecución. Esto es mucho más rápido que un intérprete puro, y **ya funciona en el navegador**.
2. **GPU WebGL2**: `GSH_OpenGLJs` usa WebGL2 directamente con `emscripten_webgl_create_context`.
3. **Audio**: OpenAL (emulado por Emscripten).
4. **Disco**: `Js_DiscImageDeviceStream` + `DiscImageDevice.ts` — lectura bajo demanda con `File.slice()` y `MAIN_THREAD_EM_ASM`.
5. **Entrada**: `InputProviderEmscripten` con eventos de teclado.
6. **Frontend React**: `js/play_browser/` con React 17.

### Requisito crítico: pthreads (SharedArrayBuffer)

El CMakeLists.txt del web target incluye:
```
-sPTHREAD_POOL_SIZE=2
```

Play! es **inherentemente multihilo**:
- **VM thread** (`PS2VM.cpp:327`): `m_thread = std::thread([&]() { EmuThread(); })`
- **GS thread** (`GSHandler.cpp:107`): `m_thread = std::thread([&]() { ThreadProc(); })`
- Comunicación por mailbox (`CMailBox`) entre hilos.
- El disco JS usa `MAIN_THREAD_EM_ASM` + `usleep(100)` poll, que requiere que el hilo llamante sea un Worker pthread.

Esto implica:
- **SharedArrayBuffer** obligatorio.
- **Cabeceras COOP/COEP** (`Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Embedder-Policy: require-corp`).
- Cartivo necesitará servir estas cabeceras. La PWA actual no las tiene.

### Opciones de integración

| Opción | Pros | Contras |
|---|---|---|
| **A) Web target directo** (ui_js) | Ya funciona, JIT WASM, GPU nativa WebGL2 | API propia (no libretro), hilos obligatorios, sin save states expuestos al host |
| **B) Frontend libretro** (ui_libretro) | API estándar, save states, compatible con la capa de Cartivo | También necesita hilos (la VM los crea internamente), GPU hardware (HW render callback) |
| **C) Adaptador híbrido** | Interfaz Cartivo propia sobre `CPs2VmJs` | Máxima flexibilidad pero más código de integración |

**Recomendación**: opción B (frontend libretro) si es posible compilar con Emscripten, ya que reutiliza toda la capa de Cartivo (SramStore, Partidas, protocolo Worker). Pero hay que resolver los hilos y la GPU (que necesita `RETRO_HW_CONTEXT_OPENGLES3` → `SurfaceModule` de ADR-017, como N64). Opción A como alternativa si libretro no compila.

### Diferencias con los demás núcleos de Cartivo

| Aspecto | Núcleos actuales (NES–PS1) | Play! (PS2) |
|---|---|---|
| Hilos | Ninguno (un solo hilo) | 2+ (VM + GS) |
| GPU | Software (RGBA por CPU) | Hardware (WebGL2, como N64) |
| JIT | No (intérprete) | WASM JIT (CodeGen_Wasm) |
| SharedArrayBuffer | No necesario | **Obligatorio** |
| COOP/COEP | No necesario | **Obligatorio** |
| Tamaño WASM | 0,5–3 MiB | 2,4 MiB + 188 KiB de JS (build `a56f8b2`) |
| Save states | ~5 KB – 300 KB | ~40 MiB (buffer) |
| Disco | Cartucho en RAM | VFS bajo demanda |

## 6. Riesgos

1. **SharedArrayBuffer/COOP/COEP**: añadir estas cabeceras afecta a **toda** la PWA, no solo a PS2. Puede romper integraciones con iframes de terceros. Requiere ADR y prueba de regresión en todos los núcleos.
2. **Rendimiento**: el JIT WASM de Play! es prometedor pero la PS2 es mucho más compleja que los demás sistemas. Rendimiento incierto con juegos comerciales.
3. **Memory cards**: no se exponen por la API libretro estándar (`RETRO_MEMORY_SAVE_RAM`). Hay que montar un mecanismo de persistencia específico para PS2.
4. **Tamaño del binario**: el WASM de Play! será significativamente mayor que los demás núcleos.
5. **Compatibilidad de juegos**: el HLE de Play! no cubre todos los módulos del PS2. La compatibilidad es parcial.
6. **AltKit sin licencia**: excluir del build (solo iOS).

## 7. Decisión

**`investigation`** — El gate legal es **muy favorable**:

- Todas las licencias son permisivas (BSD-2-Clause, BSD-3-Clause, MIT, Zlib, dominio público).
- No hay ningún componente GPL, LGPL ni de licencia restrictiva.
- HLE completa, sin BIOS de Sony.
- Encaja con PolyForm Noncommercial y con distribución futura.

Sin embargo, la **viabilidad técnica de la integración** requiere:

1. **Spike de compilación**: compilar Play! (web target o libretro) a WASM con Emscripten, confirmando que los pthreads funcionan con SharedArrayBuffer en Cartivo.
2. **ADR para COOP/COEP**: evaluar el impacto de añadir las cabeceras en toda la PWA. **Hecho:** [ADR-020](../adr/020-cross-origin-isolation.md) (aislamiento global, también desde el service worker).
3. **Evaluar el rendimiento** con un homebrew PS2 (no un juego comercial).
4. **Resolver la persistencia de memory cards**.
5. **Evaluar el tamaño** del WASM y la precarga.

Solo tras el spike se puede mover a `accepted (uso privado)` y planificar la integración.

**Receta del spike (2026-11-11):** `tools/build-play.mjs` + `cores/play/CMakeLists.txt` (envoltorio que enlaza `PlayCore`, `ui_shared`, `gsh_opengl` y el frontend libretro con el puente `cores/play/src/cartivo.cpp`), disparada solo por `cores/play/.build-request` (`.github/workflows/core-play.yml`). Salida: `play.js` (cargador ES y worker de pthreads) + `play.wasm`; contexto WebGL2 sobre el OffscreenCanvas del host (`#cartivo-canvas`) y disco montado con WORKERFS. El grafo CMake se ha validado con una configuración nativa (`USE_GLES=ON`); el primer build deliberado se completó en CI (run 42979336329, commit `a56f8b2`, emsdk 6.0.12): `play.js` 188 KiB (`334e6b17c6a6`) y `play.wasm` 2,4 MiB (`16aec860bcb4`), 16 dependencias con licencia identificada (`verify-core`) y aviso `License.txt` idéntico al upstream. Hicieron falta cuatro correcciones de receta: `include(Header)` después de `project()` para detectar Emscripten, `-lembind` para el JIT de CodeGen, versionar `cores/play/dist/` y seguir compilando tras un error (`-k`).

**Paso 1 del spike (compilación): hecho.** Siguen pendientes la ejecución en navegador (adaptador, OffscreenCanvas, WORKERFS y pthreads con SharedArrayBuffer), el ADR de COOP/COEP, el rendimiento con homebrew y la persistencia de memory cards. Por eso el resultado sigue siendo `investigation`.

## SBOM resumido

| Componente | SPDX | Enlace estático | En el WASM |
|---|---|---|---|
| Play! (core, EE, IOP, GS, ui_js/ui_libretro) | BSD-2-Clause | Sí | Sí |
| CodeGen (JIT WASM) | BSD-2-Clause | Sí | Sí |
| Framework (utilidades) | BSD-2-Clause | Sí | Sí |
| Nuanceur (shaders) | BSD-2-Clause | Sí | Sí |
| libchdr | BSD-3-Clause | Sí | Sí si CHD |
| libretro-common (ext/libretro.h) | MIT | Sí | Sí si libretro |
| GLEW 2.0.0 | BSD/MIT | Sí | No (build GLES) |
| bzip2 1.0.6 | BSD-like | Sí | Sí |
| LZMA SDK 18.05 | Dominio público | Sí | Sí |
| sqlite 3.20.1 | Dominio público | Sí | Probable |
| xxHash | BSD-2-Clause | Sí | Sí |
| zlib | Zlib | Sí | Sí |
| zstd | BSD-3-Clause | Sí | Sí |
| nlohmann/json | MIT | Sí | Probable |
| ghc::filesystem | MIT | Sí | Sí |

**Licencia del conjunto: BSD-2-Clause** (todas las dependencias son permisivas).
