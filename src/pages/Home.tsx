import { Fragment, useMemo } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useLibrary } from "../store/useLibrary";
import { useSelectedItem } from "../store/useSelectedItem";
import { useAddSheet } from "../store/useAddSheet";
import { useHomeLayout, type HomeSectionId } from "../store/useHomeLayout";
import { StatCard } from "../components/StatCard";
import { PosterCard } from "../components/PosterCard";
import { EmptyState } from "../components/EmptyState";
import { PosterGridSkeleton, StatCardSkeleton } from "../components/Skeletons";
import { PosterArt } from "../components/PosterArt";
import { VoteBadge } from "../components/VoteBadge";
import { UpcomingRow } from "../components/UpcomingRow";
import { NightPickerButton } from "../components/NightPicker";
import { Nastro } from "../components/Nastro";
import { MarathonCard } from "../components/MarathonCard";
import { ContinueSagaRow } from "../components/ContinueSagaRow";
import { PosterRow } from "../components/PosterRow";
import { forYou, mostWatched, recentlyAdded } from "../lib/recommend";
import { computeStats } from "../lib/stats";
import { greeting } from "../lib/stats";
import { formatRuntime } from "../lib/format";
import { useAppReady } from "../lib/useAppReady";

export function Home() {
  const ready = useAppReady();
  const items = useLibrary((s) => s.items);
  const openItem = useSelectedItem((s) => s.open);
  const openAddSheet = useAddSheet((s) => s.open);
  const order = useHomeLayout((s) => s.order);
  const hidden = useHomeLayout((s) => s.hidden);

  const stats = computeStats(items);
  const watching = items.filter((i) => i.status === "In visione");
  const planned = items.filter((i) => i.status === "Da vedere").slice(0, 4);
  const favs = items.filter((i) => i.fav);

  // Each of these walks the whole library, and the Home page re-renders on
  // every store touch — a tick on an episode counter shouldn't recompute a
  // taste profile.
  const suggestions = useMemo(() => forYou(items), [items]);
  const watchedMost = useMemo(() => mostWatched(items), [items]);
  const latest = useMemo(() => recentlyAdded(items), [items]);

  const today = new Intl.DateTimeFormat("it-IT", { weekday: "long", day: "numeric", month: "long" }).format(new Date());

  // Every row is built here and picked from below, rather than written inline
  // in a fixed sequence. That is what makes the order in Impostazioni real:
  // with the markup interleaved, "sposta su" could only ever move the rows
  // that happened to sit next to each other in the file.
  const sections: Record<HomeSectionId, ReactNode> = {
    nastro: items.length > 0 ? <Nastro days={30} height={58} /> : null,

    maratona: <MarathonCard />,

    statistiche: (
      <section aria-label="Le tue statistiche" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="in libreria" value={String(stats.total)} />
        <StatCard label="voto medio" value={stats.avgVote != null ? stats.avgVote.toFixed(1) : "—"} />
        <StatCard label={`${stats.days} giorni`} value={`${stats.hours}h`} />
        <StatCard label="preferiti" value={String(stats.favs)} />
      </section>
    ),

    riprendi:
      watching.length > 0 ? (
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
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${pct}%`, background: "var(--status-watching)" }}
                          />
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
      ) : null,

    saga: <ContinueSagaRow />,

    arrivo: <UpcomingRow />,

    perTe: (
      <PosterRow
        title="Per te"
        entries={suggestions}
        note="Dai voti che hai già dato: ogni titolo dice perché è qui."
      />
    ),

    preferiti:
      favs.length > 0 ? (
        <PosterRow title="I tuoi preferiti" entries={favs.map((item) => ({ item }))} count={favs.length} />
      ) : null,

    piuVisti: <PosterRow title="Più visti" entries={watchedMost} />,

    ultimiAggiunti: (
      <PosterRow title="Ultimi aggiunti" entries={latest.map((item) => ({ item }))} moreHref="/libreria" />
    ),

    watchlist:
      planned.length > 0 ? (
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl font-semibold text-text">
              Watchlist{" "}
              <span className="text-sm font-normal text-text-faint">
                · {items.filter((i) => i.status === "Da vedere").length}
              </span>
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
      ) : null,
  };

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

      {!ready ? (
        <>
          <section aria-label="Le tue statistiche" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <StatCardSkeleton key={i} />
            ))}
          </section>
          <PosterGridSkeleton count={4} />
        </>
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
        order
          .filter((id) => !hidden.includes(id))
          .map((id) => <Fragment key={id}>{sections[id]}</Fragment>)
      )}
    </div>
  );
}
