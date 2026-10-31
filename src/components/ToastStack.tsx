import type { ReactNode } from "react";
import { AnimatePresence, m } from "framer-motion";
import { useLibrary } from "../store/useLibrary";
import type { ToastKind } from "../types";
import { CloseIcon, ErrorIcon, InfoIcon, SuccessIcon } from "./icons";

/*
 * L'avviso è vetro, non un blocco di colore: il testo resta nel colore del
 * testo e l'esito lo dice l'icona. Un avviso tutto rosso, o tutto ciano, era la
 * cosa più accesa dello schermo per tre secondi — più della locandina appena
 * aggiunta di cui stava parlando.
 */
const KIND_STYLES: Record<ToastKind, { tone: string; icon: ReactNode }> = {
  success: { tone: "var(--success)", icon: <SuccessIcon /> },
  error: { tone: "var(--danger)", icon: <ErrorIcon /> },
  info: { tone: "var(--text-muted)", icon: <InfoIcon size={16} /> },
};

export function ToastStack() {
  const toasts = useLibrary((s) => s.toasts);
  const dismissToast = useLibrary((s) => s.dismissToast);

  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-50 flex flex-col items-center gap-2 px-4 lg:bottom-6 lg:items-end lg:px-6"
    >
      <AnimatePresence initial={false}>
        {toasts.map((toast) => {
          const style = KIND_STYLES[toast.kind];
          return (
            <m.div
              key={toast.id}
              layout
              initial={{ opacity: 0, y: 12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 420, damping: 40 }}
              className="pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-md py-1.5 pl-4 pr-1.5 text-text shadow-[var(--shadow-md)] backdrop-blur-xl backdrop-saturate-150"
              style={{ background: "var(--material)", boxShadow: "var(--shadow-md), 0 0 0 1px var(--separator)" }}
            >
              <span aria-hidden="true" className="flex shrink-0" style={{ color: style.tone }}>
                {style.icon}
              </span>
              <p className="flex-1 py-2 text-sm leading-snug">{toast.text}</p>
              <button
                type="button"
                onClick={() => dismissToast(toast.id)}
                aria-label="Chiudi notifica"
                className="icon-btn icon-btn-sm"
              >
                <CloseIcon size={14} />
              </button>
            </m.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
