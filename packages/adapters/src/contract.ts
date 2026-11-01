// What every emulator core must offer to run in Cartivo (ADR-002, ADR-009).
// A core module is registered in registry.ts and checked by
// tests/core-conformance.test.ts.
import type { InputState } from "../../input/src/nes-input.ts";

export type Frame = {
  /** RGBA, width × height × 4 bytes, owned by the caller (transferable). */
  pixels: Uint8ClampedArray;
  /** Mono samples at 48 kHz produced by this batch. */
  audio: Float32Array;
  /** Frames emulated since power-on. */
  frames: number;
};

export interface EmulatorCore {
  /** The cartridge has battery-backed RAM (saved by SramStore). */
  readonly battery: boolean;
  frames: number;
  /**
   * Player 1 buttons. NES and Game Boy share these 8 actions; systems with
   * more buttons extend InputState first (docs/ADDING_A_SYSTEM.md).
   */
  input(state: InputState): void;
  /** Emulates 1–3 frames. */
  advance(count: number): Frame;
  /** Battery RAM, exactly `CoreModule.sramBytes` long. */
  save(): Uint8Array;
  /** Full console snapshot for «Partidas», tied to this core and version. */
  snapshot(): Uint8Array;
  /** Restores a snapshot; throws a user-readable error if it does not fit. */
  restore(bytes: Uint8Array): void;
  /** Copy of the last presented frame (empty before any frame). */
  lastFrame(): Uint8ClampedArray;
  /** Releases resources (wasm memory); the core is unusable afterwards. */
  dispose(): void;
}

export interface CoreModule {
  system: string;
  id: string;
  /** Exact version: snapshots of another version are not loaded. */
  version: string;
  video: { width: number; height: number };
  /** Battery RAM size used by SramStore and backups. */
  sramBytes: number;
  maxRomBytes: number;
  /** Throws a user-readable error for unsupported files. */
  validate(rom: Uint8Array): { battery: boolean };
  /** Optional original test ROM for «Probar demo» (never third-party). */
  demo?(): Uint8Array;
  /** One-time async setup (e.g. instantiate wasm). */
  prepare(): Promise<void>;
  create(rom: Uint8Array, save?: Uint8Array): EmulatorCore;
}
