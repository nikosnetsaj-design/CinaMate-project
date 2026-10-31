import { useMemo } from "react";
import { usePlayerSources } from "../store/usePlayerSources";
import type { PersonalList } from "../store/useLists";
import type { Item } from "../types";
import { runQuery } from "./listing";
import { useVisibleItems } from "./useVisibleItems";

/** I titoli di una lista: quelli scelti, nell'ordine scelto, o la risposta della ricerca salvata. */
export function listItems(list: PersonalList, items: Item[], lookupSource?: (id: string) => ReturnType<typeof usePlayerSources.getState>["sources"][string]): Item[] {
  if (list.kind === "smart") return runQuery(items, list.query, lookupSource).list;
  const byId = new Map(items.map((i) => [i.id, i]));
  return list.itemIds.map((id) => byId.get(id)).filter((i): i is Item => i !== undefined);
}

/** Come sopra, sullo scaffale visibile: il controllo genitori vale anche dentro le liste. */
export function useListItems(list: PersonalList | null | undefined): Item[] {
  const items = useVisibleItems();
  const sources = usePlayerSources((s) => s.sources);
  return useMemo(() => (list ? listItems(list, items, (id) => sources[id]) : []), [list, items, sources]);
}
