import type { Status } from "../types";

export const STATUSES: Status[] = [
  "In visione",
  "Visto",
  "Da vedere",
  "In pausa",
  "Abbandonato",
  // Ultimo nella fila perché è il meno "deciso" di tutti: non è una scelta che
  // si prende, è quello che resta quando non ne hai presa nessuna.
  "Sullo scaffale",
];

export const STATUS_META: Record<Status, { color: string; icon: string }> = {
  "In visione": { color: "var(--status-watching)", icon: "▶" },
  Visto: { color: "var(--status-done)", icon: "✓" },
  "Da vedere": { color: "var(--status-planned)", icon: "◷" },
  Abbandonato: { color: "var(--status-dropped)", icon: "✕" },
  "In pausa": { color: "var(--status-hold)", icon: "⏸" },
  "Sullo scaffale": { color: "var(--status-shelf)", icon: "◦" },
};
