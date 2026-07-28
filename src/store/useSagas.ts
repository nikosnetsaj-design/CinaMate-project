import { create } from "zustand";
import { isRecord, readJson, writeJson } from "../lib/localStore";
import type { SagaOrders, WatchOrder } from "../lib/sagas";
import type { TmdbSaga, TmdbSagaPart } from "../lib/tmdb";

const SAGAS_KEY = "cinemate:sagas:v1";
const ORDERS_KEY = "cinemate:saga-orders:v1";
const PREFS_KEY = "cinemate:saga-prefs:v1";

/** Cached universe listings expire: films get added to a world over time. */
const UNIVERSE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type SagaKey = string;
export function sagaKey(collectionId: number): SagaKey {
  return `saga:${collectionId}`;
}
export function universeKey(universeId: string): SagaKey {
  return `universe:${universeId}`;
}

interface UniverseCache {
  parts: TmdbSagaPart[];
  fetchedAt: number;
}

interface Prefs {
  /** Chosen viewing order per saga or universe. */
  order: Record<SagaKey, WatchOrder>;
  /** Sagas the user has hidden from the Saghe page. */
  hidden: SagaKey[];
}

/**
 * Part synopses are never rendered in the saga list, and a large library can
 * hold dozens of sagas — dropping them keeps the cache from eating the storage
 * budget that the library itself needs.
 */
function trimParts(parts: TmdbSagaPart[]): TmdbSagaPart[] {
  return parts.map((p) => ({ ...p, overview: "" }));
}

/** Shallow shape check: enough to reject a corrupted blob, cheap enough to run on every load. */
function everyValueHasArray(value: unknown, field: string): boolean {
  return isRecord(value) && Object.values(value).every((v) => isRecord(v) && Array.isArray(v[field]));
}

function isSagaRecord(value: unknown): value is Record<string, TmdbSaga> {
  return everyValueHasArray(value, "parts");
}
function isUniverseRecord(value: unknown): value is Record<string, UniverseCache> {
  return everyValueHasArray(value, "parts");
}
function isOrdersRecord(value: unknown): value is Record<SagaKey, SagaOrders> {
  return everyValueHasArray(value, "chronological");
}
function isPrefs(value: unknown): value is Prefs {
  return isRecord(value) && isRecord(value.order) && Array.isArray(value.hidden);
}

interface StoredSagas {
  sagas: Record<string, TmdbSaga>;
  universes: Record<string, UniverseCache>;
}

function loadSagas(): StoredSagas {
  const sagas = readJson<Record<string, TmdbSaga>>(SAGAS_KEY, isSagaRecord, {});
  const universes = readJson<Record<string, UniverseCache>>(`${SAGAS_KEY}:universes`, isUniverseRecord, {});
  return { sagas, universes };
}

interface SagasState {
  sagas: Record<string, TmdbSaga>;
  universes: Record<string, UniverseCache>;
  orders: Record<SagaKey, SagaOrders>;
  prefs: Prefs;

  setSaga: (saga: TmdbSaga) => void;
  setUniverse: (universeId: string, parts: TmdbSagaPart[]) => void;
  /** Cached listing, or `null` when absent or stale enough to refetch. */
  freshUniverse: (universeId: string) => TmdbSagaPart[] | null;
  setOrders: (key: SagaKey, orders: SagaOrders) => void;
  setPreferredOrder: (key: SagaKey, order: WatchOrder) => void;
  toggleHidden: (key: SagaKey) => void;
  /** Applies the saga half of a backup. The catalogue cache re-downloads itself. */
  restore: (data: { orders: Record<SagaKey, SagaOrders>; preferredOrder: Record<SagaKey, WatchOrder>; hidden: SagaKey[] }) => void;
  clearAll: () => void;
}

const initialSagas = loadSagas();

export const useSagas = create<SagasState>((set, get) => ({
  sagas: initialSagas.sagas,
  universes: initialSagas.universes,
  orders: readJson<Record<SagaKey, SagaOrders>>(ORDERS_KEY, isOrdersRecord, {}),
  prefs: readJson<Prefs>(PREFS_KEY, isPrefs, { order: {}, hidden: [] }),

  setSaga: (saga) => {
    const next = { ...get().sagas, [String(saga.id)]: { ...saga, parts: trimParts(saga.parts) } };
    writeJson(SAGAS_KEY, next);
    set({ sagas: next });
  },

  setUniverse: (universeId, parts) => {
    const next = { ...get().universes, [universeId]: { parts: trimParts(parts), fetchedAt: Date.now() } };
    writeJson(`${SAGAS_KEY}:universes`, next);
    set({ universes: next });
  },

  freshUniverse: (universeId) => {
    const hit = get().universes[universeId];
    if (!hit || Date.now() - hit.fetchedAt > UNIVERSE_TTL_MS) return null;
    return hit.parts;
  },

  setOrders: (key, orders) => {
    const next = { ...get().orders, [key]: orders };
    writeJson(ORDERS_KEY, next);
    set({ orders: next });
  },

  setPreferredOrder: (key, order) => {
    const prefs = { ...get().prefs, order: { ...get().prefs.order, [key]: order } };
    writeJson(PREFS_KEY, prefs);
    set({ prefs });
  },

  toggleHidden: (key) => {
    const current = get().prefs.hidden;
    const hidden = current.includes(key) ? current.filter((k) => k !== key) : [...current, key];
    const prefs = { ...get().prefs, hidden };
    writeJson(PREFS_KEY, prefs);
    set({ prefs });
  },

  restore: ({ orders, preferredOrder, hidden }) => {
    const prefs: Prefs = { order: preferredOrder, hidden };
    writeJson(ORDERS_KEY, orders);
    writeJson(PREFS_KEY, prefs);
    set({ orders, prefs });
  },

  clearAll: () => {
    writeJson(SAGAS_KEY, {});
    writeJson(`${SAGAS_KEY}:universes`, {});
    writeJson(ORDERS_KEY, {});
    writeJson(PREFS_KEY, { order: {}, hidden: [] });
    set({ sagas: {}, universes: {}, orders: {}, prefs: { order: {}, hidden: [] } });
  },
}));
