/* tslint:disable */
/* eslint-disable */

export class Core {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Mono samples produced by the last `frames` call.
     */
    audio(): Float32Array;
    /**
     * Emulates `count` frames (1-3), keeping the last picture and all audio.
     */
    frames(count: number): void;
    /**
     * Loads an iNES image. Cartivo validates the header before calling this.
     */
    constructor(rom: Uint8Array | number[], sample_rate: number);
    /**
     * RGBA 256x240 of the last emulated frame.
     */
    pixels(): Uint8Array;
    /**
     * Power-cycles the console, keeping the cartridge and its battery RAM.
     */
    reset(): void;
    /**
     * Sets player 1 buttons from a bit mask in `BUTTONS` order.
     */
    set_input(bits: number): void;
    /**
     * Restores battery RAM from raw bytes. No-op without a battery.
     */
    set_sram(data: Uint8Array | number[]): void;
    /**
     * Battery RAM as raw bytes (empty without a battery).
     */
    sram(): Uint8Array;
    /**
     * Whether the cartridge has battery-backed RAM.
     */
    readonly battery: boolean;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_core_free: (a: number, b: number) => void;
    readonly core_audio: (a: number, b: number) => void;
    readonly core_battery: (a: number) => number;
    readonly core_frames: (a: number, b: number, c: number) => void;
    readonly core_new: (a: number, b: number, c: number, d: number) => void;
    readonly core_pixels: (a: number, b: number) => void;
    readonly core_reset: (a: number) => void;
    readonly core_set_input: (a: number, b: number) => void;
    readonly core_set_sram: (a: number, b: number, c: number) => void;
    readonly core_sram: (a: number, b: number) => void;
    readonly __wbindgen_export: (a: number, b: number) => number;
    readonly __wbindgen_export2: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_export3: (a: number, b: number, c: number) => void;
    readonly __wbindgen_export4: (a: number) => void;
    readonly __wbindgen_export5: () => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_add_to_stack_pointer: (a: number) => number;
    readonly __wbindgen_export6: (a: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
