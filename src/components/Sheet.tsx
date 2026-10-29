import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { useFocusTrap } from "../lib/useFocusTrap";
import { CloseIcon } from "./icons";

/**
 * Il foglio: la stanza accanto, non una finestra che salta fuori.
 *
 * Sul telefono sale dal basso con una molla che non rimbalza, sul computer
 * compare al centro. Niente bordo intorno — lo stacca dal fondo la superficie
 * più chiara e un'ombra lunga — e la × è un bottone tondo pieno, non un
 * carattere: la stessa icona di ogni altra chiusura dell'app.
 */
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
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        className="absolute inset-0"
        style={{ background: "var(--scrim)" }}
        onClick={onClose}
      />
      <motion.div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 24, transition: { duration: 0.2, ease: [0.65, 0, 0.35, 1] } }}
        transition={{ type: "spring", stiffness: 420, damping: 40 }}
        className={`relative z-10 flex max-h-[92dvh] w-full ${maxWidthClass} flex-col overflow-y-auto overscroll-contain rounded-t-lg bg-surface pb-[env(safe-area-inset-bottom)] shadow-[var(--shadow-lg)] sm:rounded-lg sm:pb-0`}
      >
        <div className="mx-auto mt-2 h-[5px] w-9 shrink-0 rounded-full bg-border-strong opacity-60 sm:hidden" aria-hidden="true" />
        <button
          type="button"
          onClick={onClose}
          aria-label="Chiudi"
          className="icon-btn icon-btn-sm icon-btn-filled absolute right-3 top-3 z-20"
        >
          <CloseIcon size={16} />
        </button>
        {children}
      </motion.div>
    </div>,
    document.body,
  );
}
