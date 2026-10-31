import { RefreshCw, WifiOff } from "lucide-react";
import { t } from "../lib/i18n";

/**
 * Quando qualcosa che arriva dalla rete non arriva.
 *
 * Il fratello di EmptyState, con la stessa forma: un segno, una frase che
 * dice cosa è successo e cosa resta in piedi, e l'unica azione che serve —
 * riprovare. Prima ogni pagina se la cavava a modo suo: una riga di Scopri
 * spariva in silenzio, una ricerca fallita diceva «nessun risultato», che è
 * una risposta falsa a una domanda che nessuno aveva fatto.
 *
 * `compact` è la versione per una riga dentro una pagina che per il resto
 * funziona: una frase e il pulsante, senza occupare lo schermo.
 */
export function ErrorState({
  title = t("error.title"),
  description = t("error.text"),
  onRetry,
  compact = false,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-surface-2 px-4 py-3">
        <p className="min-w-0 flex-1 text-sm text-text-muted">
          <span className="font-medium text-text">{title}.</span> {description}
        </p>
        {onRetry && (
          <button type="button" onClick={onRetry} className="btn btn-secondary btn-sm shrink-0">
            <RefreshCw size={14} strokeWidth={2} aria-hidden="true" />
            {t("common.retry")}
          </button>
        )}
      </div>
    );
  }
  return (
    <div role="alert" className="flex flex-col items-center gap-3 px-6 py-14 text-center">
      <div className="mb-1 grid h-14 w-14 place-items-center rounded-full bg-surface-2 text-text-muted">
        <WifiOff size={24} strokeWidth={1.75} aria-hidden="true" />
      </div>
      <h2 className="t-title text-text">{title}</h2>
      <p className="max-w-[34ch] text-sm text-text-muted">{description}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="btn btn-secondary mt-2">
          {t("common.retry")}
        </button>
      )}
    </div>
  );
}
