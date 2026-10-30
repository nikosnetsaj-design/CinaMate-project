import { useMemo, useState } from "react";
import { useLibrary } from "../store/useLibrary";
import { episodeLabel, isWatched, nextEpisode, seasonLayout, watchedList, type EpisodeRef } from "../lib/episodes";
import { useLongPress } from "../lib/useLongPress";
import type { Item } from "../types";
import { CheckIcon } from "./icons";

/**
 * Le stagioni come griglia: un quadrato per puntata.
 *
 * Sostituisce la slitta del contatore, che sapeva dire «27 episodi» ma non
 * quali. Un tocco segna o toglie quella puntata; tenendo premuto si segnano
 * tutte quelle prima, che è il gesto di chi aggiunge una serie a metà. Il
 * prossimo episodio ha l'anello d'accento: è l'unico colore della griglia.
 *
 * Funziona anche senza TMDB: senza la divisione in stagioni le puntate stanno
 * in fila nella stagione 1, e la griglia lo dice.
 */
function Cell({ item, ref_, next }: { item: Item; ref_: EpisodeRef; next: boolean }) {
  const toggleEpisode = useLibrary((s) => s.toggleEpisode);
  const markEpisodesUpTo = useLibrary((s) => s.markEpisodesUpTo);
  const watched = isWatched(item, ref_);
  const press = useLongPress(
    () => toggleEpisode(item.id, ref_),
    () => markEpisodesUpTo(item.id, ref_),
  );
  return (
    <button
      type="button"
      {...press}
      aria-pressed={watched}
      aria-label={`${episodeLabel(ref_)}${watched ? ", visto" : ""}${next ? ", il prossimo" : ""}`}
      className="flex aspect-square min-h-11 items-center justify-center rounded-sm text-sm font-medium tabular transition-[background-color,color,transform] duration-200 active:scale-95"
      style={
        watched
          ? { background: "var(--text)", color: "var(--bg)" }
          : next
            ? { background: "var(--surface-2)", color: "var(--text)", boxShadow: "inset 0 0 0 2px var(--accent)" }
            : { background: "var(--surface-2)", color: "var(--text-muted)" }
      }
    >
      {ref_.episode}
    </button>
  );
}

export function EpisodeGrid({ item }: { item: Item }) {
  const layout = seasonLayout(item);
  const watched = watchedList(item);
  const next = nextEpisode(item);

  // Senza divisione: quante caselle mostrare nella stagione 1. Il totale se
  // lo si sa, altrimenti l'ultimo visto più qualche puntata davanti.
  const seasons = useMemo(() => {
    if (layout) return layout.map((count, i) => ({ season: i + 1, count }));
    const highest = watched.reduce((m, w) => Math.max(m, w.episode), 0);
    return [{ season: 1, count: item.episodes ?? Math.max(highest + 6, 12) }];
  }, [layout, watched, item.episodes]);

  const [season, setSeason] = useState(() => next?.season ?? seasons[seasons.length - 1]?.season ?? 1);
  const current = seasons.find((s) => s.season === season) ?? seasons[0];
  const doneIn = (n: number) => watched.filter((w) => w.season === n).length;

  return (
    <div className="flex flex-col gap-3">
      {seasons.length > 1 && (
        <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1" role="tablist" aria-label="Stagioni">
          {seasons.map((s) => {
            const done = doneIn(s.season);
            return (
              <button
                key={s.season}
                type="button"
                role="tab"
                aria-selected={s.season === season}
                onClick={() => setSeason(s.season)}
                className="chip"
              >
                S{s.season}
                <span className="tabular opacity-60">
                  {done === s.count && s.count > 0 ? <CheckIcon size={14} /> : `${done}/${s.count}`}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {current && current.count > 0 ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(44px,1fr))] gap-1.5" role="group" aria-label={`Stagione ${current.season}`}>
          {Array.from({ length: current.count }, (_, i) => {
            const ref = { season: current.season, episode: i + 1 };
            return <Cell key={i} item={item} ref_={ref} next={!!next && next.season === ref.season && next.episode === ref.episode} />;
          })}
        </div>
      ) : (
        <p className="text-sm text-text-muted">TMDB non elenca ancora puntate per questa stagione.</p>
      )}

      <p className="text-xs text-text-muted">
        Tocca una puntata per segnarla, tieni premuto per segnare anche quelle prima.
        {!layout && " La divisione in stagioni arriva da TMDB: fino ad allora le puntate stanno in fila."}
      </p>
    </div>
  );
}
