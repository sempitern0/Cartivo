// SameBoy (C → standalone WebAssembly, ADR-010) behind the EmulatorCore
// contract. cores/sameboy/dist/sameboy.wasm is built and committed by CI on
// explicit request; this file only uses the exports listed in its manifest.
import type { Action, InputState } from "../../input/src/nes-input.ts";
import { validateGbRom } from "./gb-header.ts";
import { BridgeCore, packBits, wasmLoader, type Bridge } from "./wasm-host.ts";

type SameBoyBridge = Bridge & {
  cartivo_create(rom: number, length: number, cgb: number): number;
};

// Bit order must match GB_key_t (cores/sameboy/src/cartivo.c); L/R unused.
const order: readonly Action[] = [
  "right",
  "left",
  "up",
  "down",
  "a",
  "b",
  "select",
  "start",
];

export const gbInputBits = (state: InputState) => packBits(order, state);

const loader = wasmLoader(
  "SameBoy",
  new URL("../../../cores/sameboy/dist/sameboy.wasm", import.meta.url),
);

/** Node tests cannot fetch file URLs: hand the bytes in before prepare(). */
export const provideSameBoyBinary = (bytes: Uint8Array) =>
  loader.provide(bytes);

/** Compiles the wasm once per Worker (lazy: only when a GB game starts). */
export const prepareSameBoy = () => loader.prepare();

export class SameBoyAdapter extends BridgeCore<SameBoyBridge> {
  /** Requires prepareSameBoy() to have finished. */
  constructor(rom: Uint8Array, save?: Uint8Array) {
    const cartridge = validateGbRom(rom);
    super(
      loader.module(),
      {
        name: "SameBoy",
        width: 160,
        height: 144,
        bits: gbInputBits,
        // The header picks DMG or CGB hardware.
        create: (wasm, pointer, length) =>
          wasm.cartivo_create(pointer, length, cartridge.cgb ? 1 : 0),
        battery: (saveBytes) => cartridge.battery && saveBytes > 0,
      },
      rom,
      save,
    );
  }
}
