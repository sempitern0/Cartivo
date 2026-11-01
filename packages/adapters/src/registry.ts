// Worker-side registry of core modules. The UI only knows system and core
// ids (packages/runtime/src/systems.ts); this file maps them to code.
import init from "../../../cores/tetanes/dist/tetanes.js";
import type { CoreModule } from "./contract.ts";
import { MAX_ROM_BYTES, validateRom } from "./ines.ts";
import { NesAdapter } from "./jsnes.ts";
import { TetanesAdapter } from "./tetanes.ts";
import { controlDemo } from "../../fixtures/src/control-demo.ts";
import { gbControlDemo } from "../../fixtures/src/gb-control-demo.ts";
import { MAX_GB_ROM_BYTES, validateGbRom } from "./gb-header.ts";

// SameBoy loads on demand: NES players never download its glue or wasm.
type SameBoy = typeof import("./sameboy.ts");
let sameboy: SameBoy | undefined;
let sameboyReady: Promise<void> | undefined;
function prepareSameBoy() {
  sameboyReady ??= import("./sameboy.ts")
    .then(async (lib) => {
      await lib.prepareSameBoy();
      sameboy = lib;
    })
    .catch((error: unknown) => {
      sameboyReady = undefined;
      throw error;
    });
  return sameboyReady;
}

/** Game Boy and Game Boy Color share SameBoy; the header picks the model. */
const sameboyModule = (system: string, color: boolean): CoreModule => ({
  system,
  id: "sameboy",
  version: "1.0.4",
  video: { width: 160, height: 144 },
  maxRomBytes: MAX_GB_ROM_BYTES,
  validate: validateGbRom,
  demo: () => gbControlDemo(color),
  prepare: prepareSameBoy,
  create(rom, save) {
    if (!sameboy) throw Error("El núcleo SameBoy no está preparado.");
    return new sameboy.SameBoyAdapter(rom, save);
  },
});

let tetanesReady: Promise<void> | undefined;

const nesVideo = { width: 256, height: 240 };

export const coreModules: readonly CoreModule[] = [
  {
    system: "nes",
    id: "tetanes",
    version: "0.17.0",
    video: nesVideo,
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
    maxRomBytes: MAX_ROM_BYTES,
    validate: validateRom,
    demo: controlDemo,
    prepare: () => Promise.resolve(),
    create: (rom, save) => new NesAdapter(rom, save),
  },
  sameboyModule("gb", false),
  sameboyModule("gbc", true),
];

export function coreModule(system: string, id: string): CoreModule {
  const found = coreModules.find((m) => m.system === system && m.id === id);
  if (!found) throw Error(`Núcleo ${id} no disponible para ${system}`);
  return found;
}
