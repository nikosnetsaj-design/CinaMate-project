import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { createPortal } from "react-dom";
import { useFocusTrap } from "../lib/useFocusTrap";
import { useLibrary } from "../store/useLibrary";
import { useSelectedItem } from "../store/useSelectedItem";
import { PosterArt } from "./PosterArt";
import { DiceIcon } from "./icons";
import type { Item } from "../types";

function pickRandom(items: Item[]): Item | null {
  const pool = items.filter((i) => i.status === "Da vedere");
  const source = pool.length > 0 ? pool : items;
  if (source.length === 0) return null;
  return source[Math.floor(Math.random() * source.length)];
}

function PickerModal({ onClose }: { onClose: () => void }) {
  const items = useLibrary((s) => s.items);
  const openItem = useSelectedItem((s) => s.open);
  const [pick, setPick] = useState<Item | null>(() => pickRandom(items));
  const [spinKey, setSpinKey] = useState(0);
  const containerRef = useFocusTrap(onClose);
  const titleId = "night-picker-title";

  function respin() {
    setPick(pickRandom(items));
    setSpinKey((k) => k + 1);
  }

  return createPortal(
    <div className="fixed inset-0 z-70 flex items-center justify-center p-6">
      <motion.div
        aria-hidden="true"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ type: "spring", stiffness: 320, damping: 28 }}
        className="relative z-10 w-full max-w-xs rounded-lg border border-border bg-surface p-6 text-center shadow-[var(--shadow-lg)]"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Chiudi"
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full border border-border-strong text-text-muted"
        >
          ✕
        </button>
        <h2 id={titleId} className="font-display text-lg font-semibold text-text">
          Cosa guardo stasera?
        </h2>
        {pick ? (
          <AnimatePresence mode="wait">
            <motion.div
              key={spinKey}
              initial={{ opacity: 0, y: 10, rotate: -3 }}
              animate={{ opacity: 1, y: 0, rotate: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ type: "spring", stiffness: 260, damping: 20 }}
              className="mt-4 flex flex-col items-center gap-2.5"
            >
              <PosterArt item={pick} size="lg" showTitle={false} className="w-32" />
              <p className="font-display text-base font-semibold text-text">{pick.title}</p>
              <p className="text-xs text-text-faint">
                {pick.year} · {pick.genre}
              </p>
            </motion.div>
          </AnimatePresence>
        ) : (
          <p className="mt-4 text-sm text-text-faint">Aggiungi qualche titolo alla watchlist per iniziare.</p>
        )}
        {pick && (
          <div className="mt-5 flex gap-2.5">
            <button
              type="button"
              onClick={respin}
              className="flex-1 rounded-sm border border-border-strong py-2.5 text-sm text-text-muted"
            >
              Un altro
            </button>
            <button
              type="button"
              onClick={() => {
                openItem(pick);
                onClose();
              }}
              className="flex-1 rounded-sm py-2.5 text-sm font-semibold"
              style={{ background: "var(--accent)", color: "var(--accent-contrast)" }}
            >
              Guarda ora
            </button>
          </div>
        )}
      </motion.div>
    </div>,
    document.body,
  );
}

export function NightPickerButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-full border border-border-strong px-3 py-1.5 text-xs font-medium text-text-muted transition-colors hover:text-text"
      >
        <DiceIcon size={14} />
        Cosa guardo stasera?
      </button>
      <AnimatePresence>{open && <PickerModal onClose={() => setOpen(false)} />}</AnimatePresence>
    </>
  );
}
