import { STATUS_META } from "../lib/status";
import type { Status } from "../types";

export function StatusChip({ status, size = "md" }: { status: Status; size?: "sm" | "md" }) {
  const meta = STATUS_META[status];
  const cls = size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-[11px]";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border font-semibold whitespace-nowrap ${cls}`}
      style={{ borderColor: `color-mix(in srgb, ${meta.color} 45%, transparent)`, background: `color-mix(in srgb, ${meta.color} 14%, transparent)`, color: meta.color }}
    >
      <span aria-hidden="true">{meta.icon}</span>
      {status}
    </span>
  );
}
