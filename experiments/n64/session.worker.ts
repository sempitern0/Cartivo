// One N64 laboratory session in its own Worker: the transferred canvas gets
// a WebGL2 context that the core draws into directly, the ROM goes to the
// module's in-memory FS, and frames run at the game's rate, paced by the
// page's audio queue. Audio leaves in one chunk per frame. The module is the
// CI build in cores/mupen64plus-next/dist (tools/build-mupen64plus-next.mjs): this file is never
// imported by the application.
//
// States: loading → running ⇄ paused → stopping. A request that does not fit
// the current state is ignored and logged, so every transition is idempotent.
import type {
  SessionEvent,
  SessionRequest,
  SessionState,
  Startup,
} from "./session-protocol.ts";

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

/** Audio queued ahead in the page: above HIGH a tick runs no frame, below
 * LOW it runs one more (never more than two per tick: no bursts). */
const HIGH_MS = 150;
const LOW_MS = 40;

let core: Core | undefined;
let gl: WebGL2RenderingContext | null = null;
let state: SessionState | undefined;
let timer = 0;
let fps = 60;
let frames = 0;
/** Last queue the page reported and when: it drains in real time meanwhile
 * (a skipped tick sends no audio, so no new report would come). */
let queue = { ms: -1, at: 0 };
const pacing = { skipped: 0, doubled: 0 };
const startup: Startup = {
  glue: 0,
  wasm: 0,
  context: 0,
  load: 0,
  firstFrame: 0,
};
let started = 0;
/** Wall time spent running (paused time excluded) and since when. */
let runningMs = 0;
let runningSince = 0;
let lastTick = 0;

const send = (event: SessionEvent, transfer: Transferable[] = []) =>
  self.postMessage(event, transfer);
const log = (text: string) => send({ type: "log", text });
function enter(next: SessionState, detail: string) {
  state = next;
  log(`[estado] ${next}: ${detail}`);
  send({ type: "state", state: next, detail });
}

/** Last frame times and tick intervals, for percentiles. */
const frameTimes: number[] = [];
const tickTimes: number[] = [];
const keep = (list: number[], value: number, size: number) => {
  list.push(value);
  if (list.length > size) list.shift();
};
const round = (ms: number) => Math.round(ms * 100) / 100;
function percentile(list: number[], p: number) {
  if (!list.length) return 0;
  const sorted = [...list].sort((a, b) => a - b);
  return round(
    sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))],
  );
}

/** Tone oracle: left-channel frames and sign changes since the start. */
const audio = { rate: 0, frames: 0, crossings: 0, last: 0 };

const queueMs = () =>
  queue.ms < 0 ? -1 : Math.max(0, queue.ms - (performance.now() - queue.at));

/** One emulated frame: time it, then send its audio. */
function runFrame() {
  const before = performance.now();
  core!._n64_run();
  keep(frameTimes, performance.now() - before, 120);
  frames++;
  if (!startup.firstFrame && core!._n64_presented() > 0)
    startup.firstFrame = Math.round(performance.now() - started);
  const count = core!._n64_audio_frames();
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

/** The loop at the game's rate; the audio queue decides 0, 1 or 2 frames. */
function tick() {
  if (state !== "running") return;
  const now = performance.now();
  keep(tickTimes, now - lastTick, 240);
  lastTick = now;
  const ahead = queueMs();
  if (ahead > HIGH_MS) {
    pacing.skipped++;
    return;
  }
  runFrame();
  if (ahead >= 0 && ahead < LOW_MS) {
    runFrame();
    pacing.doubled++;
  }
}

function loop(on: boolean) {
  clearInterval(timer);
  if (on) {
    lastTick = runningSince = performance.now();
    timer = setInterval(tick, 1000 / fps) as unknown as number;
  } else if (runningSince) {
    runningMs += performance.now() - runningSince;
    runningSince = 0;
  }
}

function speed() {
  const wall =
    runningMs + (runningSince ? performance.now() - runningSince : 0);
  return wall ? round(frames / fps / (wall / 1000)) : 0;
}

/** GL_VERSION and the GPU, when the browser exposes it. */
function renderer() {
  if (!gl) return "sin contexto";
  const info = gl.getExtension("WEBGL_debug_renderer_info");
  const gpu = info
    ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL)
    : gl.getParameter(gl.RENDERER);
  return `${gl.getParameter(gl.VERSION)} · ${gpu}`;
}

async function start(canvas: OffscreenCanvas, rom: Uint8Array, url: string) {
  if (state) return log(`[ignorado] start en estado ${state}`);
  started = performance.now();
  const since = () => Math.round(performance.now() - started);
  enter("loading", "cargando el núcleo (n64-core.mjs)");
  const factory = (await import(/* @vite-ignore */ url)).default as (
    options: object,
  ) => Promise<Core>;
  startup.glue = since();
  enter("loading", "compilando WebAssembly");
  core = await factory({ print: log, printErr: log });
  startup.wasm = since();
  // A lost context cannot be restored under a running core: the session
  // stops and says so; the page offers to start again.
  canvas.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    loop(false);
    send({
      type: "error",
      message: "Se ha perdido el contexto WebGL: la sesión se ha detenido.",
    });
  });
  enter("loading", "creando el contexto WebGL2");
  const context = core.GL.createContext(canvas, {
    majorVersion: 2,
    minorVersion: 0,
    alpha: false,
    depth: true,
    stencil: true,
    antialias: false,
    preserveDrawingBuffer: false,
  });
  if (!context || !core.GL.makeContextCurrent(context))
    throw new Error("No se pudo crear un contexto WebGL2 en el Worker.");
  gl = canvas.getContext("webgl2");
  startup.context = since();
  log(`[gpu] ${renderer()}`);
  enter("loading", "cargando el cartucho");
  core.FS.mkdirTree("/n64/system");
  core.FS.mkdirTree("/n64/save");
  core.FS.writeFile("/n64/rom.z64", rom);
  core._n64_init();
  const path = core.stringToNewUTF8("/n64/rom.z64");
  const loaded = core._n64_load(path);
  core._free(path);
  if (loaded !== 0)
    throw new Error(`El núcleo no ha podido cargar el cartucho (${loaded}).`);
  startup.load = since();
  fps = core._n64_fps() || 60;
  audio.rate = core._n64_sample_rate();
  enter("running", `${fps.toFixed(2)} Hz`);
  send({ type: "running", fps, sampleRate: audio.rate, renderer: renderer() });
  loop(true);
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

function status(x: number, y: number) {
  // Read right after a frame so the default framebuffer holds it.
  if (state === "running") runFrame();
  send({
    type: "status",
    state: state ?? "stopping",
    frames,
    presented: core?._n64_presented() ?? 0,
    pixel: state === "running" ? sample(x, y) : [],
    width: gl?.drawingBufferWidth ?? 0,
    height: gl?.drawingBufferHeight ?? 0,
    frameMs: {
      average: round(
        frameTimes.reduce((sum, t) => sum + t, 0) / (frameTimes.length || 1),
      ),
      p95: percentile(frameTimes, 0.95),
    },
    tickMs: {
      p50: percentile(tickTimes, 0.5),
      p95: percentile(tickTimes, 0.95),
      p99: percentile(tickTimes, 0.99),
    },
    speed: speed(),
    pacing,
    startup,
    audio: {
      rate: audio.rate,
      frames: audio.frames,
      crossings: audio.crossings,
    },
    memory: core?.HEAPU8.buffer.byteLength ?? 0,
  });
}

function handle(data: SessionRequest) {
  switch (data.type) {
    case "input":
      core?._n64_input(data.buttons, data.lx, data.ly, data.rx, data.ry);
      return;
    case "status":
      return status(data.x, data.y);
    case "audio-queue":
      queue = { ms: data.ms, at: performance.now() };
      return;
    case "pause":
      if (state !== "running") return log(`[ignorado] pause en ${state}`);
      loop(false);
      return enter("paused", "en pausa");
    case "resume":
      if (state !== "paused") return log(`[ignorado] resume en ${state}`);
      // The loop restarts from now: the time spent paused is not recovered.
      enter("running", "reanudada");
      return loop(true);
    case "lose-context":
      gl?.getExtension("WEBGL_lose_context")?.loseContext();
      return;
    case "stop":
      if (state === "stopping") return;
      loop(false);
      enter("stopping", "liberando el núcleo");
      core?._n64_unload();
      core = undefined;
      send({ type: "stopped" });
  }
}

function fail(error: unknown) {
  loop(false);
  const message =
    error instanceof Error ? error.message : `Error del núcleo: ${error}`;
  if (error instanceof Error && error.stack) log(`[error] ${error.stack}`);
  send({ type: "error", message });
}

self.onmessage = async ({ data }: MessageEvent<SessionRequest>) => {
  try {
    if (data.type === "start") await start(data.canvas, data.rom, data.module);
    else handle(data);
  } catch (error) {
    fail(error);
  }
};
// Aborts inside the core (Emscripten rejects its promises) end up here.
self.addEventListener("unhandledrejection", (event) => fail(event.reason));
