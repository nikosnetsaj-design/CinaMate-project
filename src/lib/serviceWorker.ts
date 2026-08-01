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

export const useServiceWorker = create<ServiceWorkerState>((set) => ({
  updateReady: false,
  applyUpdate: () => {
    set({ updateReady: false });
    // The worker calls skipWaiting, and the controllerchange listener below
    // does the reload — reloading here would race the swap and could come back
    // on the old version anyway.
    if (waitingWorker) waitingWorker.postMessage("skip-waiting");
    else window.location.reload();
  },
}));

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

    let reloading = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    });
  });
}
