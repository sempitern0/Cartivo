// Play! for PlayStation 2 (ADR-022): an Emscripten ES module with pthreads
// (the console runs on its own thread, so the app must be cross-origin
// isolated, ADR-020) whose GS draws with WebGL2 on the game canvas the page
// hands to the Worker (ADR-017). The game stays in the player's files: Play!
// asks this adapter for the sectors it needs (ADR-015).
// cores/play/dist is built and committed by CI on request; its frontend is
// cores/play/src/cartivo.cpp.
import { AudioPace } from "./audio-pace.ts";
import type { EmulatorCore } from "./contract.ts";
import type { DiscImage } from "./disc.ts";
import { surfaceFrame, useSurface, type EmscriptenGl } from "./surface.ts";
import { compileFrom, libretroInputBits } from "./wasm-host.ts";
import type { InputState } from "../../input/src/nes-input.ts";
import type { DiscPart } from "../../storage/src/disc-identity.ts";
import { centered, toInt16, type Analog } from "../../input/src/analog.ts";

/** The parts of the Emscripten module this adapter uses. */
type Emscripten = {
  GL: EmscriptenGl;
  FS: { writeFile(path: string, data: Uint8Array): void };
  /**
   * Play!'s disc image under Emscripten (Js_DiscImageDeviceStream.cpp):
   * its only image, whatever path it is given, set by the host.
   */
  discImageDevice?: {
    getFileSize(): number;
    read(pointer: number, position: number, size: number): void;
    isDone(): boolean;
  };
  PThread: { terminateAllThreads(): void };
  /** Shared and growable: views are made from its current buffer. */
  wasmMemory: WebAssembly.Memory;
  stringToNewUTF8(text: string): number;
  _malloc(bytes: number): number;
  _free(pointer: number): void;
  _cartivo_create(path: number, length: number, scale: number): number;
  _cartivo_free(game: number): void;
  _cartivo_set_input(game: number, bits: number): void;
  _cartivo_set_analog(
    game: number,
    lx: number,
    ly: number,
    rx: number,
    ry: number,
  ): void;
  _cartivo_frames(game: number, count: number): number;
  _cartivo_audio(game: number): number;
  _cartivo_frame_rate(game: number): number;
  _cartivo_snapshot(game: number): number;
  _cartivo_snapshot_data(game: number): number;
  _cartivo_restore(game: number, data: number, length: number): number;
};

type Factory = (options: {
  print(text: string): void;
  printErr(text: string): void;
  instantiateWasm(
    imports: WebAssembly.Imports,
    done: (instance: WebAssembly.Instance, module: WebAssembly.Module) => void,
  ): object;
}) => Promise<Emscripten>;

const NAME = "Play!";
// Both files are build assets: the glue is loaded as a module from its URL
// (and again by each of its threads), and the wasm is compiled once per
// Worker and instantiated per game.
const GLUE = new URL("../../../cores/play/dist/play.js", import.meta.url);
const WASM = new URL("../../../cores/play/dist/play.wasm", import.meta.url);
/** Larger than any homebrew; an .elf is copied into the module's memory. */
const MAX_ELF_BYTES = 64 * 1024 * 1024;
/** The bridge's output rate (cartivo.cpp OUT_RATE). */
const SAMPLE_RATE = 48000;
/** The console's picture; the GS draws at 1 to 4 times it. */
const PICTURE = { width: 640, height: 448 };

let ready: Promise<{ factory: Factory; wasm: WebAssembly.Module }> | undefined;
let loaded: { factory: Factory; wasm: WebAssembly.Module } | undefined;

/** Downloads the glue and compiles the wasm once per Worker. */
export function preparePs2(): Promise<void> {
  // The console's thread shares memory with this one.
  if (!globalThis.crossOriginIsolated)
    return Promise.reject(
      Error(
        "PlayStation 2 necesita que la página esté aislada (cabeceras COOP y COEP), y este servidor no las envía. Recarga la página; si sigue igual, revisa la configuración del servidor.",
      ),
    );
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

/**
 * Whether `bytes` has the envelope of a zip archive, which Play!'s states
 * are: a local file header first and an end-of-directory record in the tail
 * (22 bytes, plus a comment of up to 64 KiB).
 */
export function isZip(bytes: Uint8Array): boolean {
  const signature = (at: number, last: number) =>
    bytes[at] === 0x50 &&
    bytes[at + 1] === 0x4b &&
    bytes[at + 2] === last - 1 &&
    bytes[at + 3] === last;
  if (bytes.length < 22 || !signature(0, 4)) return false;
  const first = Math.max(0, bytes.length - 22 - 0xffff);
  for (let at = bytes.length - 22; at >= first; at--)
    if (signature(at, 6)) return true;
  return false;
}

/** One game per canvas: a new core releases the one drawing there. */
const drawing = new WeakMap<OffscreenCanvas, Ps2Core>();

class Ps2Core implements EmulatorCore {
  /** Memory cards are not exported yet: progress is kept with Partidas. */
  readonly battery = false;
  readonly saveBytes = 0;
  readonly frameRate: number;
  frames = 0;
  #em: Emscripten | undefined;
  #game: number;
  #canvas: OffscreenCanvas;
  #bits = 0;
  #sticks: Analog = centered();
  #lost = false;
  #stopped = false;
  #audio: AudioPace;
  #onLost = (event: Event) => {
    event.preventDefault();
    this.#lost = true;
  };

  constructor(em: Emscripten, game: number, canvas: OffscreenCanvas) {
    this.#em = em;
    this.#game = game;
    this.#canvas = canvas;
    this.frameRate = em._cartivo_frame_rate(game);
    this.#audio = new AudioPace(SAMPLE_RATE, this.frameRate);
    canvas.addEventListener("webglcontextlost", this.#onLost);
  }

  /** The live module; a closed or stopped core refuses every call. */
  #live(): Emscripten {
    if (!this.#em) throw Error("El núcleo ya se ha cerrado.");
    if (this.#lost)
      throw Error(
        "El navegador ha retirado la aceleración gráfica (contexto WebGL perdido). Vuelve a abrir el juego.",
      );
    if (this.#stopped)
      throw Error(
        "El juego ha dejado de responder. Vuelve a abrirlo; si pasa siempre en el mismo punto, este juego aún no es compatible.",
      );
    return this.#em;
  }

  #bytes(at: number, length: number) {
    return new Uint8Array(this.#live().wasmMemory.buffer, at, length);
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
    em._cartivo_set_input(this.#game, this.#bits);
    em._cartivo_set_analog(
      this.#game,
      toInt16(left.x),
      toInt16(left.y),
      toInt16(right.x),
      toInt16(right.y),
    );
    const samples = em._cartivo_frames(this.#game, count);
    if (samples < 0) {
      this.#stopped = true;
      this.#live(); // throws the user-readable error
    }
    this.frames += count;
    const audio = new Float32Array(
      em.wasmMemory.buffer,
      em._cartivo_audio(this.#game),
      samples,
    );
    // The console's thread delivers sound in blocks: evened out per frame
    // (a copy too: the module's memory is shared and cannot be transferred).
    return { audio: this.#audio.step(audio, count), frames: this.frames };
  }

  /** No battery RAM (see `battery`). */
  save(): Uint8Array {
    return new Uint8Array(0);
  }

  /** Play!'s own state: a zip of the EE, the IOP and the GS. */
  snapshot(): Uint8Array {
    const em = this.#live();
    const size = em._cartivo_snapshot(this.#game);
    if (!size) throw Error("El núcleo de PS2 no ha podido guardar la partida.");
    return this.#bytes(em._cartivo_snapshot_data(this.#game), size).slice();
  }

  restore(bytes: Uint8Array) {
    const em = this.#live();
    // Refused here, with the game untouched: Play!'s reader does not cope
    // with a file too short to be an archive.
    if (!isZip(bytes))
      throw Error("Esta partida no corresponde a este núcleo de PS2.");
    const at = em._malloc(bytes.length);
    if (!at) throw Error("Memoria insuficiente para cargar la partida.");
    let status: number;
    try {
      this.#bytes(at, bytes.length).set(bytes);
      status = em._cartivo_restore(this.#game, at, bytes.length);
    } finally {
      em._free(at);
    }
    if (status !== 0) {
      // Play! restores in place: a state it rejects half-way leaves no game.
      this.#stopped = true;
      throw Error(
        "Esta partida no corresponde a este núcleo de PS2. Vuelve a abrir el juego.",
      );
    }
  }

  /** The picture on the surface, for Partidas and «Continuar» previews. */
  lastFrame(): Uint8ClampedArray {
    if (!this.#em || this.#lost || !this.frames)
      return new Uint8ClampedArray(0);
    return surfaceFrame(this.#canvas, PICTURE.width);
  }

  dispose() {
    const em = this.#em;
    if (!em) return;
    this.#em = undefined;
    this.#canvas.removeEventListener("webglcontextlost", this.#onLost);
    if (drawing.get(this.#canvas) === this) drawing.delete(this.#canvas);
    try {
      // A console that stopped answering cannot be shut down in order.
      if (!this.#stopped) em._cartivo_free(this.#game);
    } catch {
      // A core that aborted cannot unload; dropping it frees its memory.
    }
    // Its threads are Workers of their own: without this they stay alive.
    em.PThread.terminateAllThreads();
  }
}

/** The file's extension, lower-case with its dot. */
const extension = (part: DiscPart) =>
  part.name.slice(part.name.lastIndexOf(".")).toLowerCase();

/** Requires preparePs2() to have finished. */
export async function createPs2(
  disc: DiscImage,
  canvas: OffscreenCanvas,
  scale: number,
): Promise<EmulatorCore> {
  if (!loaded) throw Error(`El núcleo ${NAME} no está preparado.`);
  const { factory, wasm } = loaded;
  // Its GL objects must go before the next core takes the context.
  drawing.get(canvas)?.dispose();
  const em = await factory({
    // Play!'s own messages (an unsupported module, an abort) are the only
    // trace of why a game stops: kept in the Worker's console, never shown.
    print: (text) => console.debug("[Play!]", text),
    printErr: (text) => console.warn("[Play!]", text),
    instantiateWasm(imports, done) {
      void WebAssembly.instantiate(wasm, imports).then((instance) =>
        done(instance, wasm),
      );
      return {};
    },
  });
  let game = 0;
  try {
    useSurface(em.GL, canvas, "PlayStation 2", false, { ...PICTURE, scale });
    const image = disc.primary;
    // Play! takes the format from the extension; the name is not a real path.
    const name = `/${image.name.toLowerCase().endsWith(".elf") ? "game.elf" : `disc${extension(image)}`}`;
    if (name === "/game.elf") {
      if (image.blob.size > MAX_ELF_BYTES)
        throw Error("Este ejecutable es demasiado grande para ser un .elf.");
      em.FS.writeFile(name, disc.read(image, 0, image.blob.size));
    } else {
      // Sectors on demand, straight from the player's file into the
      // module's memory; nothing else of the disc is ever loaded.
      em.discImageDevice = {
        getFileSize: () => image.blob.size,
        read(pointer, position, size) {
          const bytes = disc.read(image, position, size);
          new Uint8Array(em.wasmMemory.buffer, pointer, bytes.length).set(
            bytes,
          );
        },
        isDone: () => true,
      };
    }
    const path = em.stringToNewUTF8(name);
    game = em._cartivo_create(
      path,
      new TextEncoder().encode(name).length,
      scale,
    );
    em._free(path);
    if (!game)
      throw Error(
        "El núcleo de PS2 no ha podido arrancar este juego. Comprueba que sea una imagen de disco de PlayStation 2 en un solo archivo (.iso, .chd, .cso o .isz).",
      );
  } catch (error) {
    em.PThread.terminateAllThreads();
    throw error;
  }
  const core = new Ps2Core(em, game, canvas);
  drawing.set(canvas, core);
  return core;
}
