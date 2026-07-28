import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useLibrary } from "../store/useLibrary";
import { useSettings } from "../store/useSettings";
import { useSelectedItem } from "../store/useSelectedItem";
import { loadUpcoming, trackedKey, type UpcomingEntry } from "../lib/upcoming";
import { countdown } from "../lib/format";
import { PosterArt } from "./PosterArt";

/** Home keeps the row short: the full calendar lives in Scopri. */
const MAX_ON_HOME = 8;

export function UpcomingRow() {
  const items = useLibrary((s) => s.items);
  const tmdbApiKey = useSettings((s) => s.tmdbApiKey);
  const openItem = useSelectedItem((s) => s.open);
  const [upcoming, setUpcoming] = useState<UpcomingEntry[]>([]);

  // Depend on the tracked titles themselves, not on the array identity, so
  // unrelated library edits don't retrigger the sweep.
  const key = trackedKey(items);

  useEffect(() => {
    let cancelled = false;
    void loadUpcoming(useLibrary.getState().items, tmdbApiKey).then((list) => {
      if (!cancelled) setUpcoming(list);
    });
    return () => {
      cancelled = true;
    };
  }, [tmdbApiKey, key]);

  if (!tmdbApiKey || upcoming.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl font-semibold text-text">In arrivo</h2>
        <Link to="/scopri" className="text-sm font-medium text-accent-text">
          calendario
        </Link>
      </div>
      <div className="flex gap-3.5 overflow-x-auto pb-1">
        {upcoming.slice(0, MAX_ON_HOME).map(({ item, date, season, episode }) => (
          <button
            key={item.id}
            type="button"
            onClick={() => openItem(item)}
            aria-label={`Apri dettagli di ${item.title}, ${item.year}`}
            className="w-28 shrink-0 text-left"
          >
            <PosterArt item={item} size="sm" className="w-28" />
            <p className="mt-1.5 line-clamp-1 text-xs font-semibold text-text">{item.title}</p>
            <p className="text-[10px] text-text-faint">
              {season != null && episode != null ? `S${season}E${episode} · ` : ""}
              {countdown(date)}
            </p>
          </button>
        ))}
      </div>
    </section>
  );
}
