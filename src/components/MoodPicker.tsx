import { useMemo, useState } from "react";
import { PosterRow } from "./PosterRow";
import { useVisibleItems } from "../lib/useVisibleItems";
import { MOODS, itemsForMood, moodCounts, type MoodId } from "../lib/moods";

/**
 * «Che serata è?» — la scoperta per stato d'animo.
 *
 * Lavora sullo scaffale che hai, non sul catalogo mondiale, ed è una scelta
 * precisa: la paralisi da scelta che questo risolve non è "non so cosa esiste",
 * è "ho duecento titoli e non so quale stasera". Cercare l'umore su TMDB
 * avrebbe risposto alla domanda sbagliata, e sarebbe costato una chiamata di
 * rete per una cosa che si può calcolare qui in un millisecondo.
 *
 * Gli umori senza risposte non si mostrano. Una pastiglia che porta a una
 * schermata vuota è peggio di una pastiglia in meno: promette e non mantiene,
 * ed è lo stesso motivo per cui il menu dei generi elenca solo i generi che
 * possiedi davvero (vedi `GenreMenu` in TopBar).
 */
export function MoodPicker() {
  const items = useVisibleItems();
  const [active, setActive] = useState<MoodId | null>(null);

  const counts = useMemo(() => moodCounts(items), [items]);
  const available = MOODS.filter((m) => counts[m.id] > 0);
  const matches = useMemo(() => (active ? itemsForMood(items, active) : []), [items, active]);

  // Meno di due strade non è una scelta: con una sola pastiglia accesa questa
  // riga occuperebbe spazio per proporre l'unica cosa possibile.
  if (available.length < 2) return null;

  const current = MOODS.find((m) => m.id === active);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 className="section-mark font-display text-xl font-semibold text-text">Che serata è?</h2>
        <p className="text-xs text-text-faint">
          {current ? current.blurb : "Scegli l'aria che tira, non il genere"}
        </p>
      </div>

      <div
        className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6"
        role="group"
        aria-label="Scegli lo stato d'animo"
      >
        {available.map((mood) => {
          const on = mood.id === active;
          return (
            <button
              key={mood.id}
              type="button"
              // `aria-pressed` e non `aria-selected`: sono interruttori
              // indipendenti, non le linguette di un pannello.
              aria-pressed={on}
              onClick={() => setActive(on ? null : mood.id)}
              className={[
                "tap-target flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                on
                  ? "border-accent bg-accent text-accent-contrast"
                  : "border-border-strong bg-surface-2 text-text hover:bg-surface-hover",
              ].join(" ")}
            >
              {mood.label}
              <span className={on ? "text-accent-contrast/70" : "text-text-faint"}>{counts[mood.id]}</span>
            </button>
          );
        })}
      </div>

      {active && matches.length > 0 && (
        <PosterRow title={current?.label ?? ""} entries={matches} count={matches.length} />
      )}
    </section>
  );
}
