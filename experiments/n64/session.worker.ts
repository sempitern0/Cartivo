// One N64 laboratory session in its own Worker: the transferred canvas gets
// a WebGL2 context that the core draws into directly, the ROM goes to the
// module's in-memory FS, and frames run at the game's rate. Audio leaves in
// one chunk per frame; the page plays it. The module is the local build from
// build-core.mjs (.build/, git ignored): this file is never imported by the
// application.
import type { SessionRequest, SessionEvent } from "./session-protocol.ts";

type Core = {
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
  _free(pointer: number): void;
  _n64_init(): number;
  _n64_load(path: number): number;
  _n64_run(): void;
  _n64_audio(): number;
  _n64_audio_frames(): number;
  _n64_fps(): number;
  _n64_sample_rate(): number;
  _n64_presented(): number;
  _n64_input(
    bits: number,
    lx: number,
    ly: number,
    rx: number,
    ry: number,
  ): void;
  _n64_unload(): void;
};

let core: Core | undefined;
let gl: WebGL2RenderingContext | null = null;
let timer = 0;
let frames = 0;
let running = false;
const send = (event: SessionEvent, transfer: Transferable[] = []) =>
  self.postMessage(event, transfer);

/** The last 120 frame times, for the average and the 95th percentile. */
const frameTimes: number[] = [];
/** Tone oracle: left-channel frames and sign changes since the start. */
const audio = { rate: 0, frames: 0, crossings: 0, last: 0 };

function frameStats() {
  if (!frameTimes.length) return { average: 0, p95: 0 };
  const sorted = [...frameTimes].sort((a, b) => a - b);
  const sum = sorted.reduce((total, t) => total + t, 0);
  const p95 =
    sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];
  const round = (ms: number) => Math.round(ms * 100) / 100;
  return { average: round(sum / sorted.length), p95: round(p95) };
}

/** One emulated frame: time it, then send its audio. */
function runFrame() {
  const started = performance.now();
  core!._n64_run();
  const count = core!._n64_audio_frames();
  frameTimes.push(performance.now() - started);
  if (frameTimes.length > 120) frameTimes.shift();
  frames++;
  if (!count) return;
  const from = core!._n64_audio() >> 1;
  const samples = core!.HEAP16.slice(from, from + count * 2);
  for (let i = 0; i < samples.length; i += 2) {
    const sign = Math.sign(samples[i]);
    if (sign && audio.last && sign !== audio.last) audio.crossings++;
    if (sign) audio.last = sign;
  }
  audio.frames += count;
  send({ type: "audio", samples }, [samples.buffer]);
}

function halt() {
  clearInterval(timer);
  running = false;
}

async function start(canvas: OffscreenCanvas, rom: Uint8Array, url: string) {
  const factory = (await import(/* @vite-ignore */ url)).default as (
    options: object,
  ) => Promise<Core>;
  core = await factory({
    print: (text: string) => send({ type: "log", text }),
    printErr: (text: string) => send({ type: "log", text }),
  });
  // A lost context cannot be restored under a running core: the session
  // stops and says so; the page offers to start again.
  canvas.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    halt();
    send({
      type: "error",
      message: "Se ha perdido el contexto WebGL: la sesión se ha detenido.",
    });
  });
  const handle = core.GL.createContext(canvas, {
    majorVersion: 2,
    minorVersion: 0,
    alpha: false,
    depth: true,
    stencil: true,
    antialias: false,
    preserveDrawingBuffer: false,
  });
  if (!handle || !core.GL.makeContextCurrent(handle))
    throw new Error("No se pudo crear un contexto WebGL2 en el Worker.");
  gl = canvas.getContext("webgl2");
  core.FS.mkdirTree("/n64/system");
  core.FS.mkdirTree("/n64/save");
  core.FS.writeFile("/n64/rom.z64", rom);
  core._n64_init();
  const path = core.stringToNewUTF8("/n64/rom.z64");
  const loaded = core._n64_load(path);
  core._free(path);
  if (loaded !== 0)
    throw new Error(`El núcleo no ha podido cargar el cartucho (${loaded}).`);
  const fps = core._n64_fps() || 60;
  audio.rate = core._n64_sample_rate();
  running = true;
  send({ type: "running", fps, sampleRate: audio.rate });
  // A fixed cadence, without catching up after a stall (no burst).
  timer = setInterval(runFrame, 1000 / fps) as unknown as number;
}

/** One diagnostic readback of a pixel (never a per-frame path). */
function sample(x: number, y: number) {
  if (!gl) return [0, 0, 0];
  const pixel = new Uint8Array(4);
  gl.readPixels(
    x,
    gl.drawingBufferHeight - 1 - y,
    1,
    1,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    pixel,
  );
  return [pixel[0], pixel[1], pixel[2]];
}

self.onmessage = async ({ data }: MessageEvent<SessionRequest>) => {
  try {
    if (data.type === "start") await start(data.canvas, data.rom, data.module);
    else if (data.type === "input")
      core?._n64_input(data.buttons, data.lx, data.ly, data.rx, data.ry);
    else if (data.type === "status") {
      // Read right after a frame so the default framebuffer holds it.
      if (running) runFrame();
      send({
        type: "status",
        frames,
        presented: core?._n64_presented() ?? 0,
        pixel: running ? sample(data.x, data.y) : [],
        width: gl?.drawingBufferWidth ?? 0,
        height: gl?.drawingBufferHeight ?? 0,
        frameMs: frameStats(),
        audio: {
          rate: audio.rate,
          frames: audio.frames,
          crossings: audio.crossings,
        },
        memory: core?.HEAPU8.buffer.byteLength ?? 0,
      });
    } else if (data.type === "lose-context")
      gl?.getExtension("WEBGL_lose_context")?.loseContext();
    else if (data.type === "stop") {
      halt();
      core?._n64_unload();
      core = undefined;
      send({ type: "stopped" });
    }
  } catch (error) {
    halt();
    send({
      type: "error",
      message: error instanceof Error ? error.message : String(error),
    });
  }
};
