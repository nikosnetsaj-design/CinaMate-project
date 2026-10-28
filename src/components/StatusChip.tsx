import { STATUS_META } from "../lib/status";
import type { Status } from "../types";

/**
 * Il segno dello stato: un punto, nella forma oltre che nel colore.
 *
 * Erano cinque caratteri (▶ ✓ ◷ ✕ ⏸), disegnati dal carattere di sistema e
 * diversi su ogni telefono. Ora un punto pieno per gli stati che hanno un
 * colore loro, un cerchio vuoto per «da vedere» (non ancora cominciato) e un
 * trattino per «abbandonato» (si è fermato): chi non distingue i colori
 * distingue comunque le forme.
 */
export function StatusMark({ status }: { status: Status }) {
  const color = STATUS_META[status].color;
  if (status === "Da vedere") {
    return <span aria-hidden="true" className="h-[7px] w-[7px] shrink-0 rounded-full" style={{ boxShadow: `inset 0 0 0 1.5px ${color}` }} />;
  }
  if (status === "Abbandonato") {
    return <span aria-hidden="true" className="h-[2px] w-2 shrink-0 rounded-full" style={{ background: color }} />;
  }
  return <span aria-hidden="true" className="h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: color }} />;
}

/**
 * Lo stato di un titolo: il segno e la parola, in grigio.
 *
 * Era una pastiglia con bordo, riempimento e testo nel colore dello stato:
 * cinque colori pieni sotto ogni copertina, in gara con le copertine stesse.
 * Il colore resta nel segno, che è piccolo; la parola è testo secondario.
 */
export function StatusChip({ status, size = "md" }: { status: Status; size?: "sm" | "md" }) {
  const cls = size === "sm" ? "gap-1.5 text-xs" : "gap-2 text-sm";
  return (
    <span className={`inline-flex items-center whitespace-nowrap font-medium text-text-muted ${cls}`}>
      <StatusMark status={status} />
      {status}
    </span>
  );
}
