# ADR-005 — Modelo de licencia y distribución de núcleos

Estado: **aceptado para el código propio**; revisiones «Uso privado» del 2026-11-01 y «Arte de terceros y dependencias» del 2026-11-08 (al final). Fecha: 2026-10-30.

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

## Revisión: uso privado (2026-11-01)

**Decisión del titular:** Cartivo se usa de forma personal y privada. El repositorio es privado y no se distribuye a terceros.

- Mientras se mantenga así, se admiten núcleos con **cualquier licencia libre o de código disponible identificada** (MIT, Apache-2.0, BSD, ISC, Zlib, MPL-2.0, LGPL, GPL, y licencias no comerciales como las de Snes9x o Genesis Plus GX para uso personal). Las obligaciones de redistribución (fuentes correspondientes, compatibilidad del conjunto) no se activan sin distribución.
- Se siguen conservando licencias, avisos y procedencia de cada núcleo (gate CORE-LEGAL-01 como registro), y se rechazan componentes sin licencia o de fuentes no verificadas.
- `cores/tetanes/deny.toml` y `tools/verify-tetanes.mjs` aplican esta lista; la excepción puntual de `option-ext` queda absorbida.
- **Despliegue:** una URL pública sería distribución. El despliegue personal (Cloudflare) debe protegerse con acceso restringido (por ejemplo Cloudflare Access).
- **Antes de cualquier publicación o entrega a terceros** se rehace el análisis de combinación con PolyForm por núcleo, y los núcleos incompatibles se retiran, se sustituyen o se resuelve la licencia.

`LICENSE` (PolyForm Noncommercial 1.0.0) no cambia.

## Revisión: arte de terceros y dependencias (2026-11-08)

**Decisión del titular:** mientras Cartivo sea de uso local o entre conocidos, se levanta la restricción de arte de terceros y la de dependencias.

- **Logotipos y arte:** se admiten logotipos de consolas y otro arte de terceros, originales o alterados. Cada pieza anota su procedencia (fuente y titular) en `LICENSES.md` para poder retirarla antes de publicar. Siguen sin concesión implícita de derechos de marca.
- **Dependencias:** se admiten librerías de terceros estables y mantenidas, con licencia identificada (ADR-019 elige los componentes de interfaz). El lockfile lo sincroniza la CI cuando el cambio se escribe sin acceso al registro.
- **Límite:** ROMs comerciales, BIOS propietarias y datos de usuario siguen sin subirse.
- **Antes de publicar o entregar a terceros** se retira o se licencia el arte de terceros, junto con el análisis de núcleos de la revisión anterior.
- **Visibilidad:** la revisión anterior da el repositorio por privado; si es público, todo lo que se suba (arte incluido) es visible para cualquiera.
