import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { useFocusTrap } from "../lib/useFocusTrap";

export function Sheet({
  onClose,
  children,
  titleId,
  maxWidthClass = "max-w-lg",
}: {
  onClose: () => void;
  children: ReactNode;
  titleId: string;
  maxWidthClass?: string;
}) {
  const containerRef = useFocusTrap(onClose);

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
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        initial={{ opacity: 0, y: 32 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 16 }}
        transition={{ type: "spring", stiffness: 320, damping: 30 }}
        className={`relative z-10 flex max-h-[92vh] w-full ${maxWidthClass} flex-col overflow-y-auto rounded-t-lg border border-border bg-surface shadow-[var(--shadow-lg)] sm:rounded-lg`}
      >
        <div className="mx-auto mt-2.5 h-1 w-9 shrink-0 rounded-full bg-border-strong sm:hidden" aria-hidden="true" />
        <button
          type="button"
          onClick={onClose}
          aria-label="Chiudi"
          className="absolute right-3 top-3 z-20 flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-black/45 text-white backdrop-blur-sm hover:scale-110"
        >
          ✕
        </button>
        {children}
      </motion.div>
    </div>,
    document.body,
  );
}
