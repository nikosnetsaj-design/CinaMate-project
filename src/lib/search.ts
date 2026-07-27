import type { Item } from "../types";

/**
 * Shared matcher so the command palette and the library filter stay in sync —
 * a query that finds a title in one place finds it in the other.
 */
export function matchesQuery(item: Item, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    item.title.toLowerCase().includes(q) ||
    item.director.toLowerCase().includes(q) ||
    item.genre.toLowerCase().includes(q) ||
    item.notes.toLowerCase().includes(q) ||
    item.cast.some((c) => c.toLowerCase().includes(q))
  );
}
