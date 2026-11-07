// Messages between the laboratory page and session.worker.ts.

/** Worker states; "idle" is the page's state before a Worker exists. */
export type SessionState = "loading" | "running" | "paused" | "stopping";

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
  /**
   * Audio queued ahead in the page (ms), after each chunk it schedules; -1
   * when audio is not playing (suspended or unavailable): no pacing then.
   */
  | { type: "audio-queue"; ms: number }
  | { type: "pause" }
  | { type: "resume" }
  /** Diagnosis: lose the WebGL context on purpose (WEBGL_lose_context). */
  | { type: "lose-context" }
  | { type: "stop" };

/** Milliseconds from the start request to each startup step. */
export type Startup = {
  /** Emscripten glue (n64-core.mjs) imported. */
  glue: number;
  /** WebAssembly fetched, compiled and instantiated. */
  wasm: number;
  /** WebGL2 context created and current. */
  context: number;
  /** Cartridge loaded by the core. */
  load: number;
  /** First frame the core presented (0 until then). */
  firstFrame: number;
};

export type SessionEvent =
  /** A core log line or a worker diagnostic. */
  | { type: "log"; text: string }
  | { type: "state"; state: SessionState; detail: string }
  | {
      type: "running";
      fps: number;
      sampleRate: number;
      /** GL_VERSION and, where the browser tells, the GPU renderer. */
      renderer: string;
    }
  /** Interleaved stereo produced by one emulated frame. */
  | { type: "audio"; samples: Int16Array }
  | {
      type: "status";
      state: SessionState;
      frames: number;
      presented: number;
      pixel: number[];
      width: number;
      height: number;
      /** Time per emulated frame over the last 120 frames (ms). */
      frameMs: { average: number; p95: number };
      /** Wall time between loop ticks over the last 240 ticks (ms). */
      tickMs: { p50: number; p95: number; p99: number };
      /** Emulated time over wall time while running (1 = full speed). */
      speed: number;
      /** Ticks without a frame (audio ahead) and with an extra one (behind). */
      pacing: { skipped: number; doubled: number };
      startup: Startup;
      /** Left-channel totals since the start (the tone oracle). */
      audio: { rate: number; frames: number; crossings: number };
      /** Size of the module's WebAssembly memory (bytes). */
      memory: number;
    }
  | { type: "stopped" }
  | { type: "error"; message: string };
