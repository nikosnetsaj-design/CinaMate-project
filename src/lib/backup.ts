import type { HistoryEntry, Item } from "../types";

export interface Backup {
  items: Item[];
  history: HistoryEntry[];
}

const CURRENT_VERSION = 2;

export function buildBackup(items: Item[], history: HistoryEntry[]): string {
  return JSON.stringify({ app: "cinemate", version: CURRENT_VERSION, exportedAt: new Date().toISOString(), items, history }, null, 2);
}

function looksLikeItem(value: unknown): value is Item {
  return (
    !!value &&
    typeof value === "object" &&
    typeof (value as Item).title === "string" &&
    typeof (value as Item).id === "string"
  );
}

function looksLikeHistoryEntry(value: unknown): value is HistoryEntry {
  return (
    !!value &&
    typeof value === "object" &&
    typeof (value as HistoryEntry).itemId === "string" &&
    typeof (value as HistoryEntry).date === "string"
  );
}

export class BackupParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BackupParseError";
  }
}

/**
 * Accepts both the current `{ items, history }` envelope and the bare array
 * written by earlier versions, so an older export never becomes unusable.
 */
export function parseBackup(raw: string): Backup {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new BackupParseError("Il file non è un JSON valido.");
  }

  if (Array.isArray(parsed)) {
    const items = parsed.filter(looksLikeItem);
    if (items.length === 0) throw new BackupParseError("Nessun titolo valido trovato nel file.");
    return { items, history: [] };
  }

  if (parsed && typeof parsed === "object" && Array.isArray((parsed as { items?: unknown }).items)) {
    const record = parsed as { items: unknown[]; history?: unknown };
    const items = record.items.filter(looksLikeItem);
    if (items.length === 0) throw new BackupParseError("Nessun titolo valido trovato nel file.");
    const history = Array.isArray(record.history) ? record.history.filter(looksLikeHistoryEntry) : [];
    // Drop history pointing at titles the backup doesn't contain.
    const ids = new Set(items.map((i) => i.id));
    return { items, history: history.filter((h) => ids.has(h.itemId)) };
  }

  throw new BackupParseError("Il file non sembra un backup di CineMate.");
}
