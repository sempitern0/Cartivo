// PCSX-ReARMed (C → standalone WebAssembly, ADR-015) for PlayStation, behind
// the EmulatorCore contract, with its own HLE BIOS. The disc is read on
// demand through the host's VFS (disc.ts). cores/pcsx-rearmed/dist is built
// and committed by CI on explicit request.
import type { DiscImage } from "./disc.ts";
import {
  BridgeCore,
  libretroInputBits,
  wasmLoader,
  type Bridge,
} from "./wasm-host.ts";

type PcsxBridge = Bridge & {
  cartivo_create(path: number, length: number): number;
};

const loader = wasmLoader(
  "PCSX-ReARMed",
  new URL(
    "../../../cores/pcsx-rearmed/dist/pcsx-rearmed.wasm",
    import.meta.url,
  ),
);

/** Node tests cannot fetch file URLs: hand the bytes in before prepare(). */
export const providePcsxBinary = (bytes: Uint8Array) => loader.provide(bytes);

/** Compiles the wasm once per Worker (lazy: only when a PS1 game starts). */
export const preparePcsx = () => loader.prepare();

/** Every PlayStation mode is scaled by the bridge to this 4:3 frame. */
export const PS1_FRAME = { width: 640, height: 480 } as const;

export class PcsxRearmedAdapter extends BridgeCore<PcsxBridge> {
  /** Requires preparePcsx() to have finished. */
  constructor(disc: DiscImage, save?: Uint8Array) {
    super(
      loader.module(),
      {
        name: "PCSX-ReARMed",
        ...PS1_FRAME,
        // Cross/Circle/Square/Triangle on B/A/Y/X, L1/R1 on L/R, then L2/R2
        // (libretro order; systems.ts labels).
        bits: libretroInputBits,
        create: (wasm, path, length) => wasm.cartivo_create(path, length),
        // Memory card 1 is always there; it is saved like battery RAM.
        battery: (saveBytes) => saveBytes > 0,
      },
      disc,
      save,
    );
  }
}
