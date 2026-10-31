import { useState } from "react";
import { useLongPress } from "../lib/useLongPress";
import { AnimatePresence, m } from "framer-motion";
import { PosterArt } from "./PosterArt";
import { VoteBadge } from "./VoteBadge";
import { StatusChip } from "./StatusChip";
import { HeartIcon } from "./icons";
import { useLibrary } from "../store/useLibrary";
import type { Item } from "../types";
import type { PosterBadge } from "../lib/homeBadges";

export function PosterCard({
  item,
  onOpen,
  progress = false,
  badge,
}: {
  item: Item;
  onOpen: (item: Item) => void;
  progress?: boolean;
  /** La pastiglia sulla copertina — vedi lib/homeBadges. */
  badge?: PosterBadge;
}) {
  const pct = item.kind !== "film" && item.episodes ? Math.round(((item.seen || 0) / item.episodes) * 100) : null;
  const toggleFav = useLibrary((s) => s.toggleFav);

  const [burst, setBurst] = useState(false);

  /**
   * Tocco: apre, subito. Pressione lunga: preferito.
   *
   * Il preferito era sul doppio tocco, e il prezzo era che *ogni* tocco
   * singolo aspettava trecento millisecondi per vedere se ne arrivava un
   * secondo: l'apertura di una scheda, cioè il gesto più frequente dell'app,
   * sembrava sempre un po' lenta. Con la pressione lunga il tocco non aspetta
   * niente. La pressione lunga ha anche le sue strade da tastiera e da mouse
   * (Maiuscolo + clic, menu contestuale), che il doppio tocco non aveva.
   */
  function favourite() {
    toggleFav(item.id);
    // Il cuore pulsa solo quando il preferito si *accende*: togliere una cosa
    // non merita una festa.
    if (!item.fav) {
      setBurst(true);
      window.setTimeout(() => setBurst(false), 340);
    }
  }
  const press = useLongPress(() => onOpen(item), favourite);

  return (
    <div className="group flex flex-col gap-2">
      <m.div
        role="button"
        tabIndex={0}
        aria-label={`Apri dettagli di ${item.title}, ${item.year}`}
        aria-description={item.fav ? "Fra i preferiti. Maiuscolo + Invio lo toglie." : "Maiuscolo + Invio lo mette fra i preferiti."}
        {...press}
        onKeyDown={(e) => {
          // Invio apre; Maiuscolo + Invio è la pressione lunga della tastiera.
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (e.shiftKey) favourite();
            else onOpen(item);
          }
        }}
        whileHover={{ y: -2 }}
        whileTap={{ scale: 0.98 }}
        transition={{ type: "spring", stiffness: 420, damping: 36 }}
        className="relative cursor-pointer overflow-hidden rounded-sm shadow-[var(--shadow-sm)] transition-shadow duration-200 group-hover:shadow-[var(--shadow-md)]"
      >
        <PosterArt item={item} size="sm" badge={badge} />

        <AnimatePresence>
          {burst && (
            <m.span
              aria-hidden="true"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1.15 }}
              exit={{ opacity: 0, scale: 1.4 }}
              transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
              className="pointer-events-none absolute inset-0 flex items-center justify-center text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.6)]"
            >
              <HeartIcon size={54} filled />
            </m.span>
          )}
        </AnimatePresence>
      </m.div>
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-sm font-medium text-text" title={item.title}>
            {item.title}
          </p>
          {item.fav && (
            <span className="shrink-0 text-accent-text" role="img" aria-label="Preferito">
              <HeartIcon size={12} filled />
            </span>
          )}
        </div>
        <div className="flex h-5 items-center justify-between gap-2">
          <StatusChip status={item.status} size="sm" />
          <VoteBadge vote={item.vote} size="sm" />
        </div>
        {progress && pct !== null && (
          <div className="mt-0.5">
            <div className="h-[3px] overflow-hidden rounded-full bg-surface-hover">
              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "var(--accent)" }} />
            </div>
            <div className="mt-1 text-xs tabular text-text-faint">
              {item.seen || 0}/{item.episodes} episodi
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
