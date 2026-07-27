import type { HistoryEntry, Item } from "../types";

export interface DiaryEntry {
  item: Item;
  action: HistoryEntry["action"];
  count: number;
}

export interface DiaryDay {
  date: string;
  entries: DiaryEntry[];
}

export function groupDiary(history: HistoryEntry[], items: Item[]): DiaryDay[] {
  const itemById = new Map(items.map((i) => [i.id, i]));
  const byDate = new Map<string, Map<string, DiaryEntry>>();

  for (const h of history) {
    const item = itemById.get(h.itemId);
    if (!item) continue;
    const dayMap = byDate.get(h.date) ?? new Map<string, DiaryEntry>();
    const key = `${h.itemId}:${h.action}`;
    const existing = dayMap.get(key);
    if (existing) existing.count += 1;
    else dayMap.set(key, { item, action: h.action, count: 1 });
    byDate.set(h.date, dayMap);
  }

  return Array.from(byDate.entries())
    .map(([date, dayMap]) => ({ date, entries: Array.from(dayMap.values()) }))
    .sort((a, b) => b.date.localeCompare(a.date));
}
