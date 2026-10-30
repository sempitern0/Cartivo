# ADR-005 — Modelo de licencia y distribución de núcleos

Estado: **aceptado para el código propio**; integración y distribución de núcleos externos condicionadas a auditoría. Fecha: 2026-10-30.

## Decisión del titular

Cartivo adopta **PolyForm Noncommercial License 1.0.0** para el código original cuyo copyright posee o puede licenciar el titular. El texto oficial figura en [LICENSE](../../LICENSE), con un aviso de copyright del titular. Autoriza los usos definidos como no comerciales y permite estudiar, modificar y redistribuir bajo sus condiciones. Los usos comerciales requieren licencia o permiso separado. Es una licencia *source-available*, no OSI open source.

La LGPL-2.1 constaba en el commit inicial. La sustitución del archivo para versiones futuras **no revoca retroactivamente** los derechos válidamente concedidos sobre copias anteriores; tampoco autoriza relicenciar contribuciones de terceros sin permisos suficientes. El titular debe verificar titularidad y procedencia de aportaciones futuras.

## Alcance y límites

- **Código original de Cartivo:** PolyForm Noncommercial 1.0.0; consultar texto íntegro, no una paráfrasis.
- **Núcleos de emulación, librerías, fuentes, metadatos y arte de terceros:** conservan sus licencias y avisos originales. No se incluyen automáticamente en la licencia de Cartivo.
- **GPL/LGPL y otras licencias recíprocas:** evaluar cómo se combina o distribuye el trabajo. No presuponer que Worker, iframe, host separado, WASM dinámico o packs descargables independizan jurídicamente el conjunto.
- **Licencias permisivas:** cumplir avisos de copyright, atribución y otras condiciones; verificar compatibilidad del caso concreto.
- **Marcas y logotipos:** sin concesión implícita de derechos de marca.

El cambio **no bloquea** la implementación independiente de UI, dominio, PWA, almacenamiento, contratos, pruebas o adaptadores originales. La integración, vinculación y distribución pública de cada núcleo queda sujeta a licencia compatible o permisos expresos suficientes. En caso de conflicto, seleccionar otro núcleo, solicitar licencia comercial/excepción o modificar la arquitectura con revisión jurídica; no ocultar obligaciones ni relajar silenciosamente la licencia.

## Evidencia inicial

README de EmulatorJS declara GPLv3; PPSSPP declara GPL-2.0-or-later; Genesis Plus GX contiene condiciones particulares y restricciones comerciales. La evidencia upstream no sustituye revisión del commit/build exacto. No se ha aprobado ni distribuido ningún núcleo en esta PR.

## Expediente obligatorio por build antes de publicar

Registrar repositorio y commit, titularidad, licencia SPDX/LicenseRef, submódulos y dependencias, archivos de copyright, toolchain, parches, tipo de integración/vinculación, binarios y hashes, fuentes correspondientes y scripts exigidos, avisos, permisos adicionales, compatibilidad con PolyForm y decisión final **accepted / blocked**.

Mantener inventario y avisos separados para cada tercero; no añadir textos incompatibles en un único LICENSE general. El responsable del producto conserva la decisión de distribución, sometida a la revisión jurídica aplicable.

## Alternativas descartadas

- Mantener LGPL-2.1 como licencia general futura: permite usos comerciales bajo sus condiciones y no responde a la intención actual.
- Licencia cerrada sin permiso de modificaciones no comerciales: restringiría más la colaboración comunitaria deseada.
- Aplicar PolyForm indiscriminadamente a núcleos GPL: incompatible sin derechos adicionales o una combinación que satisfaga realmente ambas licencias.

**Estado de implementación:** solo decisión y documentación; sin certificación jurídica de núcleos, builds ni releases.
