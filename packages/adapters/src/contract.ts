// What every emulator core must offer to run in Cartivo (ADR-002, ADR-009).
// A core module is registered in registry.ts and checked by
// tests/core-conformance.test.ts.
import type { InputState } from "../../input/src/nes-input.ts";
import type { Analog } from "../../input/src/analog.ts";
import type { DiscImage } from "./disc.ts";

export type Frame = {
  /**
   * RGBA, width × height × 4 bytes, owned by the caller (transferable).
   * Absent for a core that draws on its own surface (SurfaceModule).
   */
  pixels?: Uint8ClampedArray;
  /** Mono samples at 48 kHz produced by this batch. */
  audio: Float32Array;
  /** Frames emulated since power-on. */
  frames: number;
};

export interface EmulatorCore {
  /** The cartridge has battery-backed RAM (saved by SramStore). */
  readonly battery: boolean;
  /**
   * Frames per second of this game when the core reports it (a PAL
   * cartridge runs at 50 Hz); undefined means the system's nominal rate.
   */
  readonly frameRate?: number;
  frames: number;
  /**
   * Player 1 buttons. NES and Game Boy share these 8 actions; systems with
   * more buttons extend InputState first (docs/ADDING_A_SYSTEM.md).
   */
  input(state: InputState): void;
  /**
   * Player 1's sticks, normalised (analog.ts), for cores with an analog pad;
   * the others leave it out. Called right after input() each batch.
   */
  analog?(sticks: Analog): void;
  /** Emulates 1–3 frames. */
  advance(count: number): Frame;
  /**
   * Battery RAM size of this cartridge in the core's own save format (NES
   * 8 KB; Game Boy 0–128 KB plus the clock). Fixed once the core exists.
   */
  readonly saveBytes: number;
  /** Battery RAM, exactly `saveBytes` long. */
  save(): Uint8Array;
  /** Full console snapshot for «Partidas», tied to this core and version. */
  snapshot(): Uint8Array;
  /** Restores a snapshot; throws a user-readable error if it does not fit. */
  restore(bytes: Uint8Array): void;
  /** Copy of the last presented frame (empty before any frame); a core
   * that draws on its own surface reads it back on demand. */
  lastFrame(): Uint8ClampedArray;
  /**
   * A game on several discs (an .m3u): which one is in and changing it, as
   * opening the lid would. Cores of one disc or cartridge leave it out.
   */
  readonly discs?: DiscTray;
  /** Releases resources (wasm memory); the core is unusable afterwards. */
  dispose(): void;
}

/** The disc tray of a multi-disc game (ADR-015). */
export interface DiscTray {
  /** The boot file of each disc, in order. */
  readonly names: readonly string[];
  /** Index of the disc in the tray. */
  current(): number;
  /** Puts disc `index` in; throws a user-readable error if the core refuses. */
  insert(index: number): void;
}

type ModuleInfo = {
  system: string;
  id: string;
  /** Exact version: snapshots of another version are not loaded. */
  version: string;
  video: { width: number; height: number };
  /** One-time async setup (e.g. instantiate wasm). */
  prepare(): Promise<void>;
};

/** A cartridge: the whole ROM is read into memory and checked first. */
type CartridgeInfo = ModuleInfo & {
  disc?: undefined;
  maxRomBytes: number;
  /** Throws a user-readable error for unsupported files. */
  validate(rom: Uint8Array): { battery: boolean };
  /** Optional original test ROM, opened with `#demo/<id>` (never third-party). */
  demo?(): Uint8Array;
};

/** Cartridge systems whose core returns RGBA frames. */
export interface CartridgeModule extends CartridgeInfo {
  surface?: undefined;
  create(rom: Uint8Array, save?: Uint8Array): EmulatorCore;
}

type DiscInfo = ModuleInfo & {
  disc: true;
  /** Original test program for the demo entry, as a file the core boots. */
  demo?(): { name: string; bytes: Uint8Array };
};

/**
 * Disc systems (ADR-015): the game stays in the player's files and the core
 * reads the sectors it needs. The page picks the file to boot (systems.ts
 * `gameForFiles`); the core opens the rest by name.
 */
export interface DiscModule extends DiscInfo {
  surface?: undefined;
  create(disc: DiscImage, save?: Uint8Array): EmulatorCore;
}

/**
 * Disc systems whose core draws with the GPU (ADR-017, ADR-022): the core
 * renders on the game canvas and reads the disc itself. No battery RAM.
 */
export interface SurfaceDiscModule extends DiscInfo {
  surface: "webgl2";
  create(disc: DiscImage, canvas: OffscreenCanvas): Promise<EmulatorCore>;
}

/**
 * Cartridge systems whose core draws with the GPU (ADR-017): the page hands
 * the game canvas to the Worker, the core renders on it with WebGL2 and the
 * browser presents each frame; no RGBA crosses to the page. Creating a core
 * is asynchronous (an Emscripten instance per game).
 */
export interface SurfaceModule extends CartridgeInfo {
  surface: "webgl2";
  create(
    rom: Uint8Array,
    canvas: OffscreenCanvas,
    save?: Uint8Array,
  ): Promise<EmulatorCore>;
}

export type CoreModule =
  | CartridgeModule
  | DiscModule
  | SurfaceModule
  | SurfaceDiscModule;
