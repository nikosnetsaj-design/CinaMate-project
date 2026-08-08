import { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { PosterArt } from "./PosterArt";
import { VoteBadge } from "./VoteBadge";
import { StatusChip } from "./StatusChip";
import { HeartIcon } from "./icons";
import { useLibrary } from "../store/useLibrary";
import type { Item } from "../types";
import type { PosterBadge } from "../lib/homeBadges";

/** Sotto questa distanza fra due tocchi, sono un doppio tocco e non due tocchi. */
const DOUBLE_TAP_MS = 300;

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

  const lastTap = useRef(0);
  const pending = useRef<number | null>(null);
  const [burst, setBurst] = useState(false);

  /**
   * Doppio tocco: preferito.
   *
   * Il cuore c'era già (`item.fav`), ma per arrivarci bisognava aprire la
   * scheda, trovare l'azione tonda e tornare indietro: tre tocchi per un
   * gesto che ne vale uno, su una cosa che si fa scorrendo una fila. È il
   * gesto che tutti hanno già imparato altrove, e non aggiunge un pixel
   * all'interfaccia — che è il motivo per cui vale la pena rubarlo.
   *
   * Il tocco singolo aspetta la finestra del doppio prima di aprire la
   * scheda. Sono trecento millisecondi di ritardo su un'apertura, ed è il
   * prezzo onesto: senza attesa, il primo tocco del doppio aprirebbe la
   * scheda e il secondo cadrebbe su un'altra schermata.
   */
  function onTap() {
    const now = Date.now();
    if (now - lastTap.current < DOUBLE_TAP_MS) {
      if (pending.current) window.clearTimeout(pending.current);
      pending.current = null;
      lastTap.current = 0;
      toggleFav(item.id);
      // Il cuore pulsa solo quando il preferito si *accende*: togliere una
      // cosa non merita una festa.
      if (!item.fav) {
        setBurst(true);
        window.setTimeout(() => setBurst(false), 340);
      }
      return;
    }
    lastTap.current = now;
    pending.current = window.setTimeout(() => {
      pending.current = null;
      onOpen(item);
    }, DOUBLE_TAP_MS);
  }

  return (
    <div className="group flex flex-col gap-2">
      <motion.div
        role="button"
        tabIndex={0}
        aria-label={`Apri dettagli di ${item.title}, ${item.year}`}
        onClick={onTap}
        onKeyDown={(e) => {
          // Da tastiera niente doppio tocco: Invio apre, e basta. Un doppio
          // Invio a tempo sarebbe una scorciatoia che nessuno può scoprire.
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onOpen(item);
          }
        }}
        whileHover={{ y: -4 }}
        whileTap={{ scale: 0.98 }}
        transition={{ type: "spring", stiffness: 380, damping: 26 }}
        className="relative cursor-pointer overflow-hidden rounded-sm shadow-[var(--shadow-sm)] transition-shadow duration-200 group-hover:shadow-[var(--shadow-md)]"
      >
        <PosterArt item={item} size="sm" badge={badge} />

        <AnimatePresence>
          {burst && (
            <motion.span
              aria-hidden="true"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1.15 }}
              exit={{ opacity: 0, scale: 1.4 }}
              transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
              className="pointer-events-none absolute inset-0 flex items-center justify-center text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.6)]"
            >
              <HeartIcon size={54} filled />
            </motion.span>
          )}
        </AnimatePresence>
      </motion.div>
      <div className="flex flex-col gap-1 px-0.5">
        <div className="flex items-center gap-1">
          <p className="truncate font-display text-sm font-medium text-text" title={item.title}>
            {item.title}
          </p>
          {item.fav && <HeartIcon size={11} filled />}
        </div>
        <div className="flex items-center justify-between gap-2">
          <StatusChip status={item.status} size="sm" />
          <VoteBadge vote={item.vote} size="sm" />
        </div>
        {progress && pct !== null && (
          <div className="mt-0.5">
            <div className="h-[3px] overflow-hidden rounded-full bg-surface-hover">
              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "var(--status-watching)" }} />
            </div>
            <div className="mt-1 text-[10px] text-text-faint">
              {item.seen || 0}/{item.episodes} episodi
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
