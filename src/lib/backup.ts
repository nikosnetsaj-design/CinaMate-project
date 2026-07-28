import type { HistoryEntry, Item } from "../types";
import type { SagaOrders, WatchOrder } from "./sagas";
import { isRecord } from "./localStore";

/**
 * Everything a saga knows that cannot be derived again from TMDB: the viewing
 * orders Claude worked out, which order you chose, and where a marathon stopped.
 * The catalogue half of the cache is deliberately left out — it re-downloads
 * itself, and a backup should stay small enough to read.
 */
export interface SagaBackup {
  orders: Record<string, SagaOrders>;
  preferredOrder: Record<string, WatchOrder>;
  hidden: string[];
  marathon: unknown;
  reminders: { enabled: string[]; notified: Record<string, string> };
}

export interface Backup {
  items: Item[];
  history: HistoryEntry[];
  /** Absent in files written before sagas existed. */
  sagas?: SagaBackup;
}

const CURRENT_VERSION = 3;

export function buildBackup(items: Item[], history: HistoryEntry[], sagas?: SagaBackup): string {
  return JSON.stringify(
    { app: "cinemate", version: CURRENT_VERSION, exportedAt: new Date().toISOString(), items, history, sagas },
    null,
    2,
  );
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

/**
 * Saga extras are a bonus, never a reason to reject a file: anything malformed
 * is dropped and the titles still import.
 */
function parseSagaBackup(value: unknown): SagaBackup | undefined {
  if (!isRecord(value)) return undefined;
  const reminders = isRecord(value.reminders) ? value.reminders : {};
  return {
    orders: isRecord(value.orders) ? (value.orders as Record<string, SagaOrders>) : {},
    preferredOrder: isRecord(value.preferredOrder) ? (value.preferredOrder as Record<string, WatchOrder>) : {},
    hidden: Array.isArray(value.hidden) ? value.hidden.filter((h): h is string => typeof h === "string") : [],
    marathon: value.marathon ?? null,
    reminders: {
      enabled: Array.isArray(reminders.enabled) ? reminders.enabled.filter((e): e is string => typeof e === "string") : [],
      notified: isRecord(reminders.notified) ? (reminders.notified as Record<string, string>) : {},
    },
  };
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
    const record = parsed as { items: unknown[]; history?: unknown; sagas?: unknown };
    const items = record.items.filter(looksLikeItem);
    if (items.length === 0) throw new BackupParseError("Nessun titolo valido trovato nel file.");
    const history = Array.isArray(record.history) ? record.history.filter(looksLikeHistoryEntry) : [];
    // Drop history pointing at titles the backup doesn't contain.
    const ids = new Set(items.map((i) => i.id));
    return {
      items,
      history: history.filter((h) => ids.has(h.itemId)),
      sagas: parseSagaBackup(record.sagas),
    };
  }

  throw new BackupParseError("Il file non sembra un backup di CineMate.");
}
