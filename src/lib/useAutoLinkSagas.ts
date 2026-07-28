import { useEffect } from "react";
import { useLibrary } from "../store/useLibrary";
import { useSettings } from "../store/useSettings";
import { useSagas, sagaKey } from "../store/useSagas";
import { getDetails, getSaga } from "./tmdb";
import type { Item } from "../types";

const DELAY_MS = 250;

// Module scope for the same reason as the TMDB linker: this is a background
// sync against global stores, and a remount must not restart it.
let running = false;
const attempted = new Set<string>();

/** Films linked to TMDB before sagas existed carry no collection field at all. */
function needsSagaLookup(item: Item): boolean {
  return item.tmdbId !== null && item.tmdbMediaType === "movie" && item.collectionId === undefined;
}

/**
 * Second pass of the catalogue sync, dedicated to sagas: it asks TMDB which
 * collection each film belongs to and then downloads that collection once, so
 * the Saghe page is built from titles the user actually owns rather than from a
 * curated list. Films that turn out to be standalone are written back as
 * `collectionId: null`, which is what stops them being asked about again.
 */
export function useAutoLinkSagas() {
  const items = useLibrary((s) => s.items);
  const tmdbApiKey = useSettings((s) => s.tmdbApiKey);
  const pendingCount = items.filter((i) => needsSagaLookup(i) && !attempted.has(i.id)).length;
  const missingSagas = items.filter((i) => i.collectionId != null).map((i) => i.collectionId);

  // Identity of the set, not of the array: unrelated library edits must not
  // retrigger a sweep over collections already downloaded.
  const sagaIdsKey = Array.from(new Set(missingSagas)).sort((a, b) => (a ?? 0) - (b ?? 0)).join(",");

  useEffect(() => {
    if (!tmdbApiKey || running) return;
    running = true;

    void (async () => {
      try {
        for (;;) {
          const next = useLibrary.getState().items.find((i) => needsSagaLookup(i) && !attempted.has(i.id));
          if (!next) break;
          attempted.add(next.id);
          try {
            const d = await getDetails(next.tmdbId!, "movie", tmdbApiKey);
            useLibrary.getState().updateItem(next.id, {
              collectionId: d.collectionId,
              collectionName: d.collectionName,
            });
          } catch {
            // Offline or rate limited: leave the field undefined so a reload
            // picks the title up again instead of marking it standalone.
            attempted.delete(next.id);
            break;
          }
          await new Promise((r) => setTimeout(r, DELAY_MS));
        }

        // Then fetch the collections themselves, once each.
        const ids = Array.from(
          new Set(
            useLibrary
              .getState()
              .items.map((i) => i.collectionId)
              .filter((id): id is number => typeof id === "number"),
          ),
        );
        for (const id of ids) {
          if (useSagas.getState().sagas[String(id)]) continue;
          if (useSagas.getState().prefs.hidden.includes(sagaKey(id))) continue;
          try {
            useSagas.getState().setSaga(await getSaga(id, tmdbApiKey));
          } catch {
            break;
          }
          await new Promise((r) => setTimeout(r, DELAY_MS));
        }
      } finally {
        running = false;
      }
    })();
  }, [tmdbApiKey, pendingCount, sagaIdsKey]);
}
