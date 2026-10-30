# ADR-005 — Modelo de licencia y distribución de núcleos

Estado: decisión pendiente; bloquea publicación incompatible. Fecha: 2026-10-30.

## Hechos observados

El commit inicial de Cartivo contiene LGPL-2.1 en `LICENSE`. La intención expresada por el titular es publicar la aplicación restringiendo libre uso/redistribución del código propio. No son equivalentes. Esta revisión no sustituye la licencia ni intenta retirar derechos ya concedidos.

Fuentes primarias inspeccionadas: README de EmulatorJS declara GPLv3; PPSSPP declara GPL-2.0-or-later; LICENSE de Genesis Plus GX restringe uso comercial e impone condiciones de fuentes y avisos. Revalidar todos los componentes, dependencias y variantes en el commit que se pretenda distribuir.

## Opciones a resolver

| Ruta | Consecuencia |
|---|---|
| Mantener LGPL actual y distribuir componentes conforme a sus licencias | Puede servir a un producto público, pero no satisface una prohibición general de redistribución; revisar integración y licencias copyleft adicionales |
| Código propio propietario con dependencias compatibles o permisos específicos | Exige decidir alcance de derechos, revisar licencias de terceros e integración y posiblemente cambiar núcleo/catálogo |
| Reemplazar o desarrollar partes sin alternativa compatible | Aumenta sustancialmente coste y puede impedir PSP/N64/PS1 en V1; no equivale a disponer de un emulador listo |

## Recomendación técnica

Resolver esta elección antes de reutilizar una plataforma completa o comprometer el catálogo público. Mantener contratos y recetas separadas ayuda a cambiar componentes, pero no prueba independencia jurídica. Worker, iframe, dominio separado, carga bajo demanda o app gratuita no son una excepción automática a copyleft o restricciones comerciales.

Una PWA entrega JS/WASM al dispositivo: no prometer ocultación de binarios ni tratar todo como ejecución interna del servidor. Las restricciones propias no pueden anular los derechos de los componentes ajenos. Términos del producto, marcas, código propio y arte requieren alcance claro; no crear una EULA incompatible con los componentes.

## Expediente obligatorio por build antes de publicación

Repositorio y commit; archivos de licencia y copyright; submódulos; licencia SPDX/LicenseRef; cambios y flags; toolchain; artefactos y hashes; dependencias vinculadas; fuentes correspondientes y scripts exigidos; avisos; permiso comercial cuando proceda; conclusión aplicable a integración/distribución concreta.

Las fuentes se consultaron para detectar bloqueos, no para certificar cumplimiento integral. El responsable del producto debe registrar la decisión y revisión correspondiente; mientras tanto, solo investigación y componentes con condiciones compatibles con el trabajo autorizado, sin publicar packs bloqueados.
