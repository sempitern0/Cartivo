// Laboratory page: a real N64 session with the local core build (see
// build-core.mjs). One session at a time, in its own Worker; stopping or a
// failure terminates it, so nothing outlives the session.
import { n64ControlDemo } from "./fixture/n64-control-demo.ts";
import { analogStick, MAX_N64_ROM_BYTES } from "./preflight.ts";
import type { SessionEvent, SessionRequest } from "./session-protocol.ts";

const startDemo = document.querySelector<HTMLButtonElement>("#session-demo")!;
const startRom = document.querySelector<HTMLButtonElement>("#session-rom")!;
const stopButton = document.querySelector<HTMLButtonElement>("#session-stop")!;
const loseButton = document.querySelector<HTMLButtonElement>("#session-lose")!;
const status = document.querySelector<HTMLElement>("#session-status")!;
const stats = document.querySelector<HTMLElement>("#session-stats")!;
const holder = document.querySelector<HTMLElement>("#session-screen")!;
const file = document.querySelector<HTMLInputElement>("#rom")!;
const MODULE = new URL(".build/n64-core.mjs", location.href).href;

let worker: Worker | undefined;
let frame = 0;
let poll: ReturnType<typeof setInterval> | undefined;
const keys = new Set<string>();

/**
 * Audio: created on the click that starts a session (autoplay rules); each
 * chunk is scheduled right after the previous one. The queue is bounded:
 * beyond MAX_AHEAD a chunk is dropped instead of drifting into latency.
 */
const MAX_AHEAD = 0.25;
const LEAD = 0.06;
let audio: AudioContext | undefined;
let sampleRate = 0;
let playAt = 0;
let dropped = 0;

function play(samples: Int16Array) {
  if (!audio || !sampleRate) return;
  const now = audio.currentTime;
  if (playAt < now + LEAD / 2) playAt = now + LEAD;
  if (playAt - now > MAX_AHEAD) {
    dropped++;
    return;
  }
  const frames = samples.length / 2;
  const buffer = audio.createBuffer(2, frames, sampleRate);
  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);
  for (let i = 0; i < frames; i++) {
    left[i] = samples[i * 2] / 32768;
    right[i] = samples[i * 2 + 1] / 32768;
  }
  const source = audio.createBufferSource();
  source.buffer = buffer;
  source.connect(audio.destination);
  source.start(playAt);
  playAt += frames / sampleRate;
}

/** libretro bits as the core maps them: B→N64 A, Y→N64 B, L2→Z. */
const KEYBOARD: Record<string, number> = {
  KeyK: 0, // A
  KeyJ: 1, // B
  Enter: 3, // Start
  KeyQ: 12, // Z
  KeyI: 10, // L
  KeyO: 11, // R
};
const PAD: [number, number][] = [
  [0, 0], // south → A
  [2, 1], // west → B
  [9, 3], // start
  [6, 12], // left trigger → Z
  [4, 10], // L
  [5, 11], // R
];

function send(request: SessionRequest, transfer: Transferable[] = []) {
  worker?.postMessage(request, transfer);
}

function stop(message = "Sesión detenida.") {
  cancelAnimationFrame(frame);
  clearInterval(poll);
  worker?.terminate();
  worker = undefined;
  void audio?.close();
  audio = undefined;
  sampleRate = 0;
  keys.clear();
  holder.replaceChildren();
  stopButton.disabled = loseButton.disabled = true;
  startDemo.disabled = startRom.disabled = false;
  status.textContent = message;
}

/** Keyboard and the first standard pad, sampled each animation frame. */
function pumpInput() {
  let buttons = 0;
  for (const key of keys) if (key in KEYBOARD) buttons |= 1 << KEYBOARD[key];
  let lx = 0;
  let ly = 0;
  const pad = Array.from(navigator.getGamepads?.() ?? []).find(
    (p) => p?.connected && p.mapping === "standard",
  );
  if (pad) {
    for (const [from, to] of PAD)
      if (pad.buttons[from]?.pressed) buttons |= 1 << to;
    const stick = analogStick(pad.axes[0] ?? 0, pad.axes[1] ?? 0);
    // Gamepad API y grows downwards, like libretro's.
    lx = Math.round(stick.x * 32767);
    ly = Math.round(stick.y * 32767);
  }
  send({ type: "input", buttons, lx, ly, rx: 0, ry: 0 });
  frame = requestAnimationFrame(pumpInput);
}

async function start(rom: Uint8Array) {
  stop("Arrancando…");
  if ((await fetch(MODULE, { method: "HEAD" })).status !== 200) {
    status.textContent =
      "Falta el núcleo local: ejecuta node experiments/n64/build-core.mjs.";
    return;
  }
  audio = new AudioContext();
  playAt = 0;
  dropped = 0;
  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = 480;
  canvas.setAttribute("aria-label", "Imagen del juego N64");
  holder.replaceChildren(canvas);
  const offscreen = canvas.transferControlToOffscreen();
  worker = new Worker(new URL("./session.worker.ts", import.meta.url), {
    type: "module",
  });
  stopButton.disabled = loseButton.disabled = false;
  startDemo.disabled = startRom.disabled = true;
  worker.onerror = () => stop("El Worker de la sesión ha fallado.");
  worker.onmessage = ({ data }: MessageEvent<SessionEvent>) => {
    if (data.type === "audio") play(data.samples);
    else if (data.type === "running") {
      sampleRate = data.sampleRate;
      status.textContent = `En marcha a ${data.fps.toFixed(2)} Hz.`;
      pumpInput();
      poll = setInterval(() => send({ type: "status", x: 320, y: 240 }), 1000);
    } else if (data.type === "status") {
      const queued = audio ? Math.max(0, playAt - audio.currentTime) : 0;
      stats.textContent = JSON.stringify({
        ...data,
        audioQueueMs: Math.round(queued * 1000),
        audioDropped: dropped,
      });
    } else if (data.type === "error") stop(data.message);
  };
  send({ type: "start", canvas: offscreen, rom, module: MODULE }, [
    offscreen,
    rom.buffer,
  ]);
}

startDemo.onclick = () => void start(n64ControlDemo());
startRom.onclick = async () => {
  const chosen = file.files?.[0];
  if (!chosen || chosen.size > MAX_N64_ROM_BYTES) {
    status.textContent = "Elige un cartucho .z64, .v64 o .n64 de hasta 64 MiB.";
    return;
  }
  await start(new Uint8Array(await chosen.arrayBuffer()));
};
stopButton.onclick = () => stop();
loseButton.onclick = () => send({ type: "lose-context" });
window.addEventListener("keydown", (e) => {
  if (worker && e.code in KEYBOARD) keys.add(e.code);
});
window.addEventListener("keyup", (e) => keys.delete(e.code));
window.addEventListener("blur", () => keys.clear());
window.addEventListener("pagehide", () => stop());
