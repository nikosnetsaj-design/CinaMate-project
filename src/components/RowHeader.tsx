import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronRightIcon } from "./icons";

/**
 * L'attacco di una riga: il titolo in serif, il conteggio accanto, una riga
 * che dice perché la riga c'è, e un'azione sola a destra.
 *
 * Ogni riga della Home se lo scriveva da sé — con la barretta d'accento
 * davanti, «· 6» in un corpo diverso da riga a riga, il link scritto in
 * minuscolo come «tutti», «tutte», «profilo», «calendario». Qui è uno, e il
 * link dice cosa fa.
 */
export function RowHeader({
  title,
  count,
  note,
  to,
  action = "Vedi tutti",
  id,
}: {
  title: ReactNode;
  count?: number;
  note?: ReactNode;
  to?: string;
  action?: string;
  id?: string;
}) {
  return (
    <div className="flex items-end justify-between gap-3">
      <div className="min-w-0">
        <h2 id={id} className="t-title text-text">
          {title}
          {count !== undefined && <span className="ml-2 font-sans text-sm font-normal text-text-faint tabular">{count}</span>}
        </h2>
        {note && <p className="mt-1 text-sm text-text-muted">{note}</p>}
      </div>
      {to && (
        <Link to={to} viewTransition className="btn btn-plain btn-sm -mr-3 shrink-0 gap-0.5 font-medium">
          {action}
          <ChevronRightIcon size={16} />
        </Link>
      )}
    </div>
  );
}
