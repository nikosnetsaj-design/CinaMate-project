import { create } from "zustand";
import { useLibrary } from "./useLibrary";
import { isRecord, readJson, writeJson } from "../lib/localStore";
import { isSort, type ShelfQuery } from "../lib/listing";
import type { Filters } from "../lib/filters";

const KEY = "cinemate:lists:v1";

/**
 * Le liste personali.
 *
 * Due specie, una sola forma sullo schermo:
 *
 * - una **lista** è una scelta: titoli messi lì a mano, nell'ordine che dici
 *   tu («Da vedere col partner»);
 * - una **lista intelligente** è una domanda: un filtro della Libreria salvato
 *   con un nome («Horror di ottobre sotto le due ore»), che si aggiorna da
 *   sola perché la risposta si ricalcola ogni volta.
 *
 * Stanno nel backup come tutto ciò che hai scritto a mano. Sono piccole — id
 * e un nome — quindi stanno in localStorage, accanto agli obiettivi.
 */
export interface ManualList {
  id: string;
  kind: "manual";
  name: string;
  itemIds: string[];
  createdAt: string;
}

export interface SmartList {
  id: string;
  kind: "smart";
  name: string;
  query: ShelfQuery;
  createdAt: string;
}

export type PersonalList = ManualList | SmartList;

function isFilters(value: unknown): value is Filters {
  return isRecord(value);
}

function isList(value: unknown): value is PersonalList {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.name !== "string") return false;
  if (value.kind === "manual") return Array.isArray(value.itemIds) && value.itemIds.every((id) => typeof id === "string");
  if (value.kind === "smart") {
    const q = value.query;
    return isRecord(q) && isFilters(q.filters) && isSort(q.sort) && (q.q === undefined || typeof q.q === "string");
  }
  return false;
}

function isListArray(value: unknown): value is PersonalList[] {
  return Array.isArray(value) && value.every(isList);
}

function newId(): string {
  return `lista-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Un nome che non c'è già: «Da vedere», poi «Da vedere 2». */
export function freeName(lists: PersonalList[], base: string): string {
  const taken = new Set(lists.map((l) => l.name.trim().toLowerCase()));
  if (!taken.has(base.trim().toLowerCase())) return base.trim();
  for (let n = 2; ; n++) {
    const candidate = `${base.trim()} ${n}`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
}

function move<T>(list: T[], index: number, delta: -1 | 1): T[] {
  const target = index + delta;
  if (index < 0 || target < 0 || target >= list.length) return list;
  const next = [...list];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

interface ListsState {
  lists: PersonalList[];
  createManual: (name: string, itemIds?: string[]) => string;
  createSmart: (name: string, query: ShelfQuery) => string;
  rename: (id: string, name: string) => void;
  remove: (id: string) => void;
  /** Sposta una lista in su o in giù nell'elenco delle liste. */
  moveList: (id: string, delta: -1 | 1) => void;
  toggleItem: (listId: string, itemId: string) => void;
  moveItem: (listId: string, itemId: string, delta: -1 | 1) => void;
  /** Toglie da ogni lista un titolo uscito dalla libreria. */
  forgetItem: (itemId: string) => void;
  restore: (value: unknown) => void;
}

export const useLists = create<ListsState>((set, get) => {
  const save = (lists: PersonalList[]) => {
    writeJson(KEY, lists);
    set({ lists });
  };
  const update = (id: string, fn: (list: PersonalList) => PersonalList) =>
    save(get().lists.map((l) => (l.id === id ? fn(l) : l)));

  return {
    lists: readJson<PersonalList[]>(KEY, isListArray, []),

    createManual: (name, itemIds = []) => {
      const id = newId();
      const list: ManualList = { id, kind: "manual", name: freeName(get().lists, name || "Nuova lista"), itemIds, createdAt: today() };
      save([...get().lists, list]);
      return id;
    },

    createSmart: (name, query) => {
      const id = newId();
      const list: SmartList = { id, kind: "smart", name: freeName(get().lists, name || "Lista intelligente"), query, createdAt: today() };
      save([...get().lists, list]);
      return id;
    },

    rename: (id, name) => {
      const clean = name.trim();
      if (!clean) return;
      update(id, (l) => ({ ...l, name: clean }));
    },

    remove: (id) => save(get().lists.filter((l) => l.id !== id)),

    moveList: (id, delta) => {
      const lists = get().lists;
      save(move(lists, lists.findIndex((l) => l.id === id), delta));
    },

    toggleItem: (listId, itemId) =>
      update(listId, (l) =>
        l.kind !== "manual"
          ? l
          : { ...l, itemIds: l.itemIds.includes(itemId) ? l.itemIds.filter((i) => i !== itemId) : [...l.itemIds, itemId] },
      ),

    moveItem: (listId, itemId, delta) =>
      update(listId, (l) => (l.kind !== "manual" ? l : { ...l, itemIds: move(l.itemIds, l.itemIds.indexOf(itemId), delta) })),

    forgetItem: (itemId) => {
      const lists = get().lists;
      if (!lists.some((l) => l.kind === "manual" && l.itemIds.includes(itemId))) return;
      save(lists.map((l) => (l.kind === "manual" ? { ...l, itemIds: l.itemIds.filter((i) => i !== itemId) } : l)));
    },

    restore: (value) => {
      if (isListArray(value)) save(value);
    },
  };
});

/*
 * Un titolo che esce dalla libreria esce anche dalle liste: altrimenti una
 * lista resterebbe con dei buchi che nessuno può più aprire né togliere.
 */
useLibrary.subscribe((state, prev) => {
  if (state.items === prev.items || state.items.length >= prev.items.length) return;
  const alive = new Set(state.items.map((i) => i.id));
  for (const item of prev.items) if (!alive.has(item.id)) useLists.getState().forgetItem(item.id);
});
