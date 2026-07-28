import { Link } from "react-router-dom";
import { useLibrary } from "../store/useLibrary";
import { useSelectedItem } from "../store/useSelectedItem";
import { useAddSheet } from "../store/useAddSheet";
import { StatCard } from "../components/StatCard";
import { PosterCard } from "../components/PosterCard";
import { EmptyState } from "../components/EmptyState";
import { PosterGridSkeleton, StatCardSkeleton } from "../components/Skeletons";
import { PosterArt } from "../components/PosterArt";
import { VoteBadge } from "../components/VoteBadge";
import { UpcomingRow } from "../components/UpcomingRow";
import { NightPickerButton } from "../components/NightPicker";
import { Nastro } from "../components/Nastro";
import { computeStats } from "../lib/stats";
import { greeting } from "../lib/stats";
import { formatRuntime } from "../lib/format";
import { useAppReady } from "../lib/useAppReady";

export function Home() {
  const ready = useAppReady();
  const items = useLibrary((s) => s.items);
  const openItem = useSelectedItem((s) => s.open);
  const openAddSheet = useAddSheet((s) => s.open);

  const stats = computeStats(items);
  const watching = items.filter((i) => i.status === "In visione");
  const planned = items.filter((i) => i.status === "Da vedere").slice(0, 4);
  const favs = items.filter((i) => i.fav);

  const today = new Intl.DateTimeFormat("it-IT", { weekday: "long", day: "numeric", month: "long" }).format(new Date());

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-9 px-4 py-6 sm:px-6 sm:py-10">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-text-faint">La tua collezione</p>
        <div className="mt-1 flex items-baseline justify-between">
          <h1 className="font-display text-3xl font-semibold text-text sm:text-4xl">{greeting()}.</h1>
          <span className="text-xs text-text-faint">{ready ? `${items.length} titoli` : ""}</span>
        </div>
        <div className="mt-1 flex items-center justify-between gap-3">
          <p className="text-sm capitalize text-text-faint">{today}</p>
          {ready && items.length > 0 && <NightPickerButton />}
        </div>
      </div>

      {ready && items.length > 0 && <Nastro days={30} height={58} />}

      <section aria-label="Le tue statistiche" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {!ready ? (
          Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
        ) : (
          <>
            <StatCard label="in libreria" value={String(stats.total)} />
            <StatCard label="voto medio" value={stats.avgVote != null ? stats.avgVote.toFixed(1) : "—"} />
            <StatCard label={`${stats.days} giorni`} value={`${stats.hours}h`} />
            <StatCard label="preferiti" value={String(stats.favs)} />
          </>
        )}
      </section>

      {!ready ? (
        <PosterGridSkeleton count={4} />
      ) : items.length === 0 ? (
        <EmptyState
          title="La tua libreria è vuota"
          description="Cerca il primo film, serie o anime: copertina, trama, cast e durata arrivano da soli."
          action={
            <button
              type="button"
              onClick={() => openAddSheet()}
              className="rounded-sm px-4 py-2 text-sm font-medium"
              style={{ background: "var(--accent)", color: "var(--accent-contrast)" }}
            >
              Aggiungi il primo titolo
            </button>
          }
        />
      ) : (
        <>
          {watching.length > 0 && (
            <section className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-xl font-semibold text-text">
                  Riprendi <span className="text-sm font-normal text-text-faint">· {watching.length}</span>
                </h2>
                <Link to="/libreria" className="text-sm font-medium" style={{ color: "var(--status-watching)" }}>
                  tutti
                </Link>
              </div>
              <ul className="flex flex-col gap-2.5">
                {watching.map((item) => {
                  const pct = item.episodes ? Math.round(((item.seen || 0) / item.episodes) * 100) : null;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => openItem(item)}
                        aria-label={`Apri dettagli di ${item.title}, ${item.year}`}
                        className="flex w-full items-center gap-3.5 rounded-md border border-border bg-surface p-3 text-left transition-colors hover:bg-surface-hover"
                      >
                        <PosterArt item={item} size="sm" className="w-14 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-display text-sm font-semibold text-text">{item.title}</p>
                          <p className="mt-0.5 text-xs text-text-faint">
                            {item.seen}/{item.episodes} episodi · {formatRuntime(item.runtime)}
                          </p>
                          {pct !== null && (
                            <div className="mt-1.5 h-[3px] w-full max-w-64 overflow-hidden rounded-full bg-surface-hover">
                              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "var(--status-watching)" }} />
                            </div>
                          )}
                        </div>
                        <VoteBadge vote={item.vote} size="sm" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          <UpcomingRow />

          {favs.length > 0 && (
            <section className="flex flex-col gap-3">
              <h2 className="font-display text-xl font-semibold text-text">
                I tuoi preferiti <span className="text-sm font-normal text-text-faint">· {favs.length}</span>
              </h2>
              <div className="flex gap-3.5 overflow-x-auto pb-1">
                {favs.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => openItem(item)}
                    aria-label={`Apri dettagli di ${item.title}, ${item.year}`}
                    className="w-24 shrink-0 text-left"
                  >
                    <PosterArt item={item} size="sm" className="w-24" />
                    <p className="mt-1.5 line-clamp-2 text-xs font-medium text-text">{item.title}</p>
                    <VoteBadge vote={item.vote} size="sm" />
                  </button>
                ))}
              </div>
            </section>
          )}

          {planned.length > 0 && (
            <section className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-xl font-semibold text-text">
                  Watchlist <span className="text-sm font-normal text-text-faint">· {items.filter((i) => i.status === "Da vedere").length}</span>
                </h2>
                <Link to="/libreria" className="text-sm font-medium text-accent-text">
                  tutti
                </Link>
              </div>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
                {planned.map((item) => (
                  <PosterCard key={item.id} item={item} onOpen={openItem} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
