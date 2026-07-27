import { Link } from "react-router-dom";
import { MOVIES } from "../data/movies";
import { useLibrary } from "../store/useLibrary";
import { useSelectedMovie } from "../store/useSelectedMovie";
import { StatCard } from "../components/StatCard";
import { PosterCard } from "../components/PosterCard";
import { EmptyState } from "../components/EmptyState";
import { PosterGridSkeleton, StatCardSkeleton } from "../components/Skeletons";
import { computeStats, greeting } from "../lib/stats";
import { formatRuntime } from "../lib/format";
import { useAppReady } from "../lib/useAppReady";

export function Home() {
  const ready = useAppReady();
  const watchlist = useLibrary((s) => s.watchlist);
  const diary = useLibrary((s) => s.diary);
  const openMovie = useSelectedMovie((s) => s.open);

  const stats = computeStats(diary);
  const watchlistMovies = watchlist
    .slice()
    .reverse()
    .slice(0, 4)
    .map((w) => MOVIES.find((m) => m.id === w.movieId))
    .filter((m): m is (typeof MOVIES)[number] => !!m);
  const recentMovies = diary
    .slice(0, 4)
    .map((d) => MOVIES.find((m) => m.id === d.movieId))
    .filter((m): m is (typeof MOVIES)[number] => !!m);

  const today = new Intl.DateTimeFormat("it-IT", { weekday: "long", day: "numeric", month: "long" }).format(
    new Date(),
  );

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-6 sm:px-6 sm:py-10">
      <div>
        <p className="text-sm capitalize text-text-faint">{today}</p>
        <h1 className="font-display text-3xl font-semibold text-text sm:text-4xl">{greeting()}.</h1>
      </div>

      <section aria-label="Le tue statistiche" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {!ready ? (
          Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
        ) : (
          <>
            <StatCard label="Film visti" value={String(stats.totalWatched)} />
            <StatCard label="Ore di visione" value={String(Math.round(stats.totalMinutes / 60))} hint="ore totali" />
            <StatCard label="Questo mese" value={String(stats.thisMonthWatched)} />
            <StatCard
              label="Voto medio"
              value={stats.totalWatched ? stats.avgRating.toFixed(1) : "—"}
              hint={stats.favoriteGenre ? `Ami: ${stats.favoriteGenre}` : undefined}
            />
          </>
        )}
      </section>

      {ready && stats.totalWatched >= 3 && stats.favoriteGenre && (
        <p className="rounded-md border border-border bg-surface-2 px-4 py-3 text-sm text-text-muted">
          Nelle ultime settimane hai preferito il genere{" "}
          <span className="font-medium text-accent-text">{stats.favoriteGenre}</span>, con un voto medio di{" "}
          <span className="font-medium text-text">{stats.avgRating.toFixed(1)}★</span> e{" "}
          {formatRuntime(stats.totalMinutes)} passate davanti allo schermo.
        </p>
      )}

      <section aria-labelledby="watchlist-heading" className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 id="watchlist-heading" className="font-display text-xl font-semibold text-text">
            Continua la watchlist
          </h2>
          {watchlist.length > 0 && (
            <Link to="/watchlist" className="text-sm font-medium text-accent-text hover:underline">
              Vedi tutto
            </Link>
          )}
        </div>
        {!ready ? (
          <PosterGridSkeleton count={4} />
        ) : watchlistMovies.length === 0 ? (
          <EmptyState
            title="La tua watchlist è vuota"
            description="Aggiungi i film che vuoi vedere per trovarli qui, pronti quando hai voglia di guardarli."
            action={
              <Link
                to="/scopri"
                className="rounded-sm px-4 py-2 text-sm font-medium"
                style={{ background: "var(--accent)", color: "var(--accent-contrast)" }}
              >
                Scopri film
              </Link>
            }
          />
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {watchlistMovies.map((movie) => (
              <PosterCard key={movie.id} movie={movie} onOpen={openMovie} />
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="recent-heading" className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 id="recent-heading" className="font-display text-xl font-semibold text-text">
            Visti di recente
          </h2>
          {diary.length > 0 && (
            <Link to="/diario" className="text-sm font-medium text-accent-text hover:underline">
              Vedi tutto
            </Link>
          )}
        </div>
        {!ready ? (
          <PosterGridSkeleton count={4} />
        ) : recentMovies.length === 0 ? (
          <EmptyState
            title="Il tuo diario è vuoto"
            description="Segna un film come visto per iniziare a costruire il tuo archivio personale."
            action={
              <Link
                to="/scopri"
                className="rounded-sm px-4 py-2 text-sm font-medium"
                style={{ background: "var(--accent)", color: "var(--accent-contrast)" }}
              >
                Scopri film
              </Link>
            }
          />
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {recentMovies.map((movie) => (
              <PosterCard key={movie.id} movie={movie} onOpen={openMovie} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
