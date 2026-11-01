# Auditoría preliminar de núcleos, licencias y firmware — Cartivo V1

**Fecha de investigación:** 2026-10-30 · **Estado:** exploratorio, sin autorizaciones finales, builds ni pruebas. Responsable de aceptar por build: mantenedor de Cartivo.

## Alcance y regla de distribución

Diez consolas V1: NES, SNES, GB, GBC, GBA, Master System, Mega Drive/Genesis, N64, PS1 y PSP. PS2 queda en laboratorio independiente. Cartivo original utiliza [PolyForm Noncommercial 1.0.0](../../LICENSE). La licencia de Cartivo **no reemplaza** la de sus núcleos, ports, código enlazado o recursos externos. Una licencia permisiva es prometedora, **no una aprobación automática**. Una licencia GPL puede imponer condiciones incompatibles con la restricción no comercial del trabajo combinado. Un Worker, iframe, carga dinámica o subdominio no son excepciones jurídicas automáticas. El alcance depende de derechos, naturaleza de integración y distribución real; solicitar revisión jurídica cuando corresponda.

| Sistema | Candidato de evaluación | Evidencia preliminar | Riesgo para Cartivo | BIOS/firmware | Estado |
|---|---|---|---|---|---|
| NES | [TetaNES](https://github.com/lukexor/tetanes), [JSNES](https://github.com/bfirsh/jsnes) | TetaNES MIT/Apache-2.0; JSNES **Apache-2.0** (no MIT) | Dependencias, ports y soporte real de saves/wasm | Cartuchos habituales sin BIOS externa; excluir FDS inicialmente | TetaNES 0.17.0: **accepted** ([expediente](TETANES_CORE_GATE.md)); JSNES 2.1.0: accepted (ADR-007) |
| SNES | [ares](https://github.com/ares-emulator/ares); [Snes9x](https://github.com/snes9xgit/snes9x/blob/master/LICENSE) como referencia | ares licencia base ISC con componentes de terceros; Snes9x condiciones de uso no comercial | Rendimiento web/cores de ares y condiciones de terceros; Snes9x no es licencia PolyForm | Chips especiales podrían precisar firmware; auditar por título | Investigar |
| GB | [SameBoy](https://github.com/LIJI32/SameBoy/blob/master/LICENSE), [mGBA](https://github.com/mgba-emu/mgba) | SameBoy Expat en núcleo general con excepciones iOS/HexFiend; mGBA MPL-2.0 | Compilación WebAssembly, permisos por archivo y obligaciones MPL | SameBoy incluye boot ROMs libres; revisar distribución de artefactos | Investigar |
| GBC | SameBoy / mGBA | Mismas licencias preliminares que GB | Modos CGB, RTC, paletas y dependencias | Boot ROMs libres o arranque HLE por build | Investigar |
| GBA | mGBA | MPL-2.0 según upstream | MPL exige conservación de licencias y disponibilidad de fuentes de archivos cubiertos cuando aplique | BIOS integrada según build; no cargar BIOS propietaria externa | Investigar |
| Master System | [Genesis Plus GX](https://github.com/ekeeke/Genesis-Plus-GX/blob/master/LICENSE.txt) o ares | Genesis Plus GX licencia propia no comercial y varias licencias de terceros; ares base ISC | Licencias específicas por port y posibles dependencias recíprocas | Modos/regiones con y sin firmware; verificar arranque sin BIOS externa | Investigar |
| Mega Drive / Genesis | Genesis Plus GX o ares | Como Master System | No confundir no comercial del núcleo con permiso global para relicenciar; ares requiere evaluación de performance | BIOS cartucho habitual no requerido; Mega-CD **fuera de V1** por requisito firmware | Investigar |
| N64 | [Mupen64Plus-Next](https://github.com/libretro/mupen64plus-libretro-nx/blob/develop/LICENSE), ares | Mupen64Plus-Next GPL-2.0; ares ISC base | Vinculación GPL; renderer web/CPU/JIT y dependencia de plugins | Cartuchos sin BIOS externa habitual; revisar variantes, microcódigo, plugins | Bloqueo potencial de copyleft / spike |
| PS1 | [PCSX-ReARMed](https://github.com/notaz/pcsx_rearmed/blob/master/COPYING), Beetle PSX | PCSX-ReARMed GPL-2.0; Beetle PSX GPL-2.0 | GPL; entorno WASM sin recompilador nativo | PCSX-ReARMed HLE; Beetle PSX OpenBIOS. Medir compatibilidad | Bloqueo potencial de copyleft / spike |
| PSP | [PPSSPP](https://github.com/hrydgard/ppsspp) | GPL-2.0-or-later | Licencia del conjunto, port web y audio/gráficos | PPSSPP declara HLE, no BIOS obligatoria | Bloqueo potencial de copyleft / spike |
| PS2 *(laboratorio)* | [Play!](https://github.com/jpd002/Play-/blob/master/License.txt) | BSD tipo 2 cláusulas en la licencia principal; dependencias aún sin auditar | Web port experimental, memorias, velocidad y componentes adicionales | Play! usa HLE; no afirmar soporte masivo | Investigar aparte |

**Importante:** no se ha fijado commit, calculado SBOM, ejecutado un binario ni auditado submódulos para ningún candidato. Las conclusiones son pistas de prioridad, no certificaciones de cumplimiento. La licencia base de un proyecto no garantiza que todos sus ports o plugins usen esa licencia.

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
