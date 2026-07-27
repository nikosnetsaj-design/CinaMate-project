import { Link } from "react-router-dom";
import { MOVIES } from "../data/movies";
import { useLibrary } from "../store/useLibrary";
import { useSelectedMovie } from "../store/useSelectedMovie";
import { PosterCard } from "../components/PosterCard";
import { EmptyState } from "../components/EmptyState";
import { PosterGridSkeleton } from "../components/Skeletons";
import { useAppReady } from "../lib/useAppReady";

export function Watchlist() {
  const ready = useAppReady();
  const watchlist = useLibrary((s) => s.watchlist);
  const openMovie = useSelectedMovie((s) => s.open);

  const movies = watchlist
    .slice()
    .sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime())
    .map((w) => MOVIES.find((m) => m.id === w.movieId))
    .filter((m): m is (typeof MOVIES)[number] => !!m);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
      <div>
        <h1 className="font-display text-3xl font-semibold text-text">Watchlist</h1>
        <p className="mt-1 text-sm text-text-muted">
          {movies.length === 0 ? "Nessun film in lista." : `${movies.length} film da vedere.`}
        </p>
      </div>

      {!ready ? (
        <PosterGridSkeleton count={8} />
      ) : movies.length === 0 ? (
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
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {movies.map((movie) => (
            <PosterCard key={movie.id} movie={movie} onOpen={openMovie} />
          ))}
        </div>
      )}
    </div>
  );
}
