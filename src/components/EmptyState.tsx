import type { ReactNode } from "react";
import { Popcorn } from "lucide-react";

/**
 * Lo stato vuoto: un invito, non un riquadro da riempire.
 *
 * Era una cornice tratteggiata, cioè il disegno di un segnaposto — la cosa che
 * si lascia nei prototipi per ricordarsi che lì va qualcosa. Ora è una pausa
 * nella pagina: un'icona in un cerchio, un titolo, una riga, un'azione.
 */
export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
      <div className="mb-1 grid h-14 w-14 place-items-center rounded-full bg-surface-2 text-text-muted">
        {icon ?? <Popcorn size={24} strokeWidth={1.75} aria-hidden="true" />}
      </div>
      <h3 className="t-title text-text">{title}</h3>
      <p className="max-w-[34ch] text-sm text-text-muted">{description}</p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
