import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { PosterArt } from "./PosterArt";
import { StarRating } from "./StarRating";
import { useLibrary } from "../store/useLibrary";
import { useSelectedMovie } from "../store/useSelectedMovie";
import { formatDate, formatRuntime } from "../lib/format";
import type { Movie } from "../types";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

function BookmarkIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M3.5 2.5h9a.5.5 0 0 1 .5.5v10.6a.4.4 0 0 1-.63.33L8 10.2l-4.37 3.73A.4.4 0 0 1 3 13.6V3a.5.5 0 0 1 .5-.5Z" strokeLinejoin="round" />
    </svg>
  );
}

export function MovieModal({ movie, onClose }: { movie: Movie; onClose: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const titleId = `movie-modal-title-${movie.id}`;

  const inWatchlist = useLibrary((s) => s.isInWatchlist(movie.id));
  const diaryEntry = useLibrary((s) => s.getDiaryEntry(movie.id));
  const toggleWatchlist = useLibrary((s) => s.toggleWatchlist);
  const markWatched = useLibrary((s) => s.markWatched);
  const removeDiaryEntry = useLibrary((s) => s.removeDiaryEntry);

  const [editingRating, setEditingRating] = useState(!diaryEntry);
  const [rating, setRating] = useState(diaryEntry?.rating ?? 0);
  const [note, setNote] = useState(diaryEntry?.note ?? "");

  useEffect(() => {
    previouslyFocused.current = document.activeElement as HTMLElement;
    const first = dialogRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    first?.focus();
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
      previouslyFocused.current?.focus();
    };
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  function handleSaveRating() {
    if (rating === 0) return;
    markWatched(movie.id, rating, note);
    setEditingRating(false);
  }

  return createPortal(
    <div className="fixed inset-0 z-70 flex items-end justify-center sm:items-center sm:p-6">
      <motion.div
        aria-hidden="true"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <motion.div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        initial={{ opacity: 0, y: 32 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 16 }}
        transition={{ type: "spring", stiffness: 320, damping: 30 }}
        className="relative z-10 flex max-h-[92vh] w-full max-w-2xl flex-col overflow-y-auto rounded-t-lg border border-border bg-surface shadow-[var(--shadow-lg)] sm:rounded-lg"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Chiudi"
          className="absolute right-3 top-3 z-20 flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-black/45 text-white backdrop-blur-sm hover:scale-110"
        >
          ✕
        </button>

        <div className="flex flex-col gap-5 p-5 sm:flex-row sm:p-6">
          <PosterArt movie={movie} size="lg" className="w-36 shrink-0 self-center sm:w-44 sm:self-start" />

          <div className="flex flex-1 flex-col gap-4 min-w-0">
            <div>
              <h2 id={titleId} className="font-display text-2xl font-semibold text-text">
                {movie.title}
              </h2>
              {movie.originalTitle && movie.originalTitle !== movie.title && (
                <p className="font-display text-sm font-medium italic text-text-faint">{movie.originalTitle}</p>
              )}
              <p className="mt-1 text-sm text-text-muted">
                {movie.year} · {movie.director} · {formatRuntime(movie.runtime)} · {movie.country}
              </p>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {movie.genres.map((g) => (
                <span
                  key={g}
                  className="rounded-full border border-border-strong px-2.5 py-0.5 text-xs text-text-muted"
                >
                  {g}
                </span>
              ))}
            </div>

            <p className="text-sm leading-relaxed text-text">{movie.synopsis}</p>

            <p className="text-xs text-text-muted">
              <span className="font-medium text-text-faint">Cast: </span>
              {movie.cast.join(", ")}
            </p>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => toggleWatchlist(movie.id)}
                className="inline-flex items-center gap-2 rounded-sm border border-border-strong px-3.5 py-2 text-sm font-medium text-text transition-colors hover:bg-surface-hover"
              >
                <BookmarkIcon filled={inWatchlist} />
                {inWatchlist ? "Nella watchlist" : "Aggiungi a watchlist"}
              </button>
            </div>

            <div className="rounded-md border border-border bg-surface-2 p-4">
              {diaryEntry && !editingRating ? (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium uppercase tracking-wide text-text-faint">
                      Visto il {formatDate(diaryEntry.watchedAt)}
                    </p>
                    <StarRating value={diaryEntry.rating} readOnly size="sm" />
                  </div>
                  {diaryEntry.note && <p className="text-sm text-text">&ldquo;{diaryEntry.note}&rdquo;</p>}
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setEditingRating(true)}
                      className="text-xs font-medium text-accent-text underline-offset-2 hover:underline"
                    >
                      Modifica
                    </button>
                    <button
                      type="button"
                      onClick={() => removeDiaryEntry(movie.id)}
                      className="text-xs font-medium text-text-faint underline-offset-2 hover:underline"
                    >
                      Rimuovi dal diario
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-text-faint">
                    {diaryEntry ? "Modifica valutazione" : "Segna come visto"}
                  </p>
                  <StarRating value={rating} onChange={setRating} size="lg" />
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs text-text-muted">Nota personale (facoltativa)</span>
                    <textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      rows={2}
                      maxLength={280}
                      placeholder="Cosa ti ha colpito di questo film?"
                      className="resize-none rounded-sm border border-border-strong bg-surface px-3 py-2 text-sm text-text placeholder:text-text-faint focus:border-accent"
                    />
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleSaveRating}
                      disabled={rating === 0}
                      className="rounded-sm px-3.5 py-2 text-sm font-medium transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
                      style={{ background: "var(--accent)", color: "var(--accent-contrast)" }}
                    >
                      Salva
                    </button>
                    {diaryEntry && (
                      <button
                        type="button"
                        onClick={() => {
                          setRating(diaryEntry.rating);
                          setNote(diaryEntry.note ?? "");
                          setEditingRating(false);
                        }}
                        className="rounded-sm border border-border-strong px-3.5 py-2 text-sm font-medium text-text-muted hover:bg-surface-hover"
                      >
                        Annulla
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </div>,
    document.body,
  );
}

export function AnimatedMovieModal() {
  const movie = useSelectedMovie((s) => s.movie);
  const close = useSelectedMovie((s) => s.close);
  return <AnimatePresence>{movie && <MovieModal movie={movie} onClose={close} />}</AnimatePresence>;
}
