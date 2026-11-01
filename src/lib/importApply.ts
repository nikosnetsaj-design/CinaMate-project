import type { HistoryEntry, Item, Status, WatchedEpisode } from "../types";
import type { TmdbSearchResult } from "./tmdb";
import { foldTitle, mergeEntries, type ImportedEntry } from "./importers";
import { compareEpisodes, isEpisodic, sameEpisode, watchedList } from "./episodes";

/**
 * Mettere in libreria quello che si è deciso di importare. Funzione pura: le
 * stesse voci danno la stessa libreria, ed è ciò che i test controllano.
 *
 * **Nessun doppione.** Un titolo già in libreria — stesso id TMDB, o stesso
 * nome e anno quando uno dei due non è collegato — non entra una seconda
 * volta: riceve solo quello che gli manca. Il voto se non ne aveva, gli
 * episodi non ancora segnati, le visioni con una data che il diario non ha. Lo
 * stato cambia solo da «Da vedere» in avanti: «In pausa» e «Abbandonato» sono
 * decisioni tue, e un file di un'altra app non le scavalca.
 *
 * **Il diario con le date vere.** Una visione entra nel diario solo se il file
 * dice quando: una data inventata (oggi) riempirebbe il giorno dell'import di
 * centinaia di film mai visti quel giorno. Gli episodi senza data entrano nel
 * registro con la data di oggi segnata come stimata, come quelli migrati.
 */

export interface Accepted {
  entry: ImportedEntry;
  /** `null`: entra senza collegamento al catalogo, con il nome del file. */
  pick: TmdbSearchResult | null;
}

export interface ImportOutcome {
  items: Item[];
  history: HistoryEntry[];
  added: number;
  updated: number;
  unchanged: number;
}

interface Context {
  today: string;
  newId: () => string;
}

function sameTitle(item: Item, names: string[], year: number | null, mediaType: "movie" | "tv" | null): boolean {
  if (item.tmdbMediaType && mediaType && item.tmdbMediaType !== mediaType) return false;
  if (year && item.year && Math.abs(item.year - year) > 1) return false;
  const folded = foldTitle(item.title);
  return names.some((n) => n && foldTitle(n) === folded);
}

/** Il titolo della libreria che è già questo, se c'è. */
export function findExisting(items: Item[], entry: ImportedEntry, pick: TmdbSearchResult | null): Item | undefined {
  if (pick) {
    const linked = items.find((i) => i.tmdbId === pick.tmdbId && i.tmdbMediaType === pick.mediaType);
    if (linked) return linked;
  }
  const names = [entry.title, pick?.title ?? "", pick?.originalTitle ?? ""];
  const year = pick?.year ?? entry.year;
  // Per nome solo fra quelli non collegati, o collegati a questo stesso
  // titolo: un «Dune» del 1984 già collegato non è il «Dune» che arriva.
  return items.find((i) => (!i.tmdbId || !pick) && sameTitle(i, names, year, pick?.mediaType ?? entry.mediaType));
}

function historyEntry(item: Item, date: string, action: HistoryEntry["action"], ctx: Context, count = 1): HistoryEntry {
  return { id: ctx.newId(), itemId: item.id, title: item.title, kind: item.kind, date, action, count };
}

function registry(entry: ImportedEntry, ctx: Context): WatchedEpisode[] {
  return entry.episodes.map((ep) =>
    ep.date ? { season: ep.season, episode: ep.episode, date: ep.date } : { season: ep.season, episode: ep.episode, date: ctx.today, estimated: true },
  );
}

/** Le voci del diario per gli episodi nuovi: una per giorno, come un binge. */
function episodeHistory(item: Item, added: WatchedEpisode[], ctx: Context): HistoryEntry[] {
  const byDay = new Map<string, WatchedEpisode[]>();
  for (const w of added) {
    if (w.estimated) continue;
    byDay.set(w.date, [...(byDay.get(w.date) ?? []), w]);
  }
  return [...byDay.entries()].map(([date, eps]) => {
    const h = historyEntry(item, date, "episode", ctx, eps.length);
    if (eps.length === 1) {
      h.season = eps[0].season;
      h.episode = eps[0].episode;
    }
    return h;
  });
}

/** Le visioni di un film che il diario non ha ancora: la prima è «visto», le altre revisioni. */
function viewingHistory(item: Item, dates: string[], history: HistoryEntry[], ctx: Context): HistoryEntry[] {
  const mine = history.filter((h) => h.itemId === item.id && h.action !== "episode");
  const known = new Set(mine.map((h) => h.date));
  let hasFirst = mine.some((h) => h.action === "watched");
  const out: HistoryEntry[] = [];
  for (const date of dates) {
    if (known.has(date)) continue;
    out.push(historyEntry(item, date, hasFirst ? "rewatch" : "watched", ctx));
    hasFirst = true;
    known.add(date);
  }
  return out;
}

function newItem(entry: ImportedEntry, pick: TmdbSearchResult | null, ctx: Context): Item {
  const mediaType = pick?.mediaType ?? entry.mediaType;
  let kind = pick?.kind ?? (mediaType === "tv" ? "serie" : "film");
  // Una docuserie con gli episodi segnati deve poterli tenere.
  if (entry.episodes.length > 0 && !isEpisodic({ kind })) kind = "serie";
  const base: Item = {
    id: ctx.newId(),
    title: pick?.title || entry.title,
    kind,
    year: pick?.year ?? entry.year ?? 0,
    genre: "",
    status: entry.status,
    vote: entry.vote,
    platform: "Altro",
    runtime: 0,
    episodes: null,
    seen: 0,
    seasons: null,
    fav: entry.fav,
    rewatch: entry.rewatch,
    overview: pick?.overview ?? "",
    director: "",
    cast: [],
    similar: [],
    notes: "",
    added: ctx.today,
    tmdbId: pick?.tmdbId ?? null,
    tmdbMediaType: pick?.mediaType ?? null,
    posterPath: pick?.posterPath ?? null,
    trailerUrl: null,
    links: [],
  };
  if (isEpisodic(base)) {
    const watched = registry(entry, ctx).sort(compareEpisodes);
    return { ...base, watched, seen: watched.length };
  }
  return base;
}

const FORWARD: Record<Status, boolean> = { "Da vedere": true, "In visione": false, "In pausa": false, Abbandonato: false, Visto: false };

export function applyImport(items: Item[], history: HistoryEntry[], accepted: Accepted[], ctx: Context): ImportOutcome {
  // Due voci che il catalogo dice essere lo stesso titolo — «The Godfather»
  // da Letterboxd e l'id 238 da Trakt — diventano una.
  const picks = new Map<string, TmdbSearchResult>();
  const tagged = accepted.map(({ entry, pick }) => {
    if (!pick) return entry;
    picks.set(`${pick.mediaType}:${pick.tmdbId}`, pick);
    return { ...entry, ids: { ...entry.ids, tmdb: pick.tmdbId }, mediaType: pick.mediaType };
  });
  const merged = mergeEntries(tagged);

  let nextItems = [...items];
  const nextHistory = [...history];
  let added = 0;
  let updated = 0;
  let unchanged = 0;

  for (const entry of merged) {
    const pick = entry.ids.tmdb && entry.mediaType ? (picks.get(`${entry.mediaType}:${entry.ids.tmdb}`) ?? null) : null;
    const existing = findExisting(nextItems, entry, pick);

    if (!existing) {
      const item = newItem(entry, pick, ctx);
      nextItems = [item, ...nextItems];
      nextHistory.push(
        ...(isEpisodic(item) ? episodeHistory(item, item.watched ?? [], ctx) : viewingHistory(item, entry.watchedDates, nextHistory, ctx)),
      );
      added++;
      continue;
    }

    let item: Item = { ...existing };
    const entries: HistoryEntry[] = [];
    if (item.vote === null && entry.vote !== null) item.vote = entry.vote;
    if (entry.fav && !item.fav) item.fav = true;
    if (entry.rewatch > item.rewatch) item.rewatch = entry.rewatch;
    if (!item.tmdbId && pick) {
      item.tmdbId = pick.tmdbId;
      item.tmdbMediaType = pick.mediaType;
      item.posterPath = item.posterPath ?? pick.posterPath;
    }

    if (isEpisodic(item)) {
      const before = watchedList(item);
      const fresh = registry(entry, ctx).filter((w) => !before.some((b) => sameEpisode(b, w)));
      if (fresh.length > 0) {
        const watched = [...before, ...fresh].sort(compareEpisodes);
        item = { ...item, watched, seen: watched.length };
        if (item.status === "Da vedere") item.status = "In visione";
        if (item.episodes && item.seen >= item.episodes) item.status = "Visto";
        entries.push(...episodeHistory(item, fresh, ctx));
      } else if (FORWARD[item.status] && entry.status !== "Da vedere") item.status = entry.status;
    } else {
      if (FORWARD[item.status] && entry.status !== "Da vedere") item.status = entry.status;
      entries.push(...viewingHistory(item, entry.watchedDates, nextHistory, ctx));
    }

    const changed = entries.length > 0 || JSON.stringify(item) !== JSON.stringify(existing);
    if (!changed) {
      unchanged++;
      continue;
    }
    nextItems = nextItems.map((i) => (i.id === existing.id ? item : i));
    nextHistory.push(...entries);
    updated++;
  }

  nextHistory.sort((a, b) => a.date.localeCompare(b.date));
  return { items: nextItems, history: nextHistory, added, updated, unchanged };
}
