# ADR-009 — «Partidas»: instantáneas para guardar cualquier juego

Estado: **aceptado**, 2026-11-01.

## Contexto

La SRAM (RAM con batería del cartucho) solo existe en algunos juegos. Muchos títulos NES (Contra, Mega Man, Castlevania; placas UxROM/CNROM) no tenían batería y no pueden guardar progreso por sí mismos. El titular quiere guardar en cualquier juego. TetaNES (`ControlDeck::save_state`/`load_state`) y JSNES (`toJSON`/`fromJSON`) permiten instantáneas del estado completo de la consola.

## Decisión

- **Capa propia «Partidas»** sobre las instantáneas de cada núcleo, independiente del formato interno. La SRAM sigue igual (ADR-007) y se confirma también en cada instantánea.
- **Núcleos:** interfaz común `snapshot()`, `restore(bytes)` y `lastFrame()`. El estado se etiqueta con `core` y `coreVersion` (`CoreModule.version` en `packages/adapters/src/registry.ts`). Un estado de otro núcleo o de otra versión no se carga y se conserva sin cambios; el mensaje nombra el núcleo con la etiqueta de `systems.ts` (`snapshotFits`). TetaNES rechaza además estados de otro cartucho. Todo núcleo futuro debe implementar esta interfaz o declarar que no puede.
- **Almacenamiento** (`packages/storage/src/states.ts`): IndexedDB `cartivo-states`, clave `hashROM:ranura`. Ranuras: `auto` («Al salir») y `1`–`3`. Cada registro guarda bytes, SHA-256, núcleo, versión, frames, fecha y miniatura RGBA 128×120. Tope de 8 MB. Éxito solo tras `oncomplete`; checksum verificado al cargar. Nunca se usa Cache Storage.
- **Escritor único:** Web Lock `cartivo:game:<hash>` para cualquier juego (con o sin batería), con un breve reintento para el traspaso entre sesiones de la misma pestaña.
- **Protocolo v1:** `state-list`, `state-save`, `state-load` y `state-delete` con ranura validada; el Worker serializa y guarda, la UI solo recibe metadatos y miniaturas.
- **Interfaz:**
  - Panel **Partidas** (`SavePanel.svelte`; el reproductor solo ejecuta las operaciones) con miniaturas, «Guardar aquí», carga en dos pasos y borrado.
  - Guardado automático en «Al salir» al pulsar Salir, al usar Cargar ROM y al ocultarse la pestaña.
  - Al reabrir un juego con «Al salir», aviso **Continuar donde lo dejaste / Empezar de nuevo**.
  - **F5** guarda en la ranura 1 y **F9** la carga; F5 no recarga la página durante la partida.

## Consecuencias

- Cualquier juego NES puede guardar y continuar, también sin batería.
- Evidencia de integridad: [H1-QA](../compatibility/H1-QA.md) (100 ciclos, estados dañados o de otra versión, ciclo de vida).
- Las instantáneas dependen de la versión del núcleo: actualizar TetaNES puede dejar estados antiguos sin poder cargarse (se avisa; la SRAM no se ve afectada).
- Pendiente: exportar e importar instantáneas, varias por ranura con historial, y «Continuar» desde el inicio sin volver a elegir el archivo (requiere guardar la ROM en OPFS).
