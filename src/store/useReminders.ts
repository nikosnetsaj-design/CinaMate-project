import { create } from "zustand";
import { isRecord, readJson, writeJson } from "../lib/localStore";

const KEY = "cinemate:reminders:v1";

/**
 * Reminders are local and best-effort by design. There is no server to push
 * from, so the app checks the dates it already has whenever it is opened and
 * raises a system notification for anything that landed since last time. The
 * `notified` map is what keeps a release from being announced twice.
 */
interface Reminders {
  /** Item ids the user asked to be reminded about. */
  enabled: string[];
  /** Item id -> the air/release date already announced. */
  notified: Record<string, string>;
}

function isReminders(value: unknown): value is Reminders {
  return isRecord(value) && Array.isArray(value.enabled) && isRecord(value.notified);
}

interface RemindersState extends Reminders {
  isEnabled: (itemId: string) => boolean;
  toggle: (itemId: string) => boolean;
  markNotified: (itemId: string, date: string) => void;
  wasNotified: (itemId: string, date: string) => boolean;
  restore: (data: Reminders) => void;
  clearAll: () => void;
}

const initial = readJson<Reminders>(KEY, isReminders, { enabled: [], notified: {} });

export const useReminders = create<RemindersState>((set, get) => ({
  ...initial,

  isEnabled: (itemId) => get().enabled.includes(itemId),

  toggle: (itemId) => {
    const on = !get().enabled.includes(itemId);
    const enabled = on ? [...get().enabled, itemId] : get().enabled.filter((id) => id !== itemId);
    writeJson(KEY, { enabled, notified: get().notified });
    set({ enabled });
    return on;
  },

  markNotified: (itemId, date) => {
    const notified = { ...get().notified, [itemId]: date };
    writeJson(KEY, { enabled: get().enabled, notified });
    set({ notified });
  },

  wasNotified: (itemId, date) => get().notified[itemId] === date,

  restore: ({ enabled, notified }) => {
    writeJson(KEY, { enabled, notified });
    set({ enabled, notified });
  },

  clearAll: () => {
    writeJson(KEY, { enabled: [], notified: {} });
    set({ enabled: [], notified: {} });
  },
}));
