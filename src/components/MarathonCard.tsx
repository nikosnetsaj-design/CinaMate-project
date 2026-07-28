import { useState } from "react";
import { useLibrary } from "../store/useLibrary";
import { useMarathon } from "../store/useMarathon";
import { useSelectedItem } from "../store/useSelectedItem";
import { useSelectedSaga } from "../store/useSelectedSaga";
import { useSettings } from "../store/useSettings";
import { useEditSheet } from "../store/useEditSheet";
import { useSagaView } from "../lib/useSagaView";
import { draftFromTmdb } from "../lib/addFromTmdb";
import { findLibraryMatch, WATCH_ORDERS } from "../lib/sagas";
import { PosterArt } from "./PosterArt";
import { PlayIcon } from "./icons";

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
  const openNew = useEditSheet((s) => s.openNew);
  const tmdbApiKey = useSettings((s) => s.tmdbApiKey);
  const [adding, setAdding] = useState(false);

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
      isLast ? `Maratona completata: ${saga.name}.` : "Prossimo capitolo pronto.",
    );
  }

  async function addCurrent() {
    if (!tmdbApiKey || !current) return;
    setAdding(true);
    try {
      openNew(
        await draftFromTmdb(current.tmdbId, "movie", "film", tmdbApiKey, {
          title: current.title,
          year: current.year,
          posterPath: current.posterPath,
        }),
      );
    } catch {
      pushToast("error", "Non è stato possibile leggere questo titolo da TMDB.");
    }
    setAdding(false);
  }

  return (
    <section
      aria-label="Maratona in corso"
      className="rounded-md border p-3.5"
      style={{
        borderColor: `color-mix(in srgb, ${view.accent} 38%, transparent)`,
        background: `color-mix(in srgb, ${view.accent} 8%, transparent)`,
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => openSaga(marathon.key)}
          className="min-w-0 text-left"
          aria-label={`Apri la saga ${view.name}`}
        >
          <p className="text-[11px] uppercase tracking-[0.16em] text-text-faint">Maratona · ordine {orderLabel}</p>
          <p className="truncate font-display text-base font-semibold text-text">{view.name}</p>
        </button>
        <button
          type="button"
          onClick={stop}
          className="shrink-0 rounded-sm border border-border-strong px-2.5 py-1 text-[11px] text-text-muted hover:bg-surface-hover"
        >
          Termina
        </button>
      </div>

      <div className="mt-2.5 flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-hover">
          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: view.accent }} />
        </div>
        <span className="font-mono tabular text-xs font-semibold" style={{ color: view.accent }}>
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
          <p className="text-[11px] text-text-faint">
            Capitolo {marathon.index + 1} di {marathon.queue.length}
          </p>
          <p className="truncate font-display text-sm font-semibold text-text">{current.title}</p>
          <p className="font-mono tabular text-[11px] text-text-faint">{current.year ?? "in arrivo"}</p>
        </div>
      </div>

      <div className="mt-3 flex gap-2">
        {currentItem ? (
          <button
            type="button"
            onClick={() => openItem(currentItem)}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-sm border border-border-strong bg-surface py-2 text-xs font-medium text-text"
          >
            <PlayIcon size={13} />
            Dove guardarlo
          </button>
        ) : (
          <button
            type="button"
            onClick={addCurrent}
            disabled={adding || !tmdbApiKey}
            className="flex-1 rounded-sm border border-border-strong bg-surface py-2 text-xs font-medium text-text disabled:opacity-60"
          >
            {adding ? "…" : "Aggiungi in libreria"}
          </button>
        )}
        <button
          type="button"
          onClick={finishAndAdvance}
          className="flex-[1.4] rounded-sm py-2 text-xs font-semibold"
          style={{ background: view.accent, color: "var(--accent-contrast)" }}
        >
          {currentItem ? "Visto → prossimo" : "Salta al prossimo"}
        </button>
      </div>
    </section>
  );
}
