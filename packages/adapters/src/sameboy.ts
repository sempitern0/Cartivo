// SameBoy (C → standalone WebAssembly, ADR-010) behind the EmulatorCore
// contract. cores/sameboy/dist/sameboy.wasm is built and committed by CI on
// explicit request; this file only uses the exports listed in its manifest.
import type { Action, InputState } from "../../input/src/nes-input.ts";
import type { EmulatorCore } from "./contract.ts";
import { validateGbRom } from "./gb-header.ts";

const WIDTH = 160;
const HEIGHT = 144;
const MAX_AUDIO = 48000;

type Pointer = number;
type Exports = {
  memory: WebAssembly.Memory;
  _initialize?: () => void;
  malloc(bytes: number): Pointer;
  free(pointer: Pointer): void;
  cartivo_create(rom: Pointer, length: number, cgb: number): Pointer;
  cartivo_free(core: Pointer): void;
  cartivo_save_size(core: Pointer): number;
  cartivo_load_save(core: Pointer, data: Pointer, length: number): void;
  cartivo_save(core: Pointer, out: Pointer): void;
  cartivo_set_input(core: Pointer, bits: number): void;
  cartivo_frames(core: Pointer, count: number): number;
  cartivo_pixels(core: Pointer): Pointer;
  cartivo_audio(core: Pointer): Pointer;
  cartivo_state_size(core: Pointer): number;
  cartivo_save_state(core: Pointer, out: Pointer): void;
  cartivo_load_state(core: Pointer, data: Pointer, length: number): number;
};

// Bit order must match GB_key_t (cores/sameboy/src/cartivo.c).
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

export function gbInputBits(state: InputState): number {
  let bits = 0;
  order.forEach((action, i) => {
    if (state[action]) bits |= 1 << i;
  });
  return bits;
}

let binary: Uint8Array | undefined;
let compiled: Promise<WebAssembly.Module> | undefined;
let ready: WebAssembly.Module | undefined;

/** Node tests cannot fetch file URLs: hand the bytes in before prepare(). */
export function provideSameBoyBinary(bytes: Uint8Array) {
  binary = bytes;
}

/** Compiles the wasm once per Worker (lazy: only when a GB game starts). */
export function prepareSameBoy(): Promise<void> {
  compiled ??= (
    binary
      ? WebAssembly.compile(binary as BufferSource)
      : WebAssembly.compileStreaming(
          fetch(
            new URL(
              "../../../cores/sameboy/dist/sameboy.wasm",
              import.meta.url,
            ),
          ),
        )
  ).catch((error: unknown) => {
    compiled = undefined;
    throw Error("No se pudo iniciar el núcleo SameBoy (WebAssembly).", {
      cause: error,
    });
  });
  return compiled.then((module) => {
    ready = module;
  });
}

/**
 * Host functions for a standalone Emscripten module. Only a clock and a
 * discarded log are needed; anything else reports "not supported" (52).
 */
function hostImports(module: WebAssembly.Module, memory: () => ArrayBuffer) {
  const view = () => new DataView(memory());
  const known: Record<string, (...args: never[]) => unknown> = {
    clock_time_get: (_id: number, _precision: bigint, out: number) => {
      view().setBigUint64(out, BigInt(Date.now()) * 1_000_000n, true);
      return 0;
    },
    fd_write: (_fd: number, iovs: number, count: number, written: number) => {
      let total = 0;
      for (let i = 0; i < count; i++)
        total += view().getUint32(iovs + i * 8 + 4, true);
      view().setUint32(written, total, true);
      return 0;
    },
    environ_sizes_get: (count: number, size: number) => {
      view().setUint32(count, 0, true);
      view().setUint32(size, 0, true);
      return 0;
    },
    proc_exit: (code: number) => {
      throw Error(`El núcleo SameBoy se detuvo (código ${code}).`);
    },
    emscripten_notify_memory_growth: () => undefined,
  };
  const imports: Record<string, Record<string, WebAssembly.ImportValue>> = {};
  for (const { module: space, name, kind } of WebAssembly.Module.imports(
    module,
  )) {
    if (kind !== "function")
      throw Error(`Import inesperado del núcleo: ${space}.${name}`);
    (imports[space] ??= {})[name] = (known[name] ??
      (() => 52)) as WebAssembly.ImportValue;
  }
  return imports;
}

export class SameBoyAdapter implements EmulatorCore {
  readonly battery: boolean;
  readonly saveBytes: number;
  frames = 0;
  #wasm: Exports;
  #core: Pointer;

  /** Requires prepareSameBoy() to have finished. */
  constructor(rom: Uint8Array, save?: Uint8Array) {
    const cartridge = validateGbRom(rom);
    if (!ready) throw Error("El núcleo SameBoy no está preparado.");
    let wasm: Exports | undefined;
    const instance = new WebAssembly.Instance(
      ready,
      hostImports(ready, () => wasm!.memory.buffer),
    );
    wasm = instance.exports as unknown as Exports;
    wasm._initialize?.();
    this.#wasm = wasm;
    this.#core = this.#withBytes(rom, (pointer) =>
      wasm.cartivo_create(pointer, rom.length, cartridge.cgb ? 1 : 0),
    );
    if (!this.#core) throw Error("Memoria insuficiente para el núcleo.");
    this.saveBytes = wasm.cartivo_save_size(this.#core);
    this.battery = cartridge.battery && this.saveBytes > 0;
    if (save) {
      if (save.length !== this.saveBytes) {
        this.dispose();
        throw Error("Partida SRAM incompatible");
      }
      this.#withBytes(save, (pointer) =>
        wasm.cartivo_load_save(this.#core, pointer, save.length),
      );
    }
  }

  /** Copies bytes into wasm memory for the duration of `use`. */
  #withBytes<T>(bytes: Uint8Array, use: (pointer: Pointer) => T): T {
    const pointer = this.#wasm.malloc(Math.max(1, bytes.length));
    if (!pointer) throw Error("Memoria insuficiente para el núcleo.");
    try {
      new Uint8Array(this.#wasm.memory.buffer).set(bytes, pointer);
      return use(pointer);
    } finally {
      this.#wasm.free(pointer);
    }
  }

  /** Reads `length` bytes written by `fill` into a temporary buffer. */
  #readBytes(length: number, fill: (pointer: Pointer) => void): Uint8Array {
    const pointer = this.#wasm.malloc(Math.max(1, length));
    if (!pointer) throw Error("Memoria insuficiente para el núcleo.");
    try {
      fill(pointer);
      return new Uint8Array(this.#wasm.memory.buffer, pointer, length).slice();
    } finally {
      this.#wasm.free(pointer);
    }
  }

  input(state: InputState) {
    this.#wasm.cartivo_set_input(this.#core, gbInputBits(state));
  }

  advance(count: number) {
    if (!Number.isInteger(count) || count < 1 || count > 3)
      throw Error("Lote de frames inválido");
    const samples = Math.min(
      MAX_AUDIO,
      this.#wasm.cartivo_frames(this.#core, count),
    );
    this.frames += count;
    const audio = new Float32Array(
      this.#wasm.memory.buffer,
      this.#wasm.cartivo_audio(this.#core),
      samples,
    ).slice();
    return { pixels: this.lastFrame(), audio, frames: this.frames };
  }

  save() {
    return this.#readBytes(this.saveBytes, (pointer) =>
      this.#wasm.cartivo_save(this.#core, pointer),
    );
  }

  /** Copy of the last presented frame (RGBA 160×144). */
  lastFrame(): Uint8ClampedArray {
    return new Uint8ClampedArray(
      this.#wasm.memory.buffer,
      this.#wasm.cartivo_pixels(this.#core),
      WIDTH * HEIGHT * 4,
    ).slice();
  }

  /** Full console snapshot in SameBoy's own state format. */
  snapshot(): Uint8Array {
    const length = this.#wasm.cartivo_state_size(this.#core);
    return this.#readBytes(length, (pointer) =>
      this.#wasm.cartivo_save_state(this.#core, pointer),
    );
  }

  /** Restores a snapshot; SameBoy leaves the machine untouched on failure. */
  restore(bytes: Uint8Array) {
    const result = this.#withBytes(bytes, (pointer) =>
      this.#wasm.cartivo_load_state(this.#core, pointer, bytes.length),
    );
    if (result !== 0)
      throw Error(
        "La partida guardada no corresponde a este juego o está dañada",
      );
  }

  /** Frees the core; the instance and its memory are then garbage. */
  dispose() {
    if (!this.#core) return;
    this.#wasm.cartivo_free(this.#core);
    this.#core = 0;
  }
}
