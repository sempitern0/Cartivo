# Cartivo: reglas de desarrollo

## Fuente de verdad y alcance

Leer `docs/PLAN_TECNICO_CARTIVO.md`, ADRs y evidencia de compatibilidad antes de implementar. El plan es una especificación, no una declaración de funcionalidades existentes. Estado inicial: sin implementación.

V1: NES, SNES, GB, GBC, GBA, SMS, Mega Drive, N64, PS1 y PSP. Las tres últimas dependen de aceptación individual; PS2 es laboratorio independiente. No añadir sistemas ni accesorios fuera de alcance sin una decisión de producto registrada.

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

`LICENSE` contiene LGPL-2.1. No sustituirlo silenciosamente ni asumir que el objetivo propietario ya está aprobado. Registrar cualquier decisión en ADR-005. No integrar/publicar un núcleo cuyo expediente legal siga bloqueado; puede investigarse su viabilidad sin redistribuirlo.

Consultar fuentes primarias, fijar commit/toolchain y registrar licencia, dependencias, parches, fuentes y avisos de cada build. Un iframe/Worker/origen separado no exime obligaciones. No inventar permisos, benchmarks ni compatibilidad web a partir de una versión nativa.

## Verificación

Con código implementado, ejecutar tipos/lint y pruebas adecuadas al cambio. E2E para flujos críticos; QA real para GPU, mandos, instalación y suspensión móvil. Usar fixtures autorizados y conservar procedencia/licencia. Para documentación, comprobar enlaces relativos, fences y coherencia del alcance; no declarar tests de runtime ejecutados cuando solo hay documentos.

Entregar qué cambió, evidencia de validación y límites pendientes. Actualizar documentación y compatibilidad cuando cambien decisiones o resultados.
