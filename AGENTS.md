# Cartivo: reglas de desarrollo

## Fuente de verdad y alcance

Leer `docs/PLAN_TECNICO_CARTIVO.md`, ADRs y evidencia de compatibilidad antes de implementar. El plan es una especificación, no una declaración de funcionalidades existentes. El estado observado y sus pruebas se mantienen en README y `docs/compatibility/`; actualizarlos con cada incremento, sin conservar una etiqueta de planificación cuando ya exista código.

V1: NES, SNES, GB, GBC, GBA, SMS, Mega Drive, N64, PS1 y PSP. Las tres últimas dependen de aceptación individual; PS2 es laboratorio independiente. No añadir sistemas ni accesorios fuera de alcance sin una decisión de producto registrada.

Para ejecutar H0/H1, seguir `docs/GUIA_EJECUCION_H0_H1.md`. La investigación NES habilita el primer incremento; los spikes 3D pendientes no bloquean el shell. Un bloqueo de licencia no impide avanzar en tareas independientes autorizadas, pero impide declarar completo el núcleo afectado.

## Ingeniería

- Implementar H0/H1 incrementalmente. No construir todos los adaptadores a la vez.
- Mantener TypeScript estricto y contratos versionados con validación runtime.
- UI sin conocimiento de APIs internas del núcleo; no crear globals compartidos entre emuladores.
- Un juego activo; lifecycle, errores, cancelación y limpieza explícitos.
- No bloquear el hilo de UI con parsing, hashing o IO voluminoso.
- No prometer WebGPU, threads, rewind, JIT, save states ni lectura incremental sin evidencia del port y build concreta.
- Mantener el aspecto original y la velocidad emulada por defecto; mejoras que alteren fidelidad son opcionales.
- Crear paquetes cuando exista consumidor, sin scaffolding vacío ni complejidad innecesaria.

## Datos y seguridad

- Sin BIOS propietarias externas obligatorias, ROMs comerciales, claves o arte sin derechos en git/CI.
- Archivos, partidas y rutas del usuario permanecen locales; metadatos remotos opcionales y transparentes.
- No tratar Workers del mismo origen como sandbox de privilegios.
- Saves con generaciones recuperables, escritor único, exportación y confirmación de commit. No depender de eventos de cierre.
- Ninguna actualización del SW/núcleo recarga una sesión activa o borra saves para liberar caché.

## Licencias y fuentes

El código original de Cartivo cuyos derechos controle el titular se publica bajo **PolyForm Noncommercial 1.0.0** (véase `LICENSE` y ADR-005). No aplicar esta licencia a núcleos, bibliotecas o archivos de terceros, ni afirmar que anula derechos otorgados con la LGPL-2.1 anterior. Los permisos comerciales del código propio requieren autorización adicional. No integrar/publicar un núcleo cuyo expediente legal siga bloqueado; puede investigarse su viabilidad sin redistribuirlo.

Consultar fuentes primarias, fijar commit/toolchain y registrar licencia, dependencias, parches, fuentes y avisos de cada build. Un iframe/Worker/origen separado no exime obligaciones. No inventar permisos, benchmarks ni compatibilidad web a partir de una versión nativa.

## Verificación

Con código implementado, ejecutar tipos/lint y pruebas adecuadas al cambio. E2E para flujos críticos; QA real para GPU, mandos, instalación y suspensión móvil. Usar fixtures autorizados y conservar procedencia/licencia. Para documentación, comprobar enlaces relativos, fences y coherencia del alcance; no declarar tests de runtime ejecutados cuando solo hay documentos.

Entregar qué cambió, evidencia de validación y límites pendientes. Actualizar documentación y compatibilidad cuando cambien decisiones o resultados.

## Inicio de implementación tras el merge

Seguir el contrato de arranque de la guía H0/H1. Verificar la rama base actualizada y trabajar en una rama de implementación cuando la documental ya esté fusionada. Las decisiones técnicas propuestas pueden concretarse con evidencia y registrarse en su ADR durante H0; no exigir una aprobación adicional para cada elección técnica rutinaria dentro del alcance autorizado. La decisión del modelo de licencia corresponde al titular y no se deduce de aceptar la arquitectura.

H0 tiene una salida mínima para NES y expedientes independientes para otros sistemas. H1 solo depende de esa salida NES y de los servicios que consume; no de terminar todos los spikes 3D. No crear módulos, gateway ni backends sin consumidor en el primer incremento.

No confundir preparación documental, shell con mock, H1 jugable y release estable. Registrar por criterio el commit/build, prueba y resultado; un requisito pendiente conserva ese estado aunque el resto del incremento pase.
