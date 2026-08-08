import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
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
import { useAppReady } from "../lib/useAppReady";
import { useVisibleItems } from "../lib/useVisibleItems";

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-md border border-border bg-surface-2 p-4 ${className}`}>{children}</div>;
}

function Label({ children }: { children: string }) {
  return <span className="mb-2 block text-xs font-medium uppercase tracking-wide text-text-faint">{children}</span>;
}

function Tile({ value, label, color }: { value: string; label: string; color?: string }) {
  return (
    <div className="rounded-md border border-border bg-surface-2 p-3.5 text-center">
      <div className="font-mono tabular text-2xl font-semibold" style={{ color: color ?? "var(--text)" }}>
        {value}
      </div>
      <div className="mt-0.5 text-[11px] text-text-faint">{label}</div>
    </div>
  );
}

/** The ring around the avatar: how far through the current level you are. */
/**
 * L'attesa, disegnata come la pagina che sta arrivando.
 *
 * Prima era la parola «Caricamento…», che descrive sé stessa e non dice
 * niente di ciò che si sta aspettando. Lo scheletro dice la forma: un
 * riquadro grande per le ore, tre pastiglie per i totali, un rettangolo per
 * il grafico. Quando i dati arrivano non c'è nessun salto, perché la pagina
 * era già lì di misura.
 */
function ProfileSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-4">
      <div className="skeleton h-28 rounded-md" />
      <div className="grid grid-cols-3 gap-2.5">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="skeleton h-20 rounded-md" />
        ))}
      </div>
      <div className="skeleton h-44 rounded-md" />
    </div>
  );
}

function LevelRing({ pct, children }: { pct: number; children: React.ReactNode }) {
  return (
    <div
      className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full p-[3px]"
      style={{
        background: `conic-gradient(var(--accent) ${pct * 3.6}deg, color-mix(in srgb, var(--text-faint) 22%, transparent) 0deg)`,
      }}
    >
      <div className="flex h-full w-full items-center justify-center rounded-full bg-surface">{children}</div>
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
      <div className="flex h-28 items-end gap-[3px]">
        {buckets.map((b, idx) => (
          <div key={b.key} className="flex min-w-0 flex-1 flex-col items-center gap-1">
            <div
              className="w-full rounded-t-xs transition-[height]"
              style={{
                height: `${b.minutes ? Math.max((b.minutes / peak) * 86, 3) : 2}px`,
                background: b.minutes ? "var(--accent)" : "color-mix(in srgb, var(--text-faint) 20%, transparent)",
              }}
              title={`${b.label}: ${formatRuntime(b.minutes)}`}
            />
            <span className="truncate text-[9px] text-text-faint">
              {idx % labelEvery === 0 ? b.label : ""}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-center text-xs text-text-muted">
        {total > 0
          ? `${formatRuntime(total)} in questo periodo · picco ${formatRuntime(peak)}`
          : "Nessuna attività registrata in questo periodo."}
      </p>
    </div>
  );
}

/** L'intestazione di **Tu**: chi sei secondo le ore che hai messo. */
export function ProfileHeader() {
  const displayName = usePlayerPrefs((s) => s.displayName);
  const { level } = useLevelSummary();
  return (
    <header className="flex items-center gap-4 rounded-md border border-border bg-surface-2 p-4">
      <LevelRing pct={level.pct}>
        <span className="t-numeral text-xl font-semibold" style={{ color: "var(--accent-text)" }}>
          {level.level}
        </span>
      </LevelRing>
      <div className="min-w-0 flex-1">
        <p className="t-label text-text-faint">Livello {level.level}</p>
        <h1 className="truncate font-display text-2xl font-semibold text-text sm:text-3xl">{level.title}</h1>
        <p className="mt-0.5 truncate text-sm text-text-muted">
          {displayName?.trim() ? displayName : "Tu"} ·{" "}
          {level.hoursToNext != null
            ? `${level.hoursToNext}h a «${level.nextTitle}»`
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
    <div className="flex flex-col gap-4">
      {items.length === 0 && history.length === 0 ? (
        <EmptyState
          title="Il diario comincia col primo voto."
          description="Segna un titolo come visto, o guarda qualcosa dal lettore: da lì in poi ore, grafico e record si riempiono da soli."
        />
      ) : (
        <>
          {/* --- Total hours ---------------------------------------------- */}
          <div className="rounded-md border border-border bg-surface-2 p-6 text-center">
            <span className="text-xs uppercase tracking-[0.14em] text-text-faint">Ore totali</span>
            <div className="mt-1.5 font-mono tabular text-5xl font-semibold" style={{ color: "var(--accent-text)" }}>
              {totalHours}
              <span className="text-2xl">h</span>
            </div>
            <p className="mt-1.5 text-sm text-text-muted">
              {playerHours >= 0.1
                ? `di cui ${playerHours.toFixed(1)}h misurate dal player`
                : "in gran parte stimate dalla tua libreria"}
              {streak > 0 && ` · ${streak} giorn${streak === 1 ? "o" : "i"} di fila`}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            <Tile value={String(stats.filmsCompleted)} label="film visti" color="var(--status-done)" />
            <Tile value={String(stats.seriesCompleted)} label="serie completate" color="var(--status-watching)" />
            <Tile value={String(stats.episodesWatched)} label="episodi visti" color="var(--accent-text)" />
          </div>

          {/* --- Activity chart ------------------------------------------- */}
          <Card>
            <div className="mb-3 flex items-center justify-between gap-3">
              <span className="text-xs font-medium uppercase tracking-wide text-text-faint">Attività</span>
              <div className="flex gap-1" role="tablist" aria-label="Periodo del grafico">
                {ACTIVITY_RANGES.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    role="tab"
                    aria-selected={range === r.id}
                    onClick={() => setRange(r.id)}
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                      range === r.id
                        ? "border-accent text-text"
                        : "border-border-strong text-text-faint hover:text-text-muted"
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
            <ActivityChart range={range} minutes={minutes} />
          </Card>

          {/* --- Personal record ------------------------------------------ */}
          <Card>
            <Label>Record personale</Label>
            {record ? (
              <div className="flex items-baseline justify-between gap-3">
                <span className="truncate text-sm capitalize text-text">{formatDay(record.date)}</span>
                <span className="shrink-0 font-mono tabular text-xl font-semibold" style={{ color: "var(--accent-text)" }}>
                  {formatRuntime(record.minutes)}
                </span>
              </div>
            ) : (
              <p className="text-sm text-text-muted">Nessun giorno registrato: il record arriva con la prima visione.</p>
            )}
          </Card>

          {/* --- Continue watching ---------------------------------------- */}
          {resume.length > 0 && (
            <Card>
              <Label>Continua a guardare</Label>
              <div className="no-scrollbar flex gap-3.5 overflow-x-auto pb-1">
                {resume.map((entry) => (
                  <ContinueWatchingCard key={entry.item.id} entry={entry} />
                ))}
              </div>
            </Card>
          )}

          {/* --- Series ranking ------------------------------------------- */}
          {ranking.length > 0 && (
            <Card>
              <Label>Le tue serie, per episodi</Label>
              {ranking.map(({ item, episodes, minutes: mins, pct }, idx) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => openItem(item)}
                  aria-label={`Apri dettagli di ${item.title}, ${episodes} episodi visti`}
                  className="mb-2.5 flex w-full items-center gap-2.5 text-left last:mb-0"
                >
                  <span
                    className="w-4 shrink-0 font-mono tabular text-base font-semibold"
                    style={{ color: idx === 0 ? "var(--accent-text)" : "var(--text-faint)" }}
                  >
                    {idx + 1}
                  </span>
                  <PosterArt item={item} size="sm" showTitle={false} className="w-8 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-text">{item.title}</div>
                    <div className="mt-1 flex items-center gap-1.5">
                      <span className="h-1 flex-1 overflow-hidden rounded-full bg-surface-hover">
                        <span
                          className="block h-full rounded-full"
                          style={{ width: `${Math.max(pct, 2)}%`, background: "var(--status-watching)" }}
                        />
                      </span>
                      <span className="shrink-0 font-mono tabular text-[10px] text-text-faint">
                        {episodes}
                        {item.episodes ? `/${item.episodes}` : ""} ep · {formatRuntime(mins)}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </Card>
          )}

          {/* --- Library shortcut ------------------------------------------ */}
          <Card>
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="text-xs font-medium uppercase tracking-wide text-text-faint">Libreria completata</span>
              <Link to="/libreria" className="shrink-0 text-sm font-medium text-accent-text">
                apri
              </Link>
            </div>
            {finished.length === 0 ? (
              <p className="text-sm text-text-muted">Niente di completato, per ora.</p>
            ) : (
              <div className="no-scrollbar flex gap-2.5 overflow-x-auto pb-1">
                {finished.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => openItem(item)}
                    aria-label={`Apri dettagli di ${item.title}, ${item.year}`}
                    className="w-16 shrink-0"
                  >
                    <PosterArt item={item} size="sm" showTitle={false} className="w-16" />
                  </button>
                ))}
              </div>
            )}
          </Card>

          <p className="text-center text-xs text-text-faint">
            Le statistiche partono da quando è stata installata questa versione: le visioni precedenti restano nella
            libreria e nel diario, ma non nel conteggio delle ore misurate dal player.
          </p>
        </>
      )}
    </div>
  );
}
