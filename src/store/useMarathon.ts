import { create } from "zustand";
import { isRecord, readJson, removeKey, writeJson } from "../lib/localStore";
import type { WatchOrder } from "../lib/sagas";
import type { SagaKey } from "./useSagas";

const KEY = "cinemate:marathon:v1";

/**
 * A marathon is a queue with a bookmark, not a playlist: CineMate does not play
 * anything. Starting one fixes the order you chose so that later re-sorting the
 * saga page cannot silently move you to a different next chapter, and the
 * bookmark survives reloads so a saga watched over three weeks stays one run.
 */
export interface Marathon {
  key: SagaKey;
  name: string;
  posterPath: string | null;
  order: WatchOrder;
  /** TMDB ids, frozen in the chosen order at the moment the run started. */
  queue: number[];
  /** Position of the chapter currently up next. */
  index: number;
  startedAt: number;
}

function isMarathon(value: unknown): value is Marathon {
  return (
    isRecord(value) &&
    typeof value.key === "string" &&
    typeof value.name === "string" &&
    Array.isArray(value.queue) &&
    value.queue.every((v) => typeof v === "number") &&
    typeof value.index === "number"
  );
}

interface MarathonState {
  marathon: Marathon | null;
  start: (marathon: Omit<Marathon, "startedAt">) => void;
  /** Moves the bookmark; clamped so it can never point past the queue. */
  goTo: (index: number) => void;
  advance: () => void;
  stop: () => void;
  /** Applies a marathon from a backup, ignoring anything that is not one. */
  restore: (value: unknown) => void;
}

export const useMarathon = create<MarathonState>((set, get) => ({
  marathon: readJson<Marathon | null>(KEY, (v): v is Marathon | null => v === null || isMarathon(v), null),

  start: (marathon) => {
    const next: Marathon = { ...marathon, startedAt: Date.now() };
    writeJson(KEY, next);
    set({ marathon: next });
  },

  goTo: (index) => {
    const current = get().marathon;
    if (!current) return;
    const next = { ...current, index: Math.max(0, Math.min(current.queue.length - 1, index)) };
    writeJson(KEY, next);
    set({ marathon: next });
  },

  advance: () => {
    const current = get().marathon;
    if (!current) return;
    // Past the last chapter the run is over: keeping a dangling bookmark would
    // leave the bar advertising a chapter that does not exist.
    if (current.index + 1 >= current.queue.length) {
      removeKey(KEY);
      set({ marathon: null });
      return;
    }
    const next = { ...current, index: current.index + 1 };
    writeJson(KEY, next);
    set({ marathon: next });
  },

  stop: () => {
    removeKey(KEY);
    set({ marathon: null });
  },

  restore: (value) => {
    if (!isMarathon(value)) {
      removeKey(KEY);
      set({ marathon: null });
      return;
    }
    writeJson(KEY, value);
    set({ marathon: value });
  },
}));
