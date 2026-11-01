// Installation, offline cache and safe updates for the Cartivo shell.
// The service worker only exists in production builds (see tools/pwa-plugin.mjs).

type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export const pwa = $state({
  /** The browser offered a native install prompt that has not been used. */
  canInstall: false,
  /** Running as an installed app (standalone window). */
  installed: false,
  /** The current version is cached and works without a network connection. */
  offlineReady: false,
  /** A newer version is downloaded and waiting for a safe moment. */
  updateReady: false,
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
  sw.addEventListener("controllerchange", () => {
    setOfflineReady(true);
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
      setOfflineReady(!!sw.controller || !!registration.active);
      // Installed apps keep saves safer from storage eviction. Asking in a
      // plain tab could show a permission prompt in some browsers.
      if (pwa.installed && navigator.storage?.persist)
        void navigator.storage.persisted().then((done) => {
          if (!done) void navigator.storage.persist();
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
  if (!waiting) return;
  reloadWhenActivated = true;
  waiting.postMessage({ type: "cartivo:activate-update" });
}
