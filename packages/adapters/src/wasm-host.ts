// Shared host for Cartivo's standalone Emscripten cores (SameBoy, mGBA,
// Snes9x, Genesis Plus GX).
// Each core is a single .wasm built by CI with the same cartivo_* bridge
// (cores/<id>/src/cartivo.c); this file loads it, supplies its system
// imports and implements EmulatorCore on top of that bridge.
import type { InputState } from "../../input/src/nes-input.ts";
import type { EmulatorCore } from "./contract.ts";

type Pointer = number;
export type Bridge = {
  memory: WebAssembly.Memory;
  _initialize?: () => void;
  malloc(bytes: number): Pointer;
  free(pointer: Pointer): void;
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

const MAX_AUDIO = 48000;

/** The core file could not be fetched (network, offline cache, HTTP). */
export class CoreDownloadError extends Error {}

/**
 * Downloads and compiles a core. Streaming needs the server to send
 * `application/wasm`; if it does not (or streaming is missing), the same
 * response is compiled from its bytes. A failed download gets its own message.
 */
export async function compileFrom(
  name: string,
  url: URL,
  load: typeof fetch = fetch,
): Promise<WebAssembly.Module> {
  let response: Response;
  try {
    response = await load(url);
    if (!response.ok) throw Error(`HTTP ${response.status}`);
  } catch (error) {
    throw new CoreDownloadError(
      `No se pudo descargar el núcleo ${name}. Comprueba la conexión o reinstala la app.`,
      { cause: error },
    );
  }
  try {
    return await WebAssembly.compileStreaming(response.clone());
  } catch (error) {
    if (!(error instanceof TypeError)) throw error;
    return WebAssembly.compile(await response.arrayBuffer());
  }
}

/** Compiles a core once per Worker; Node tests hand the bytes in first. */
export function wasmLoader(name: string, url: URL) {
  let binary: Uint8Array | undefined;
  let compiled: Promise<WebAssembly.Module> | undefined;
  let ready: WebAssembly.Module | undefined;
  return {
    provide(bytes: Uint8Array) {
      binary = bytes;
    },
    prepare(): Promise<void> {
      compiled ??= (
        binary
          ? WebAssembly.compile(binary as BufferSource)
          : compileFrom(name, url)
      ).catch((error: unknown) => {
        compiled = undefined;
        if (error instanceof CoreDownloadError) throw error;
        throw Error(`No se pudo iniciar el núcleo ${name} (WebAssembly).`, {
          cause: error,
        });
      });
      return compiled.then((module) => {
        // Fail early, with the name, if a rebuilt core needs something new.
        const missing = unsupportedImports(module);
        if (missing.length) {
          compiled = undefined;
          throw Error(
            `El núcleo ${name} necesita funciones que Cartivo no ofrece: ${missing.join(", ")}.`,
          );
        }
        ready = module;
      });
    },
    module(): WebAssembly.Module {
      if (!ready) throw Error(`El núcleo ${name} no está preparado.`);
      return ready;
    },
  };
}

/** WASI errno for an operation this host does not provide (no files). */
const ENOSYS = 52;

/**
 * Every host function a standalone core may import, by module. A core that
 * imports anything else is refused at prepare() (see unsupportedImports).
 */
const allowed: Record<string, readonly string[]> = {
  // __syscall_ftruncate64: Snes9x's unused file streams (no files exist).
  env: ["emscripten_notify_memory_growth", "__syscall_ftruncate64"],
  wasi_snapshot_preview1: [
    "clock_time_get",
    "fd_write",
    "fd_read",
    "fd_close",
    "fd_seek",
    "environ_sizes_get",
    "environ_get",
    "args_sizes_get",
    "args_get",
    "proc_exit",
  ],
};

/**
 * Exception tags a core may import: the one native WebAssembly setjmp/longjmp
 * uses (`-sSUPPORT_LONGJMP=wasm`, Genesis Plus GX's 68000 address errors).
 */
const allowedTags: Record<string, readonly string[]> = {
  env: ["__c_longjmp"],
};

type Tag = { readonly __tag: unique symbol };
const TagConstructor = (
  WebAssembly as unknown as {
    Tag?: new (type: { parameters: string[] }) => Tag;
  }
).Tag;

const supported = (space: string, name: string, kind: string) =>
  kind === "function"
    ? !!allowed[space]?.includes(name)
    : kind === "tag" &&
      !!TagConstructor &&
      !!allowedTags[space]?.includes(name);

/** Imports outside the allow-list, as "module.name". */
export function unsupportedImports(module: WebAssembly.Module): string[] {
  return WebAssembly.Module.imports(module)
    .filter(({ module: space, name, kind }) => !supported(space, name, kind))
    .map(({ module: space, name }) => `${space}.${name}`);
}

/**
 * Host functions for a standalone Emscripten module: a clock, an empty
 * environment, a discarded log and no files.
 */
function hostImports(
  name: string,
  module: WebAssembly.Module,
  memory: () => ArrayBuffer,
) {
  const view = () => new DataView(memory());
  const empty = (count: number, size: number) => {
    view().setUint32(count, 0, true);
    view().setUint32(size, 0, true);
    return 0;
  };
  const host: Record<string, (...args: never[]) => unknown> = {
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
    fd_read: () => ENOSYS,
    fd_close: () => ENOSYS,
    fd_seek: () => ENOSYS,
    // Emscripten syscalls return a negative errno.
    __syscall_ftruncate64: () => -ENOSYS,
    environ_sizes_get: empty,
    environ_get: () => 0,
    args_sizes_get: empty,
    args_get: () => 0,
    proc_exit: (code: number) => {
      throw Error(`El núcleo ${name} se detuvo (código ${code}).`);
    },
    emscripten_notify_memory_growth: () => undefined,
  };
  const imports: Record<string, Record<string, WebAssembly.ImportValue>> = {};
  for (const { module: space, name: item, kind } of WebAssembly.Module.imports(
    module,
  )) {
    // TypeScript's ImportExportKind predates exception-handling tags.
    if ((kind as string) === "tag" && supported(space, item, kind)) {
      // The longjmp payload is a jmp_buf pointer (wasm32).
      (imports[space] ??= {})[item] = new TagConstructor!({
        parameters: ["i32"],
      }) as unknown as WebAssembly.ImportValue;
      continue;
    }
    const fn = allowed[space]?.includes(item) ? host[item] : undefined;
    if (!fn)
      throw Error(`Import no previsto del núcleo ${name}: ${space}.${item}`);
    (imports[space] ??= {})[item] = fn as WebAssembly.ImportValue;
  }
  return imports;
}

export type BridgeOptions<T extends Bridge> = {
  name: string;
  width: number;
  height: number;
  /** Packs Cartivo's buttons in the order the bridge expects. */
  bits(state: InputState): number;
  /** Calls the bridge's own cartivo_create with the ROM in wasm memory. */
  create(wasm: T, rom: Pointer, length: number): Pointer;
  /** The cartridge keeps a battery save (decided with the core's size). */
  battery(saveBytes: number): boolean;
};

/** EmulatorCore over a cartivo_* bridge; one wasm instance per game. */
export class BridgeCore<T extends Bridge> implements EmulatorCore {
  readonly battery: boolean;
  readonly saveBytes: number;
  frames = 0;
  #wasm: T;
  #core: Pointer;
  #options: BridgeOptions<T>;

  constructor(
    module: WebAssembly.Module,
    options: BridgeOptions<T>,
    rom: Uint8Array,
    save?: Uint8Array,
  ) {
    this.#options = options;
    let wasm: T | undefined;
    const instance = new WebAssembly.Instance(
      module,
      hostImports(options.name, module, () => wasm!.memory.buffer),
    );
    wasm = instance.exports as unknown as T;
    wasm._initialize?.();
    this.#wasm = wasm;
    this.#core = this.#withBytes(rom, (pointer) =>
      options.create(wasm, pointer, rom.length),
    );
    if (!this.#core) throw Error("El núcleo no ha podido abrir el cartucho.");
    this.saveBytes = wasm.cartivo_save_size(this.#core);
    this.battery = options.battery(this.saveBytes);
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

  /** The live core pointer; a disposed core refuses every call. */
  #live(): Pointer {
    if (!this.#core) throw Error("El núcleo ya se ha cerrado.");
    return this.#core;
  }

  /** Copies bytes into wasm memory for the duration of `use`. */
  #withBytes<R>(bytes: Uint8Array, use: (pointer: Pointer) => R): R {
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
    this.#wasm.cartivo_set_input(this.#live(), this.#options.bits(state));
  }

  advance(count: number) {
    if (!Number.isInteger(count) || count < 1 || count > 3)
      throw Error("Lote de frames inválido");
    const samples = Math.min(
      MAX_AUDIO,
      this.#wasm.cartivo_frames(this.#live(), count),
    );
    this.frames += count;
    const audio = new Float32Array(
      this.#wasm.memory.buffer,
      this.#wasm.cartivo_audio(this.#live()),
      samples,
    ).slice();
    return { pixels: this.lastFrame(), audio, frames: this.frames };
  }

  save() {
    return this.#readBytes(this.saveBytes, (pointer) =>
      this.#wasm.cartivo_save(this.#live(), pointer),
    );
  }

  /** Copy of the last presented frame (RGBA). */
  lastFrame(): Uint8ClampedArray {
    const { width, height } = this.#options;
    return new Uint8ClampedArray(
      this.#wasm.memory.buffer,
      this.#wasm.cartivo_pixels(this.#live()),
      width * height * 4,
    ).slice();
  }

  /** Full console snapshot in the core's own state format. */
  snapshot(): Uint8Array {
    const length = this.#wasm.cartivo_state_size(this.#live());
    return this.#readBytes(length, (pointer) =>
      this.#wasm.cartivo_save_state(this.#live(), pointer),
    );
  }

  /** Restores a snapshot; the bridges leave the machine untouched on failure. */
  restore(bytes: Uint8Array) {
    const result = this.#withBytes(bytes, (pointer) =>
      this.#wasm.cartivo_load_state(this.#live(), pointer, bytes.length),
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

/** Packs an InputState as bits in the given button order. */
export function packBits(
  order: readonly (keyof InputState)[],
  state: InputState,
): number {
  let bits = 0;
  order.forEach((action, i) => {
    if (state[action]) bits |= 1 << i;
  });
  return bits;
}

/**
 * RETRO_DEVICE_ID_JOYPAD_* order, shared by every bridge that drives a
 * libretro frontend (Snes9x, Genesis Plus GX). Each system maps its own
 * buttons onto these positions (systems.ts `buttons` and `labels`).
 */
const libretroOrder: readonly (keyof InputState)[] = [
  "b",
  "y",
  "select",
  "start",
  "up",
  "down",
  "left",
  "right",
  "a",
  "x",
  "l",
  "r",
];

export const libretroInputBits = (state: InputState) =>
  packBits(libretroOrder, state);
