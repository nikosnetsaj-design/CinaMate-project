import { Link } from "react-router-dom";
import { MOVIES } from "../data/movies";
import { useLibrary } from "../store/useLibrary";
import { useSelectedMovie } from "../store/useSelectedMovie";
import { PosterArt } from "../components/PosterArt";
import { StarRating } from "../components/StarRating";
import { EmptyState } from "../components/EmptyState";
import { RowSkeleton } from "../components/Skeletons";
import { computeStats } from "../lib/stats";
import { formatDate, formatRuntime } from "../lib/format";
import { useAppReady } from "../lib/useAppReady";

export function Diary() {
  const ready = useAppReady();
  const diary = useLibrary((s) => s.diary);
  const removeDiaryEntry = useLibrary((s) => s.removeDiaryEntry);
  const openMovie = useSelectedMovie((s) => s.open);
  const stats = computeStats(diary);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
      <div>
        <h1 className="font-display text-3xl font-semibold text-text">Diario</h1>
        <p className="mt-1 text-sm text-text-muted">
          {diary.length === 0
            ? "Nessuna voce ancora."
            : `${diary.length} film visti · ${formatRuntime(stats.totalMinutes)} totali`}
        </p>
      </div>

      {!ready ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <RowSkeleton key={i} />
          ))}
        </div>
      ) : diary.length === 0 ? (
        <EmptyState
          title="Il tuo diario è vuoto"
          description="Segna un film come visto per iniziare a costruire il tuo archivio personale, con voto e note private."
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
        <ul className="flex flex-col gap-3">
          {diary.map((entry) => {
            const movie = MOVIES.find((m) => m.id === entry.movieId);
            if (!movie) return null;
            return (
              <li
                key={entry.movieId}
                className="flex gap-4 rounded-md border border-border bg-surface p-3 transition-colors hover:bg-surface-hover"
              >
                <button
                  type="button"
                  onClick={() => openMovie(movie)}
                  aria-label={`Apri dettagli di ${movie.title}`}
                  className="w-14 shrink-0 overflow-hidden rounded-xs sm:w-16"
                >
                  <PosterArt movie={movie} size="sm" />
                </button>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                    <button
                      type="button"
                      onClick={() => openMovie(movie)}
                      className="truncate text-left font-display text-base font-medium text-text hover:underline"
                    >
                      {movie.title}
                    </button>
                    <StarRating value={entry.rating} readOnly size="sm" />
                  </div>
                  <p className="text-xs text-text-faint">
                    Visto il {formatDate(entry.watchedAt)} · {movie.year}
                  </p>
                  {entry.note && <p className="text-sm text-text-muted">&ldquo;{entry.note}&rdquo;</p>}
                  <div className="mt-1">
                    <button
                      type="button"
                      onClick={() => removeDiaryEntry(entry.movieId)}
                      className="text-xs font-medium text-text-faint hover:text-rust hover:underline"
                    >
                      Rimuovi dal diario
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
