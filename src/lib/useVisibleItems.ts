import { useMemo } from "react";
import { useLibrary } from "../store/useLibrary";
import { useParental, parentalRules } from "../store/useParental";
import { applyParental } from "./parental";
import type { Item } from "../types";

/**
 * The library as the current viewer is allowed to see it.
 *
 * Every browsing surface reads this instead of `useLibrary(s => s.items)`, so
 * parental control is one decision applied in one place rather than a filter
 * each page has to remember. The surfaces that deliberately keep reading the
 * raw list are the ones where hiding titles would corrupt the meaning of what
 * they show: statistics, the diary, backup — a filtered export would silently
 * drop half the library from the file, which is a data-loss bug wearing a
 * parental-control costume.
 */
export function useVisibleItems(): Item[] {
  const items = useLibrary((s) => s.items);
  const parental = useParental();
  const rules = parentalRules(parental);

  return useMemo(
    () => applyParental(items, rules),
    // Spread rather than passed as an object: `parentalRules` builds a fresh
    // one on every render, so depending on it would defeat the memo entirely.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, rules.enabled, rules.maxAge, rules.allowUnrated],
  );
}
