import { useServiceWorker } from "../lib/serviceWorker";
import { t } from "../lib/i18n";

/**
 * Offers the new version instead of installing it under the user's hands.
 *
 * Reloading by itself would be the wrong call in an app like this: the reload
 * could land in the middle of writing a review, halfway through a marathon, or
 * — worst — while a video is playing. Whoever is watching decides when.
 */
export function UpdatePrompt() {
  const updateReady = useServiceWorker((s) => s.updateReady);
  const applyUpdate = useServiceWorker((s) => s.applyUpdate);

  if (!updateReady) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-50 mx-auto flex w-fit max-w-[calc(100%-2rem)] items-center gap-3 rounded-lg bg-surface-2 px-4 py-2.5 shadow-[var(--shadow-md)] lg:bottom-6"
    >
      <span className="text-sm text-text">{t("UpdatePrompt.e_disponibile_una_versione")}</span>
      <button
        type="button"
        onClick={applyUpdate}
        className="btn btn-primary btn-sm shrink-0"
      >
        {t("UpdatePrompt.ricarica")}
      </button>
    </div>
  );
}
