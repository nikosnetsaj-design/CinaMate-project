import { useEffect, useMemo, useRef, useState } from "react";
import { Sheet } from "./Sheet";
import { PosterArt } from "./PosterArt";
import { useLibrary } from "../store/useLibrary";
import { dayCounts, heatLevel, noteSuggestions, yearWeeks, type DiaryEntry, type YearAgo } from "../lib/diary";
import { yearsWithActivity } from "../lib/stats";
import type { Item } from "../types";
import { intlLocale } from "../lib/i18n";

const LEVEL_BG = [
  "var(--surface-2)",
  "color-mix(in srgb, var(--accent) 28%, var(--surface-2))",
  "color-mix(in srgb, var(--accent) 50%, var(--surface-2))",
  "color-mix(in srgb, var(--accent) 75%, var(--surface-2))",
  "var(--accent)",
];

const longDay = new Intl.DateTimeFormat(intlLocale(), { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const shortDay = new Intl.DateTimeFormat(intlLocale(), { day: "numeric", month: "long", timeZone: "UTC" });
const monthShort = new Intl.DateTimeFormat(intlLocale(), { month: "short", timeZone: "UTC" });

function utc(date: string) {
  return new Date(`${date}T00:00:00Z`);
}

function visits(n: number) {
  return `${n} ${n === 1 ? "visione" : "visioni"}`;
}

/**
 * L'anno a quadretti, una colonna per settimana come su GitHub, da lunedì.
 *
 * Il colore conta le visioni del giorno (un film, un episodio), in cinque
 * gradini. Per chi non vede i quadretti la mappa si riassume in una frase —
 * giorni attivi e il giorno più pieno — e il diario qui sotto resta l'elenco
 * completo; toccare un quadretto porta a quel giorno.
 */
export function DiaryHeatmap({ onPickDay }: { onPickDay: (date: string) => void }) {
  const history = useLibrary((s) => s.history);
  const years = useMemo(() => yearsWithActivity(history), [history]);
  const [year, setYear] = useState(years[0] ?? new Date().getFullYear());
  const counts = useMemo(() => dayCounts(history, year), [history, year]);
  const weeks = useMemo(() => yearWeeks(year), [year]);
  const scroller = useRef<HTMLDivElement>(null);

  // Sul telefono l'anno non sta in larghezza: si parte dalla fine, dove sono
  // le settimane recenti.
  useEffect(() => {
    if (scroller.current) scroller.current.scrollLeft = scroller.current.scrollWidth;
  }, [year]);

  const active = counts.size;
  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  const peak = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
  const summary =
    active === 0
      ? `Nessuna visione nel ${year}.`
      : `Nel ${year}: ${visits(total)} in ${active} ${active === 1 ? "giorno" : "giorni"}; il più pieno ${shortDay.format(utc(peak[0]))}, con ${visits(peak[1])}.`;

  const months = weeks.map((week, i) => {
    const first = week.find(Boolean);
    if (!first) return null;
    const prev = i > 0 ? weeks[i - 1].find(Boolean) : null;
    return !prev || prev.slice(5, 7) !== first.slice(5, 7) ? monthShort.format(utc(first)) : null;
  });

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="t-title text-text">L'anno a quadretti</h2>
        {years.length > 1 && (
          <select value={year} onChange={(e) => setYear(Number(e.target.value))} aria-label="Anno della mappa" className="field field-sm w-auto tabular">
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        )}
      </div>
      <div className="rounded-lg bg-surface p-4 shadow-[var(--shadow-sm)]">
        <div ref={scroller} className="no-scrollbar overflow-x-auto">
          <div
            role="img"
            aria-label={summary}
            className="inline-grid gap-[3px]"
            style={{ gridTemplateColumns: `auto repeat(${weeks.length}, 11px)`, gridTemplateRows: "auto repeat(7, 11px)" }}
            onClick={(e) => {
              const date = (e.target as HTMLElement).dataset.date;
              if (date && counts.has(date)) onPickDay(date);
            }}
          >
            <span />
            {months.map((m, i) => (
              <span key={`m${i}`} aria-hidden="true" className="whitespace-nowrap text-[10px] leading-none text-text-faint" style={{ gridColumn: i + 2, gridRow: 1 }}>
                {m ?? ""}
              </span>
            ))}
            {["lun", "", "mer", "", "ven", "", ""].map((d, i) => (
              <span key={`d${i}`} aria-hidden="true" className="pr-1.5 text-[10px] leading-[11px] text-text-faint" style={{ gridColumn: 1, gridRow: i + 2 }}>
                {d}
              </span>
            ))}
            {weeks.flatMap((week, w) =>
              week.map((date, d) => {
                if (!date) return <span key={`${w}-${d}`} style={{ gridColumn: w + 2, gridRow: d + 2 }} />;
                const n = counts.get(date) ?? 0;
                return (
                  <span
                    key={date}
                    data-date={date}
                    title={`${longDay.format(utc(date))}: ${n === 0 ? "niente" : visits(n)}`}
                    className={`rounded-[2px] ${n > 0 ? "cursor-pointer" : ""}`}
                    style={{ gridColumn: w + 2, gridRow: d + 2, background: LEVEL_BG[heatLevel(n)] }}
                  />
                );
              }),
            )}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-text-muted">{summary}</p>
          <span className="flex items-center gap-1 text-[10px] text-text-faint" aria-hidden="true">
            meno
            {LEVEL_BG.map((bg, i) => (
              <span key={i} className="h-[11px] w-[11px] rounded-[2px]" style={{ background: bg }} />
            ))}
            più
          </span>
        </div>
      </div>
    </section>
  );
}

/** «Un anno fa guardavi…», quando il diario ha qualcosa da ricordare. */
export function YearAgoCard({ memory, openItem }: { memory: YearAgo; openItem: (item: Item) => void }) {
  const what = memory.entries.slice(0, 3);
  return (
    <section className="flex items-center gap-4 rounded-lg bg-surface p-4 shadow-[var(--shadow-sm)]" aria-label="Un anno fa">
      <div className="flex shrink-0 -space-x-4">
        {what.map((e) => (
          <button key={e.item.id} type="button" onClick={() => openItem(e.item)} aria-label={`Apri dettagli di ${e.item.title}`}>
            <PosterArt item={e.item} size="sm" showTitle={false} className="w-12 ring-2 ring-[var(--surface)]" />
          </button>
        ))}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-text-muted">
          {memory.exact ? "Un anno fa, oggi" : `Più o meno un anno fa, ${shortDay.format(utc(memory.date))}`}
        </p>
        <p className="text-sm text-text">
          guardavi {what.map((e) => `«${e.item.title}»`).join(", ")}
          {memory.entries.length > 3 ? ` e altri ${memory.entries.length - 3}` : ""}.
        </p>
      </div>
    </section>
  );
}

function Suggestions({ values, onPick }: { values: string[]; onPick: (v: string) => void }) {
  if (values.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {values.map((v) => (
        <button key={v} type="button" className="chip" onClick={() => onPick(v)}>
          {v}
        </button>
      ))}
    </div>
  );
}

/**
 * Con chi e dove, per una visione. Tutto facoltativo, tutto scritto da te: il
 * diario funziona uguale senza, e chi lo vuole ricorda «al cinema con Marta»
 * accanto al titolo. I valori già usati tornano come suggerimenti.
 */
export function DiaryNoteSheet({ entry, date, onClose }: { entry: DiaryEntry; date: string; onClose: () => void }) {
  const history = useLibrary((s) => s.history);
  const annotate = useLibrary((s) => s.annotateHistory);
  const [who, setWho] = useState(entry.with ?? "");
  const [where, setWhere] = useState(entry.where ?? "");
  const withSuggestions = useMemo(() => noteSuggestions(history, "with").filter((v) => v !== who), [history, who]);
  const whereSuggestions = useMemo(() => noteSuggestions(history, "where").filter((v) => v !== where), [history, where]);
  const titleId = "diary-note-title";

  return (
    <Sheet onClose={onClose} titleId={titleId} maxWidthClass="max-w-md">
      <form
        className="flex flex-col gap-5 p-5 pt-8 sm:p-6"
        onSubmit={(e) => {
          e.preventDefault();
          annotate(entry.ids, { with: who, where });
          onClose();
        }}
      >
        <div>
          <h2 id={titleId} className="t-title text-text">
            {entry.item.title}
          </h2>
          <p className="mt-1 text-sm text-text-muted first-letter:uppercase">{longDay.format(utc(date))}</p>
        </div>
        <label className="flex flex-col gap-2 text-sm text-text">
          Con chi
          <input value={who} onChange={(e) => setWho(e.target.value)} maxLength={80} placeholder="Da solo, con Marta, in famiglia…" className="field" />
        </label>
        <Suggestions values={withSuggestions} onPick={setWho} />
        <label className="flex flex-col gap-2 text-sm text-text">
          Dove
          <input value={where} onChange={(e) => setWhere(e.target.value)} maxLength={80} placeholder="A casa, al cinema, in treno…" className="field" />
        </label>
        <Suggestions values={whereSuggestions} onPick={setWhere} />
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-plain" onClick={onClose}>
            Annulla
          </button>
          <button type="submit" className="btn btn-primary">
            Salva
          </button>
        </div>
      </form>
    </Sheet>
  );
}
