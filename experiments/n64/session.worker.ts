// One N64 laboratory session in its own Worker: the transferred canvas gets
// a WebGL2 context that the core draws into directly, the ROM goes to the
// module's in-memory FS, and frames run at the game's rate. The module is
// the local build from build-core.mjs (.build/, git ignored): this file is
// never imported by the application.
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
  stringToNewUTF8(text: string): number;
  _free(pointer: number): void;
  _n64_init(): number;
  _n64_load(path: number): number;
  _n64_run(): number;
  _n64_fps(): number;
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
const send = (event: SessionEvent) => self.postMessage(event);

async function start(canvas: OffscreenCanvas, rom: Uint8Array, url: string) {
  const factory = (await import(/* @vite-ignore */ url)).default as (
    options: object,
  ) => Promise<Core>;
  core = await factory({
    print: (text: string) => send({ type: "log", text }),
    printErr: (text: string) => send({ type: "log", text }),
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
  running = true;
  send({ type: "running", fps });
  // A fixed cadence, without catching up after a stall (no burst).
  timer = setInterval(() => {
    core!._n64_run();
    frames++;
  }, 1000 / fps) as unknown as number;
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
    else if (data.type === "status")
      send({
        type: "status",
        frames,
        presented: core?._n64_presented() ?? 0,
        // Read right after a frame so the default framebuffer holds it.
        pixel: running
          ? (core!._n64_run(), frames++, sample(data.x, data.y))
          : [],
        width: gl?.drawingBufferWidth ?? 0,
        height: gl?.drawingBufferHeight ?? 0,
      });
    else if (data.type === "stop") {
      clearInterval(timer);
      running = false;
      core?._n64_unload();
      core = undefined;
      send({ type: "stopped" });
    }
  } catch (error) {
    clearInterval(timer);
    running = false;
    send({
      type: "error",
      message: error instanceof Error ? error.message : String(error),
    });
  }
};
