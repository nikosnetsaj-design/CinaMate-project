import { motion } from "framer-motion";
import { PosterArt } from "./PosterArt";
import { StarRating } from "./StarRating";
import { useLibrary } from "../store/useLibrary";
import type { Movie } from "../types";

function BookmarkIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M3.5 2.5h9a.5.5 0 0 1 .5.5v10.6a.4.4 0 0 1-.63.33L8 10.2l-4.37 3.73A.4.4 0 0 1 3 13.6V3a.5.5 0 0 1 .5-.5Z" strokeLinejoin="round" />
    </svg>
  );
}

function CheckBadge() {
  return (
    <span
      className="absolute left-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full shadow-[var(--shadow-sm)]"
      style={{ background: "var(--teal)", color: "var(--teal-contrast)" }}
      aria-hidden="true"
    >
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <path d="M2 6.2 4.8 9 10 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

export function PosterCard({ movie, onOpen }: { movie: Movie; onOpen: (movie: Movie) => void }) {
  const inWatchlist = useLibrary((s) => s.isInWatchlist(movie.id));
  const diaryEntry = useLibrary((s) => s.getDiaryEntry(movie.id));
  const toggleWatchlist = useLibrary((s) => s.toggleWatchlist);
  const watched = !!diaryEntry;

  return (
    <div className="group flex flex-col gap-2">
      <div className="relative">
        {watched && <CheckBadge />}
        <motion.div
          role="button"
          tabIndex={0}
          aria-label={`Apri dettagli di ${movie.title}, ${movie.year}${watched ? ", già visto" : ""}`}
          onClick={() => onOpen(movie)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onOpen(movie);
            }
          }}
          whileHover={{ y: -4 }}
          whileTap={{ scale: 0.98 }}
          transition={{ type: "spring", stiffness: 380, damping: 26 }}
          className="cursor-pointer overflow-hidden rounded-sm shadow-[var(--shadow-sm)] transition-shadow duration-200 group-hover:shadow-[var(--shadow-md)]"
        >
          <PosterArt movie={movie} size="sm" />
        </motion.div>
        <button
          type="button"
          onClick={() => toggleWatchlist(movie.id)}
          aria-pressed={inWatchlist}
          aria-label={inWatchlist ? `Rimuovi ${movie.title} dalla watchlist` : `Aggiungi ${movie.title} alla watchlist`}
          className="absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-white/20 bg-black/45 text-white backdrop-blur-sm transition-transform hover:scale-110 active:scale-95"
        >
          <BookmarkIcon filled={inWatchlist} />
        </button>
      </div>
      <div className="flex flex-col gap-1 px-0.5">
        <p className="truncate font-display text-sm font-medium text-text" title={movie.title}>
          {movie.title}
        </p>
        <div className="flex items-center justify-between">
          <span className="text-xs text-text-muted">{movie.genres[0]}</span>
          {watched && <StarRating value={diaryEntry.rating} readOnly size="sm" />}
        </div>
      </div>
    </div>
  );
}
