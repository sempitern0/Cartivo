// Mupen64Plus-Next with GLideN64 for Nintendo 64 (ADR-017): an Emscripten
// ES module whose core draws with WebGL2 on the game canvas the page hands
// to the Worker, so it is a SurfaceModule (contract.ts): frames never cross
// to the page as RGBA. libco runs on fibers/Asyncify (src/cooperative.c).
// cores/mupen64plus-next/dist is built and committed by CI on request.
import type { EmulatorCore } from "./contract.ts";
import { compileFrom, libretroInputBits } from "./wasm-host.ts";
import type { InputState } from "../../input/src/nes-input.ts";
import { centered, toInt16, type Analog } from "../../input/src/analog.ts";

/** The parts of the Emscripten module this adapter uses (frontend.c). */
type Emscripten = {
  GL: {
    createContext(
      canvas: OffscreenCanvas,
      attributes: Record<string, unknown>,
    ): number;
    makeContextCurrent(handle: number): boolean;
  };
  FS: {
    mkdirTree(path: string): void;
    writeFile(path: string, data: Uint8Array): void;
  };
  HEAP16: Int16Array;
  HEAPU8: Uint8Array;
  stringToNewUTF8(text: string): number;
  _malloc(bytes: number): number;
  _free(pointer: number): void;
  _n64_init(): number;
  _n64_load(path: number): number;
  _n64_run(): void;
  _n64_audio(): number;
  _n64_audio_frames(): number;
  _n64_fps(): number;
  _n64_sample_rate(): number;
  _n64_input(
    bits: number,
    lx: number,
    ly: number,
    rx: number,
    ry: number,
  ): void;
  _n64_save_data(): number;
  _n64_save_size(): number;
  _n64_snapshot(): void;
  _n64_snapshot_data(): number;
  _n64_snapshot_size(): number;
  _n64_restore(data: number, size: number): void;
  _n64_restore_status(): number;
  _n64_unload(): void;
};

type Factory = (options: {
  print(text: string): void;
  printErr(text: string): void;
  instantiateWasm(
    imports: WebAssembly.Imports,
    done: (instance: WebAssembly.Instance, module: WebAssembly.Module) => void,
  ): object;
}) => Promise<Emscripten>;

const NAME = "Mupen64Plus-Next";
// Both files are build assets: the glue is loaded as a module from its URL,
// and the wasm is compiled once per Worker and instantiated per game.
const GLUE = new URL(
  "../../../cores/mupen64plus-next/dist/n64-core.mjs",
  import.meta.url,
);
const WASM = new URL(
  "../../../cores/mupen64plus-next/dist/n64-core.wasm",
  import.meta.url,
);

let ready: Promise<{ factory: Factory; wasm: WebAssembly.Module }> | undefined;
let loaded: { factory: Factory; wasm: WebAssembly.Module } | undefined;

/** Downloads the glue and compiles the wasm once per Worker. */
export function prepareN64(): Promise<void> {
  ready ??= Promise.all([
    import(/* @vite-ignore */ GLUE.href).catch((error: unknown) => {
      throw Error(`No se pudo descargar el núcleo ${NAME}.`, { cause: error });
    }),
    compileFrom(NAME, WASM),
  ]).then(
    ([glue, wasm]) => (loaded = { factory: glue.default as Factory, wasm }),
    (error: unknown) => {
      ready = undefined;
      throw error;
    },
  );
  return ready.then(() => {});
}

/** The core's fixed output rate is downmixed to the app's 48 kHz mono. */
const OUTPUT_RATE = 48000;

/**
 * Stereo 16-bit audio at `from` Hz to mono floats at 48 kHz, by linear
 * interpolation that carries its phase and last sample across batches.
 */
export class Downmix {
  #step: number;
  /** Next output position, in input samples after the previous batch's last. */
  #position = 0;
  #previous = 0;
  constructor(from: number) {
    if (!(from >= 8000 && from <= 192000))
      throw RangeError(`Frecuencia de audio inválida: ${from}`);
    this.#step = from / OUTPUT_RATE;
  }
  /** Appends the batch's output to `out`. */
  push(stereo: Int16Array, out: number[]) {
    const n = stereo.length >> 1;
    if (!n) return;
    const at = (i: number) =>
      i < 0 ? this.#previous : (stereo[i * 2] + stereo[i * 2 + 1]) / 65536;
    // Positions run from the previous batch's last sample (index −1).
    let t = this.#position - 1;
    for (; t < n - 1; t += this.#step) {
      const i = Math.floor(t);
      const a = at(i);
      out.push(a + (at(i + 1) - a) * (t - i));
    }
    this.#position = t - (n - 1);
    this.#previous = at(n - 1);
  }
}

/** One game per canvas: a new core releases the one drawing there. */
const drawing = new WeakMap<OffscreenCanvas, N64Core>();

class N64Core implements EmulatorCore {
  readonly battery = true;
  readonly saveBytes: number;
  readonly frameRate: number;
  frames = 0;
  #em: Emscripten | undefined;
  #canvas: OffscreenCanvas;
  #bits = 0;
  #sticks: Analog = centered();
  #downmix: Downmix;
  #lost = false;
  #onLost = (event: Event) => {
    event.preventDefault();
    this.#lost = true;
  };

  constructor(em: Emscripten, canvas: OffscreenCanvas) {
    this.#em = em;
    this.#canvas = canvas;
    this.saveBytes = em._n64_save_size();
    this.frameRate = em._n64_fps() || 60;
    this.#downmix = new Downmix(em._n64_sample_rate() || 44100);
    canvas.addEventListener("webglcontextlost", this.#onLost);
  }

  /** The live module; a closed core or a lost context refuses every call. */
  #live(): Emscripten {
    if (!this.#em) throw Error("El núcleo ya se ha cerrado.");
    if (this.#lost)
      throw Error(
        "El navegador ha retirado la aceleración gráfica (contexto WebGL perdido). Vuelve a abrir el juego.",
      );
    return this.#em;
  }

  input(state: InputState) {
    this.#bits = libretroInputBits(state);
  }

  analog(sticks: Analog) {
    this.#sticks = sticks;
  }

  advance(count: number) {
    if (!Number.isInteger(count) || count < 1 || count > 3)
      throw Error("Lote de frames inválido");
    const em = this.#live();
    const { left, right } = this.#sticks;
    em._n64_input(
      this.#bits,
      toInt16(left.x),
      toInt16(left.y),
      toInt16(right.x),
      toInt16(right.y),
    );
    const out: number[] = [];
    for (let i = 0; i < count; i++) {
      em._n64_run();
      const stereo = em._n64_audio_frames();
      const from = em._n64_audio() >> 1;
      this.#downmix.push(em.HEAP16.subarray(from, from + stereo * 2), out);
    }
    this.frames += count;
    return { audio: Float32Array.from(out), frames: this.frames };
  }

  save(): Uint8Array {
    const em = this.#live();
    const at = em._n64_save_data();
    return em.HEAPU8.slice(at, at + this.saveBytes);
  }

  /** The core's own state, deflated by the frontend (frontend.c). */
  snapshot(): Uint8Array {
    const em = this.#live();
    em._n64_snapshot();
    const size = em._n64_snapshot_size();
    if (!size) throw Error("El núcleo de N64 no ha podido guardar la partida.");
    const at = em._n64_snapshot_data();
    return em.HEAPU8.slice(at, at + size);
  }

  restore(bytes: Uint8Array) {
    const em = this.#live();
    const at = em._malloc(bytes.length);
    if (!at) throw Error("Memoria insuficiente para cargar la partida.");
    try {
      em.HEAPU8.set(bytes, at);
      em._n64_restore(at, bytes.length);
    } finally {
      em._free(at);
    }
    const status = em._n64_restore_status();
    if (status === -2)
      throw Error("Memoria insuficiente para cargar la partida.");
    if (status !== 0)
      throw Error("Esta partida no corresponde a este núcleo de N64.");
  }

  /** The picture lives on the GPU surface: no copy for previews yet. */
  lastFrame(): Uint8ClampedArray {
    return new Uint8ClampedArray(0);
  }

  dispose() {
    const em = this.#em;
    if (!em) return;
    this.#em = undefined;
    this.#canvas.removeEventListener("webglcontextlost", this.#onLost);
    if (drawing.get(this.#canvas) === this) drawing.delete(this.#canvas);
    try {
      em._n64_unload();
    } catch {
      // A core that aborted cannot unload; dropping it frees its memory.
    }
  }
}

/** Requires prepareN64() to have finished. */
export async function createN64(
  rom: Uint8Array,
  canvas: OffscreenCanvas,
  save?: Uint8Array,
): Promise<EmulatorCore> {
  if (!loaded) throw Error(`El núcleo ${NAME} no está preparado.`);
  const { factory, wasm } = loaded;
  // Its GL objects must go before the next core takes the context.
  drawing.get(canvas)?.dispose();
  const em = await factory({
    print: () => {},
    printErr: () => {},
    instantiateWasm(imports, done) {
      void WebAssembly.instantiate(wasm, imports).then((instance) =>
        done(instance, wasm),
      );
      return {};
    },
  });
  const context = em.GL.createContext(canvas, {
    majorVersion: 2,
    minorVersion: 0,
    alpha: false,
    depth: true,
    stencil: true,
    antialias: false,
    preserveDrawingBuffer: false,
  });
  if (!context || !em.GL.makeContextCurrent(context))
    throw Error(
      "Este navegador no ofrece WebGL2 en segundo plano, que Nintendo 64 necesita.",
    );
  em.FS.mkdirTree("/n64/system");
  em.FS.mkdirTree("/n64/save");
  em.FS.writeFile("/n64/rom.z64", rom);
  em._n64_init();
  const path = em.stringToNewUTF8("/n64/rom.z64");
  const status = em._n64_load(path);
  em._free(path);
  if (status !== 0) {
    try {
      em._n64_unload();
    } catch {
      // Nothing to release beyond the instance itself.
    }
    throw Error(
      `El núcleo de N64 no ha podido arrancar este cartucho (${status}).`,
    );
  }
  const core = new N64Core(em, canvas);
  if (save) {
    if (save.length !== core.saveBytes) {
      core.dispose();
      throw Error("Partida de N64 incompatible");
    }
    em.HEAPU8.set(save, em._n64_save_data());
  }
  drawing.set(canvas, core);
  return core;
}
