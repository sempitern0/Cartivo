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
export const MAX_ROM_BYTES = 16 + 32768 + 8192;
export function validateNrom(bytes: Uint8Array): { battery: boolean } {
  if (
    bytes.length < 16 ||
    bytes.length > MAX_ROM_BYTES ||
    bytes[0] !== 0x4e ||
    bytes[1] !== 0x45 ||
    bytes[2] !== 0x53 ||
    bytes[3] !== 0x1a
  )
    throw Error(
      "Archivo NES inválido o demasiado grande. Este incremento admite NROM de hasta 32 KB PRG.",
    );
  if ((bytes[7] & 0x0c) === 8) throw Error("NES 2.0 todavía no está admitido.");
  if ((bytes[6] >> 4) | (bytes[7] & 0xf0))
    throw Error("Este incremento solo admite cartuchos NROM (mapper 0).");
  if (
    bytes[6] & 0x0c ||
    bytes[7] & 15 ||
    bytes[9] !== 0 ||
    bytes[10] !== 0 ||
    bytes.slice(11, 16).some((v) => v !== 0)
  )
    throw Error(
      "Solo iNES NTSC estándar, sin trainer, VS, FDS ni extensiones.",
    );
  if (
    (bytes[4] !== 1 && bytes[4] !== 2) ||
    bytes[5] > 1 ||
    bytes[8] > 1 ||
    bytes.length !== 16 + bytes[4] * 16384 + bytes[5] * 8192
  )
    throw Error("Tamaño de cartucho NROM incorrecto o truncado.");
  return { battery: !!(bytes[6] & 2) };
}
/** Private pinned ABI: mapper0.js uses cpu.mem[$6000..$7fff]. Never exposed to UI. */
type SramABI = { cpu: { mem: Uint8Array | number[] } };
export class NesAdapter {
  private core: NES;
  private pixels = new Uint8ClampedArray(256 * 240 * 4);
  private audio: number[] = [];
  readonly battery: boolean;
  frames = 0;
  constructor(rom: Uint8Array, save?: Uint8Array) {
    this.battery = validateNrom(rom).battery;
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
  save() {
    return Uint8Array.from(
      (this.core as unknown as SramABI).cpu.mem.slice(0x6000, 0x8000),
    );
  }
}
