// mGBA (C → standalone WebAssembly, ADR-011), Game Boy Advance only, behind
// the EmulatorCore contract. cores/mgba/dist/mgba.wasm is built and
// committed by CI on explicit request; it runs mGBA's own HLE BIOS.
import type { Action, InputState } from "../../input/src/nes-input.ts";
import { validateGbaRom } from "./gba-header.ts";
import { BridgeCore, packBits, wasmLoader, type Bridge } from "./wasm-host.ts";

type MgbaBridge = Bridge & {
  cartivo_create(rom: number, length: number): number;
};

// Bit order must match GBAKey (cores/mgba/src/cartivo.c): R before L.
const order: readonly Action[] = [
  "a",
  "b",
  "select",
  "start",
  "right",
  "left",
  "up",
  "down",
  "r",
  "l",
];

export const gbaInputBits = (state: InputState) => packBits(order, state);

const loader = wasmLoader(
  "mGBA",
  new URL("../../../cores/mgba/dist/mgba.wasm", import.meta.url),
);

/** Node tests cannot fetch file URLs: hand the bytes in before prepare(). */
export const provideMgbaBinary = (bytes: Uint8Array) => loader.provide(bytes);

/** Compiles the wasm once per Worker (lazy: only when a GBA game starts). */
export const prepareMgba = () => loader.prepare();

export class MgbaAdapter extends BridgeCore<MgbaBridge> {
  /** Requires prepareMgba() to have finished. */
  constructor(rom: Uint8Array, save?: Uint8Array) {
    validateGbaRom(rom);
    super(
      loader.module(),
      {
        name: "mGBA",
        width: 240,
        height: 160,
        bits: gbaInputBits,
        create: (wasm, pointer, length) => wasm.cartivo_create(pointer, length),
        // A fixed 128 KiB buffer: any GBA cartridge may have a save chip.
        battery: () => true,
      },
      rom,
      save,
    );
  }
}
