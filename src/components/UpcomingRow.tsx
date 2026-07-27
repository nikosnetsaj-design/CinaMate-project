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

interface CachedAir {
  airDate: string | null;
  season: number | null;
  episode: number | null;
  fetchedAt: number;
}

/**
 * Air dates change at most daily, while the library re-renders on every edit.
 * Caching per show keeps a fav toggle or an episode bump from replaying the
 * whole TMDB round-trip, and survives navigating away from Home and back.
 */
const airCache = new Map<number, CachedAir>();
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

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
  // Depend on the shows themselves, not on the array identity, so unrelated
  // library edits don't retrigger the effect.
  const trackedKey = tracked
    .map((i) => i.tmdbId)
    .sort((a, b) => (a ?? 0) - (b ?? 0))
    .join(",");

  useEffect(() => {
    if (!tmdbApiKey || tracked.length === 0) {
      setUpcoming([]);
      return;
    }
    let cancelled = false;
    const now = Date.now();

    Promise.all(
      tracked.slice(0, 8).map(async (item) => {
        const tmdbId = item.tmdbId!;
        const cached = airCache.get(tmdbId);
        let air: CachedAir;
        if (cached && now - cached.fetchedAt < CACHE_TTL_MS) {
          air = cached;
        } else {
          try {
            const next = await getNextEpisode(tmdbId, tmdbApiKey);
            air = { airDate: next.airDate, season: next.seasonNumber, episode: next.episodeNumber, fetchedAt: now };
            airCache.set(tmdbId, air);
          } catch {
            return null;
          }
        }
        return air.airDate ? { item, airDate: air.airDate, season: air.season, episode: air.episode } : null;
      }),
    ).then((results) => {
      if (cancelled) return;
      const list = results.filter((r): r is Upcoming => r !== null).sort((a, b) => a.airDate.localeCompare(b.airDate));
      setUpcoming(list);
    });
    return () => {
      cancelled = true;
    };
    // `tracked` is intentionally excluded: trackedKey captures the identity
    // that actually matters, and the array is rebuilt on every library change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tmdbApiKey, trackedKey]);

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
