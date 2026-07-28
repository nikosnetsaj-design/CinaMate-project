import { AnimatePresence, motion } from "framer-motion";
import { useLibrary } from "../store/useLibrary";
import type { ToastKind } from "../types";

const KIND_STYLES: Record<ToastKind, { bg: string; text: string; icon: string }> = {
  success: { bg: "var(--cyan)", text: "var(--cyan-contrast)", icon: "✓" },
  error: { bg: "var(--danger)", text: "var(--danger-contrast)", icon: "!" },
  info: { bg: "var(--surface-2)", text: "var(--text)", icon: "•" },
};

export function ToastStack() {
  const toasts = useLibrary((s) => s.toasts);
  const dismissToast = useLibrary((s) => s.dismissToast);

  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-50 flex flex-col items-center gap-2 px-4 sm:bottom-6 sm:items-end sm:px-6"
    >
      <AnimatePresence initial={false}>
        {toasts.map((toast) => {
          const style = KIND_STYLES[toast.kind];
          return (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, y: 12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 420, damping: 32 }}
              className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-md border border-border-strong px-4 py-3 shadow-[var(--shadow-lg)]"
              style={{ background: style.bg, color: style.text }}
            >
              <span
                aria-hidden="true"
                className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
                style={{ background: style.text, color: style.bg }}
              >
                {style.icon}
              </span>
              <p className="flex-1 text-sm leading-snug">{toast.text}</p>
              <button
                type="button"
                onClick={() => dismissToast(toast.id)}
                aria-label="Chiudi notifica"
                className="shrink-0 text-sm opacity-70 transition-opacity hover:opacity-100"
              >
                ✕
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
