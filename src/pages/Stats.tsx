import { useLibrary } from "../store/useLibrary";
import { useSelectedItem } from "../store/useSelectedItem";
import { computeStats } from "../lib/stats";
import { voteColor } from "../lib/vote";
import { PosterArt } from "../components/PosterArt";
import { VoteBadge } from "../components/VoteBadge";
import { EmptyState } from "../components/EmptyState";
import { useAppReady } from "../lib/useAppReady";

const KIND_LABELS: Record<string, string> = { film: "Film", serie: "Serie TV", anime: "Anime", doc: "Documentario" };
const KIND_COLORS = ["var(--accent)", "var(--status-watching)", "var(--rust)", "var(--status-done)"];

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-md border border-border bg-surface-2 p-4">{children}</div>;
}
function Label({ children }: { children: string }) {
  return <span className="mb-2 block text-xs font-medium uppercase tracking-wide text-text-faint">{children}</span>;
}

export function Stats() {
  const ready = useAppReady();
  const items = useLibrary((s) => s.items);
  const openItem = useSelectedItem((s) => s.open);
  const stats = computeStats(items);
  const maxVoteCount = Math.max(...stats.voteDist.map((d) => d.n), 1);

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

      <div className="rounded-md border border-border bg-surface-2 p-6 text-center">
        <span className="text-xs uppercase tracking-[0.14em] text-text-faint">Tempo totale davanti allo schermo</span>
        <div className="mt-1.5 font-display text-5xl font-black" style={{ color: "var(--accent-text)" }}>
          {stats.hours}
          <span className="text-2xl">h</span>
        </div>
        <p className="mt-1.5 text-sm text-text-muted">circa {stats.days} giorni pieni</p>
      </div>

      <div className="grid grid-cols-3 gap-2.5">
        <div className="rounded-md border border-border bg-surface-2 p-3.5 text-center">
          <div className="font-display text-2xl font-black" style={{ color: "var(--status-done)" }}>
            {stats.byStatus.Visto}
          </div>
          <div className="mt-0.5 text-[11px] text-text-faint">visti</div>
        </div>
        <div className="rounded-md border border-border bg-surface-2 p-3.5 text-center">
          <div className="font-display text-2xl font-black" style={{ color: "var(--status-watching)" }}>
            {stats.byStatus["In visione"]}
          </div>
          <div className="mt-0.5 text-[11px] text-text-faint">in corso</div>
        </div>
        <div className="rounded-md border border-border bg-surface-2 p-3.5 text-center">
          <div className="font-display text-2xl font-black" style={{ color: "var(--accent-text)" }}>
            {stats.byStatus["Da vedere"]}
          </div>
          <div className="mt-0.5 text-[11px] text-text-faint">da vedere</div>
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
              <span className="w-4 font-display text-base font-black" style={{ color: idx === 0 ? "var(--accent-text)" : "var(--text-faint)" }}>
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
