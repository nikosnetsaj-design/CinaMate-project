import { Fragment, useMemo } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useSelectedItem } from "../store/useSelectedItem";
import { useAddSheet } from "../store/useAddSheet";
import { useHomeLayout, type HomeSectionId } from "../store/useHomeLayout";
import { StatCard } from "../components/StatCard";
import { PosterCard } from "../components/PosterCard";
import { EmptyState } from "../components/EmptyState";
import { PosterGridSkeleton, StatCardSkeleton } from "../components/Skeletons";
import { UpcomingRow } from "../components/UpcomingRow";
import { NightPickerButton } from "../components/NightPicker";
import { Nastro } from "../components/Nastro";
import { MarathonCard } from "../components/MarathonCard";
import { ContinueSagaRow } from "../components/ContinueSagaRow";
import { ContinueWatchingRow } from "../components/ContinueWatchingRow";
import { PosterRow } from "../components/PosterRow";
import { Billboard } from "../components/Billboard";
import { becauseYouWatched, forYou, mostWatched, recentlyAdded } from "../lib/recommend";
import { lastSeenDates } from "../lib/continueWatching";
import { badgeFor, type PosterBadge } from "../lib/homeBadges";
import { byItemId, useUpcoming } from "../lib/useUpcoming";
import { useLibrary } from "../store/useLibrary";
import { computeStats } from "../lib/stats";
import { greeting } from "../lib/stats";
import { useAppReady } from "../lib/useAppReady";
import { useVisibleItems } from "../lib/useVisibleItems";

export function Home() {
  const ready = useAppReady();
  const items = useVisibleItems();
  const openItem = useSelectedItem((s) => s.open);
  const openAddSheet = useAddSheet((s) => s.open);
  const order = useHomeLayout((s) => s.order);
  const hidden = useHomeLayout((s) => s.hidden);

  // Walks the whole library and derives a dozen aggregates, and this page
  // re-renders on every store touch — ticking one episode counter should not
  // recount every genre, actor and director you own.
  const stats = useMemo(() => computeStats(items), [items]);
  const planned = useMemo(() => items.filter((i) => i.status === "Da vedere").slice(0, 4), [items]);
  const favs = useMemo(() => items.filter((i) => i.fav), [items]);

  // Each of these walks the whole library, and the Home page re-renders on
  // every store touch — a tick on an episode counter shouldn't recompute a
  // taste profile.
  const suggestions = useMemo(() => forYou(items), [items]);
  const watchedMost = useMemo(() => mostWatched(items), [items]);
  const latest = useMemo(() => recentlyAdded(items), [items]);

  const history = useLibrary((s) => s.history);
  const because = useMemo(() => becauseYouWatched(items, lastSeenDates(history)), [items, history]);

  // Le pastiglie sulle copertine si calcolano una volta per tutta la pagina:
  // ogni riga chiede gli stessi titoli, e ricalcolarle riga per riga
  // significherebbe rifare lo stesso lavoro cinque volte per scorrimento.
  const upcoming = useUpcoming();
  const badges = useMemo(() => {
    const next = byItemId(upcoming);
    const map: Record<string, PosterBadge> = {};
    for (const item of items) {
      const badge = badgeFor(item, next[item.id]);
      if (badge) map[item.id] = badge;
    }
    return map;
  }, [items, upcoming]);

  const today = new Intl.DateTimeFormat("it-IT", { weekday: "long", day: "numeric", month: "long" }).format(new Date());

  // Every row is built here and picked from below, rather than written inline
  // in a fixed sequence. That is what makes the order in Impostazioni real:
  // with the markup interleaved, "sposta su" could only ever move the rows
  // that happened to sit next to each other in the file.
  const sections: Record<HomeSectionId, ReactNode> = {
    vetrina: <Billboard />,

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

    // Was a vertical list of series with an episode counter. It is now driven
    // by the playhead instead, which covers the same titles plus every film,
    // and can say the minute rather than only the episode.
    riprendi: <ContinueWatchingRow badges={badges} />,

    saga: <ContinueSagaRow />,

    arrivo: <UpcomingRow />,

    perTe: (
      <PosterRow
        title="Per te"
        entries={suggestions}
        note="Dai voti che hai già dato: ogni titolo dice perché è qui."
        badges={badges}
      />
    ),

    // Il perché sta nel titolo della riga, quindi le singole copertine non
    // ripetono la loro motivazione: sarebbe la stessa frase otto volte.
    perche: because ? (
      <PosterRow
        title={`Perché hai guardato ${because.seed.title}`}
        entries={because.entries}
        badges={badges}
      />
    ) : null,

    preferiti:
      favs.length > 0 ? (
        <PosterRow title="I tuoi preferiti" entries={favs.map((item) => ({ item }))} count={favs.length} badges={badges} />
      ) : null,

    piuVisti: <PosterRow title="Più visti" entries={watchedMost} badges={badges} />,

    ultimiAggiunti: (
      <PosterRow title="Ultimi aggiunti" entries={latest.map((item) => ({ item }))} moreHref="/libreria" badges={badges} />
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
              <PosterCard key={item.id} item={item} onOpen={openItem} badge={badges[item.id]} />
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
