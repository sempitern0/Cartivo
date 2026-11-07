import { samplePad } from "./preflight.ts";
import { isProbeResult } from "./protocol.ts";

const file = document.querySelector<HTMLInputElement>("#rom")!;
const probe = document.querySelector<HTMLButtonElement>("#probe")!;
const cancel = document.querySelector<HTMLButtonElement>("#cancel")!;
const status = document.querySelector<HTMLElement>("#status")!;
const result = document.querySelector<HTMLElement>("#result")!;
const padButton = document.querySelector<HTMLButtonElement>("#pad")!;
const padState = document.querySelector<HTMLElement>("#pad-state")!;
let worker: Worker | undefined;
let timeout: ReturnType<typeof setTimeout> | undefined;
let generation = 0;

function stop() {
  generation++;
  worker?.terminate();
  worker = undefined;
  clearTimeout(timeout);
  timeout = undefined;
  cancel.disabled = true;
}

probe.onclick = () => {
  stop();
  result.textContent = "Sin resultados.";
  status.textContent = "Comprobando…";
  try {
    if (!window.isSecureContext)
      throw new Error("Abre el laboratorio en localhost o mediante HTTPS.");
    if (
      typeof Worker === "undefined" ||
      typeof HTMLCanvasElement.prototype.transferControlToOffscreen !==
        "function"
    )
      throw new Error(
        "El navegador no permite transferir un canvas a un Worker.",
      );
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 2;
    const offscreen = canvas.transferControlToOffscreen();
    const current = generation;
    worker = new Worker(new URL("./probe.worker.ts", import.meta.url), {
      type: "module",
    });
    cancel.disabled = false;
    const fail = (message: string) => {
      if (current !== generation) return;
      stop();
      status.textContent = message;
    };
    worker.onerror = () => fail("El Worker no pudo completar el diagnóstico.");
    worker.onmessageerror = () => fail("Respuesta del Worker ilegible.");
    worker.onmessage = ({ data }: MessageEvent<unknown>) => {
      if (current !== generation) return;
      if (!isProbeResult(data)) return fail("Respuesta del Worker inválida.");
      stop();
      if (!data.ok) {
        status.textContent = data.error;
        return;
      }
      result.textContent = JSON.stringify(data, null, 2);
      status.textContent =
        data.webgl2 && data.wasm
          ? "Diagnóstico completado. La ruta básica funciona; el núcleo N64 sigue pendiente."
          : "Diagnóstico completado con requisitos no disponibles.";
    };
    timeout = setTimeout(
      () =>
        fail("El diagnóstico agotó el tiempo disponible. Puedes reintentarlo."),
      10_000,
    );
    worker.postMessage(
      { version: 1, canvas: offscreen, file: file.files?.[0] },
      [offscreen],
    );
  } catch (error) {
    stop();
    status.textContent =
      error instanceof Error
        ? error.message
        : "No se pudo iniciar el diagnóstico.";
  }
};
cancel.onclick = () => {
  stop();
  status.textContent = "Diagnóstico cancelado.";
};
file.onchange = () => {
  stop();
  result.textContent = "Sin resultados.";
  status.textContent = "Preparado.";
};

let frame = 0;
let testingPad = false;
function stopPad() {
  testingPad = false;
  cancelAnimationFrame(frame);
  padButton.setAttribute("aria-pressed", "false");
  padButton.textContent = "Probar mando";
  padState.textContent = "Prueba detenida. Entrada neutralizada.";
}
function pollPad() {
  if (!testingPad) return;
  try {
    const pad =
      Array.from(navigator.getGamepads()).find(
        (item) => item?.connected && item.mapping === "standard",
      ) ?? null;
    const text = pad
      ? JSON.stringify(samplePad(pad), null, 2)
      : "Sin mando estándar activo. Entrada neutralizada.";
    if (padState.textContent !== text) padState.textContent = text;
    frame = requestAnimationFrame(pollPad);
  } catch {
    stopPad();
    padState.textContent =
      "La lectura del mando no está disponible en este contexto.";
  }
}
padButton.onclick = () => {
  if (testingPad) return stopPad();
  testingPad = true;
  padButton.setAttribute("aria-pressed", "true");
  padButton.textContent = "Detener prueba de mando";
  pollPad();
};
window.addEventListener("blur", stopPad);
window.addEventListener("gamepaddisconnected", () => {
  padState.textContent = "Mando desconectado. Entrada neutralizada.";
});
window.addEventListener("pagehide", () => {
  stop();
  stopPad();
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    stop();
    stopPad();
    status.textContent = "Prueba detenida al ocultar la página.";
  }
});
