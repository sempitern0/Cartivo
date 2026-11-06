// Installation, offline cache and safe updates for the Cartivo shell.
// The service worker only exists in production builds (see tools/pwa-plugin.mjs).
import { offlineCacheComplete } from "./offline-cache.ts";

type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export const pwa = $state({
  /** The browser offered a native install prompt that has not been used. */
  canInstall: false,
  /** Running as an installed app (standalone window). */
  installed: false,
  /**
   * Verified: a Cartivo cache holds its manifest and every file it lists
   * (cores included), so the app works without a network connection.
   */
  offlineReady: false,
  /** A newer version is downloaded and waiting for a safe moment. */
  updateReady: false,
  applyingUpdate: false,
  updateProblem: "",
});

let deferredPrompt: InstallPrompt | undefined;
let waiting: ServiceWorker | undefined;
let reloadWhenActivated = false;

function setOfflineReady(value: boolean) {
  pwa.offlineReady = value;
  document.documentElement.dataset.offlineReady = String(value);
}

function standalone() {
  return (
    matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function track(worker: ServiceWorker | null | undefined) {
  if (!worker) return;
  const check = () => {
    if (worker.state === "installed" && navigator.serviceWorker.controller) {
      waiting = worker;
      pwa.updateReady = true;
    }
  };
  check();
  worker.addEventListener("statechange", check);
}

/** Asks a service worker which build it serves (its cache name). */
function workerVersion(sw: ServiceWorkerContainer, worker: ServiceWorker) {
  return new Promise<string>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      sw.removeEventListener("message", receive);
      reject(new Error("Service worker version unavailable"));
    }, 3000);
    function receive(event: MessageEvent) {
      if (
        event.source !== worker ||
        event.data?.type !== "cartivo:version" ||
        typeof event.data.version !== "string"
      )
        return;
      window.clearTimeout(timer);
      sw.removeEventListener("message", receive);
      resolve(event.data.version);
    }
    sw.addEventListener("message", receive);
    worker.postMessage({ type: "cartivo:version" });
  });
}

export function startPwa() {
  pwa.installed = standalone();
  matchMedia("(display-mode: standalone)").addEventListener("change", () => {
    pwa.installed = standalone();
  });
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event as InstallPrompt;
    pwa.canInstall = !pwa.installed;
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = undefined;
    pwa.canInstall = false;
    pwa.installed = true;
  });

  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
  const sw = navigator.serviceWorker;
  const scope = new URL(import.meta.env.BASE_URL, location.href).href;
  let verification = 0;
  const verifyOffline = async () => {
    const attempt = ++verification;
    setOfflineReady(false);
    try {
      const worker = sw.controller ?? (await sw.ready).active;
      if (!worker) return;
      const version = await workerVersion(sw, worker);
      const complete = await offlineCacheComplete(scope, version);
      if (attempt === verification) setOfflineReady(complete);
    } catch {
      if (attempt === verification) setOfflineReady(false);
    }
  };
  sw.addEventListener("controllerchange", () => {
    void verifyOffline();
    // Only reload when the player explicitly applied an update, and the
    // UI only offers that while no game session is open.
    if (reloadWhenActivated) location.reload();
  });
  void sw
    .register(`${import.meta.env.BASE_URL}sw.js`)
    .then(async (registration) => {
      track(registration.waiting);
      registration.addEventListener("updatefound", () =>
        track(registration.installing),
      );
      await sw.ready;
      await verifyOffline();
      // Installed apps keep saves safer from storage eviction. Asking in a
      // plain tab could show a permission prompt in some browsers.
      if (pwa.installed && navigator.storage?.persist)
        void navigator.storage
          .persisted()
          .then((done) => done || navigator.storage.persist())
          .catch(() => {
            /* Persistence is optional. */
          });
    })
    .catch(() => setOfflineReady(false));
}

export async function install() {
  const prompt = deferredPrompt;
  if (!prompt) return;
  deferredPrompt = undefined;
  pwa.canInstall = false;
  await prompt.prompt();
  const { outcome } = await prompt.userChoice;
  if (outcome === "accepted") pwa.installed = true;
}

/** Applies a waiting update. Call only when no game session is active. */
export function applyUpdate() {
  if (!waiting || pwa.applyingUpdate) return;
  pwa.applyingUpdate = true;
  pwa.updateProblem = "";
  reloadWhenActivated = true;
  const channel = new MessageChannel();
  const timeout = window.setTimeout(() => {
    channel.port1.close();
    // Do not unlock: activation may still finish and reload this tab.
    pwa.updateProblem =
      "La actualización está tardando. Cierra y vuelve a abrir Cartivo para continuar.";
  }, 10000);
  channel.port1.onmessage = (event) => {
    window.clearTimeout(timeout);
    channel.port1.close();
    if (event.data?.accepted) return;
    reloadWhenActivated = false;
    pwa.applyingUpdate = false;
    pwa.updateProblem =
      "Cierra las otras pestañas de Cartivo antes de actualizar.";
  };
  try {
    waiting.postMessage({ type: "cartivo:activate-update" }, [channel.port2]);
  } catch {
    window.clearTimeout(timeout);
    channel.port1.close();
    reloadWhenActivated = false;
    pwa.applyingUpdate = false;
    pwa.updateProblem =
      "No se pudo activar la actualización. Vuelve a intentarlo.";
  }
}
