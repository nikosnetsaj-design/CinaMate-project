import { useEffect, useMemo, useState } from "react";
import { useLibrary } from "../store/useLibrary";
import { useSettings } from "../store/useSettings";
import { useSelectedItem } from "../store/useSelectedItem";
import { getNextEpisode } from "../lib/tmdb";
import { PosterArt } from "./PosterArt";
import type { Item } from "../types";

interface Upcoming {
  item: Item;
  airDate: string;
  season: number | null;
  episode: number | null;
}

function daysUntil(dateStr: string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${dateStr}T00:00:00`);
  const diff = Math.round((target.getTime() - today.getTime()) / 86400000);
  if (diff < 0) return "uscito";
  if (diff === 0) return "oggi";
  if (diff === 1) return "domani";
  return `tra ${diff} giorni`;
}

export function UpcomingRow() {
  const items = useLibrary((s) => s.items);
  const tmdbApiKey = useSettings((s) => s.tmdbApiKey);
  const openItem = useSelectedItem((s) => s.open);
  const [upcoming, setUpcoming] = useState<Upcoming[]>([]);

  const tracked = useMemo(
    () => items.filter((i) => i.tmdbId && i.tmdbMediaType === "tv" && (i.status === "In visione" || i.status === "Da vedere")),
    [items],
  );

  useEffect(() => {
    if (!tmdbApiKey || tracked.length === 0) {
      setUpcoming([]);
      return;
    }
    let cancelled = false;
    Promise.all(
      tracked.slice(0, 8).map((item) =>
        getNextEpisode(item.tmdbId!, tmdbApiKey)
          .then((next) => (next.airDate ? { item, airDate: next.airDate, season: next.seasonNumber, episode: next.episodeNumber } : null))
          .catch(() => null),
      ),
    ).then((results) => {
      if (cancelled) return;
      const list = results.filter((r): r is Upcoming => r !== null).sort((a, b) => a.airDate.localeCompare(b.airDate));
      setUpcoming(list);
    });
    return () => {
      cancelled = true;
    };
  }, [tmdbApiKey, tracked]);

  if (!tmdbApiKey || upcoming.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-display text-xl font-semibold text-text">In arrivo</h2>
      <div className="flex gap-3.5 overflow-x-auto pb-1">
        {upcoming.map(({ item, airDate, season, episode }) => (
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
              {daysUntil(airDate)}
            </p>
          </button>
        ))}
      </div>
    </section>
  );
}
