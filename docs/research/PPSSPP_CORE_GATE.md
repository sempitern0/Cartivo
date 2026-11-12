# Gate CORE-LEGAL-01 — PPSSPP (PSP)

**Fecha:** 2026-11-08 · **Resultado:** `investigation` — pendiente de build WASM y pruebas.

## 1. Identificación

| Campo | Valor |
|---|---|
| Núcleo | PPSSPP |
| Upstream | <https://github.com/hrydgard/ppsspp> |
| SHA evaluado | `9dc79eb81dac5d1f04d0637aa58b566583b642d4` (HEAD al 2026-11-08) |
| Fork/port | Ninguno; se usa el upstream directamente con su frontend libretro (`libretro/libretro.cpp`) |
| Licencia principal | GPL-2.0-or-later (`LICENSE.TXT`: PSPSDK BSD-3-Clause + GPL-2.0 completa) |

## 2. Inventario del artefacto (preliminar)

PPSSPP es un emulador completo, no un núcleo libretro mínimo. Incluye:

### Código propio (GPL-2.0-or-later)
- `Core/` — CPU (intérprete, IR JIT, dynarec ARM/x86/ARM64/RISC-V), HLE (202 archivos), sistema de archivos, memoria, save states
- `GPU/` — backends: GLES (OpenGL ES → WebGL2), Vulkan, D3D11, Software, Metal, Null
- `Common/` — utilidades, serialización, threading, VFS, crypto
- `libretro/` — frontend libretro con save states, VFS y backends GL/Vulkan/D3D11

### Dependencias en `ext/` (submódulos y vendored)

| Componente | Licencia | Notas |
|---|---|---|
| glslang (submódulo) | Apache-2.0 + BSD-3-Clause + MIT | Compilador GLSL → SPIR-V de Khronos |
| SPIRV-Cross (submódulo) | Apache-2.0 | Decompilador SPIR-V de Khronos |
| armips (submódulo) | MIT | Ensamblador MIPS/ARM |
| zlib | Zlib | Compresión |
| snappy | BSD-3-Clause (Google) | Compresión rápida |
| libdeflate | MIT | Compresión deflate |
| cityhash | MIT (Google) | Hash rápido |
| gason | MIT | Parser JSON |
| naett-lib | MIT | HTTP; no se usa en WASM |
| portable-file-dialogs | WTFPL | Diálogos nativos; no se usa en WASM |
| udis86 | BSD-2-Clause | Desensamblador x86; solo x86 |
| sfmt19937 | BSD-3-Clause | Mersenne Twister SIMD |
| jpge | Public Domain / Apache-2.0 | Codificador JPEG |
| vma | MIT (AMD) | Vulkan Memory Allocator; solo con Vulkan |
| **ffmpeg** | **LGPL-2.1+** (sin `--enable-gpl`) | Decodificación de audio/vídeo (AT3, MP3, H.264); enlazado estáticamente |
| at3_standalone | Derivado de ffmpeg, LGPL-2.1+ | Decodificador ATRAC3/ATRAC3+ independiente |
| **libkirk** | **GPL-3.0-or-later** | Motor criptográfico del PSP (crypto de saves, DRM) |
| **xbrz** | **GPL** (con excepción MAME) | Filtro de escalado; opcional |
| libchdr (submódulo) | BSD-3-Clause | Soporte CHD |
| libzip | BSD-3-Clause | Manejo de ZIP |
| lzma-sdk | LicenseRef-public-domain | Compresión LZMA |
| rcheevos (submódulo) | MIT | RetroAchievements; no se usa |
| discord-rpc (submódulo) | MIT | Discord; no se usa en WASM |
| miniupnp (submódulo) | BSD-3-Clause | UPnP; no se usa en WASM |
| lua (submódulo) | MIT | Scripting; probablemente excluible |
| freetype (submódulo) | FTL (BSD-like) / GPL-2.0 | Renderizado de fuentes |
| nanosvg (submódulo) | Zlib | SVG |
| cpu_features (submódulo) | Apache-2.0 (Google) | Detección de CPU; no aplica en WASM |
| stb (imgui integrado) | MIT / Public Domain | Cabeceras de utilidad |
| imgui | MIT | UI de depuración; excluible |
| basis_universal | Apache-2.0 (Google) | Texturas comprimidas |
| OpenXR-SDK (submódulo) | Apache-2.0 (Khronos) | VR; no se usa en WASM |
| oboe (submódulo) | Apache-2.0 (Google) | Audio Android; no se usa en WASM |

### Componentes libretro
- `libretro-common` (submódulo): MIT

## 3. Licencias reales y encaje

### Licencia del conjunto
GPL-2.0-or-later, reforzada por:
- **libkirk GPL-3.0**: al enlazar con GPL-3.0, el conjunto sube a GPL-3.0-or-later (compatible con GPL-2.0-or-later, pero obliga a la versión 3+ del conjunto).
- **ffmpeg LGPL-2.1+**: compatible con GPL; enlazado estáticamente obliga a permitir reenlazar.
- **xbrz GPL**: compatible; excluible si no se usa el filtro.
- **freetype FTL/GPL-2.0**: compatible.

### Encaje con la política de uso privado (ADR-005)
- GPL-3.0 (por libkirk) es una licencia libre identificada: **admisible para uso privado**.
- Si se distribuyera: fuentes correspondientes del conjunto bajo GPL-3.0-or-later; reenlazado de componentes LGPL; avisos de todos los componentes BSD/MIT/Apache.

### BIOS/firmware
- PPSSPP usa **HLE completa**: 202 archivos en `Core/HLE/` que emulan las funciones del firmware PSP por software.
- No necesita la BIOS de Sony (`flash0`, `syscon`) para la mayoría de juegos.
- Algunos juegos pueden requerir archivos de `flash0` (fuentes de sistema, etc.) que no están cubiertos por el HLE. Esto se documentará como límite.

## 4. Save states y memoria
- `retro_serialize` / `retro_unserialize`: implementados (`libretro/libretro.cpp:1877-1926`).
- `retro_get_memory_data`: expone `RETRO_MEMORY_SYSTEM_RAM` (la RAM del PSP), **no** una tarjeta de memoria como batería. Las partidas del PSP se guardan en el sistema de archivos virtual (`ms0:/PSP/SAVEDATA/`), que PPSSPP persiste por su cuenta.
- **Implicación para Cartivo**: la batería (`SramStore`) no será el mecanismo principal; los saves del PSP se gestionan por el propio emulador en su sistema de archivos. Las Partidas (instantáneas) sí funcionan por `retro_serialize`.

## 5. Formatos
- `need_fullpath = true`: el disco se abre por ruta, compatible con la VFS de Cartivo.
- Formatos soportados: `.iso` (UMD), `.cso` (CSO comprimido), `.chd` (libchdr), `.pbp` (PlayStation Store), `.elf` (homebrew).
- Para Cartivo V1: `.iso` y `.cso` como mínimo.

## 6. Complejidad del port WASM

### Sin soporte Emscripten existente
PPSSPP no tiene target Emscripten/WASM en su sistema de build. Hay que portarlo. Esto es **significativamente más complejo** que los núcleos anteriores:

1. **GPU**: PPSSPP tiene su propio pipeline de rendering (no usa el de libretro). El backend GLES necesita WebGL2 en un Worker con `OffscreenCanvas`, como N64 con `SurfaceModule` (ADR-017).
2. **CPU**: el intérprete es imprescindible en WASM (sin dynarec). PPSSPP tiene un intérprete y un IR JIT; el intérprete puro es más lento pero funciona sin generar código nativo.
3. **Threading**: PPSSPP usa hilos para audio, GPU y HLE. En WASM sin SharedArrayBuffer habría que serializar o emular en un solo hilo.
4. **Audio**: decodificación de ATRAC3/ATRAC3+ (at3_standalone derivado de ffmpeg) y salida a 44.1 kHz.
5. **Sistema de archivos**: el PSP tiene un FS virtual complejo (`ms0:`, `flash0:`, `disc0:`). En el modo libretro, el VFS de libretro se encarga del disco; el memstick (`ms0:`) se gestiona internamente.
6. **Tamaño del binario**: PPSSPP es mucho más grande que los núcleos anteriores. El WASM resultante puede superar los 10 MiB.

### Camino propuesto (si se aprueba)
- Usar el frontend **libretro** de PPSSPP con el backend **GLES** (WebGL2).
- CPU: intérprete puro (sin IR JIT ni dynarec).
- Un solo hilo (como los demás núcleos de Cartivo), serializando GPU y audio.
- Puente `cartivo.c` sobre el frontend libretro, como los demás núcleos.
- `SurfaceModule` de ADR-017 para el lienzo WebGL2 en el Worker.
- VFS de Cartivo para los discos (`.iso`/`.cso`).

### Riesgos
- **Rendimiento**: PSP a velocidad completa en un intérprete WASM sin hilos es incierto. EmulatorJS/RetroArch Web usan PPSSPP con multithreading (SharedArrayBuffer + COOP/COEP).
- **Tamaño del binario**: puede afectar a la precarga de la PWA.
- **ffmpeg/at3**: la decodificación de audio ATRAC puede ser costosa sin SIMD.
- **GPU GLES**: el pipeline de shaders de PPSSPP puede necesitar adaptación para las limitaciones de WebGL2.

## 7. Decisión

**`investigation`** — El gate legal es favorable para uso privado (todas las licencias son libres e identificadas), pero la **viabilidad técnica del port WASM** requiere:

1. Un spike de compilación: compilar el frontend libretro con el backend GLES a WASM con Emscripten, sin hilos ni dynarec.
2. Evaluar el rendimiento con un homebrew PSP (no un juego comercial).
3. Evaluar el tamaño del binario WASM.

Solo tras el spike se puede mover a `accepted (uso privado)` y planificar la integración.

## SBOM resumido

| Componente | SPDX | Enlace estático | En el WASM |
|---|---|---|---|
| PPSSPP (Core, GPU/GLES, Common, libretro) | GPL-2.0-or-later | Sí | Sí |
| PSPSDK (headers) | BSD-3-Clause | Sí | Sí |
| libkirk | GPL-3.0-or-later | Sí | Sí (crypto) |
| ffmpeg / at3_standalone | LGPL-2.1-or-later | Sí | Sí (audio ATRAC) |
| xbrz | GPL-2.0-or-later (con excepción MAME) | Sí | Excluible |
| freetype | FTL (BSD-like) o GPL-2.0 | Sí | Probable (fuentes) |
| glslang | Apache-2.0 + BSD-3-Clause + MIT | Sí | Sí (shaders) |
| SPIRV-Cross | Apache-2.0 | Sí | Sí (shaders) |
| zlib | Zlib | Sí | Sí |
| snappy | BSD-3-Clause | Sí | Sí |
| libdeflate | MIT | Sí | Sí |
| sfmt19937 | BSD-3-Clause | Sí | Sí |
| cityhash | MIT | Sí | Sí |
| jpge | PD / Apache-2.0 | Sí | Probable |
| libchdr | BSD-3-Clause | Sí | Si CHD |
| libzip | BSD-3-Clause | Sí | Sí |
| lzma-sdk | LicenseRef-public-domain | Sí | Sí |
| nanosvg | Zlib | Sí | Probable |
| basis_universal | Apache-2.0 | Sí | Probable |
| armips | MIT | Sí | Probable |
| stb/imgui | MIT / PD | Sí | Parcial |
| libretro-common | MIT | Sí | Sí |

**Licencia del conjunto si se distribuyera: GPL-3.0-or-later** (por libkirk GPL-3.0).
