// Worker-side registry of core modules. The UI only knows system and core
// ids (packages/runtime/src/systems.ts); this file maps them to code.
import init from "../../../cores/tetanes/dist/tetanes.js";
import type { CoreModule } from "./contract.ts";
import { MAX_ROM_BYTES, validateRom } from "./ines.ts";
import { NesAdapter } from "./jsnes.ts";
import { TetanesAdapter } from "./tetanes.ts";
import { controlDemo } from "../../fixtures/src/control-demo.ts";

let tetanesReady: Promise<void> | undefined;

const nesVideo = { width: 256, height: 240 };

export const coreModules: readonly CoreModule[] = [
  {
    system: "nes",
    id: "tetanes",
    version: "0.17.0",
    video: nesVideo,
    sramBytes: 8192,
    maxRomBytes: MAX_ROM_BYTES,
    validate: validateRom,
    demo: controlDemo,
    prepare() {
      tetanesReady ??= init()
        .then(() => undefined)
        .catch((error: unknown) => {
          tetanesReady = undefined;
          throw Error(
            "No se pudo iniciar el núcleo TetaNES (WebAssembly). Puedes elegir JSNES en Acerca de esta prueba.",
            { cause: error },
          );
        });
      return tetanesReady;
    },
    create: (rom, save) => new TetanesAdapter(rom, save),
  },
  {
    system: "nes",
    id: "jsnes",
    version: "2.1.0",
    video: nesVideo,
    sramBytes: 8192,
    maxRomBytes: MAX_ROM_BYTES,
    validate: validateRom,
    demo: controlDemo,
    prepare: () => Promise.resolve(),
    create: (rom, save) => new NesAdapter(rom, save),
  },
];

export function coreModule(system: string, id: string): CoreModule {
  const found = coreModules.find((m) => m.system === system && m.id === id);
  if (!found) throw Error(`Núcleo ${id} no disponible para ${system}`);
  return found;
}
