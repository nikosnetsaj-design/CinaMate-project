import type { HistoryEntry, Item } from "../types";

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function hashSeed(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/**
 * Backfills a plausible watch history from an item's existing fields
 * (status, seen, rewatch, added) so the diary/stats/achievements have real
 * content the first time a library is loaded, instead of starting empty.
 */
export function buildSeedHistory(items: Item[]): HistoryEntry[] {
  const entries: HistoryEntry[] = [];
  let n = 0;
  const push = (item: Item, date: string, action: HistoryEntry["action"]) => {
    entries.push({ id: `seed-h-${++n}`, itemId: item.id, title: item.title, kind: item.kind, date, action });
  };

  for (const item of items) {
    const variance = hashSeed(item.id) % 7;

    if (item.kind === "film" || item.kind === "doc") {
      if (item.status === "Visto") push(item, item.added, "watched");
    } else {
      const seen = item.seen || 0;
      if (seen > 0) {
        const sessions = Math.min(6, Math.max(1, Math.round(seen / 4)));
        let remaining = seen;
        let dayOffset = 0;
        for (let s = 0; s < sessions && remaining > 0; s++) {
          const isLast = s === sessions - 1;
          const count = isLast ? remaining : Math.max(1, Math.round(remaining / (sessions - s)) - (variance % 2));
          const clamped = Math.min(remaining, Math.max(1, count));
          const date = addDays(item.added, -dayOffset);
          for (let e = 0; e < clamped; e++) push(item, date, "episode");
          remaining -= clamped;
          dayOffset += 2 + (variance % 4);
        }
        if (item.status === "Visto") push(item, item.added, "watched");
      }
    }

    for (let r = 0; r < (item.rewatch || 0); r++) {
      push(item, addDays(item.added, 20 + r * 35 + variance), "rewatch");
    }
  }

  return entries.sort((a, b) => a.date.localeCompare(b.date));
}
