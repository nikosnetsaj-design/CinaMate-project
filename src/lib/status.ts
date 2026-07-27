import type { Status } from "../types";

export const STATUSES: Status[] = ["In visione", "Visto", "Da vedere", "Abbandonato", "In pausa"];

export const STATUS_META: Record<Status, { color: string; icon: string }> = {
  "In visione": { color: "var(--status-watching)", icon: "▶" },
  Visto: { color: "var(--status-done)", icon: "✓" },
  "Da vedere": { color: "var(--status-planned)", icon: "◷" },
  Abbandonato: { color: "var(--status-dropped)", icon: "✕" },
  "In pausa": { color: "var(--status-hold)", icon: "⏸" },
};
