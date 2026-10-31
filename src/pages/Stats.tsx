import { lazy, Suspense, useMemo, useState } from "react";
import { useLibrary } from "../store/useLibrary";
import { useSagas } from "../store/useSagas";
import { useSelectedPerson } from "../store/useSelectedPerson";
import { computeStats, computeYearInReview, yearsWithActivity } from "../lib/stats";
import { computeAchievements } from "../lib/achievements";
import { groupDiary, yearAgo, type DiaryEntry } from "../lib/diary";
import { voteColor } from "../lib/vote";
import { PosterArt } from "../components/PosterArt";
import { VoteBadge } from "../components/VoteBadge";
import { EmptyState } from "../components/EmptyState";
import { Nastro } from "../components/Nastro";
import type { Item } from "../types";
import { AchievementIcon } from "../components/AchievementIcon";
import { RowHeader } from "../components/RowHeader";
import { FigureBand } from "../components/Figures";
import { StatusMark } from "../components/StatusChip";
import { PalateCard } from "../components/PalateCard";
import { CheckIcon, PeopleIcon, PlusIcon, ShareIcon } from "../components/icons";

// Il disegno su canvas serve solo a chi condivide: si scarica al tocco.
const YearShareSheet = lazy(() => import("../components/YearShareSheet"));
import { DiaryHeatmap, DiaryNoteSheet, YearAgoCard } from "../components/DiaryExtras";

const KIND_LABELS: Record<string, string> = { film: "Film", serie: "Serie TV", anime: "Anime", doc: "Documentario" };
/*
 * I formati in una barra sola: l'accento al più frequente, poi neutri che
 * schiariscono. Quattro colori diversi — accento, verde, rosso, blu — dicevano
 * quattro cose diverse, e il rosso in questa app vuol dire «attenzione».
 */
const KIND_COLORS = [
  "var(--accent)",
  "color-mix(in srgb, var(--accent) 45%, var(--surface-2))",
  "var(--text-muted)",
  "color-mix(in srgb, var(--text-faint) 45%, var(--surface-2))",
];

/** A titled block of the tab: the heading, then whatever it holds. */
function Section({ title, trailing, children }: { title: string; trailing?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <RowHeader title={title} trailing={trailing} />
      {children}
    </section>
  );
}

/** One surface, the content directly on it — never a card inside a card. */
function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-lg bg-surface p-4 shadow-[var(--shadow-sm)] ${className}`}>{children}</div>;
}

/** A ranked bar: the label, the count, and how it compares with the first. */
function RankBar({ label, n, max }: { label: string; n: number; max: number }) {
  return (
    <>
      <div className="flex items-baseline justify-between gap-3">
        <span className="truncate text-sm text-text">{label}</span>
        <span className="shrink-0 text-xs tabular text-text-faint">{n}</span>
      </div>
      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-surface-2">
        <div className="h-full rounded-full bg-text-muted" style={{ width: `${(n / max) * 100}%` }} />
      </div>
    </>
  );
}

/** Ranked list of people, each a way into their filmography. */
function PeopleCard({ title, rows }: { title: string; rows: [string, number][] }) {
  const openPerson = useSelectedPerson((s) => s.open);
  if (rows.length === 0) return null;
  const max = rows[0][1];

  return (
    <Section title={title}>
      <Panel className="flex flex-col gap-1 py-2">
        {rows.slice(0, 6).map(([name, n]) => (
          <button
            key={name}
            type="button"
            onClick={() => openPerson(name)}
            aria-label={`Apri la scheda di ${name}`}
            className="-mx-2 block rounded-sm px-2 py-2 text-left transition-colors hover:bg-surface-2"
          >
            <RankBar label={name} n={n} max={max} />
          </button>
        ))}
      </Panel>
    </Section>
  );
}

export function TasteTab({ items, openItem }: { items: Item[]; openItem: (item: Item) => void }) {
  const stats = computeStats(items);
  const history = useLibrary((s) => s.history);
  const maxVoteCount = Math.max(...stats.voteDist.map((d) => d.n), 1);
  const years = yearsWithActivity(history);
  const [year, setYear] = useState(years[0]);
  const yir = useMemo(() => computeYearInReview(items, history, year), [items, history, year]);
  const [sharingYear, setSharingYear] = useState(false);

  return (
    <div className="flex flex-col gap-10">
      {/* Prima il palato: è la risposta alla domanda della scheda, «cosa ti
          piace». I numeri sotto dicono quanto, questo dice cosa. */}
      <PalateCard items={items} />

      <section className="flex flex-col gap-4">
        <RowHeader title="Questo o quello" to="/questo-o-quello" action="Confronta" />
        <p className="text-sm text-text-muted">
          Due titoli visti alla volta: scegli quello che preferisci. Ne esce una classifica tua, e i voti che non le somigliano
          te li faccio notare, senza cambiarli.
        </p>
      </section>

      <Section title="Il nastro">
        <Panel>
          {/* La finestra è l'anno scelto qui sotto, non "gli ultimi 365 giorni":
              la didascalia diceva «del 2026» sopra un nastro che a febbraio era
              per tre quarti 2025, e il riquadro accanto contava l'anno solare.
              Due numeri diversi con la stessa etichetta. */}
          <Nastro
            from={`${year}-01-01`}
            to={`${year}-12-31`}
            height={72}
            caption={`Un filo per ogni sessione del ${year}`}
          />
        </Panel>
      </Section>

      <Section
        title="Il tuo anno"
        trailing={
          years.length > 1 && (
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              aria-label="Anno da mostrare"
              className="field field-sm w-auto shrink-0 tabular"
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          )
        }
      >
        {yir.watchedCount === 0 ? (
          <p className="text-sm text-text-muted">Nessuna attività registrata nel {year}.</p>
        ) : (
          <>
            <FigureBand
              cols={2}
              smCols={4}
              figures={[
                { value: yir.watchedCount, label: "titoli completati" },
                { value: `${yir.hours} h`, label: "ore guardate" },
                ...(yir.topGenre ? [{ value: yir.topGenre, label: "genere più visto" }] : []),
                ...(yir.busiestMonth ? [{ value: yir.busiestMonth, label: "mese più attivo" }] : []),
              ]}
            />
            <button type="button" className="btn btn-secondary btn-sm self-start" onClick={() => setSharingYear(true)}>
              <ShareIcon size={15} />
              Condividi come immagine
            </button>
            {sharingYear && (
              <Suspense fallback={null}>
                <YearShareSheet review={yir} onClose={() => setSharingYear(false)} />
              </Suspense>
            )}
          </>
        )}
      </Section>

      <section>
        <p className="text-sm text-text-muted">Tempo totale davanti allo schermo</p>
        <p className="t-stat mt-1 text-text">
          {stats.hours}
          <span className="ml-1 text-[0.5em] font-medium text-text-faint">h</span>
        </p>
        <p className="mt-2 text-sm text-text-muted">circa {stats.days} giorni pieni</p>
      </section>

      {/* Sei totali, una fascia: gli stati sopra (con il loro segno, lo
          stesso delle copertine), i completamenti sotto. */}
      <FigureBand
        cols={3}
        figures={[
          { value: stats.byStatus.Visto, label: "visti", mark: <StatusMark status="Visto" /> },
          { value: stats.byStatus["In visione"], label: "in corso", mark: <StatusMark status="In visione" /> },
          { value: stats.byStatus["Da vedere"], label: "da vedere", mark: <StatusMark status="Da vedere" /> },
          { value: stats.filmsCompleted, label: "film completati" },
          { value: stats.seriesCompleted, label: "serie completate" },
          { value: stats.episodesWatched, label: "episodi visti" },
        ]}
      />

      <Section title="Come voti">
        <Panel>
          <p className="text-xs text-text-muted">
            Media su {items.filter((i) => i.vote != null).length} titoli votati
          </p>
          <p className="t-figure text-text">{stats.avgVote != null ? stats.avgVote.toFixed(1) : "—"}</p>
          {/* I colori dei voti sono gli stessi del selettore: qui raccontano
              la stessa scala, quindi è l'unico posto dove li si vede. */}
          <div className="mt-4 flex h-24 items-end gap-1">
            {stats.voteDist.map(({ v, n }) => (
              <div key={v} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
                <span className="h-4 text-xs tabular text-text-faint">{n > 0 ? n : ""}</span>
                <div
                  className="w-full max-w-7 rounded-t-[4px]"
                  style={{
                    height: `${n > 0 ? Math.max((n / maxVoteCount) * 52, 3) : 2}px`,
                    background: n > 0 ? voteColor(v) : "var(--surface-2)",
                  }}
                />
                <span className="text-xs tabular text-text-faint">{v}</span>
              </div>
            ))}
          </div>
        </Panel>
      </Section>

      <Section title="Formati">
        <Panel>
          <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full">
            {stats.byKind.map(([k, n], idx) => (
              <div key={k} style={{ width: `${(n / stats.total) * 100}%`, background: KIND_COLORS[idx % KIND_COLORS.length] }} />
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
            {stats.byKind.map(([k, n], idx) => (
              <div key={k} className="flex items-center gap-1.5 text-sm text-text-muted">
                <span className="h-2 w-2 rounded-full" style={{ background: KIND_COLORS[idx % KIND_COLORS.length] }} />
                {KIND_LABELS[k]}
                <span className="tabular text-text">{n}</span>
              </div>
            ))}
          </div>
        </Panel>
      </Section>

      {stats.byGenre.length > 0 && (
        <Section title="Generi più frequenti">
          <Panel className="flex flex-col gap-1 py-2">
            {stats.byGenre.slice(0, 6).map(([g, n]) => (
              <div key={g} className="py-2">
                <RankBar label={g} n={n} max={stats.byGenre[0][1]} />
              </div>
            ))}
          </Panel>
        </Section>
      )}

      <PeopleCard title="Attori più visti" rows={stats.byActor} />
      <PeopleCard title="Registi più visti" rows={stats.byDirector} />

      <Section title="Piattaforme">
        <div className="flex flex-wrap gap-2">
          {stats.byPlatform.map(([p, n]) => (
            <div key={p} className="flex h-9 items-center gap-2 rounded-full bg-surface-2 px-3.5 text-sm">
              <span className="text-text">{p}</span>
              <span className="tabular text-text-muted">{n}</span>
            </div>
          ))}
        </div>
      </Section>

      {stats.top.length > 0 && (
        <Section title="La tua top 5">
          <ol className="list-group" style={{ "--row-inset": "92px" } as React.CSSProperties}>
            {stats.top.map((item, idx) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => openItem(item)}
                  aria-label={`Apri dettagli di ${item.title}, ${item.year}`}
                  className="list-row"
                >
                  <span className="w-5 shrink-0 text-center text-sm font-medium tabular text-text-faint">{idx + 1}</span>
                  <PosterArt item={item} size="sm" showTitle={false} className="w-8 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-text">{item.title}</div>
                    <div className="truncate text-xs text-text-muted">
                      {item.year} · {item.genre}
                    </div>
                  </div>
                  <VoteBadge vote={item.vote} />
                </button>
              </li>
            ))}
          </ol>
        </Section>
      )}
    </div>
  );
}

export function DiaryTab({ items, openItem }: { items: Item[]; openItem: (item: Item) => void }) {
  const history = useLibrary((s) => s.history);
  const days = useMemo(() => groupDiary(history, items), [history, items]);
  const memory = useMemo(() => yearAgo(days, new Date().toISOString().slice(0, 10)), [days]);
  const [noting, setNoting] = useState<{ entry: DiaryEntry; date: string } | null>(null);

  if (days.length === 0) {
    return (
      <EmptyState
        title="Il tuo diario è vuoto"
        description="Segna un titolo come visto o registra un episodio per iniziare a costruire il tuo diario."
      />
    );
  }

  // Dal quadretto al giorno: il diario è lungo, e la mappa serve a saltarci dentro.
  function goToDay(date: string) {
    document.getElementById(`diario-${date}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  let lastMonth = "";
  return (
    <div className="flex flex-col gap-10">
      {memory && <YearAgoCard memory={memory} openItem={openItem} />}
      <DiaryHeatmap onPickDay={goToDay} />
      <div className="flex flex-col">
        {days.map(({ date, entries }, index) => {
          const d = new Date(`${date}T00:00:00`);
          const monthLabel = new Intl.DateTimeFormat("it-IT", { month: "long", year: "numeric" }).format(d);
          const showMonth = monthLabel !== lastMonth;
          lastMonth = monthLabel;
          const weekday = new Intl.DateTimeFormat("it-IT", { weekday: "short" }).format(d);
          return (
            <div key={date} id={`diario-${date}`} className="scroll-mt-20">
              {showMonth && (
                <h2 className={`t-title mb-2 text-text first-letter:uppercase ${index === 0 ? "" : "mt-8"}`}>{monthLabel}</h2>
              )}
              {/* Il giorno come su un calendario: la cifra grande, il nome
                  piccolo sopra. Un filo fra i giorni dello stesso mese. */}
              <div className={`flex gap-4 py-3 ${showMonth ? "" : "shadow-[inset_0_1px_0_var(--separator)]"}`}>
                <div className="w-10 shrink-0 pt-0.5 text-center">
                  <p className="text-xs text-text-faint">{weekday}</p>
                  <p className="t-figure text-text">{d.getDate()}</p>
                </div>
                <ul className="flex min-w-0 flex-1 flex-col gap-2">
                  {entries.map((entry) => {
                    const { item, action, count } = entry;
                    const note = [entry.with && `con ${entry.with}`, entry.where].filter(Boolean).join(" · ");
                    return (
                      <li key={`${item.id}-${action}`} className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openItem(item)}
                          aria-label={`Apri dettagli di ${item.title}, ${item.year}`}
                          className="flex min-w-0 flex-1 items-center gap-3 rounded-sm text-left transition-transform duration-200 active:scale-[0.99]"
                        >
                          <PosterArt item={item} size="sm" showTitle={false} className="w-10 shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-text">{item.title}</p>
                            <p className="truncate text-xs text-text-muted">
                              {action === "watched" && "Completato"}
                              {action === "episode" && `${count} episod${count === 1 ? "io" : "i"}`}
                              {action === "rewatch" && "Rivisto"}
                              {note && ` · ${note}`}
                            </p>
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => setNoting({ entry, date })}
                          aria-label={note ? `Modifica con chi e dove per ${item.title}` : `Aggiungi con chi e dove per ${item.title}`}
                          className="icon-btn icon-btn-sm shrink-0 text-text-faint hover:text-text"
                        >
                          {note ? <PeopleIcon size={15} /> : <PlusIcon size={15} />}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          );
        })}
      </div>
      {noting && <DiaryNoteSheet entry={noting.entry} date={noting.date} onClose={() => setNoting(null)} />}
    </div>
  );
}

export function AchievementsTab({ items }: { items: Item[] }) {
  const history = useLibrary((s) => s.history);
  const sagas = useSagas((s) => s.sagas);
  const achievements = computeAchievements(items, history, sagas);
  const earnedCount = achievements.filter((a) => a.earned).length;

  return (
    <section className="flex flex-col gap-4">
      <RowHeader title="Traguardi" note={`${earnedCount} su ${achievements.length} sbloccati`} />
      {/* Un elenco, non quindici riquadri uguali: si scorre con l'occhio
          come un elenco, e quelli già presi si riconoscono dall'icona accesa
          invece che da una cornice colorata. */}
      <ul className="list-group" style={{ "--row-inset": "64px" } as React.CSSProperties}>
        {achievements.map((a) => (
          <li key={a.id}>
            <div className="list-row items-start">
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                style={
                  a.earned
                    ? { background: "color-mix(in srgb, var(--accent) 16%, transparent)", color: "var(--accent-text)" }
                    : { background: "var(--surface-2)", color: "var(--text-faint)" }
                }
              >
                <AchievementIcon id={a.id} size={18} />
              </span>
              <div className="min-w-0 flex-1 pt-0.5">
                <p className="text-sm font-medium text-text">{a.title}</p>
                <p className="mt-0.5 text-xs text-text-muted">{a.description}</p>
              </div>
              {a.earned ? (
                <span className="flex shrink-0 items-center gap-1 pt-0.5 text-xs font-medium text-accent-text">
                  <CheckIcon size={14} />
                  Sbloccato
                </span>
              ) : (
                <span className="shrink-0 pt-0.5 text-xs tabular text-text-faint">{a.progress}</span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/*
 * La pagina «Dati» non esiste più: le sue schede sono diventate quelle di
 * **Tu** (`pages/Tu.tsx`), insieme a quelle che stavano in «Profilo».
 *
 * Erano due destinazioni che rispondevano alla stessa domanda — quanto
 * guardi, cosa, quando — e che si contendevano due delle dieci voci in barra.
 * Che fossero la stessa cosa lo diceva il prodotto da solo, senza bisogno di
 * un'opinione: avevano due stati vuoti diversi («Nessun dato ancora» qui, «Il
 * profilo è ancora vuoto» là) per il medesimo «non hai ancora visto niente».
 *
 * Quello che restava di buono — la panoramica dei gusti, il diario, i
 * traguardi — è rimasto intero e ha solo cambiato indirizzo: i tre componenti
 * qui sopra sono esportati e montati da Tu.
 */
