// Laboratory page: a real N64 session with the local core build (see
// build-core.mjs). One session at a time, in its own Worker; stopping or a
// failure terminates it, so nothing outlives the session.
import { n64ControlDemo } from "./fixture/n64-control-demo.ts";
import { analogStick, MAX_N64_ROM_BYTES } from "./preflight.ts";
import type { SessionEvent, SessionRequest } from "./session-protocol.ts";

const startDemo = document.querySelector<HTMLButtonElement>("#session-demo")!;
const startRom = document.querySelector<HTMLButtonElement>("#session-rom")!;
const stopButton = document.querySelector<HTMLButtonElement>("#session-stop")!;
const status = document.querySelector<HTMLElement>("#session-status")!;
const stats = document.querySelector<HTMLElement>("#session-stats")!;
const holder = document.querySelector<HTMLElement>("#session-screen")!;
const file = document.querySelector<HTMLInputElement>("#rom")!;
const MODULE = new URL(".build/n64-core.mjs", location.href).href;

let worker: Worker | undefined;
let frame = 0;
let poll: ReturnType<typeof setInterval> | undefined;
const keys = new Set<string>();

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
  keys.clear();
  holder.replaceChildren();
  stopButton.disabled = true;
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
  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = 480;
  canvas.setAttribute("aria-label", "Imagen del juego N64");
  holder.replaceChildren(canvas);
  const offscreen = canvas.transferControlToOffscreen();
  worker = new Worker(new URL("./session.worker.ts", import.meta.url), {
    type: "module",
  });
  stopButton.disabled = false;
  startDemo.disabled = startRom.disabled = true;
  worker.onerror = () => stop("El Worker de la sesión ha fallado.");
  worker.onmessage = ({ data }: MessageEvent<SessionEvent>) => {
    if (data.type === "running") {
      status.textContent = `En marcha a ${data.fps.toFixed(2)} Hz.`;
      pumpInput();
      poll = setInterval(() => send({ type: "status", x: 320, y: 240 }), 1000);
    } else if (data.type === "status") stats.textContent = JSON.stringify(data);
    else if (data.type === "error") stop(data.message);
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
window.addEventListener("keydown", (e) => {
  if (worker && e.code in KEYBOARD) keys.add(e.code);
});
window.addEventListener("keyup", (e) => keys.delete(e.code));
window.addEventListener("blur", () => keys.clear());
window.addEventListener("pagehide", () => stop());
