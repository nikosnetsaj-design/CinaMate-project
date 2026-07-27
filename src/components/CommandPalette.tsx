import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { MOVIES } from "../data/movies";
import { useCommandPalette } from "../store/useCommandPalette";
import { useSelectedMovie } from "../store/useSelectedMovie";
import { SearchIcon } from "./icons";

export function CommandPalette() {
  const isOpen = useCommandPalette((s) => s.isOpen);
  const open = useCommandPalette((s) => s.open);
  const close = useCommandPalette((s) => s.close);
  const openMovie = useSelectedMovie((s) => s.open);

  const [query, setQuery] = useState("");
  const [highlighted, setHighlighted] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleGlobalKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        open();
      }
    }
    document.addEventListener("keydown", handleGlobalKeyDown);
    return () => document.removeEventListener("keydown", handleGlobalKeyDown);
  }, [open]);

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setHighlighted(0);
      requestAnimationFrame(() => inputRef.current?.focus());
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return MOVIES.slice(0, 6);
    return MOVIES.filter(
      (m) => m.title.toLowerCase().includes(q) || m.director.toLowerCase().includes(q),
    ).slice(0, 8);
  }, [query]);

  function select(index: number) {
    const movie = results[index];
    if (!movie) return;
    openMovie(movie);
    close();
  }

  if (!isOpen) return null;

  return createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 z-80 flex items-start justify-center px-4 pt-24 sm:pt-32">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
          onClick={close}
        />
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label="Cerca film"
          initial={{ opacity: 0, y: -12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.98 }}
          transition={{ type: "spring", stiffness: 380, damping: 30 }}
          className="relative z-10 w-full max-w-lg overflow-hidden rounded-md border border-border bg-surface shadow-[var(--shadow-lg)]"
          onKeyDown={(e) => {
            if (e.key === "Escape") close();
            else if (e.key === "ArrowDown") {
              e.preventDefault();
              setHighlighted((i) => Math.min(i + 1, results.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setHighlighted((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              select(highlighted);
            }
          }}
        >
          <div className="flex items-center gap-2.5 border-b border-border px-4 py-3">
            <SearchIcon />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setHighlighted(0);
              }}
              placeholder="Cerca per titolo o regista…"
              aria-label="Cerca film"
              className="flex-1 bg-transparent text-sm text-text placeholder:text-text-faint focus:outline-none"
            />
            <kbd className="rounded-xs border border-border-strong px-1.5 py-0.5 text-[10px] text-text-faint">
              esc
            </kbd>
          </div>
          <ul role="listbox" aria-label="Risultati" className="max-h-80 overflow-y-auto py-1.5">
            {results.length === 0 && (
              <li className="px-4 py-6 text-center text-sm text-text-muted">
                Nessun film trovato per &ldquo;{query}&rdquo;.
              </li>
            )}
            {results.map((movie, i) => (
              <li key={movie.id} role="option" aria-selected={i === highlighted}>
                <button
                  type="button"
                  onMouseEnter={() => setHighlighted(i)}
                  onClick={() => select(i)}
                  className={`flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm transition-colors ${
                    i === highlighted ? "bg-surface-hover text-text" : "text-text-muted"
                  }`}
                >
                  <span className="truncate font-medium">{movie.title}</span>
                  <span className="shrink-0 text-xs text-text-faint">{movie.year}</span>
                </button>
              </li>
            ))}
          </ul>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body,
  );
}
