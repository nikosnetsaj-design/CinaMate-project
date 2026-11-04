import { useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, m } from "framer-motion";
import { useLibrary } from "../store/useLibrary";
import { useMarathon } from "../store/useMarathon";
import { useSagas, sagaKey } from "../store/useSagas";
import { useSelectedItem } from "../store/useSelectedItem";
import { buildEntries, nextChapterAfter, orderParts, type SagaEntry } from "../lib/sagas";
import { useQuickAdd } from "../lib/useQuickAdd";
import { PosterArt } from "./PosterArt";
import { CloseIcon, PlayIcon } from "./icons";
import { t } from "../lib/i18n";

/**
 * "Continua la storia": the moment a chapter is finished, the next one in its
 * saga is offered. Nothing auto-plays — there is nothing here to play — but the
 * decision of what comes next is made for you, which is the part that actually
 * stops a saga from being abandoned at chapter three.
 */
function Prompt({ finishedTitle, entry, onDismiss }: {
  finishedTitle: string;
  entry: SagaEntry;
  onDismiss: () => void;
}) {
  const openItem = useSelectedItem((s) => s.open);
  const { quickAdd, pending } = useQuickAdd();
  const adding = pending.size > 0;

  // Il prossimo capitolo entra in libreria con un tocco, e si apre la sua
  // scheda: niente modulo da riempire alla fine di un film.
  async function start() {
    if (entry.item) {
      openItem(entry.item);
      onDismiss();
      return;
    }
    const added = await quickAdd({
      tmdbId: entry.part.tmdbId,
      mediaType: "movie",
      kind: "film",
      title: entry.part.title,
      year: entry.part.year,
      posterPath: entry.part.posterPath,
    });
    if (added) {
      openItem(added);
      onDismiss();
    }
  }

  return createPortal(
    <m.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 16 }}
      transition={{ type: "spring", stiffness: 340, damping: 30 }}
      role="status"
      className="fixed inset-x-3 bottom-20 z-60 mx-auto max-w-md rounded-lg bg-surface p-4 shadow-[var(--shadow-lg),0_0_0_1px_var(--separator)] sm:inset-x-6 lg:bottom-6 lg:left-auto lg:right-6"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs text-text-muted">
          {t("NextChapterPrompt.hai_finito")} <span className="font-semibold text-text">{finishedTitle}</span>
        </p>
        <button
          type="button"
          onClick={onDismiss}
          aria-label={t("NextChapterPrompt.chiudi_il_suggerimento")}
          className="-mt-1 shrink-0 px-1 text-text-faint hover:text-text"
        >
          <CloseIcon size={16} />
        </button>
      </div>

      <div className="mt-2.5 flex items-center gap-3">
        <PosterArt
          item={{ title: entry.part.title, kind: "film", posterPath: entry.part.posterPath }}
          size="sm"
          showTitle={false}
          className="w-12 shrink-0"
        />
        <div className="min-w-0 flex-1">
          <p className="text-xs text-text-faint">
            {t("NextChapterPrompt.capitolo")} {entry.number}
          </p>
          <p className="truncate font-display text-sm font-semibold text-text">{entry.part.title}</p>
          <p className="font-mono tabular text-xs text-text-faint">{entry.part.year ?? t("NextChapterPrompt.in_arrivo")}</p>
        </div>
      </div>

      <button
        type="button"
        onClick={start}
        disabled={adding}
        className="btn btn-primary mt-3 w-full"
      >
        <PlayIcon size={14} />
        {entry.item ? t("NextChapterPrompt.continua_con_il_prossimo") : t("NextChapterPrompt.aggiungi_il_prossimo_capitolo")}
      </button>
    </m.div>,
    document.body,
  );
}

export function NextChapterPrompt() {
  const justCompleted = useLibrary((s) => s.justCompleted);
  const clearJustCompleted = useLibrary((s) => s.clearJustCompleted);
  const items = useLibrary((s) => s.items);
  const sagas = useSagas((s) => s.sagas);
  const orders = useSagas((s) => s.orders);
  const prefs = useSagas((s) => s.prefs);
  const marathon = useMarathon((s) => s.marathon);
  const advance = useMarathon((s) => s.advance);

  const finished = justCompleted ? items.find((i) => i.id === justCompleted.itemId) : undefined;
  const saga = finished?.collectionId != null ? sagas[String(finished.collectionId)] : undefined;

  const next = useMemo(() => {
    if (!finished || !saga) return null;
    const key = sagaKey(saga.id);
    const entries = buildEntries(orderParts(saga.parts, prefs.order[key] ?? "uscita", orders[key]), items);
    return nextChapterAfter(entries, finished.tmdbId, finished.title);
  }, [finished, saga, items, orders, prefs.order]);

  // A running marathon moves its own bookmark when its current chapter is the
  // one that was just finished, so the queue never falls behind the library.
  useEffect(() => {
    if (!finished || !marathon) return;
    if (finished.tmdbId == null) return;
    if (marathon.queue[marathon.index] !== finished.tmdbId) return;
    advance();
  }, [finished, marathon, advance]);

  if (!finished || !next) return null;

  return (
    <AnimatePresence>
      <Prompt
        key={next.part.tmdbId}
        finishedTitle={finished.title}
        entry={next}
        onDismiss={clearJustCompleted}
      />
    </AnimatePresence>
  );
}
