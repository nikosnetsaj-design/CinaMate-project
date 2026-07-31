import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useSagas } from "../store/useSagas";
import { useCommandPalette } from "../store/useCommandPalette";
import { useSelectedItem } from "../store/useSelectedItem";
import { useSelectedSaga } from "../store/useSelectedSaga";
import { useSelectedPerson } from "../store/useSelectedPerson";
import { useFocusTrap } from "../lib/useFocusTrap";
import { GROUP_LABELS, smartSearch, type SearchGroup, type SearchHit } from "../lib/search";
import { PersonIcon, SearchIcon, StackIcon } from "./icons";
import { useVisibleItems } from "../lib/useVisibleItems";

const GROUP_ORDER: SearchGroup[] = ["titolo", "saga", "persona"];

function GroupIcon({ group }: { group: SearchGroup }) {
  if (group === "saga") return <StackIcon size={14} />;
  if (group === "persona") return <PersonIcon size={14} />;
  return null;
}

function PaletteDialog() {
  const close = useCommandPalette((s) => s.close);
  const openItem = useSelectedItem((s) => s.open);
  const openSaga = useSelectedSaga((s) => s.open);
  const openPerson = useSelectedPerson((s) => s.open);
  const items = useVisibleItems();
  const sagas = useSagas((s) => s.sagas);

  const [query, setQuery] = useState("");
  const [highlighted, setHighlighted] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useFocusTrap(close);

  useEffect(() => {
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  /** Empty query shows the shelf itself: the six most recent titles. */
  const results = useMemo<SearchHit[]>(() => {
    if (!query.trim()) {
      return items.slice(0, 6).map((item) => ({
        group: "titolo" as const,
        id: `titolo:${item.id}`,
        label: item.title,
        sublabel: [item.year, item.genre, item.status].filter(Boolean).join(" · "),
        item,
      }));
    }
    return smartSearch(query, items, sagas);
  }, [query, items, sagas]);

  // Rendered by group, navigated as one flat list: arrow keys should never have
  // to know that a heading sits between two rows.
  const grouped = GROUP_ORDER.map((group) => ({
    group,
    hits: results.filter((r) => r.group === group),
  })).filter((g) => g.hits.length > 0);

  function select(index: number) {
    const hit = results[index];
    if (!hit) return;
    close();
    if (hit.item) openItem(hit.item);
    else if (hit.sagaKey) openSaga(hit.sagaKey);
    else if (hit.personName) openPerson(hit.personName);
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
            placeholder="Titolo, saga, attore, regista, genere…"
            aria-label="Cerca nella libreria"
            className="flex-1 bg-transparent text-sm text-text placeholder:text-text-faint focus:outline-none"
          />
          <kbd className="rounded-xs border border-border-strong px-1.5 py-0.5 text-[10px] text-text-faint">esc</kbd>
        </div>

        <ul role="listbox" aria-label="Risultati" className="max-h-80 overflow-y-auto py-1.5">
          {results.length === 0 && (
            <li className="px-4 py-6 text-center text-sm text-text-muted">
              Nessun risultato per &ldquo;{query}&rdquo;.
            </li>
          )}
          {grouped.map(({ group, hits }) => (
            <li key={group}>
              <p className="px-4 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-faint">
                {GROUP_LABELS[group]}
              </p>
              <ul>
                {hits.map((hit) => {
                  const index = results.indexOf(hit);
                  const active = index === highlighted;
                  return (
                    <li key={hit.id} role="option" aria-selected={active}>
                      <button
                        type="button"
                        onMouseEnter={() => setHighlighted(index)}
                        onClick={() => select(index)}
                        className={`flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm transition-colors ${
                          active ? "bg-surface-hover text-text" : "text-text-muted"
                        }`}
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <GroupIcon group={hit.group} />
                          <span className="truncate font-medium">{hit.label}</span>
                        </span>
                        <span className="shrink-0 truncate text-xs text-text-faint">{hit.sublabel}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
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
