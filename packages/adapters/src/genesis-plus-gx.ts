// Genesis Plus GX (C → standalone WebAssembly, ADR-014) for Master System and
// Mega Drive, behind the EmulatorCore contract. cores/genesis-plus-gx/dist is
// built and committed by CI on explicit request.
import { validateMdRom, validateSmsRom } from "./sega-header.ts";
import {
  BridgeCore,
  libretroInputBits,
  wasmLoader,
  type Bridge,
} from "./wasm-host.ts";

type GenesisBridge = Bridge & {
  cartivo_create(rom: number, length: number, system: number): number;
};

const loader = wasmLoader(
  "Genesis Plus GX",
  new URL(
    "../../../cores/genesis-plus-gx/dist/genesis-plus-gx.wasm",
    import.meta.url,
  ),
);

/** Node tests cannot fetch file URLs: hand the bytes in before prepare(). */
export const provideGenesisBinary = (bytes: Uint8Array) =>
  loader.provide(bytes);

/** Compiles the wasm once per Worker (lazy: only when a Sega game starts). */
export const prepareGenesis = () => loader.prepare();

const systems = {
  md: { id: 0, width: 320, height: 224, validate: validateMdRom },
  sms: { id: 1, width: 256, height: 192, validate: validateSmsRom },
} as const;

export class GenesisPlusGxAdapter extends BridgeCore<GenesisBridge> {
  /** Requires prepareGenesis() to have finished. */
  constructor(
    system: keyof typeof systems,
    rom: Uint8Array,
    save?: Uint8Array,
  ) {
    const { id, width, height, validate } = systems[system];
    validate(rom);
    super(
      loader.module(),
      {
        name: "Genesis Plus GX",
        width,
        height,
        // Mega Drive A/B/C on Y/B/A, X/Y/Z on L/X/R, Mode on select; Master
        // System 1/2 on B/A and Pause on start (systems.ts labels).
        bits: libretroInputBits,
        create: (wasm, pointer, length) =>
          wasm.cartivo_create(pointer, length, id),
        // A fixed 64 KiB buffer whenever the cartridge maps battery RAM.
        battery: (saveBytes) => saveBytes > 0,
      },
      rom,
      save,
    );
  }
}
