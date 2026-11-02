# Auditoría preliminar de núcleos, licencias y firmware — Cartivo V1

**Fecha de investigación:** 2026-10-30 · **Estado:** exploratorio, sin autorizaciones finales, builds ni pruebas. Responsable de aceptar por build: mantenedor de Cartivo.

## Alcance y regla de distribución

Diez consolas V1: NES, SNES, GB, GBC, GBA, Master System, Mega Drive/Genesis, N64, PS1 y PSP. PS2 queda en laboratorio independiente. Cartivo original utiliza [PolyForm Noncommercial 1.0.0](../../LICENSE). La licencia de Cartivo **no reemplaza** la de sus núcleos, ports, código enlazado o recursos externos. Una licencia permisiva es prometedora, **no una aprobación automática**. Una licencia GPL puede imponer condiciones incompatibles con la restricción no comercial del trabajo combinado. Un Worker, iframe, carga dinámica o subdominio no son excepciones jurídicas automáticas. El alcance depende de derechos, naturaleza de integración y distribución real; solicitar revisión jurídica cuando corresponda.

| Sistema | Candidato de evaluación | Evidencia preliminar | Riesgo para Cartivo | BIOS/firmware | Estado |
|---|---|---|---|---|---|
| NES | [TetaNES](https://github.com/lukexor/tetanes), [JSNES](https://github.com/bfirsh/jsnes) | TetaNES MIT/Apache-2.0; JSNES **Apache-2.0** (no MIT) | Dependencias, ports y soporte real de saves/wasm | Cartuchos habituales sin BIOS externa; excluir FDS inicialmente | TetaNES 0.17.0: **accepted** ([expediente](TETANES_CORE_GATE.md)); JSNES 2.1.0: accepted (ADR-007) |
| SNES | **Snes9x 1.63** (integrado, [expediente](SNES9X_CORE_GATE.md)); [ares](https://github.com/ares-emulator/ares) descartado por rendimiento en WASM | Snes9x licencia propia no comercial; snes_spc y snes_ntsc LGPL-2.1+; libretro MIT | No comercial: revisar antes de publicar; LGPL enlazado estáticamente: permitir reenlazar | Sin BIOS: chips emulados en código; BS-X, Sufami Turbo, Super Game Boy y ST018 rechazados | **accepted (uso privado)** |
| GB | **SameBoy v1.0.4** (integrado, [expediente](SAMEBOY_CORE_GATE.md)); [mGBA](https://github.com/mgba-emu/mgba) descartado para GB | SameBoy Expat (MIT), salvo `iOS/` y `HexFiend/`, que no se compilan | Conservar avisos de SameBoy y Emscripten | Boot ROMs libres de SameBoy compiladas desde su código | **accepted** |
| GBC | SameBoy v1.0.4 (mismo núcleo y build que GB) | Expat (MIT) | Igual que GB | `cgb_boot` libre de SameBoy | **accepted** |
| GBA | **mGBA 0.10.5** (integrado, [expediente](MGBA_CORE_GATE.md)) | MPL-2.0; blip_buf LGPL-2.1+; inih BSD-3-Clause; MurmurHash3 dominio público | MPL: fuentes de archivos cubiertos; LGPL enlazado estáticamente: permitir reenlazar si se publicara | BIOS HLE de mGBA (MPL), sin BIOS de Nintendo | **accepted (uso privado)** |
| Master System | **Genesis Plus GX `a5834b3`** (integrado, [expediente](GENESIS_PLUS_GX_CORE_GATE.md)); ares descartado por rendimiento en WASM | Genesis Plus GX licencia propia no comercial; Musashi, Z80 de MAME, SVP y Nuked OPLL no comerciales; Nuked OPN2, blip_buf y filtros NTSC LGPL-2.1+; Tremor BSD-3-Clause; minimp3 CC0; zlib; libretro MIT | No comercial: revisar antes de publicar; versión modificada obliga a publicar el código; LGPL enlazado estáticamente: permitir reenlazar | Sin BIOS: arranque directo; Game Gear y SG-1000 rechazados | **accepted (uso privado)** |
| Mega Drive / Genesis | Genesis Plus GX `a5834b3` (mismo núcleo y build que Master System) | Como Master System | Como Master System | Sin BIOS: TMSS opcional y desactivado; Mega-CD **fuera de V1** por requisito de firmware; 32X rechazado | **accepted (uso privado)** |
| N64 | [Mupen64Plus-Next](https://github.com/libretro/mupen64plus-libretro-nx/blob/develop/LICENSE), ares | Mupen64Plus-Next GPL-2.0; ares ISC base | Vinculación GPL; renderer web/CPU/JIT y dependencia de plugins | Cartuchos sin BIOS externa habitual; revisar variantes, microcódigo, plugins | Candidato (uso privado); revisar antes de publicar |
| PS1 | [PCSX-ReARMed](https://github.com/notaz/pcsx_rearmed/blob/master/COPYING), Beetle PSX | PCSX-ReARMed GPL-2.0; Beetle PSX GPL-2.0 | GPL; entorno WASM sin recompilador nativo | PCSX-ReARMed HLE; Beetle PSX OpenBIOS. Medir compatibilidad | Candidato (uso privado); revisar antes de publicar |
| PSP | [PPSSPP](https://github.com/hrydgard/ppsspp) | GPL-2.0-or-later | Licencia del conjunto, port web y audio/gráficos | PPSSPP declara HLE, no BIOS obligatoria | Candidato (uso privado); revisar antes de publicar |
| PS2 *(laboratorio)* | [Play!](https://github.com/jpd002/Play-/blob/master/License.txt) | BSD tipo 2 cláusulas en la licencia principal; dependencias aún sin auditar | Web port experimental, memorias, velocidad y componentes adicionales | Play! usa HLE; no afirmar soporte masivo | Investigar aparte |

**Política vigente (2026-11-01): uso privado.** Las columnas de riesgo describen la situación si Cartivo se distribuyera; para uso personal los núcleos GPL y no comerciales son admisibles (ADR-005). **Importante:** no se ha fijado commit, calculado SBOM, ejecutado un binario ni auditado submódulos para ningún candidato. Las conclusiones son pistas de prioridad, no certificaciones de cumplimiento. La licencia base de un proyecto no garantiza que todos sus ports o plugins usen esa licencia.

## Evidencias de primera mano consultadas

- [TetaNES README](https://github.com/lukexor/tetanes), declara licencia MIT o Apache-2.0 y versión web.
- [JSNES README](https://github.com/bfirsh/jsnes), declara Apache-2.0 y APIs de emulación para navegador.
- [Snes9x LICENSE](https://github.com/snes9xgit/snes9x/blob/master/LICENSE), permiso no comercial y componentes con condiciones distintas.
- [ares LICENSE](https://github.com/ares-emulator/ares/blob/master/LICENSE), ISC para ares y múltiples avisos de dependencias.
- [SameBoy LICENSE](https://github.com/LIJI32/SameBoy/blob/master/LICENSE), Expat salvo excepciones listadas.
- [mGBA CONTRIBUTING](https://github.com/mgba-emu/mgba/blob/master/CONTRIBUTING.md), MPL-2.0.
- [Genesis Plus GX LICENSE](https://github.com/ekeeke/Genesis-Plus-GX/blob/master/LICENSE.txt), restricciones de explotación y avisos adicionales.
- [Mupen64Plus-Next LICENSE](https://github.com/libretro/mupen64plus-libretro-nx/blob/develop/LICENSE), GPL-2.0.
- [PCSX-ReARMed COPYING](https://github.com/notaz/pcsx_rearmed/blob/master/COPYING), GPL-2.0; [README](https://github.com/notaz/pcsx_rearmed) menciona HLE.
- [PPSSPP README](https://github.com/hrydgard/ppsspp), GPL 2.0 o posterior y HLE.
- [Play! License.txt](https://github.com/jpd002/Play-/blob/master/License.txt), términos BSD-2-Clause.

## Gate CORE-LEGAL-01 por artefacto (obligatorio antes de integrar)

1. Fijar `core-id`, tag, SHA upstream, fork/port y SHA del port; adjuntar URL exacta de LICENSE/NOTICE/COPYRIGHT.
2. Inventariar archivos, librerías, submódulos, shaders, compilador, assets, wrapper y dependencias transitivas en el bundle que se distribuye; preparar SBOM o equivalente.
3. Identificar SPDX/LicenseRef reales y condiciones: copyright, cambios, fuentes correspondientes, avisos, patentes, uso comercial, restricciones adicionales.
4. Evaluar legalmente **el modo concreto de combinación con Cartivo**, incluyendo linking, protocolización, distribución, origen/worker y derechos concedidos; registrar decisión motivada, nunca asumir independencia.
5. Probar que el build WASM no requiere BIOS/firmware propietario externo para juegos y modos que se anunciarán.
6. Registrar binarios exactos, hashes, avisos reproducibles, URLs de fuente y build, y política de actualización de vulnerabilidades.
7. Resultado `accepted | blocked | needs-permission | investigation`. Solo `accepted` habilita publicación; no basta compatibilidad técnica.

### Handoff a Astra (sin modificar H1-A)

- **Priorizar** candidatos permisivos para primera integración: NES TetaNES/JSNES, GB/GBC SameBoy, GBA mGBA, PS2 Play! como laboratorio. Esto **no** decide el núcleo.
- Mantener N64/PS1/PSP como spikes con riesgo de GPL explícito y sin prometer una integración compatible con PolyForm.
- No abrir tareas de firmware legalmente inaccesible ni distribuir ROMs/BIOS.
- Revisar [ADR-005](../adr/005-licensing.md) y conservar el estado de [compatibilidad](../compatibility/README.md) hasta que existan pruebas.
