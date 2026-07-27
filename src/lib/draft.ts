import type { Item } from "../types";

export type ItemDraft = Omit<Item, "id" | "added">;

export function blankDraft(): ItemDraft {
  return {
    title: "",
    kind: "film",
    year: new Date().getFullYear(),
    genre: "",
    status: "Da vedere",
    vote: null,
    platform: "Netflix",
    runtime: 0,
    episodes: null,
    seen: 0,
    seasons: null,
    fav: false,
    rewatch: 0,
    overview: "",
    director: "",
    cast: [],
    similar: [],
    notes: "",
  };
}

export function draftFromItem(item: Item): ItemDraft {
  const { id: _id, added: _added, ...draft } = item;
  return draft;
}
