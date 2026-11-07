// Laboratory page: a real N64 session with the core built by CI
// (cores/mupen64plus-next/dist, served as the lab's Vite publicDir). One session at a time, in its own Worker; stopping or a
// failure terminates it, so nothing outlives the session. Everything the
// Worker reports goes to the visible log, to diagnose a machine from a copy.
import { n64ControlDemo } from "./fixture/n64-control-demo.ts";
import {
  analogOf,
  digitalStick,
  toInt16,
  type Stick,
} from "../../packages/input/src/analog.ts";
import { MAX_N64_ROM_BYTES } from "./preflight.ts";
import type {
  SessionEvent,
  SessionRequest,
  SessionState,
} from "./session-protocol.ts";

const $ = <T extends HTMLElement>(selector: string) =>
  document.querySelector<T>(selector)!;
const startDemo = $<HTMLButtonElement>("#session-demo");
const startRom = $<HTMLButtonElement>("#session-rom");
const pauseButton = $<HTMLButtonElement>("#session-pause");
const stopButton = $<HTMLButtonElement>("#session-stop");
const loseButton = $<HTMLButtonElement>("#session-lose");
const copyButton = $<HTMLButtonElement>("#session-copy");
const status = $("#session-status");
const stats = $("#session-stats");
const logView = $("#session-log");
const holder = $("#session-screen");
const file = $<HTMLInputElement>("#rom");
/** From cores/mupen64plus-next/dist, Vite's publicDir for the lab. */
const MODULE = new URL("n64-core.mjs", location.href).href;
/** Loading longer than this is reported, with where it stopped. */
const WATCHDOG_MS = 45_000;

let worker: Worker | undefined;
let state: SessionState | "idle" = "idle";
let loadingStep = "";
let frame = 0;
let poll: ReturnType<typeof setInterval> | undefined;
let watchdog: ReturnType<typeof setTimeout> | undefined;
/** Paused because the tab was hidden (resumed when it shows again). */
let pausedByVisibility = false;
/** Status polls in a row with frames run but none presented. */
let blank = 0;
/** Status answers received: each one changes the shown JSON. */
let polls = 0;
const keys = new Set<string>();
const lines: string[] = [];

function log(text: string) {
  lines.push(`${(performance.now() / 1000).toFixed(2)} ${text}`);
  if (lines.length > 400) lines.shift();
  logView.textContent = lines.join("\n");
  logView.scrollTop = logView.scrollHeight;
}

/**
 * Audio: created on the click that starts a session (autoplay rules); each
 * chunk is scheduled right after the previous one. The queue is bounded:
 * beyond MAX_AHEAD a chunk is dropped instead of drifting into latency. The
 * Worker paces the emulation with the queue it is told after each chunk.
 */
const MAX_AHEAD = 0.25;
const LEAD = 0.06;
let audio: AudioContext | undefined;
let sampleRate = 0;
let playAt = 0;
const sound = { chunks: 0, dropped: 0, underruns: 0, deficitMs: 0 };

const queued = () =>
  audio?.state === "running" ? Math.max(0, playAt - audio.currentTime) : -1;

function play(samples: Int16Array) {
  if (!audio || !sampleRate || audio.state !== "running") {
    send({ type: "audio-queue", ms: -1 });
    return;
  }
  const now = audio.currentTime;
  // The queue ran dry after it had started: an underrun, and how long.
  if (sound.chunks && playAt < now) {
    sound.underruns++;
    sound.deficitMs += Math.round((now - playAt) * 1000);
  }
  if (playAt < now + LEAD / 2) playAt = now + LEAD;
  if (playAt - now > MAX_AHEAD) sound.dropped++;
  else {
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
    sound.chunks++;
  }
  send({ type: "audio-queue", ms: Math.round(queued() * 1000) });
}

/** libretro bits as the core maps them (alt-map, frontend.c): B→N64 A,
 * Y→N64 B, L2→Z, Select→L, R2→R; the D-pad is libretro's 4–7. */
const KEYBOARD: Record<string, number> = {
  KeyK: 0, // A
  KeyJ: 1, // B
  Enter: 3, // Start
  KeyQ: 12, // Z
  KeyI: 2, // L
  KeyO: 13, // R
};
/** Keys read as sticks: arrows are the control stick; WASD the right stick,
 * which the core reads as the C buttons. */
const STICK_KEYS = {
  left: ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"],
  right: ["KeyW", "KeyS", "KeyA", "KeyD"],
} as const;
const PAD: [number, number][] = [
  [0, 0], // south → A
  [2, 1], // west → B
  [9, 3], // start
  [6, 12], // left trigger → Z
  [4, 2], // L
  [5, 13], // R
  [12, 4], // D-pad
  [13, 5],
  [14, 6],
  [15, 7],
];
const keyStick = ([up, down, left, right]: readonly string[]) =>
  digitalStick(keys.has(up), keys.has(down), keys.has(left), keys.has(right));
/** A pressed key direction wins over the pad's stick. */
const either = (key: Stick, pad: Stick) => (key.x || key.y ? key : pad);

function send(request: SessionRequest, transfer: Transferable[] = []) {
  worker?.postMessage(request, transfer);
}

function controls() {
  const live = state !== "idle";
  startDemo.disabled = startRom.disabled = live;
  stopButton.disabled = loseButton.disabled = !live;
  pauseButton.disabled = state !== "running" && state !== "paused";
  pauseButton.textContent = state === "paused" ? "Reanudar" : "Pausar";
}

function stop(message = "Sesión detenida.") {
  cancelAnimationFrame(frame);
  clearInterval(poll);
  clearTimeout(watchdog);
  worker?.terminate();
  worker = undefined;
  void audio?.close();
  audio = undefined;
  sampleRate = 0;
  keys.clear();
  holder.replaceChildren();
  state = "idle";
  pausedByVisibility = false;
  controls();
  status.textContent = message;
  log(`[página] ${message}`);
}

/** Keyboard and the first standard pad, sampled each animation frame. */
function pumpInput() {
  let buttons = 0;
  for (const key of keys) if (key in KEYBOARD) buttons |= 1 << KEYBOARD[key];
  const pad = Array.from(navigator.getGamepads?.() ?? []).find(
    (p) => p?.connected && p.mapping === "standard",
  );
  if (pad)
    for (const [from, to] of PAD)
      if (pad.buttons[from]?.pressed) buttons |= 1 << to;
  // Gamepad API y grows downwards, like libretro's.
  const sticks = analogOf(pad ?? undefined);
  const left = either(keyStick(STICK_KEYS.left), sticks.left);
  const right = either(keyStick(STICK_KEYS.right), sticks.right);
  send({
    type: "input",
    buttons,
    lx: toInt16(left.x),
    ly: toInt16(left.y),
    rx: toInt16(right.x),
    ry: toInt16(right.y),
  });
  frame = requestAnimationFrame(pumpInput);
}

function onEvent(data: SessionEvent) {
  switch (data.type) {
    case "audio":
      return play(data.samples);
    case "log":
      return log(data.text);
    case "state":
      state = data.state;
      if (data.state === "loading") {
        loadingStep = data.detail;
        status.textContent = `Arrancando: ${data.detail}…`;
      } else if (data.state === "paused") status.textContent = "En pausa.";
      else if (data.state === "running")
        status.textContent = `En marcha (${data.detail}).`;
      controls();
      return;
    case "running":
      clearTimeout(watchdog);
      sampleRate = data.sampleRate;
      log(
        `[página] en marcha: ${data.fps.toFixed(2)} Hz, audio ${data.sampleRate} Hz (salida ${audio?.sampleRate} Hz), ${data.renderer}`,
      );
      status.textContent = `En marcha a ${data.fps.toFixed(2)} Hz.`;
      pumpInput();
      poll = setInterval(() => send({ type: "status", x: 320, y: 240 }), 1000);
      return;
    case "status": {
      const queue = queued();
      stats.textContent = JSON.stringify({
        poll: ++polls,
        ...data,
        audioQueueMs: Math.round(Math.max(queue, 0) * 1000),
        audioDropped: sound.dropped,
        audioUnderruns: sound.underruns,
        audioDeficitMs: sound.deficitMs,
      });
      // Frames run but nothing presented: usually shaders the GPU rejected.
      blank = data.state === "running" && !data.presented ? blank + 1 : 0;
      if (blank === 3)
        status.textContent =
          "El núcleo corre pero no presenta imagen: copia el registro (suele ser un shader rechazado por la GPU).";
      return;
    }
    case "error":
      return stop(data.message);
  }
}

async function start(rom: Uint8Array) {
  stop("Arrancando…");
  // A dev server answers unknown paths with its HTML page: only JavaScript
  // means the core is there.
  const head = await fetch(MODULE, { method: "HEAD" });
  if (!head.ok || !/javascript/.test(head.headers.get("content-type") ?? "")) {
    status.textContent =
      "Falta cores/mupen64plus-next/dist/n64-core.mjs en esta copia del repositorio: actualízala con git pull (lo compila la CI) o compílalo con «node tools/build-mupen64plus-next.mjs»";
    log(
      `[página] ${MODULE}: ${head.status} ${head.headers.get("content-type")}`,
    );
    return;
  }
  // At the core's fixed 44.1 kHz (libretro.c): each chunk is its own buffer
  // source, and at another rate every one is resampled separately, with a
  // click at the joins that loud sounds make audible.
  audio = new AudioContext({ sampleRate: 44100 });
  playAt = 0;
  Object.assign(sound, { chunks: 0, dropped: 0, underruns: 0, deficitMs: 0 });
  blank = 0;
  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = 480;
  canvas.setAttribute("aria-label", "Imagen del juego N64");
  holder.replaceChildren(canvas);
  const offscreen = canvas.transferControlToOffscreen();
  worker = new Worker(new URL("./session.worker.ts", import.meta.url), {
    type: "module",
  });
  state = "loading";
  loadingStep = "arrancando el Worker";
  controls();
  log(`[página] ${navigator.userAgent}`);
  worker.onerror = (event) => {
    event.preventDefault();
    const where = event.filename
      ? ` (${event.filename}:${event.lineno})`
      : " (no se pudo cargar el script del Worker)";
    stop(
      `El Worker de la sesión ha fallado: ${event.message || "sin mensaje"}${where}.`,
    );
  };
  worker.onmessage = ({ data }: MessageEvent<SessionEvent>) => onEvent(data);
  watchdog = setTimeout(() => {
    if (state === "loading")
      status.textContent = `Sigue arrancando tras ${WATCHDOG_MS / 1000} s, en «${loadingStep}». Copia el registro.`;
  }, WATCHDOG_MS);
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
pauseButton.onclick = () => {
  pausedByVisibility = false;
  if (state === "running") {
    send({ type: "pause" });
    void audio?.suspend();
  } else if (state === "paused") {
    void audio?.resume();
    send({ type: "resume" });
  }
};
stopButton.onclick = () => stop();
loseButton.onclick = () => send({ type: "lose-context" });
copyButton.onclick = async () => {
  const text = `${lines.join("\n")}\n\n${stats.textContent}`;
  try {
    await navigator.clipboard.writeText(text);
    copyButton.textContent = "Registro copiado";
  } catch {
    copyButton.textContent = "No se pudo copiar: selecciónalo a mano";
  }
  setTimeout(() => (copyButton.textContent = "Copiar registro"), 2500);
};
// A hidden tab pauses the session (and its audio); showing it again resumes
// it from that moment, without running the time it was hidden.
document.addEventListener("visibilitychange", () => {
  if (document.hidden && state === "running") {
    pausedByVisibility = true;
    send({ type: "pause" });
    void audio?.suspend();
  } else if (!document.hidden && pausedByVisibility && state === "paused") {
    pausedByVisibility = false;
    void audio?.resume();
    send({ type: "resume" });
  }
});
const STICKS = new Set<string>([...STICK_KEYS.left, ...STICK_KEYS.right]);
window.addEventListener("keydown", (e) => {
  if (worker && (e.code in KEYBOARD || STICKS.has(e.code))) {
    keys.add(e.code);
    e.preventDefault(); // the arrows would scroll the page
  }
});
window.addEventListener("keyup", (e) => keys.delete(e.code));
window.addEventListener("blur", () => keys.clear());
window.addEventListener("pagehide", () => stop());
