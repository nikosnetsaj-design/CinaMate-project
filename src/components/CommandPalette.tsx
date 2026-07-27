import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useLibrary } from "../store/useLibrary";
import { useCommandPalette } from "../store/useCommandPalette";
import { useSelectedItem } from "../store/useSelectedItem";
import { useFocusTrap } from "../lib/useFocusTrap";
import { matchesQuery } from "../lib/search";
import { SearchIcon } from "./icons";

function PaletteDialog() {
  const close = useCommandPalette((s) => s.close);
  const openItem = useSelectedItem((s) => s.open);
  const items = useLibrary((s) => s.items);

  const [query, setQuery] = useState("");
  const [highlighted, setHighlighted] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useFocusTrap(close);

  useEffect(() => {
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  const results = useMemo(() => {
    const q = query.trim();
    if (!q) return items.slice(0, 6);
    return items.filter((m) => matchesQuery(m, q)).slice(0, 8);
  }, [query, items]);

  function select(index: number) {
    const item = results[index];
    if (!item) return;
    openItem(item);
    close();
  }

  return createPortal(
    <div className="fixed inset-0 z-80 flex items-start justify-center px-4 pt-24 sm:pt-32">
      <motion.div
        aria-hidden="true"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
        onClick={close}
      />
      <motion.div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Cerca nella libreria"
        initial={{ opacity: 0, y: -12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -8, scale: 0.98 }}
        transition={{ type: "spring", stiffness: 380, damping: 30 }}
        className="relative z-10 w-full max-w-lg overflow-hidden rounded-md border border-border bg-surface shadow-[var(--shadow-lg)]"
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
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
            placeholder="Cerca per titolo, regista, genere, attore…"
            aria-label="Cerca nella libreria"
            className="flex-1 bg-transparent text-sm text-text placeholder:text-text-faint focus:outline-none"
          />
          <kbd className="rounded-xs border border-border-strong px-1.5 py-0.5 text-[10px] text-text-faint">esc</kbd>
        </div>
        <ul role="listbox" aria-label="Risultati" className="max-h-80 overflow-y-auto py-1.5">
          {results.length === 0 && (
            <li className="px-4 py-6 text-center text-sm text-text-muted">
              Nessun titolo trovato per &ldquo;{query}&rdquo;.
            </li>
          )}
          {results.map((item, i) => (
            <li key={item.id} role="option" aria-selected={i === highlighted}>
              <button
                type="button"
                onMouseEnter={() => setHighlighted(i)}
                onClick={() => select(i)}
                className={`flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm transition-colors ${
                  i === highlighted ? "bg-surface-hover text-text" : "text-text-muted"
                }`}
              >
                <span className="truncate font-medium">{item.title}</span>
                <span className="shrink-0 text-xs text-text-faint">{item.year}</span>
              </button>
            </li>
          ))}
        </ul>
      </motion.div>
    </div>,
    document.body,
  );
}

export function CommandPalette() {
  const isOpen = useCommandPalette((s) => s.isOpen);
  const open = useCommandPalette((s) => s.open);

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

  return <AnimatePresence>{isOpen && <PaletteDialog />}</AnimatePresence>;
}
