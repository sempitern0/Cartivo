# H0 — Investigación de candidatos NES para Cartivo

Fecha de consulta: 2026-10-30. Estado: **investigación preliminar, no verificación de integración**.

Este documento se añade de forma independiente desde `main`, sin cambiar el shell, los contratos, la rama `feat/h1-session-foundation` ni los ADR aceptados. Las conclusiones requieren confirmación sobre un commit específico antes de distribuir.

## Restricciones

- Cartivo: PolyForm Noncommercial 1.0.0 para código original; no imponerla a dependencias de terceros.
- Sin BIOS propietaria externa, ejecución local en navegador y núcleo con audio, entradas y guardados.
- No seleccionar un núcleo por aparente popularidad, demo upstream o licencia aislada. Revisar dependencias, composición y versión de distribución.
- La implementación H1-A de Astra está fuera de alcance de esta investigación.

## Matriz de evaluación inicial

| Candidato | Tecnología y orientación | Licencia declarada / cuestión | Decisión preliminar |
|---|---|---|---|
| [TetaNES](https://github.com/lukexor/tetanes) | Rust, soporte web/WASM, frontend separado | MIT o Apache-2.0 según proyecto; confirmar árbol de dependencias, assets y artefactos concretos | **Investigar primero**: alternativa permisiva para evaluar |
| [JSNES](https://github.com/bfirsh/jsnes) | NES en JavaScript, frontend web | **Apache-2.0**, confirmado en LICENSE y package.json upstream; validar commit, dependencias y capacidades | **Comparador útil** de integración y fidelidad, no asumir compatibilidad completa |
| [FCEUmm](https://github.com/libretro/libretro-fceumm) | Núcleo Libretro clásico C/C++ | GPLv2 (comprobar copia y versión exacta) | **Condicionado**: estudiar solo como referencia hasta resolver integración jurídica |
| [Nestopia UE](https://github.com/libretro/nestopia) | Núcleo de emulación NES Libretro | GPLv2 declarada, confirmar condiciones por componente | **Condicionado** por copyleft; no integrar automáticamente |

La atribución Apache-2.0 de JSNES se ha contrastado con [su LICENSE](https://github.com/bfirsh/jsnes/blob/master/LICENSE) y [package.json](https://github.com/bfirsh/jsnes/blob/master/package.json) a fecha de investigación. Las condiciones del artefacto final todavía requieren auditoría.

Estas licencias son **indicativas**; la aprobación requiere archivar la evidencia textual de la licencia y sus dependencias en el commit fijado. PolyForm y GPL no deben mezclarse como si fueran automáticamente compatibles.

## Spikes independientes y verificables (orden propuesto)

### NES-RESEARCH-01 — Inventario jurídico y reproductibilidad

Para TetaNES y JSNES:
1. Fijar commit/tag, lenguaje, toolchain, LICENSE, SPDX, copyright y dependencias directas y transitivas.
2. Detectar códigos GPL/AGPL, recursos no libres, submódulos y licencias de ROMs de pruebas.
3. Verificar instrucciones de compilación web y salida de artefactos, con versiones fijadas; no copiar binarios upstream sin verificar procedencia.
4. Registrar `accepted | blocked | needs-legal-review` para un paquete determinado.

**Aceptación:** hoja por candidato que incluya URL, commit, licencias, dependencias, build y condiciones de distribución; sin afirmaciones de compatibilidad jurídica no comprobadas.

### NES-RESEARCH-02 — Pruebas de emulación, sin integración al shell

- Ejecutar un fixture homebrew permitido; mantener licencia, origen y SHA-256.
- Medir arranque, entrada real, audio, temporización, mappers, SRAM y persistencia después de recarga.
- Comparar navegadores Chromium y Firefox, y Safari si hay acceso real; registrar HW/OS/versión.
- Registrar CPU, memoria, frame pacing, underruns, excepciones y errores de carga WASM.
- Distinguir pruebas del navegador de tests automatizados y de demos upstream.

**Aceptación:** resultados reproducibles, límites conocidos y un candidato con suficiente evidencia para proponer integración H1-B.

### NES-RESEARCH-03 — Adapter feasibility (propuesta, no contrato nuevo)

Verificar sin cambiar el contrato de Astra:
- Ciclo cargar/iniciar/pausar/terminar; limpieza de recursos y un juego activo.
- Audio posterior a gesto de usuario; vídeo sin copia innecesaria por frame.
- Mapeo P1/P2 y estados de entrada neutrales en desconexión.
- Save data persistente y exportable, no confundir con save states.
- Posibilidad de empaquetado lazy/offline y headers requeridos.
- Superficie de API y cambios mínimos que tendría que realizar **el futuro adaptador**, a documentar para revisión tras la PR #2.

**Aceptación:** informe de viabilidad y lista de cuestiones para H1-B, sin modificar ni anticipar API `packages/runtime`.

## Registro de riesgos

| Riesgo | Mitigación |
|---|---|
| Dependencia transitiva incompatible con PolyForm | SBOM + revisión por commit + alternativa o permiso antes de distribuir |
| Un port web funciona solo con su UI original | Spike de API aislado; no prometer adapter hasta demostrar ciclo de vida |
| SRAM no funciona pese a existir save states | Fixture que genere SRAM real + recarga + exportación |
| Diferencias de timing/accuracy | Tests con casos autorizados y métricas reproducibles, no fps de demo |
| Nombres de archivo o mappers especiales | Identificar formato y mapper; rechazar explícitamente formatos no soportados |
| PR #2 activa | No editar archivos de su diff ni integrar su rama; revisión independiente posterior |

## Próxima decisión

Astra deberá elegir el candidato NES **solo cuando** el informe de licencia y los spikes reales estén completos. Esta investigación recomienda priorizar TetaNES/JSNES como candidatos, **no selecciona ni aprueba** un núcleo.
