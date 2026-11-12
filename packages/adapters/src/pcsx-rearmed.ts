// PCSX-ReARMed (C → standalone WebAssembly, ADR-015) for PlayStation, behind
// the EmulatorCore contract, with its own HLE BIOS. The disc is read on
// demand through the host's VFS (disc.ts). cores/pcsx-rearmed/dist is built
// and committed by CI on explicit request.
import type { DiscTray } from "./contract.ts";
import type { DiscImage } from "./disc.ts";
import {
  BridgeCore,
  libretroInputBits,
  wasmLoader,
  type Bridge,
} from "./wasm-host.ts";

type PcsxBridge = Bridge & {
  cartivo_create(path: number, length: number): number;
  /** Multi-disc games (cartivo.c): the index added, or −1. */
  cartivo_disc_add(core: number, path: number, length: number): number;
  cartivo_disc_index(core: number): number;
  /** 0 when the disc is in. */
  cartivo_disc_insert(core: number, index: number): number;
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
  /** The other discs of an .m3u, added after the first one boots. */
  readonly discs?: DiscTray;

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
    if (disc.discs.length < 2) return;
    // The core numbers its discs in the order they were given: the one it
    // booted, then the rest. The tray speaks in the game's own order.
    const order = [
      disc.discs[disc.first],
      ...disc.discs.filter((_, i) => i !== disc.first),
    ];
    for (const name of order.slice(1)) {
      const added = this.call((wasm, core) =>
        this.withText(name, (path, length) =>
          wasm.cartivo_disc_add(core, path, length),
        ),
      );
      if (added < 0) {
        this.dispose();
        throw Error("El núcleo admite ocho discos como máximo por juego.");
      }
    }
    this.discs = {
      names: disc.discs,
      current: () =>
        disc.discs.indexOf(
          order[this.call((wasm, core) => wasm.cartivo_disc_index(core))],
        ),
      insert: (index) => {
        const slot = order.indexOf(disc.discs[index]);
        if (
          slot < 0 ||
          this.call((wasm, core) => wasm.cartivo_disc_insert(core, slot))
        )
          throw Error(`No se ha podido poner el disco ${index + 1}.`);
      },
    };
  }
}
