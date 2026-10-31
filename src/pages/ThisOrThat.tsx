import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, m, useReducedMotion } from "framer-motion";
import { useLibrary } from "../store/useLibrary";
import { useDuels } from "../store/useDuels";
import { useSelectedItem } from "../store/useSelectedItem";
import { duelPool, pickPair, ranking, recalibrations, CALIBRATION_MIN } from "../lib/elo";
import { PosterArt } from "../components/PosterArt";
import { RowHeader } from "../components/RowHeader";
import { EmptyState } from "../components/EmptyState";
import { StarIcon } from "../components/icons";
import type { Item } from "../types";

/** Dopo quanti confronti la classifica comincia a voler dire qualcosa. */
const RANKING_AFTER = 5;

function Choice({ item, side, onPick }: { item: Item; side: "sinistra" | "destra"; onPick: () => void }) {
  return (
    <button
      type="button"
      onClick={onPick}
      aria-label={`Preferisco ${item.title}${item.year ? `, ${item.year}` : ""}`}
      aria-keyshortcuts={side === "sinistra" ? "ArrowLeft" : "ArrowRight"}
      className="group flex min-w-0 flex-col items-center gap-2.5 rounded-lg p-2 text-center transition-colors hover:bg-surface-hover"
    >
      <PosterArt item={item} size="lg" showTitle={false} className="w-full max-w-[220px] transition-transform duration-200 group-active:scale-[0.98]" />
      <span className="w-full">
        <span className="t-title block truncate text-text">{item.title}</span>
        <span className="block text-xs tabular text-text-muted">{[item.year || null, item.genre].filter(Boolean).join(" · ")}</span>
      </span>
    </button>
  );
}

/**
 * Questo o quello.
 *
 * Due titoli che hai visto, uno accanto all'altro: tocchi quello che
 * preferisci, ne arrivano altri due. Le frecce della tastiera fanno lo
 * stesso, e «Non saprei» è una risposta valida — un pareggio dice qualcosa
 * anche lui. Sotto, la classifica che ne esce e i voti che non le somigliano,
 * con la proposta e mai la modifica.
 */
export function ThisOrThat() {
  const items = useLibrary((s) => s.items);
  const updateItem = useLibrary((s) => s.updateItem);
  const openItem = useSelectedItem((s) => s.open);
  const { ratings, recent, count, kept, vote, keep } = useDuels();
  const reduceMotion = useReducedMotion();

  const pool = useMemo(() => duelPool(items), [items]);
  // La coppia si sceglie una volta per turno, non a ogni disegno: cambia solo
  // quando rispondi o salti, con i punteggi appena aggiornati.
  const [turn, setTurn] = useState(0);
  const [pair, setPair] = useState<[Item, Item] | null>(() => pickPair(pool, ratings, recent));
  const ranked = useMemo(() => ranking(pool, ratings), [pool, ratings]);
  const fixes = useMemo(() => recalibrations(pool, ratings, kept).slice(0, 5), [pool, ratings, kept]);

  function answer(score: 0 | 0.5 | 1 | null) {
    if (!pair) return;
    if (score !== null) vote(pair[0].id, pair[1].id, score);
    const fresh = useDuels.getState();
    setPair(pickPair(duelPool(useLibrary.getState().items), fresh.ratings, fresh.recent));
    setTurn((t) => t + 1);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.metaKey || e.ctrlKey || e.altKey) return;
      if (document.querySelector('[role="dialog"]')) return;
      if (e.key === "ArrowLeft") answer(1);
      else if (e.key === "ArrowRight") answer(0);
      else if (e.key === "=" || e.key === "ArrowDown") answer(0.5);
      else return;
      e.preventDefault();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (pool.length < 2) {
    return (
      <div className="mx-auto max-w-3xl px-[var(--gutter)] py-6 sm:py-10">
        <h1 className="t-display text-text">Questo o quello</h1>
        <EmptyState
          title="Servono almeno due titoli visti."
          description="Segna come visti un paio di film o di serie: poi qui li confronti a due a due, e ne esce la tua classifica."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-10 px-[var(--gutter)] py-6 sm:py-10">
      <div>
        <h1 className="t-display text-text">Questo o quello</h1>
        <p className="mt-1 max-w-prose text-sm text-text-muted">
          Due titoli che hai visto: tocca quello che preferisci. Dai confronti nasce la tua classifica, e i voti che non le
          somigliano te li faccio notare — senza cambiarli.
        </p>
      </div>

      {pair && (
        <section aria-label="Il confronto" className="flex flex-col gap-4">
          <AnimatePresence mode="wait" initial={false}>
            <m.div
              key={`${pair[0].id}|${pair[1].id}|${turn}`}
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -10 }}
              transition={{ duration: reduceMotion ? 0.1 : 0.2 }}
              className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-6"
            >
              <Choice item={pair[0]} side="sinistra" onPick={() => answer(1)} />
              <span className="font-display text-lg italic text-text-faint" aria-hidden="true">
                o
              </span>
              <Choice item={pair[1]} side="destra" onPick={() => answer(0)} />
            </m.div>
          </AnimatePresence>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => answer(0.5)} aria-keyshortcuts="ArrowDown">
              Non saprei
            </button>
            <button type="button" className="btn btn-plain btn-sm" onClick={() => answer(null)}>
              Salta
            </button>
          </div>
          <p className="text-center text-xs tabular text-text-faint">
            {count === 0 ? "Sulla tastiera: ← e → per scegliere, ↓ per «non saprei»." : `${count} confronti finora.`}
          </p>
        </section>
      )}

      {fixes.length > 0 && (
        <section className="flex flex-col gap-4">
          <RowHeader title="Voti da ricontrollare" note="Te li propongo, non li cambio io." />
          <ul className="list-group" style={{ "--row-inset": "72px" } as React.CSSProperties}>
            {fixes.map((f) => (
              <li key={f.item.id} className="list-row gap-3 py-2.5">
                <button type="button" onClick={() => openItem(f.item)} className="shrink-0" aria-label={`Apri dettagli di ${f.item.title}`}>
                  <PosterArt item={f.item} size="sm" showTitle={false} className="w-10" />
                </button>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-text">{f.item.title}</span>
                  <span className="block text-xs text-text-muted">
                    Gli hai dato {f.vote}; nei confronti sta fra i tuoi {f.suggested}.
                  </span>
                </span>
                <span className="flex shrink-0 flex-col gap-1 sm:flex-row">
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => updateItem(f.item.id, { vote: f.suggested })}>
                    <StarIcon size={14} />
                    Metti {f.suggested}
                  </button>
                  <button type="button" className="btn btn-plain btn-sm" onClick={() => keep(f.item.id, f.vote)}>
                    Lascia {f.vote}
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-4">
        <RowHeader title="La tua classifica" count={count >= RANKING_AFTER ? ranked.length : undefined} />
        {count < RANKING_AFTER || ranked.length === 0 ? (
          <p className="text-sm text-text-muted">
            Ancora {Math.max(1, RANKING_AFTER - count)} {RANKING_AFTER - count === 1 ? "confronto" : "confronti"} e qui compare la
            classifica. Per i voti da ricontrollare servono almeno {CALIBRATION_MIN} titoli votati con tre confronti ciascuno.
          </p>
        ) : (
          <ol className="list-group" style={{ "--row-inset": "88px" } as React.CSSProperties}>
            {ranked.slice(0, 25).map((r, i) => (
              <li key={r.item.id}>
                <button type="button" onClick={() => openItem(r.item)} className="list-row gap-3 py-2" aria-label={`${i + 1}. ${r.item.title}, apri dettagli`}>
                  <span className="w-6 shrink-0 text-center text-sm font-medium tabular text-text-faint">{i + 1}</span>
                  <PosterArt item={r.item} size="sm" showTitle={false} className="w-9 shrink-0" />
                  <span className="min-w-0 flex-1 text-left">
                    <span className="block truncate text-sm font-medium text-text">{r.item.title}</span>
                    <span className="block text-xs tabular text-text-muted">
                      {r.games} confronti{r.item.vote != null ? ` · il tuo voto ${r.item.vote}` : ""}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm tabular text-text-muted">{Math.round(r.elo)}</span>
                </button>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
