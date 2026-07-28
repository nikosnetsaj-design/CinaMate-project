import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { createPortal } from "react-dom";
import { useLibrary } from "../store/useLibrary";
import { useWatchSession } from "../store/useWatchSession";
import { useFocusTrap } from "../lib/useFocusTrap";
import { PosterArt } from "./PosterArt";
import type { Item } from "../types";

// Ask only once enough time has passed to plausibly have watched something.
const MIN_FRACTION = 0.6;

function elapsedMinutes(startedAt: number): number {
  return (Date.now() - startedAt) / 60000;
}

/** How many episodes the elapsed time suggests, clamped to what is left. */
function suggestEpisodes(item: Item, minutes: number): number {
  if (!item.runtime || !item.episodes) return 1;
  const left = item.episodes - (item.seen || 0);
  return Math.max(1, Math.min(left, Math.floor(minutes / item.runtime)));
}

function Prompt({ item, minutes }: { item: Item; minutes: number }) {
  const clear = useWatchSession((s) => s.clear);
  const setStatus = useLibrary((s) => s.setStatus);
  const setEpisodesSeen = useLibrary((s) => s.setEpisodesSeen);
  const isSeries = item.kind !== "film" && !!item.episodes;
  const [count, setCount] = useState(() => suggestEpisodes(item, minutes));
  const containerRef = useFocusTrap(clear);
  const titleId = "resume-prompt-title";

  function confirm() {
    if (isSeries) setEpisodesSeen(item.id, (item.seen || 0) + count);
    else setStatus(item.id, "Visto");
    clear();
  }

  return createPortal(
    <div className="fixed inset-x-0 bottom-0 z-80 flex justify-center p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
      <motion.div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 16 }}
        transition={{ type: "spring", stiffness: 340, damping: 30 }}
        className="w-full max-w-md rounded-lg border border-border bg-surface p-4 shadow-[var(--shadow-lg)]"
      >
        <div className="flex items-start gap-3.5">
          <PosterArt item={item} size="sm" showTitle={false} className="w-12 shrink-0" />
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="font-display text-base font-semibold text-text">
              Stavi guardando {item.title}
            </h2>
            <p className="mt-0.5 text-xs text-text-faint">
              {isSeries
                ? `Sono passate ${Math.round(minutes)} minuti. Quanti episodi hai visto?`
                : `Sono passate ${Math.round(minutes)} minuti. L'hai finito?`}
            </p>
          </div>
        </div>

        {isSeries && (
          <div className="mt-3.5 flex items-center justify-center gap-4">
            <button
              type="button"
              onClick={() => setCount((c) => Math.max(1, c - 1))}
              aria-label="Un episodio in meno"
              className="h-9 w-9 rounded-sm border border-border-strong text-text-muted"
            >
              −
            </button>
            <span className="font-mono tabular text-2xl font-semibold text-text" aria-live="polite">
              {count}
            </span>
            <button
              type="button"
              onClick={() => setCount((c) => Math.min((item.episodes ?? c) - (item.seen || 0), c + 1))}
              aria-label="Un episodio in più"
              className="h-9 w-9 rounded-sm border text-text"
              style={{ borderColor: "color-mix(in srgb, var(--accent) 45%, transparent)" }}
            >
              +
            </button>
          </div>
        )}

        <div className="mt-4 flex gap-2.5">
          <button
            type="button"
            onClick={clear}
            className="flex-1 rounded-sm border border-border-strong py-2.5 text-sm text-text-muted"
          >
            Non ancora
          </button>
          <button
            type="button"
            onClick={confirm}
            className="flex-[2] rounded-sm py-2.5 text-sm font-semibold"
            style={{ background: "var(--accent)", color: "var(--accent-contrast)" }}
          >
            {isSeries ? `Segna ${count} episod${count === 1 ? "io" : "i"}` : "Sì, visto"}
          </button>
        </div>
      </motion.div>
    </div>,
    document.body,
  );
}

/**
 * Turns "mark every episode by hand" into one tap. Opening a title records the
 * intent; on returning to the app, the elapsed time proposes the answer
 * already filled in. No third party can observe playback on Netflix or Prime,
 * so confirming is the closest honest thing to automatic.
 */
export function ResumePrompt() {
  const session = useWatchSession((s) => s.session);
  const clear = useWatchSession((s) => s.clear);
  const items = useLibrary((s) => s.items);
  const [tick, setTick] = useState(0);

  // Re-evaluate whenever the app comes back to the foreground.
  useEffect(() => {
    const onVisible = () => document.visibilityState === "visible" && setTick((t) => t + 1);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, []);

  const item = session ? items.find((i) => i.id === session.itemId) : undefined;

  useEffect(() => {
    if (session && !item) clear();
  }, [session, item, clear]);

  if (!session || !item) return null;
  void tick;

  const minutes = elapsedMinutes(session.startedAt);
  const needed = Math.max(5, (item.runtime || 45) * MIN_FRACTION);
  if (minutes < needed) return null;
  // A session older than a day is stale: the answer would be a guess.
  if (minutes > 60 * 24) {
    clear();
    return null;
  }

  return (
    <AnimatePresence>
      <Prompt key={item.id} item={item} minutes={minutes} />
    </AnimatePresence>
  );
}
