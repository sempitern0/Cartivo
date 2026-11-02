// Snes9x (C++ → standalone WebAssembly, ADR-013), SNES only, behind the
// EmulatorCore contract. cores/snes9x/dist/snes9x.wasm is built and committed
// by CI on explicit request; this file only uses the exports in its manifest.
import { validateSnesRom } from "./snes-header.ts";
import {
  BridgeCore,
  libretroInputBits,
  wasmLoader,
  type Bridge,
} from "./wasm-host.ts";

type Snes9xBridge = Bridge & {
  cartivo_create(rom: number, length: number): number;
};

const loader = wasmLoader(
  "Snes9x",
  new URL("../../../cores/snes9x/dist/snes9x.wasm", import.meta.url),
);

/** Node tests cannot fetch file URLs: hand the bytes in before prepare(). */
export const provideSnes9xBinary = (bytes: Uint8Array) => loader.provide(bytes);

/** Compiles the wasm once per Worker (lazy: only when a SNES game starts). */
export const prepareSnes9x = () => loader.prepare();

export class Snes9xAdapter extends BridgeCore<Snes9xBridge> {
  /** Requires prepareSnes9x() to have finished. */
  constructor(rom: Uint8Array, save?: Uint8Array) {
    validateSnesRom(rom);
    super(
      loader.module(),
      {
        name: "Snes9x",
        width: 256,
        height: 224,
        bits: libretroInputBits,
        create: (wasm, pointer, length) => wasm.cartivo_create(pointer, length),
        // Snes9x sizes battery RAM from the header; 0 means none.
        battery: (saveBytes) => saveBytes > 0,
      },
      rom,
      save,
    );
  }
}
