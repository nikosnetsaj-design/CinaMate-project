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

export function StatusChip({ status, size = "md" }: { status: Status; size?: "sm" | "md" }) {
  const meta = STATUS_META[status];
  const cls = size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-[11px]";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border font-semibold whitespace-nowrap ${cls}`}
      style={{ borderColor: `color-mix(in srgb, ${meta.color} 45%, transparent)`, background: `color-mix(in srgb, ${meta.color} 14%, transparent)`, color: meta.color }}
    >
      <StatusMark status={status} />
      {status}
    </span>
  );
}
