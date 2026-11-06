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
import { MAX_GBA_ROM_BYTES, validateGbaRom } from "./gba-header.ts";
import { gbaControlDemo } from "../../fixtures/src/gba-control-demo.ts";
import { MAX_SNES_ROM_BYTES, validateSnesRom } from "./snes-header.ts";
import { snesControlDemo } from "../../fixtures/src/snes-control-demo.ts";
import {
  MAX_MD_ROM_BYTES,
  MAX_SMS_ROM_BYTES,
  validateMdRom,
  validateSmsRom,
} from "./sega-header.ts";
import { smsControlDemo } from "../../fixtures/src/sms-control-demo.ts";
import { mdControlDemo } from "../../fixtures/src/md-control-demo.ts";
import { ps1ControlDemo } from "../../fixtures/src/ps1-control-demo.ts";

/**
 * Loads an adapter module the first time its system starts: players of other
 * systems never download its glue or wasm. A failed load can be retried.
 */
function onDemand<T>(
  name: string,
  load: () => Promise<T>,
  prepare: (lib: T) => Promise<void>,
) {
  let lib: T | undefined;
  let ready: Promise<void> | undefined;
  return {
    prepare: () =>
      (ready ??= load()
        .then(async (loaded) => {
          await prepare(loaded);
          lib = loaded;
        })
        .catch((error: unknown) => {
          ready = undefined;
          throw error;
        })),
    get(): T {
      if (!lib) throw Error(`El núcleo ${name} no está preparado.`);
      return lib;
    },
  };
}

const sameboy = onDemand(
  "SameBoy",
  () => import("./sameboy.ts"),
  (lib) => lib.prepareSameBoy(),
);
const mgba = onDemand(
  "mGBA",
  () => import("./mgba.ts"),
  (lib) => lib.prepareMgba(),
);
const snes9x = onDemand(
  "Snes9x",
  () => import("./snes9x.ts"),
  (lib) => lib.prepareSnes9x(),
);
const genesis = onDemand(
  "Genesis Plus GX",
  () => import("./genesis-plus-gx.ts"),
  (lib) => lib.prepareGenesis(),
);
const pcsx = onDemand(
  "PCSX-ReARMed",
  () => import("./pcsx-rearmed.ts"),
  (lib) => lib.preparePcsx(),
);

/** Game Boy and Game Boy Color share SameBoy; the header picks the model. */
const sameboyModule = (system: string, color: boolean): CoreModule => ({
  system,
  id: "sameboy",
  version: "1.0.4",
  video: { width: 160, height: 144 },
  maxRomBytes: MAX_GB_ROM_BYTES,
  validate: validateGbRom,
  demo: () => gbControlDemo(color),
  prepare: sameboy.prepare,
  create: (rom, save) => new (sameboy.get().SameBoyAdapter)(rom, save),
});

let tetanesReady: Promise<void> | undefined;

/** Genesis Plus GX has no releases: the snapshot version is the commit. */
const GENESIS_VERSION = "a5834b3";
/** Neither do PCSX-ReARMed's libretro builds. */
const PCSX_VERSION = "7b0e8f8";

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
  {
    system: "gba",
    id: "mgba",
    version: "0.10.5",
    video: { width: 240, height: 160 },
    maxRomBytes: MAX_GBA_ROM_BYTES,
    validate: validateGbaRom,
    demo: gbaControlDemo,
    prepare: mgba.prepare,
    create: (rom, save) => new (mgba.get().MgbaAdapter)(rom, save),
  },
  {
    system: "snes",
    id: "snes9x",
    version: "1.63",
    video: { width: 256, height: 224 },
    maxRomBytes: MAX_SNES_ROM_BYTES,
    validate: validateSnesRom,
    demo: snesControlDemo,
    prepare: snes9x.prepare,
    create: (rom, save) => new (snes9x.get().Snes9xAdapter)(rom, save),
  },
  {
    system: "sms",
    id: "genesis-plus-gx",
    version: GENESIS_VERSION,
    video: { width: 256, height: 192 },
    maxRomBytes: MAX_SMS_ROM_BYTES,
    validate: validateSmsRom,
    demo: smsControlDemo,
    prepare: genesis.prepare,
    create: (rom, save) =>
      new (genesis.get().GenesisPlusGxAdapter)("sms", rom, save),
  },
  {
    system: "md",
    id: "genesis-plus-gx",
    version: GENESIS_VERSION,
    video: { width: 320, height: 224 },
    maxRomBytes: MAX_MD_ROM_BYTES,
    validate: validateMdRom,
    demo: mdControlDemo,
    prepare: genesis.prepare,
    create: (rom, save) =>
      new (genesis.get().GenesisPlusGxAdapter)("md", rom, save),
  },
  {
    system: "ps1",
    id: "pcsx-rearmed",
    version: PCSX_VERSION,
    disc: true,
    // A .cue names its tracks; a lone .bin is a single-track image.
    boots: [".cue", ".iso", ".exe", ".bin"],
    video: { width: 640, height: 480 },
    demo: () => ({ name: "cartivo-demo.exe", bytes: ps1ControlDemo() }),
    prepare: pcsx.prepare,
    create: (disc, save) => new (pcsx.get().PcsxRearmedAdapter)(disc, save),
  },
];

/** The registered core of a system, or undefined (e.g. from an old file). */
export const findCoreModule = (system: string, id: string) =>
  coreModules.find((m) => m.system === system && m.id === id);

export function coreModule(system: string, id: string): CoreModule {
  const found = findCoreModule(system, id);
  if (!found) throw Error(`Núcleo ${id} no disponible para ${system}`);
  return found;
}
