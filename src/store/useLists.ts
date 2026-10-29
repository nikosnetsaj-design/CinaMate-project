import { create } from "zustand";
import { readJson, writeJson } from "../lib/localStore";
import { localDay } from "../lib/day";
import { cleanListName, moveId, readLists, type UserList } from "../lib/lists";

const KEY = "cinemate:lists:v1";

interface ListsState {
  lists: UserList[];
  /** Crea una lista e ne restituisce l'id; `null` se il nome è vuoto. */
  create: (name: string, itemIds?: string[]) => string | null;
  rename: (id: string, name: string) => void;
  remove: (id: string) => void;
  /** Mette o toglie un titolo: il gesto delle pastiglie nella scheda. */
  toggleItem: (listId: string, itemId: string) => void;
  addItems: (listId: string, itemIds: string[]) => void;
  removeItem: (listId: string, itemId: string) => void;
  /** Sposta un titolo di un posto in su (`-1`) o in giù (`+1`). */
  move: (listId: string, itemId: string, delta: number) => void;
  restore: (value: unknown) => void;
  clearAll: () => void;
}

function persist(lists: UserList[]): UserList[] {
  writeJson(KEY, lists);
  return lists;
}

function newListId(): string {
  return `lista-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

/** Applica `change` alla lista `id` e ne segna la data, lasciando le altre come sono. */
function update(lists: UserList[], id: string, change: (list: UserList) => UserList): UserList[] {
  return lists.map((list) => (list.id === id ? { ...change(list), updatedAt: localDay() } : list));
}

export const useLists = create<ListsState>((set, get) => ({
  // Letta lista per lista (`readLists`): una malformata non porta via le altre.
  lists: readLists(readJson<unknown>(KEY, (v): v is unknown => v !== undefined, [])),

  create: (name, itemIds = []) => {
    const clean = cleanListName(name);
    if (!clean) return null;
    const today = localDay();
    const list: UserList = { id: newListId(), name: clean, itemIds: Array.from(new Set(itemIds)), createdAt: today, updatedAt: today };
    // In cima: la lista appena creata è quella su cui stai lavorando.
    set({ lists: persist([list, ...get().lists]) });
    return list.id;
  },

  rename: (id, name) => {
    const clean = cleanListName(name);
    if (!clean) return;
    set({ lists: persist(update(get().lists, id, (list) => ({ ...list, name: clean }))) });
  },

  remove: (id) => set({ lists: persist(get().lists.filter((list) => list.id !== id)) }),

  toggleItem: (listId, itemId) =>
    set({
      lists: persist(
        update(get().lists, listId, (list) => ({
          ...list,
          itemIds: list.itemIds.includes(itemId) ? list.itemIds.filter((id) => id !== itemId) : [...list.itemIds, itemId],
        })),
      ),
    }),

  addItems: (listId, itemIds) =>
    set({
      lists: persist(
        update(get().lists, listId, (list) => ({ ...list, itemIds: Array.from(new Set([...list.itemIds, ...itemIds])) })),
      ),
    }),

  removeItem: (listId, itemId) =>
    set({
      lists: persist(update(get().lists, listId, (list) => ({ ...list, itemIds: list.itemIds.filter((id) => id !== itemId) }))),
    }),

  move: (listId, itemId, delta) =>
    set({ lists: persist(update(get().lists, listId, (list) => ({ ...list, itemIds: moveId(list.itemIds, itemId, delta) }))) }),

  restore: (value) => set({ lists: persist(readLists(value)) }),

  clearAll: () => set({ lists: persist([]) }),
}));
