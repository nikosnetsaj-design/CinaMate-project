import { useMemo, useState } from "react";
import { useLibrary } from "../store/useLibrary";
import { useSelectedItem } from "../store/useSelectedItem";
import { usePlayerPrefs } from "../store/usePlayerPrefs";
import { useWatchProgress } from "../store/useWatchProgress";
import { useLevelSummary } from "../lib/useLevelSummary";
import {
  ACTIVITY_RANGES,
  activityBuckets,
  currentStreak,
  dailyMinutes,
  formatDay,
  personalRecord,
  seriesRanking,
  type ActivityRange,
} from "../lib/activity";
import { continueWatching, lastSeenDates } from "../lib/continueWatching";
import { formatRuntime } from "../lib/format";
import { ContinueWatchingCard } from "../components/ContinueWatchingRow";
import { EmptyState } from "../components/EmptyState";
import { PosterArt } from "../components/PosterArt";
import { RowHeader } from "../components/RowHeader";
import { useAppReady } from "../lib/useAppReady";
import { useVisibleItems } from "../lib/useVisibleItems";

/**
 * Una cifra con la sua etichetta. L'etichetta viene prima nel codice — chi
 * legge con lo screen reader sente «film visti, 8» — e dopo a vista, dove il
 * numero deve arrivare per primo.
 */
function Figure({ value, label }: { value: string; label: string }) {
  return (
    // In colonna rovesciata l'inizio è in basso: `justify-end` tiene le cifre
    // allineate in alto anche quando un'etichetta va a capo.
    <div className="flex min-w-0 flex-col-reverse justify-end gap-0.5 px-4 py-3.5">
      <dt className="text-xs text-text-muted">{label}</dt>
      <dd className="t-figure text-text">{value}</dd>
    </div>
  );
}

/**
 * L'attesa, disegnata come la pagina che sta arrivando.
 *
 * Prima era la parola «Caricamento…», che descrive sé stessa e non dice
 * niente di ciò che si sta aspettando. Lo scheletro dice la forma: la cifra
 * grande delle ore, la fascia dei tre totali, il riquadro del grafico. Quando
 * i dati arrivano non c'è nessun salto, perché la pagina era già lì di misura.
 */
function ProfileSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-10">
      <div className="flex flex-col gap-2">
        <div className="skeleton h-4 w-20 rounded-xs" />
        <div className="skeleton h-11 w-36 rounded-sm" />
        <div className="skeleton h-4 w-56 rounded-xs" />
      </div>
      <div className="skeleton h-[76px] rounded-md" />
      <div className="skeleton h-56 rounded-md" />
    </div>
  );
}

/** The ring around the level number: how far through the current level you are. */
function LevelRing({ pct, children }: { pct: number; children: React.ReactNode }) {
  return (
    <div
      className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full p-[3px]"
      style={{
        background: `conic-gradient(var(--accent) ${pct * 3.6}deg, var(--surface-2) 0deg)`,
      }}
    >
      <div className="flex h-full w-full items-center justify-center rounded-full bg-bg">{children}</div>
    </div>
  );
}

function ActivityChart({ range, minutes }: { range: ActivityRange; minutes: Map<string, number> }) {
  const buckets = useMemo(() => activityBuckets(minutes, range), [minutes, range]);
  const peak = Math.max(...buckets.map((b) => b.minutes), 1);
  const total = buckets.reduce((a, b) => a + b.minutes, 0);
  // A month of days is too many labels for a phone; every third one keeps the
  // axis readable without thinning the bars themselves.
  const labelEvery = range === "mese" ? 3 : 1;

  return (
    <div>
      {/* Il totale sopra il grafico, come una risposta: prima quanto, poi
          come si è distribuito. */}
      <p className="text-xs text-text-muted">In questo periodo</p>
      <p className="t-figure text-text">{total > 0 ? formatRuntime(total) : "—"}</p>
      <div className="mt-4 flex h-32 items-end gap-[3px]">
        {buckets.map((b, idx) => (
          <div key={b.key} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
            <div
              className="w-full max-w-7 rounded-t-[4px] transition-[height] duration-300"
              style={{
                height: `${b.minutes ? Math.max((b.minutes / peak) * 100, 3) : 2}px`,
                background: b.minutes ? "var(--accent)" : "var(--surface-2)",
              }}
              title={`${b.label}: ${formatRuntime(b.minutes)}`}
            />
            <span className="h-4 truncate text-xs text-text-faint">
              {idx % labelEvery === 0 ? b.label : ""}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-text-faint">
        {total > 0 ? `Picco ${formatRuntime(peak)} in un giorno.` : "Nessuna attività registrata in questo periodo."}
      </p>
    </div>
  );
}

/** L'intestazione di **Tu**: chi sei secondo le ore che hai messo. */
export function ProfileHeader() {
  const displayName = usePlayerPrefs((s) => s.displayName);
  const { level } = useLevelSummary();
  return (
    <header className="flex items-center gap-4">
      <LevelRing pct={level.pct}>
        <span className="t-figure text-text" aria-hidden="true">
          {level.level}
        </span>
      </LevelRing>
      <div className="min-w-0 flex-1">
        <h1 className="t-display truncate text-text">{level.title}</h1>
        <p className="mt-1 truncate text-sm text-text-muted">
          {displayName?.trim() ? displayName : "Tu"} · livello {level.level} ·{" "}
          {level.hoursToNext != null
            ? `${level.hoursToNext} h a «${level.nextTitle}»`
            : "hai raggiunto l'ultimo livello"}
        </p>
      </div>
    </header>
  );
}

export function ProfileSummary() {
  const ready = useAppReady();
  const items = useVisibleItems();
  const allItems = useLibrary((s) => s.items);
  const history = useLibrary((s) => s.history);
  const daily = useWatchProgress((s) => s.daily);
  const progress = useWatchProgress((s) => s.progress);
  const openItem = useSelectedItem((s) => s.open);
  const [range, setRange] = useState<ActivityRange>("settimana");

  const { stats, playerHours, totalHours } = useLevelSummary();
  const minutes = useMemo(() => dailyMinutes(allItems, history, daily), [allItems, history, daily]);
  const record = useMemo(() => personalRecord(minutes), [minutes]);
  const streak = useMemo(() => currentStreak(minutes), [minutes]);
  const ranking = useMemo(() => seriesRanking(allItems), [allItems]);
  const resume = useMemo(
    () => continueWatching(items, progress, lastSeenDates(history)).slice(0, 8),
    [items, progress, history],
  );

  const finished = useMemo(
    () => allItems.filter((i) => i.status === "Visto").sort((a, b) => b.added.localeCompare(a.added)).slice(0, 12),
    [allItems],
  );

  if (!ready) return <ProfileSkeleton />;

  return (
    <div className="flex flex-col gap-10">
      {items.length === 0 && history.length === 0 ? (
        <EmptyState
          title="Il diario comincia col primo voto."
          description="Segna un titolo come visto, o guarda qualcosa dal lettore: da lì in poi ore, grafico e record si riempiono da soli."
        />
      ) : (
        <>
          {/* --- Total hours ---------------------------------------------- */}
          <section>
            <p className="text-sm text-text-muted">Ore totali</p>
            <p className="t-stat mt-1 text-text">
              {totalHours}
              <span className="ml-1 text-[0.5em] font-medium text-text-faint">h</span>
            </p>
            <p className="mt-2 text-sm text-text-muted">
              {playerHours >= 0.1
                ? `di cui ${playerHours.toFixed(1)} h misurate dal player`
                : "in gran parte stimate dalla tua libreria"}
              {streak > 0 && ` · ${streak} giorn${streak === 1 ? "o" : "i"} di fila`}
            </p>
          </section>

          {/* Tre totali in una fascia sola, divisi da un filo: sono tre
              risposte alla stessa domanda, non tre schede. */}
          <dl className="grid grid-cols-3 rounded-lg bg-surface shadow-[var(--shadow-sm)] [&>*+*]:shadow-[inset_1px_0_0_var(--separator)]">
            <Figure value={String(stats.filmsCompleted)} label="film visti" />
            <Figure value={String(stats.seriesCompleted)} label="serie completate" />
            <Figure value={String(stats.episodesWatched)} label="episodi visti" />
          </dl>

          {/* --- Activity chart ------------------------------------------- */}
          <section className="flex flex-col gap-4">
            <RowHeader
              title="Attività"
              trailing={
                <div className="segmented" role="tablist" aria-label="Periodo del grafico">
                  {ACTIVITY_RANGES.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      role="tab"
                      aria-selected={range === r.id}
                      onClick={() => setRange(r.id)}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              }
            />
            <div className="rounded-lg bg-surface p-4 shadow-[var(--shadow-sm)]">
              <ActivityChart range={range} minutes={minutes} />

              {/* --- Personal record ------------------------------------ */}
              <div className="-mx-4 -mb-4 mt-4 flex items-center justify-between gap-3 px-4 py-3.5 shadow-[inset_0_1px_0_var(--separator)]">
                <div className="min-w-0">
                  <p className="text-sm text-text">Record personale</p>
                  <p className="truncate text-xs text-text-muted first-letter:uppercase">
                    {record ? formatDay(record.date) : "Arriva con la prima visione."}
                  </p>
                </div>
                {record && <span className="t-figure shrink-0 text-text">{formatRuntime(record.minutes)}</span>}
              </div>
            </div>
          </section>

          {/* --- Continue watching ---------------------------------------- */}
          {resume.length > 0 && (
            <section className="flex flex-col gap-4">
              <RowHeader title="Continua a guardare" />
              <div className="shelf">
                {resume.map((entry) => (
                  <ContinueWatchingCard key={entry.item.id} entry={entry} />
                ))}
              </div>
            </section>
          )}

          {/* --- Series ranking ------------------------------------------- */}
          {ranking.length > 0 && (
            <section className="flex flex-col gap-4">
              <RowHeader title="Le tue serie, per episodi" />
              {/* Il filo parte dal titolo: numero (20) + copertina (32) + i
                  due spazi e il margine. */}
              <ol className="list-group" style={{ "--row-inset": "92px" } as React.CSSProperties}>
                {ranking.map(({ item, episodes, minutes: mins, pct }, idx) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => openItem(item)}
                      aria-label={`Apri dettagli di ${item.title}, ${episodes} episodi visti`}
                      className="list-row"
                    >
                      <span className="w-5 shrink-0 text-center text-sm font-medium tabular text-text-faint">{idx + 1}</span>
                      <PosterArt item={item} size="sm" showTitle={false} className="w-8 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="truncate text-sm font-medium text-text">{item.title}</span>
                          <span className="shrink-0 text-xs tabular text-text-faint">
                            {episodes}
                            {item.episodes ? `/${item.episodes}` : ""} ep · {formatRuntime(mins)}
                          </span>
                        </div>
                        <span className="mt-2 block h-1 overflow-hidden rounded-full bg-surface-2">
                          <span
                            className="block h-full rounded-full bg-accent"
                            style={{ width: `${Math.max(pct, 2)}%` }}
                          />
                        </span>
                      </div>
                    </button>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {/* --- Library shortcut ------------------------------------------ */}
          <section className="flex flex-col gap-4">
            <RowHeader title="Completati" to="/libreria" action="Libreria" />
            {finished.length === 0 ? (
              <p className="text-sm text-text-muted">Niente di completato, per ora.</p>
            ) : (
              <div className="shelf gap-3">
                {finished.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => openItem(item)}
                    aria-label={`Apri dettagli di ${item.title}, ${item.year}`}
                    className="w-20 shrink-0 transition-transform duration-200 active:scale-[0.98]"
                  >
                    <PosterArt item={item} size="sm" showTitle={false} className="w-20" />
                  </button>
                ))}
              </div>
            )}
          </section>

          <p className="max-w-prose text-xs text-text-faint">
            Le statistiche partono da quando è stata installata questa versione: le visioni precedenti restano nella
            libreria e nel diario, ma non nel conteggio delle ore misurate dal player.
          </p>
        </>
      )}
    </div>
  );
}
