import { useLibrary } from "../store/useLibrary";
import { useMarathon } from "../store/useMarathon";
import { useSelectedItem } from "../store/useSelectedItem";
import { useSelectedSaga } from "../store/useSelectedSaga";
import { useSettings } from "../store/useSettings";
import { useSagaView } from "../lib/useSagaView";
import { useQuickAdd } from "../lib/useQuickAdd";
import { findLibraryMatch, WATCH_ORDERS } from "../lib/sagas";
import { PosterArt } from "./PosterArt";
import { PlayIcon } from "./icons";
import { t } from "../lib/i18n";

/**
 * A marathon in an app that plays nothing is a queue with a bookmark: it tells
 * you which chapter is next, moves the bookmark when you finish one, and keeps
 * the run alive across days and reloads. Everything else — the playing — happens
 * on the service that holds the licence.
 */
export function MarathonCard() {
  const marathon = useMarathon((s) => s.marathon);
  const advance = useMarathon((s) => s.advance);
  const stop = useMarathon((s) => s.stop);

  const items = useLibrary((s) => s.items);
  const setStatus = useLibrary((s) => s.setStatus);
  const pushToast = useLibrary((s) => s.pushToast);
  const openItem = useSelectedItem((s) => s.open);
  const openSaga = useSelectedSaga((s) => s.open);
  const tmdbApiKey = useSettings((s) => s.tmdbApiKey);
  const { quickAdd, pending } = useQuickAdd();
  const adding = pending.size > 0;

  const { view } = useSagaView(marathon?.key ?? null);

  if (!marathon || !view) return null;
  // Bound after the guard so the callbacks below close over non-null values:
  // a hoisted function declaration cannot see the narrowing on its own.
  const run = marathon;
  const saga = view;

  const partById = new Map(view.parts.map((p) => [p.tmdbId, p]));
  const queue = marathon.queue.map((id) => partById.get(id)).filter((p) => p !== undefined);
  const watched = queue.filter((p) => findLibraryMatch(p, items)?.status === "Visto").length;
  const pct = queue.length ? Math.round((watched / queue.length) * 100) : 0;

  const current = partById.get(marathon.queue[marathon.index]);
  if (!current) return null;
  const currentItem = findLibraryMatch(current, items);
  const orderLabel = WATCH_ORDERS.find((o) => o.id === marathon.order)?.label.toLowerCase() ?? "uscita";

  function finishAndAdvance() {
    if (currentItem) setStatus(currentItem.id, "Visto");
    advance();
    const isLast = run.index + 1 >= run.queue.length;
    pushToast(
      isLast ? "success" : "info",
      isLast ? t("MarathonCard.maratona_completata", { v0: saga.name }) : t("MarathonCard.prossimo_capitolo_pronto"),
    );
  }

  // Il capitolo di turno entra in libreria con un tocco: poi la carta
  // mostra «Dove guardarlo», come per quelli che c'erano già.
  async function addCurrent() {
    if (!current) return;
    await quickAdd({ tmdbId: current.tmdbId, mediaType: "movie", kind: "film", title: current.title, year: current.year, posterPath: current.posterPath });
  }

  return (
    <section
      aria-label={t("MarathonCard.maratona_in_corso")}
      className="rounded-lg bg-surface p-4 shadow-[var(--shadow-sm)]"
    >
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => openSaga(marathon.key)}
          className="min-w-0 text-left"
          aria-label={t("MarathonCard.apri_la_saga", { v0: view.name })}
        >
          <p className="text-xs font-medium text-text-faint">{t("MarathonCard.maratona_ordine")} {orderLabel}</p>
          <p className="t-title truncate text-text">{view.name}</p>
        </button>
        <button
          type="button"
          onClick={stop}
          className="btn btn-secondary btn-sm shrink-0"
        >
          {t("MarathonCard.termina")}
        </button>
      </div>

      <div className="mt-2.5 flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-hover">
          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: view.accent }} />
        </div>
        <span className="tabular text-xs font-semibold text-text-muted">
          {watched}/{queue.length}
        </span>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <PosterArt
          item={{ title: current.title, kind: "film", posterPath: current.posterPath }}
          size="sm"
          showTitle={false}
          className="w-12 shrink-0"
        />
        <div className="min-w-0 flex-1">
          <p className="text-xs text-text-faint">
            {t("MarathonCard.capitolo")} {marathon.index + 1} {t("MarathonCard.di")} {marathon.queue.length}
          </p>
          <p className="truncate text-sm font-medium text-text">{current.title}</p>
          <p className="tabular text-xs text-text-faint">{current.year ?? t("MarathonCard.in_arrivo")}</p>
        </div>
      </div>

      <div className="mt-3 flex gap-2">
        {currentItem ? (
          <button
            type="button"
            onClick={() => openItem(currentItem)}
            className="btn btn-secondary btn-sm flex-1"
          >
            <PlayIcon size={13} />
            {t("MarathonCard.dove_guardarlo")}
          </button>
        ) : (
          <button
            type="button"
            onClick={addCurrent}
            disabled={adding || !tmdbApiKey}
            className="btn btn-secondary btn-sm flex-1 disabled:opacity-60"
          >
            {adding ? "…" : t("MarathonCard.aggiungi_in_libreria")}
          </button>
        )}
        <button
          type="button"
          onClick={finishAndAdvance}
          className="btn btn-primary btn-sm flex-[1.4]"
        >
          {currentItem ? t("MarathonCard.visto_prossimo") : t("MarathonCard.salta_al_prossimo")}
        </button>
      </div>
    </section>
  );
}
