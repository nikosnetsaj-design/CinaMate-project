import { create } from "zustand";
import { useLibrary } from "./useLibrary";
import { isRecord, readJson, writeJson } from "../lib/localStore";
import { pairKey, play, type Ratings } from "../lib/elo";

const KEY = "cinemate:duels:v1";
const RECENT = 40;

/**
 * I confronti di «Questo o quello».
 *
 * Si tiene il punteggio di ogni titolo, le ultime coppie (per non riproporle
 * subito) e i voti per cui hai detto «lascia così». Stanno nel backup: sono
 * risposte tue, e nessun calcolo le rifà.
 */
export interface DuelData {
  ratings: Ratings;
  recent: string[];
  count: number;
  /** id → il voto che hai scelto di tenere. Vale finché il voto non cambia. */
  kept: Record<string, number>;
}

const EMPTY: DuelData = { ratings: {}, recent: [], count: 0, kept: {} };

function isDuelData(value: unknown): value is DuelData {
  if (!isRecord(value) || !isRecord(value.ratings) || !Array.isArray(value.recent) || typeof value.count !== "number") return false;
  const ratingsOk = Object.values(value.ratings).every((r) => isRecord(r) && typeof r.elo === "number" && Number.isFinite(r.elo) && typeof r.games === "number");
  const keptOk = value.kept === undefined || (isRecord(value.kept) && Object.values(value.kept).every((v) => typeof v === "number"));
  return ratingsOk && keptOk && value.recent.every((k) => typeof k === "string");
}

interface DuelsState extends DuelData {
  /** `score`: 1 vince `a`, 0 vince `b`, 0.5 pari. */
  vote: (a: string, b: string, score: 0 | 0.5 | 1) => void;
  /** «Lascia così»: questo voto non va più segnalato. */
  keep: (itemId: string, vote: number) => void;
  reset: () => void;
  restore: (value: unknown) => void;
}

function load(): DuelData {
  const data = readJson<DuelData>(KEY, isDuelData, EMPTY);
  return { ...data, kept: data.kept ?? {} };
}

export const useDuels = create<DuelsState>((set, get) => {
  const save = (data: DuelData) => {
    writeJson(KEY, data);
    set(data);
  };
  const data = () => {
    const { ratings, recent, count, kept } = get();
    return { ratings, recent, count, kept };
  };

  return {
    ...load(),

    vote: (a, b, score) => {
      const d = data();
      save({
        ...d,
        ratings: play(d.ratings, a, b, score),
        recent: [pairKey(a, b), ...d.recent.filter((k) => k !== pairKey(a, b))].slice(0, RECENT),
        count: d.count + 1,
      });
    },

    keep: (itemId, vote) => {
      const d = data();
      save({ ...d, kept: { ...d.kept, [itemId]: vote } });
    },

    reset: () => save(EMPTY),

    restore: (value) => {
      if (isDuelData(value)) save({ ...value, kept: value.kept ?? {} });
    },
  };
});

// Un titolo che esce dalla libreria esce anche dalla classifica.
useLibrary.subscribe((state, prev) => {
  if (state.items === prev.items) return;
  const ids = new Set(state.items.map((i) => i.id));
  const d = useDuels.getState();
  const gone = Object.keys(d.ratings).filter((id) => !ids.has(id));
  if (gone.length === 0) return;
  const ratings = { ...d.ratings };
  const kept = { ...d.kept };
  for (const id of gone) {
    delete ratings[id];
    delete kept[id];
  }
  const recent = d.recent.filter((k) => k.split("|").every((id) => ids.has(id)));
  writeJson(KEY, { ratings, recent, count: d.count, kept });
  useDuels.setState({ ratings, recent, kept });
});
