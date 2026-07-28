import { useState } from "react";
import { useLibrary } from "../store/useLibrary";
import { useSagas } from "../store/useSagas";
import { useSelectedItem } from "../store/useSelectedItem";
import { useSelectedPerson } from "../store/useSelectedPerson";
import { computeStats, computeYearInReview, yearsWithActivity } from "../lib/stats";
import { computeAchievements } from "../lib/achievements";
import { groupDiary } from "../lib/diary";
import { voteColor } from "../lib/vote";
import { PosterArt } from "../components/PosterArt";
import { VoteBadge } from "../components/VoteBadge";
import { EmptyState } from "../components/EmptyState";
import { Nastro } from "../components/Nastro";
import { useAppReady } from "../lib/useAppReady";
import type { Item } from "../types";

const KIND_LABELS: Record<string, string> = { film: "Film", serie: "Serie TV", anime: "Anime", doc: "Documentario" };
const KIND_COLORS = ["var(--accent)", "var(--status-watching)", "var(--danger)", "var(--status-done)"];

type Tab = "panoramica" | "diario" | "traguardi";
const TABS: { id: Tab; label: string }[] = [
  { id: "panoramica", label: "Panoramica" },
  { id: "diario", label: "Diario" },
  { id: "traguardi", label: "Traguardi" },
];

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-md border border-border bg-surface-2 p-4">{children}</div>;
}
function Label({ children }: { children: string }) {
  return <span className="mb-2 block text-xs font-medium uppercase tracking-wide text-text-faint">{children}</span>;
}

/** Ranked list of people, each a way into their filmography. */
function PeopleCard({ title, rows }: { title: string; rows: [string, number][] }) {
  const openPerson = useSelectedPerson((s) => s.open);
  if (rows.length === 0) return null;
  const max = rows[0][1];

  return (
    <Card>
      <Label>{title}</Label>
      {rows.slice(0, 6).map(([name, n]) => (
        <button
          key={name}
          type="button"
          onClick={() => openPerson(name)}
          aria-label={`Apri la scheda di ${name}`}
          className="mb-2 block w-full text-left last:mb-0"
        >
          <div className="mb-1 flex justify-between gap-3">
            <span className="truncate text-xs text-text">{name}</span>
            <span className="shrink-0 font-mono tabular text-xs text-text-faint">{n}</span>
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-surface-hover">
            <div className="h-full rounded-full opacity-90" style={{ width: `${(n / max) * 100}%`, background: "var(--cyan)" }} />
          </div>
        </button>
      ))}
    </Card>
  );
}

function Overview({ items, openItem }: { items: Item[]; openItem: (item: Item) => void }) {
  const stats = computeStats(items);
  const history = useLibrary((s) => s.history);
  const maxVoteCount = Math.max(...stats.voteDist.map((d) => d.n), 1);
  const years = yearsWithActivity(history);
  const [year, setYear] = useState(years[0]);
  const yir = computeYearInReview(items, history, year);

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <Label>Il nastro</Label>
        <Nastro days={365} height={72} caption={`Un filo per ogni sessione del ${new Date().getFullYear()}`} />
      </Card>

      <Card>
        <div className="mb-2 flex items-center justify-between gap-3">
          <span className="text-xs font-medium uppercase tracking-wide text-text-faint">Il tuo anno</span>
          {years.length > 1 && (
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              aria-label="Anno da mostrare"
              className="rounded-sm border border-border-strong bg-surface px-2 py-1 font-mono tabular text-xs text-text-muted"
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          )}
        </div>
        {yir.watchedCount === 0 ? (
          <p className="text-sm text-text-muted">Nessuna attività registrata nel {year}.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="text-center">
              <div className="font-mono tabular text-2xl font-semibold" style={{ color: "var(--accent-text)" }}>
                {yir.watchedCount}
              </div>
              <div className="text-[10px] text-text-faint">titoli completati</div>
            </div>
            <div className="text-center">
              <div className="font-mono tabular text-2xl font-semibold" style={{ color: "var(--status-watching)" }}>
                {yir.hours}h
              </div>
              <div className="text-[10px] text-text-faint">ore guardate</div>
            </div>
            {yir.topGenre && (
              <div className="text-center">
                <div className="font-display text-lg font-bold text-text">{yir.topGenre}</div>
                <div className="text-[10px] text-text-faint">genere top</div>
              </div>
            )}
            {yir.busiestMonth && (
              <div className="text-center">
                <div className="font-display text-lg font-bold text-text">{yir.busiestMonth}</div>
                <div className="text-[10px] text-text-faint">mese più attivo</div>
              </div>
            )}
          </div>
        )}
      </Card>

      <div className="rounded-md border border-border bg-surface-2 p-6 text-center">
        <span className="text-xs uppercase tracking-[0.14em] text-text-faint">Tempo totale davanti allo schermo</span>
        <div className="mt-1.5 font-mono tabular text-5xl font-semibold" style={{ color: "var(--accent-text)" }}>
          {stats.hours}
          <span className="text-2xl">h</span>
        </div>
        <p className="mt-1.5 text-sm text-text-muted">circa {stats.days} giorni pieni</p>
      </div>

      <div className="grid grid-cols-3 gap-2.5">
        <div className="rounded-md border border-border bg-surface-2 p-3.5 text-center">
          <div className="font-mono tabular text-2xl font-semibold" style={{ color: "var(--status-done)" }}>
            {stats.byStatus.Visto}
          </div>
          <div className="mt-0.5 text-[11px] text-text-faint">visti</div>
        </div>
        <div className="rounded-md border border-border bg-surface-2 p-3.5 text-center">
          <div className="font-mono tabular text-2xl font-semibold" style={{ color: "var(--status-watching)" }}>
            {stats.byStatus["In visione"]}
          </div>
          <div className="mt-0.5 text-[11px] text-text-faint">in corso</div>
        </div>
        <div className="rounded-md border border-border bg-surface-2 p-3.5 text-center">
          <div className="font-mono tabular text-2xl font-semibold" style={{ color: "var(--accent-text)" }}>
            {stats.byStatus["Da vedere"]}
          </div>
          <div className="mt-0.5 text-[11px] text-text-faint">da vedere</div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2.5">
        <div className="rounded-md border border-border bg-surface-2 p-3.5 text-center">
          <div className="font-mono tabular text-2xl font-semibold text-text">{stats.filmsCompleted}</div>
          <div className="mt-0.5 text-[11px] text-text-faint">film completati</div>
        </div>
        <div className="rounded-md border border-border bg-surface-2 p-3.5 text-center">
          <div className="font-mono tabular text-2xl font-semibold text-text">{stats.seriesCompleted}</div>
          <div className="mt-0.5 text-[11px] text-text-faint">serie completate</div>
        </div>
        <div className="rounded-md border border-border bg-surface-2 p-3.5 text-center">
          <div className="font-mono tabular text-2xl font-semibold text-text">{stats.episodesWatched}</div>
          <div className="mt-0.5 text-[11px] text-text-faint">episodi visti</div>
        </div>
      </div>

      <Card>
        <Label>Come voti</Label>
        <div className="flex h-20 items-end gap-1">
          {stats.voteDist.map(({ v, n }) => (
            <div key={v} className="flex flex-1 flex-col items-center gap-1">
              {n > 0 && <span className="text-[9px] text-text-faint">{n}</span>}
              <div
                className="w-full rounded-t-xs"
                style={{ height: `${Math.max((n / maxVoteCount) * 48, n > 0 ? 3 : 0)}px`, background: voteColor(v) }}
              />
              <span className="text-[9px] text-text-faint">{v}</span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-center text-xs text-text-muted">
          Media {stats.avgVote != null ? stats.avgVote.toFixed(1) : "—"} su {items.filter((i) => i.vote != null).length} titoli votati
        </p>
      </Card>

      <Card>
        <Label>Formati</Label>
        <div className="mb-2.5 flex h-2.5 overflow-hidden rounded-full">
          {stats.byKind.map(([k, n], idx) => (
            <div key={k} style={{ width: `${(n / stats.total) * 100}%`, background: KIND_COLORS[idx % KIND_COLORS.length] }} />
          ))}
        </div>
        <div className="flex flex-wrap gap-3">
          {stats.byKind.map(([k, n], idx) => (
            <div key={k} className="flex items-center gap-1.5 text-xs text-text-muted">
              <span className="h-2 w-2 rounded-xs" style={{ background: KIND_COLORS[idx % KIND_COLORS.length] }} />
              {KIND_LABELS[k]} {n}
            </div>
          ))}
        </div>
      </Card>

      {stats.byGenre.length > 0 && (
        <Card>
          <Label>Generi più frequenti</Label>
          {stats.byGenre.slice(0, 6).map(([g, n]) => (
            <div key={g} className="mb-2 last:mb-0">
              <div className="mb-1 flex justify-between">
                <span className="text-xs text-text">{g}</span>
                <span className="text-xs text-text-faint">{n}</span>
              </div>
              <div className="h-1 overflow-hidden rounded-full bg-surface-hover">
                <div className="h-full rounded-full opacity-90" style={{ width: `${(n / stats.byGenre[0][1]) * 100}%`, background: "var(--accent)" }} />
              </div>
            </div>
          ))}
        </Card>
      )}

      <PeopleCard title="Attori più visti" rows={stats.byActor} />
      <PeopleCard title="Registi più visti" rows={stats.byDirector} />

      <Card>
        <Label>Piattaforme</Label>
        <div className="flex flex-wrap gap-2">
          {stats.byPlatform.map(([p, n]) => (
            <div key={p} className="flex items-center gap-1.5 rounded-full bg-surface-hover px-2.5 py-1 text-xs">
              <span className="text-text-muted">{p}</span>
              <span className="font-semibold text-text">{n}</span>
            </div>
          ))}
        </div>
      </Card>

      {stats.top.length > 0 && (
        <Card>
          <Label>La tua top 5</Label>
          {stats.top.map((item, idx) => (
            <button
              key={item.id}
              type="button"
              onClick={() => openItem(item)}
              aria-label={`Apri dettagli di ${item.title}, ${item.year}`}
              className="mb-2.5 flex w-full items-center gap-2.5 text-left last:mb-0"
            >
              <span className="w-4 font-mono tabular text-base font-semibold" style={{ color: idx === 0 ? "var(--accent-text)" : "var(--text-faint)" }}>
                {idx + 1}
              </span>
              <PosterArt item={item} size="sm" showTitle={false} className="w-8 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-text">{item.title}</div>
                <div className="text-[10px] text-text-faint">
                  {item.year} · {item.genre}
                </div>
              </div>
              <VoteBadge vote={item.vote} />
            </button>
          ))}
        </Card>
      )}
    </div>
  );
}

function DiaryTab({ items, openItem }: { items: Item[]; openItem: (item: Item) => void }) {
  const history = useLibrary((s) => s.history);
  const days = groupDiary(history, items);

  if (days.length === 0) {
    return (
      <EmptyState
        title="Il tuo diario è vuoto"
        description="Segna un titolo come visto o registra un episodio per iniziare a costruire il tuo diario."
      />
    );
  }

  let lastMonth = "";
  return (
    <div className="flex flex-col gap-1">
      {days.map(({ date, entries }) => {
        const d = new Date(`${date}T00:00:00`);
        const monthLabel = new Intl.DateTimeFormat("it-IT", { month: "long", year: "numeric" }).format(d);
        const showMonth = monthLabel !== lastMonth;
        lastMonth = monthLabel;
        const dayLabel = new Intl.DateTimeFormat("it-IT", { weekday: "short", day: "numeric" }).format(d);
        return (
          <div key={date}>
            {showMonth && (
              <p className="mb-1 mt-4 text-xs font-semibold uppercase tracking-wide text-text-faint first:mt-0">{monthLabel}</p>
            )}
            <div className="flex gap-3 border-b border-border py-2.5 last:border-0">
              <span className="w-11 shrink-0 pt-1 text-center text-[11px] capitalize text-text-faint">{dayLabel}</span>
              <div className="flex flex-1 flex-col gap-1.5">
                {entries.map(({ item, action, count }) => (
                  <button
                    key={`${item.id}-${action}`}
                    type="button"
                    onClick={() => openItem(item)}
                    aria-label={`Apri dettagli di ${item.title}, ${item.year}`}
                    className="flex items-center gap-2.5 text-left"
                  >
                    <PosterArt item={item} size="sm" showTitle={false} className="w-8 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-text">{item.title}</p>
                      <p className="text-[11px] text-text-faint">
                        {action === "watched" && "Completato"}
                        {action === "episode" && `${count} episod${count === 1 ? "io" : "i"}`}
                        {action === "rewatch" && "Rivisto"}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AchievementsTab({ items }: { items: Item[] }) {
  const history = useLibrary((s) => s.history);
  const sagas = useSagas((s) => s.sagas);
  const achievements = computeAchievements(items, history, sagas);
  const earnedCount = achievements.filter((a) => a.earned).length;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-text-muted">
        {earnedCount} su {achievements.length} traguardi sbloccati
      </p>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {achievements.map((a) => (
          <div
            key={a.id}
            className="flex items-start gap-3 rounded-md border p-3.5"
            style={{
              borderColor: a.earned ? "color-mix(in srgb, var(--accent) 40%, transparent)" : "var(--border)",
              background: a.earned ? "color-mix(in srgb, var(--accent) 8%, transparent)" : "var(--surface-2)",
              opacity: a.earned ? 1 : 0.65,
            }}
          >
            <span className="text-2xl leading-none">{a.icon}</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-text">{a.title}</p>
              <p className="mt-0.5 text-xs text-text-faint">{a.description}</p>
              <p className="mt-1 text-[11px] font-medium" style={{ color: a.earned ? "var(--accent-text)" : "var(--text-faint)" }}>
                {a.earned ? "✓ Sbloccato" : a.progress}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Stats() {
  const ready = useAppReady();
  const items = useLibrary((s) => s.items);
  const openItem = useSelectedItem((s) => s.open);
  const [tab, setTab] = useState<Tab>("panoramica");

  if (!ready) return <div className="mx-auto max-w-3xl px-4 py-10 text-sm text-text-faint sm:px-6">Caricamento…</div>;

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <EmptyState title="Nessun dato ancora" description="Aggiungi e vota qualche titolo per vedere le tue statistiche." />
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6 sm:px-6 sm:py-10">
      <h1 className="font-display text-3xl font-semibold text-text">Dati</h1>

      <div className="flex gap-1 border-b border-border" role="tablist" aria-label="Sezioni dati">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`-mb-px rounded-t-sm border-b-2 px-3.5 py-2 text-sm font-medium transition-colors ${
              tab === t.id ? "text-text" : "border-transparent text-text-faint hover:text-text-muted"
            }`}
            style={tab === t.id ? { borderColor: "var(--accent)" } : undefined}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "panoramica" && <Overview items={items} openItem={openItem} />}
      {tab === "diario" && <DiaryTab items={items} openItem={openItem} />}
      {tab === "traguardi" && <AchievementsTab items={items} />}
    </div>
  );
}
