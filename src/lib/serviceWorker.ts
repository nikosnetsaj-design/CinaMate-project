import { create } from "zustand";

/**
 * Registration for the offline shell, plus the one piece of state the page
 * needs from it: whether a newer version is sitting there waiting.
 *
 * A worker that swaps itself silently is how a single-page app ends up running
 * half of one release and half of the next — the tab keeps the old JavaScript
 * while lazily-loaded chunks start arriving from the new build, and the
 * mismatch shows up as an unexplained blank page. So the swap is offered rather
 * than performed: see components/UpdatePrompt.
 */
interface ServiceWorkerState {
  /** A new version is installed and waiting for the page to let it take over. */
  updateReady: boolean;
  /** Reloads onto the new version. */
  applyUpdate: () => void;
}

let waitingWorker: ServiceWorker | null = null;

/**
 * Whether the page asked for the swap.
 *
 * `controllerchange` does not only fire when a new version takes over: it also
 * fires on the very first visit, the moment the freshly installed worker calls
 * `clients.claim()`. Reloading on every such event meant every first-time
 * visitor was thrown into an unexplained reload a second after the app opened.
 * So the reload is tied to the button, not to the event.
 */
let updateRequested = false;

export const useServiceWorker = create<ServiceWorkerState>((set) => ({
  updateReady: false,
  applyUpdate: () => {
    set({ updateReady: false });
    updateRequested = true;
    // The worker calls skipWaiting, and the controllerchange listener below
    // does the reload — reloading here would race the swap and could come back
    // on the old version anyway.
    if (waitingWorker) waitingWorker.postMessage("skip-waiting");
    else window.location.reload();
  },
}));

/**
 * Tells the worker which files this page is built from, so they are cached on
 * the *first* visit rather than the second — see the matching comment in sw.js.
 *
 * The list is taken from what the browser really loaded, not from a guess: the
 * resource timeline knows every script, stylesheet and font that was fetched,
 * hashed filenames included, which is precisely what a hand-written worker
 * cannot know on its own.
 */
async function primeAssetCache() {
  try {
    const registration = await navigator.serviceWorker.ready;
    const worker = registration.active;
    if (!worker) return;

    // Selected by origin, not by `initiatorType`. That field looked like the
    // precise filter and was the wrong one: a preloaded module chunk reports
    // "other", so the very chunk the app cannot boot without was the one being
    // left out — and the fonts with it. Every same-origin resource here is
    // build output, so origin is both simpler and correct.
    const urls = performance
      .getEntriesByType("resource")
      .map((entry) => entry.name)
      .filter((name) => name.startsWith(`${window.location.origin}/`))
      // The worker is served by the browser, never from its own cache.
      .filter((name) => !name.endsWith("/sw.js"));

    if (urls.length > 0) worker.postMessage({ type: "cache-assets", urls: Array.from(new Set(urls)) });
  } catch {
    // No priming this time; the next visit's requests go through the worker
    // and populate the cache the ordinary way.
  }
}

export function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  // A worker registered from the dev server would cache a shell that Vite is
  // about to rebuild, and then serve it back over the live one.
  if (import.meta.env.DEV) return;

  window.addEventListener("load", () => {
    const url = `${import.meta.env.BASE_URL}sw.js`;
    navigator.serviceWorker
      .register(url, { scope: import.meta.env.BASE_URL })
      .then((registration) => {
        // Already waiting when the page loaded: a previous visit installed it
        // and never reloaded.
        if (registration.waiting && navigator.serviceWorker.controller) {
          waitingWorker = registration.waiting;
          useServiceWorker.setState({ updateReady: true });
        }

        registration.addEventListener("updatefound", () => {
          const installing = registration.installing;
          if (!installing) return;
          installing.addEventListener("statechange", () => {
            // `controller` is null on the very first install: there is no old
            // version to replace, so there is nothing to announce.
            if (installing.state === "installed" && navigator.serviceWorker.controller) {
              waitingWorker = installing;
              useServiceWorker.setState({ updateReady: true });
            }
          });
        });
      })
      .catch(() => {
        // No offline shell this time. Everything else works exactly as before,
        // so there is nothing worth interrupting anyone about.
      });

    void primeAssetCache();

    let reloading = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      // Not our doing: the first-visit claim, or another tab applying an
      // update. This tab keeps running the version it started with.
      if (!updateRequested || reloading) return;
      reloading = true;
      window.location.reload();
    });
  });
}
