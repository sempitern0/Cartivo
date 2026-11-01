// Chooses and builds the NES core for a session. The UI only names a core
// id; it never sees JSNES or TetaNES APIs.
import { NesAdapter } from "./jsnes.ts";
import { TetanesAdapter } from "./tetanes.ts";
import init from "../../../cores/tetanes/dist/tetanes.js";

import type { NesCoreId } from "./core-ids.ts";
export { nesCores, type NesCoreId } from "./core-ids.ts";
export type NesCore = NesAdapter | TetanesAdapter;

/** Snapshot formats are tied to the core and its exact version. */
export const coreVersions: Record<NesCoreId, string> = {
  tetanes: "0.17.0",
  jsnes: "2.1.0",
};

let ready: Promise<unknown> | undefined;

/** Loads the TetaNES wasm once per Worker. */
export function prepareCore(id: NesCoreId): Promise<unknown> {
  if (id === "jsnes") return Promise.resolve();
  ready ??= init().catch((error: unknown) => {
    ready = undefined;
    throw Error(
      "No se pudo iniciar el núcleo TetaNES (WebAssembly). Puedes elegir JSNES en Acerca de esta prueba.",
      { cause: error },
    );
  });
  return ready;
}

export function createCore(
  id: NesCoreId,
  rom: Uint8Array,
  save?: Uint8Array,
): NesCore {
  return id === "tetanes"
    ? new TetanesAdapter(rom, save)
    : new NesAdapter(rom, save);
}
