// Messages between the laboratory page and session.worker.ts.
export type SessionRequest =
  | { type: "start"; canvas: OffscreenCanvas; rom: Uint8Array; module: string }
  | {
      type: "input";
      /** RETRO_DEVICE_ID_JOYPAD_* bit order. */
      buttons: number;
      /** −32768…32767, y down (libretro). */
      lx: number;
      ly: number;
      rx: number;
      ry: number;
    }
  | { type: "status"; x: number; y: number }
  /** Diagnosis: lose the WebGL context on purpose (WEBGL_lose_context). */
  | { type: "lose-context" }
  | { type: "stop" };

export type SessionEvent =
  | { type: "log"; text: string }
  | { type: "running"; fps: number; sampleRate: number }
  /** Interleaved stereo produced by the frames since the last chunk. */
  | { type: "audio"; samples: Int16Array }
  | {
      type: "status";
      frames: number;
      presented: number;
      pixel: number[];
      width: number;
      height: number;
      /** Time per emulated frame over the last 120 frames (ms). */
      frameMs: { average: number; p95: number };
      /** Left-channel totals since the start (the tone oracle). */
      audio: { rate: number; frames: number; crossings: number };
      /** Size of the module's WebAssembly memory (bytes). */
      memory: number;
    }
  | { type: "stopped" }
  | { type: "error"; message: string };
