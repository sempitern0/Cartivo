import { NES, Controller } from "jsnes";
import {
  actions,
  type Action,
  type InputState,
} from "../../input/src/nes-input.ts";
const buttons: Record<Action, 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7> = {
  a: Controller.BUTTON_A,
  b: Controller.BUTTON_B,
  select: Controller.BUTTON_SELECT,
  start: Controller.BUTTON_START,
  up: Controller.BUTTON_UP,
  down: Controller.BUTTON_DOWN,
  left: Controller.BUTTON_LEFT,
  right: Controller.BUTTON_RIGHT,
};
export { MAX_ROM_BYTES, acceptedMappers, validateRom } from "./ines.ts";
import { validateRom } from "./ines.ts";
/** Private pinned ABI: mapper0.js uses cpu.mem[$6000..$7fff]. Never exposed to UI. */
type SramABI = { cpu: { mem: Uint8Array | number[] } };
export class NesAdapter {
  private core: NES;
  private pixels = new Uint8ClampedArray(256 * 240 * 4);
  private audio: number[] = [];
  readonly battery: boolean;
  frames = 0;
  constructor(rom: Uint8Array, save?: Uint8Array) {
    this.battery = validateRom(rom).battery;
    this.core = new NES({
      sampleRate: 48000,
      onFrame: (buffer) => {
        for (let i = 0; i < buffer.length; i++) {
          const color = buffer[i];
          const j = i * 4;
          this.pixels[j] = color & 255;
          this.pixels[j + 1] = (color >> 8) & 255;
          this.pixels[j + 2] = (color >> 16) & 255;
          this.pixels[j + 3] = 255;
        }
      },
      onAudioSample: (l, r) => {
        if (this.audio.length < 48000) this.audio.push((l + r) / 2);
      },
    });
    this.core.loadROM(rom);
    const memory = (this.core as unknown as SramABI).cpu.mem;
    if (memory.length !== 65536) throw Error("ABI SRAM inesperada");
    if (save && save.length !== 8192) throw Error("Partida SRAM incompatible");
    for (let i = 0; i < 8192; i++) memory[0x6000 + i] = save?.[i] ?? 0;
  }
  input(state: InputState) {
    for (const action of actions)
      this.core[state[action] ? "buttonDown" : "buttonUp"](1, buttons[action]);
  }
  advance(count: number) {
    if (!Number.isInteger(count) || count < 1 || count > 3)
      throw Error("Lote de frames inválido");
    this.audio = [];
    for (let i = 0; i < count; i++) {
      this.core.frame();
      this.frames++;
    }
    return {
      pixels: this.pixels.slice(),
      audio: Float32Array.from(this.audio),
      frames: this.frames,
    };
  }
  /** Copy of the last presented frame (RGBA 256×240). */
  lastFrame(): Uint8ClampedArray {
    return this.pixels.slice();
  }
  /** Full console snapshot (JSNES `toJSON`), encoded as UTF-8 JSON. */
  snapshot(): Uint8Array {
    return new TextEncoder().encode(JSON.stringify(this.core.toJSON()));
  }
  /** Restores a snapshot from `snapshot()`; throws on malformed data. */
  restore(bytes: Uint8Array) {
    let state: unknown;
    try {
      state = JSON.parse(new TextDecoder().decode(bytes));
    } catch {
      throw Error("La partida guardada está dañada");
    }
    this.core.fromJSON(state as Parameters<NES["fromJSON"]>[0]);
  }
  /** Nothing to release: plain JavaScript objects are garbage collected. */
  dispose() {}
  save() {
    return Uint8Array.from(
      (this.core as unknown as SramABI).cpu.mem.slice(0x6000, 0x8000),
    );
  }
}
