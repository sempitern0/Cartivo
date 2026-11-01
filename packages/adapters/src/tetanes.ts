// TetaNES (tetanes-core, Rust → WebAssembly) behind the same surface as the
// JSNES adapter. The wasm-bindgen glue lives in cores/tetanes/dist and is
// built and committed by CI (ADR-008); this file never touches its internals.
import { Core } from "../../../cores/tetanes/dist/tetanes.js";
import type { Action, InputState } from "../../input/src/nes-input.ts";
import { validateRom } from "./ines.ts";

/** Battery RAM exchanged with Cartivo's store and backups: always 8 KB. */
export const SRAM_BYTES = 8192;

// Bit order must match BUTTONS in cores/tetanes/src/lib.rs.
const order: readonly Action[] = [
  "up",
  "down",
  "left",
  "right",
  "a",
  "b",
  "select",
  "start",
];

export function inputBits(state: InputState): number {
  let bits = 0;
  order.forEach((action, i) => {
    if (state[action]) bits |= 1 << i;
  });
  return bits;
}

export class TetanesAdapter {
  private core: Core;
  readonly battery: boolean;
  readonly saveBytes = SRAM_BYTES;
  frames = 0;
  /** Requires the wasm module to be initialised (see core.ts). */
  constructor(rom: Uint8Array, save?: Uint8Array) {
    this.battery = validateRom(rom).battery;
    if (save && save.length !== SRAM_BYTES)
      throw Error("Partida SRAM incompatible");
    this.core = new Core(rom, 48000);
    if (save && this.core.battery) this.core.set_sram(save);
  }
  input(state: InputState) {
    this.core.set_input(inputBits(state));
  }
  advance(count: number) {
    if (!Number.isInteger(count) || count < 1 || count > 3)
      throw Error("Lote de frames inválido");
    this.core.frames(count);
    this.frames += count;
    const audio = this.core.audio();
    return {
      pixels: new Uint8ClampedArray(this.core.pixels().buffer),
      // Same bound as JSNES: never hand the host more than one second.
      audio: audio.length > 48000 ? audio.subarray(0, 48000) : audio,
      frames: this.frames,
    };
  }
  save() {
    const out = new Uint8Array(SRAM_BYTES);
    if (this.core.battery) out.set(this.core.sram().subarray(0, SRAM_BYTES));
    return out;
  }
  /** Copy of the last presented frame (RGBA 256×240; empty before any frame). */
  lastFrame(): Uint8ClampedArray {
    return new Uint8ClampedArray(this.core.pixels().buffer);
  }
  /** Full console snapshot in TetaNES' own (compressed) state format. */
  snapshot(): Uint8Array {
    return this.core.save_state();
  }
  /** Restores a snapshot; TetaNES rejects states of another cartridge. */
  restore(bytes: Uint8Array) {
    try {
      this.core.load_state(bytes);
    } catch {
      throw Error(
        "La partida guardada no corresponde a este juego o está dañada",
      );
    }
  }
  /** Frees the wasm-side instance; the adapter is unusable afterwards. */
  dispose() {
    this.core.free();
  }
}
