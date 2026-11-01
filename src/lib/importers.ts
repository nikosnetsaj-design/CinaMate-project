import type { Status } from "../types";

/**
 * Leggere quello che le altre app esportano.
 *
 * Quattro formati, una forma sola in uscita (`ImportedEntry`): un titolo, il
 * suo anno, gli identificativi che il file porta, lo stato, il voto sulla scala
 * di CineMate (1–10), le date di visione e, per le serie, gli episodi.
 *
 * - **Letterboxd** — lo ZIP dell'esportazione o i suoi CSV (`watched`,
 *   `ratings`, `diary`, `watchlist`). Voti da mezza stella a cinque stelle,
 *   raddoppiati.
 * - **Trakt** — i JSON di un backup (`watched-*`, `ratings-*`, `watchlist-*`,
 *   `history`). Portano l'id TMDB: l'abbinamento è esatto.
 * - **IMDb** — il CSV dei voti o della watchlist. Porta l'id IMDb, che TMDB
 *   sa tradurre esattamente.
 * - **TV Time** — i CSV dell'esportazione dei dati (`seen_episode`,
 *   `followed_tv_show`): episodi visti con stagione, numero e data.
 *
 * Il riconoscimento guarda le intestazioni, non il nome del file: un file
 * rinominato si legge lo stesso. Questo modulo non tocca la rete: abbinare i
 * titoli al catalogo è il lavoro di `importMatch.ts`.
 */

export type ImportSource = "letterboxd" | "trakt" | "imdb" | "tvtime";

export const SOURCE_LABEL: Record<ImportSource, string> = {
  letterboxd: "Letterboxd",
  trakt: "Trakt",
  imdb: "IMDb",
  tvtime: "TV Time",
};

export interface ImportedEpisode {
  season: number;
  episode: number;
  date: string;
}

export interface ImportedEntry {
  key: string;
  sources: ImportSource[];
  title: string;
  year: number | null;
  mediaType: "movie" | "tv" | null;
  ids: { tmdb?: number; imdb?: string; tvdb?: string };
  status: Status;
  /** 1–10, già convertito. */
  vote: number | null;
  /** `yyyy-mm-dd`, dalla più vecchia. */
  watchedDates: string[];
  episodes: ImportedEpisode[];
  rewatch: number;
  /** Fra i preferiti dell'altra app (i «like» di Letterboxd). */
  fav: boolean;
}

// --- CSV --------------------------------------------------------------------

/** Un CSV come righe di celle: virgolette, virgole e a capo dentro le virgolette. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some((v) => v.trim() !== "")) rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  row.push(cell);
  if (row.some((v) => v.trim() !== "")) rows.push(row);
  return rows;
}

/** Le righe come oggetti, con le intestazioni in minuscolo. */
export function csvRecords(text: string): Record<string, string>[] {
  const [header, ...rows] = parseCsv(text);
  if (!header) return [];
  const keys = header.map((h) => h.trim().toLowerCase());
  return rows.map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? "").trim()])));
}

// --- utilità ----------------------------------------------------------------

export function foldTitle(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function day(value: string | undefined | null): string | null {
  if (!value) return null;
  const m = value.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const t = Date.parse(value);
  return Number.isFinite(t) ? new Date(t).toISOString().slice(0, 10) : null;
}

function yearOf(value: string | number | undefined | null): number | null {
  const n = typeof value === "number" ? value : Number(String(value ?? "").slice(0, 4));
  return Number.isInteger(n) && n > 1870 && n < 2200 ? n : null;
}

/** Dieci voti, sempre interi da 1 a 10. */
export function toTen(value: number, scale: 5 | 10): number | null {
  if (!Number.isFinite(value) || value <= 0) return null;
  const ten = scale === 5 ? value * 2 : value;
  return Math.min(10, Math.max(1, Math.round(ten)));
}

function entry(source: ImportSource, base: Partial<ImportedEntry> & { title: string }): ImportedEntry {
  return {
    key: "",
    sources: [source],
    year: null,
    mediaType: null,
    ids: {},
    status: "Visto",
    vote: null,
    watchedDates: [],
    episodes: [],
    rewatch: 0,
    fav: false,
    ...base,
  };
}

// --- Letterboxd ---------------------------------------------------------------

function isLetterboxd(keys: string[]): boolean {
  return keys.includes("letterboxd uri") && keys.includes("name");
}

function fromLetterboxd(records: Record<string, string>[], fileName: string): ImportedEntry[] {
  const watchlist = /watchlist/i.test(fileName);
  const liked = /likes/i.test(fileName);
  // «Date» è il giorno in cui la riga è stata scritta: in `watched.csv` è
  // quando l'hai segnato visto, in `ratings.csv` quando l'hai votato — e un
  // voto non è una visione. La data vera di una visione è «Watched Date».
  const loggedIsWatched = /(^|\/)watched\.csv$/i.test(fileName);
  return records
    .filter((r) => r.name)
    .map((r) => {
      const rating = r.rating ? toTen(Number(r.rating), 5) : null;
      const watched = day(r["watched date"] || (loggedIsWatched ? r.date : ""));
      return entry("letterboxd", {
        title: r.name,
        year: yearOf(r.year),
        // Letterboxd è un diario di film: le serie non ci stanno.
        mediaType: "movie",
        status: watchlist ? "Da vedere" : "Visto",
        vote: rating,
        watchedDates: watched ? [watched] : [],
        rewatch: /^yes$/i.test(r.rewatch ?? "") ? 1 : 0,
        fav: liked,
      });
    });
}

// --- IMDb -----------------------------------------------------------------------

function isImdb(keys: string[]): boolean {
  return keys.includes("const") && keys.includes("title") && (keys.includes("your rating") || keys.includes("title type"));
}

function fromImdb(records: Record<string, string>[]): ImportedEntry[] {
  return records
    .filter((r) => r.title && /^tt\d+/.test(r.const ?? ""))
    .filter((r) => !/episode/i.test(r["title type"] ?? ""))
    .map((r) => {
      const type = (r["title type"] ?? "").toLowerCase();
      const isTv = /series|tv ?mini/i.test(type);
      const rated = r["your rating"] ? toTen(Number(r["your rating"]), 10) : null;
      const date = day(r["date rated"]);
      return entry("imdb", {
        title: r.title,
        year: yearOf(r.year || r["release date"]),
        mediaType: isTv ? "tv" : "movie",
        ids: { imdb: r.const },
        // Un voto vuol dire visto; la watchlist di IMDb non ha voti.
        status: rated ? "Visto" : "Da vedere",
        vote: rated,
        watchedDates: rated && date ? [date] : [],
      });
    });
}

// --- TV Time ------------------------------------------------------------------

function isTvTime(keys: string[]): boolean {
  // `seen_episode.csv` dell'esportazione classica, o `series_name` in quella
  // più recente.
  return keys.includes("tv_show_name") || (keys.includes("series_name") && keys.includes("episode_number"));
}

function fromTvTime(records: Record<string, string>[]): ImportedEntry[] {
  const byShow = new Map<string, ImportedEntry>();
  for (const r of records) {
    const name = r.tv_show_name || r.series_name;
    if (!name) continue;
    const tvdb = r.tv_show_id || r.tvdb_id || r.series_id || undefined;
    const keyName = tvdb ? `tvdb:${tvdb}` : foldTitle(name);
    let show = byShow.get(keyName);
    if (!show) {
      show = entry("tvtime", { title: name, mediaType: "tv", ids: tvdb ? { tvdb } : {}, status: "In visione" });
      byShow.set(keyName, show);
    }
    const season = Number(r.episode_season_number ?? r.season_number);
    const episode = Number(r.episode_number);
    const date = day(r.updated_at || r.created_at) ?? "";
    if (Number.isInteger(season) && season >= 1 && Number.isInteger(episode) && episode >= 1) {
      show.episodes.push({ season, episode, date });
    }
  }
  // Una serie seguita senza episodi visti è una serie da vedere.
  for (const show of byShow.values()) if (show.episodes.length === 0) show.status = "Da vedere";
  return [...byShow.values()];
}

// --- Trakt ----------------------------------------------------------------------

interface TraktMedia {
  title?: string;
  year?: number;
  ids?: { tmdb?: number; imdb?: string; tvdb?: number };
}

interface TraktRow {
  type?: string;
  movie?: TraktMedia;
  show?: TraktMedia;
  episode?: { season?: number; number?: number };
  season?: { number?: number };
  rating?: number;
  collected_at?: string;
  rated_at?: string;
  listed_at?: string;
  watched_at?: string;
  last_watched_at?: string;
  plays?: number;
  seasons?: { number?: number; episodes?: { number?: number; last_watched_at?: string }[] }[];
}

function fromTrakt(rows: TraktRow[]): ImportedEntry[] {
  const out: ImportedEntry[] = [];
  for (const row of rows) {
    const media = row.movie ?? row.show;
    if (!media?.title) continue;
    // Il voto di un episodio o di una stagione non è il voto della serie.
    if (row.rating !== undefined && (row.episode || row.season)) continue;
    // Una copia in collezione non dice di averla vista.
    if (row.collected_at && !row.watched_at && !row.last_watched_at && !row.plays) continue;
    const isTv = !!row.show;
    const ids = {
      ...(media.ids?.tmdb ? { tmdb: media.ids.tmdb } : {}),
      ...(media.ids?.imdb ? { imdb: media.ids.imdb } : {}),
      ...(media.ids?.tvdb ? { tvdb: String(media.ids.tvdb) } : {}),
    };
    const e = entry("trakt", { title: media.title, year: yearOf(media.year), mediaType: isTv ? "tv" : "movie", ids });

    if (row.listed_at && row.rating === undefined && !row.watched_at && !row.plays) {
      e.status = "Da vedere";
    } else if (row.rating !== undefined) {
      e.vote = toTen(row.rating, 10);
      const d = day(row.rated_at);
      if (d && !isTv) e.watchedDates.push(d);
    } else {
      const d = day(row.watched_at ?? row.last_watched_at);
      if (row.episode && isTv) {
        if (row.episode.season && row.episode.number) e.episodes.push({ season: row.episode.season, episode: row.episode.number, date: d ?? "" });
      } else if (isTv && row.seasons) {
        for (const s of row.seasons) {
          for (const ep of s.episodes ?? []) {
            if (s.number && s.number >= 1 && ep.number) e.episodes.push({ season: s.number, episode: ep.number, date: day(ep.last_watched_at) ?? d ?? "" });
          }
        }
      } else if (d) e.watchedDates.push(d);
      if (!isTv && (row.plays ?? 1) > 1) e.rewatch = (row.plays ?? 1) - 1;
      if (isTv) e.status = "In visione";
    }
    out.push(e);
  }
  return out;
}

// --- riconoscimento ---------------------------------------------------------------

export class ImportFormatError extends Error {}

/** Un file come elenco di titoli. Lancia `ImportFormatError` se il formato non è uno dei quattro. */
export function parseImportFile(fileName: string, text: string): { source: ImportSource; entries: ImportedEntry[] } {
  const trimmed = text.trim();
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    let data: unknown;
    try {
      data = JSON.parse(trimmed);
    } catch {
      throw new ImportFormatError(`${fileName}: non è un JSON leggibile.`);
    }
    const rows = Array.isArray(data) ? data : [];
    if (rows.length > 0 && rows.some((r) => r && typeof r === "object" && ("movie" in r || "show" in r))) {
      // Le liste personali e le collezioni hanno la stessa forma della
      // watchlist, ma non sono «da vedere»: restano fuori.
      if (/(^|[/\\])(lists?|collection)[-_.]/i.test(fileName)) {
        throw new ImportFormatError(`${fileName}: le liste e le collezioni di Trakt non sono la tua cronologia, le lascio fuori.`);
      }
      return { source: "trakt", entries: fromTrakt(rows as TraktRow[]) };
    }
    throw new ImportFormatError(`${fileName}: questo JSON non sembra un backup di Trakt.`);
  }

  const records = csvRecords(text);
  const keys = records.length ? Object.keys(records[0]) : (parseCsv(text)[0] ?? []).map((k) => k.trim().toLowerCase());
  if (isLetterboxd(keys)) return { source: "letterboxd", entries: fromLetterboxd(records, fileName) };
  if (isImdb(keys)) return { source: "imdb", entries: fromImdb(records) };
  if (isTvTime(keys)) return { source: "tvtime", entries: fromTvTime(records) };
  throw new ImportFormatError(`${fileName}: non riconosco questo file. Servono i CSV di Letterboxd, IMDb o TV Time, o i JSON di Trakt.`);
}

// --- unione -------------------------------------------------------------------------

function keyOf(e: ImportedEntry): string {
  if (e.ids.tmdb && e.mediaType) return `tmdb:${e.mediaType}:${e.ids.tmdb}`;
  if (e.ids.imdb) return `imdb:${e.ids.imdb}`;
  if (e.ids.tvdb) return `tvdb:${e.ids.tvdb}`;
  return `t:${e.mediaType ?? "?"}:${foldTitle(e.title)}:${e.year ?? ""}`;
}

const STATUS_RANK: Record<Status, number> = { Visto: 3, "In visione": 2, "In pausa": 1, Abbandonato: 1, "Da vedere": 0 };

/**
 * Lo stesso titolo da più file — il voto da `ratings.csv`, la data da
 * `diary.csv`, la presenza da `watched.csv` — diventa una voce sola. Vince lo
 * stato più avanti, l'ultimo voto, l'unione di date ed episodi.
 */
export function mergeEntries(entries: ImportedEntry[]): ImportedEntry[] {
  const merged = new Map<string, ImportedEntry>();
  for (const e of entries) {
    const key = keyOf(e);
    const prev = merged.get(key);
    if (!prev) {
      merged.set(key, { ...e, key, watchedDates: [...e.watchedDates], episodes: [...e.episodes] });
      continue;
    }
    prev.sources = [...new Set([...prev.sources, ...e.sources])];
    prev.ids = { ...prev.ids, ...e.ids };
    prev.year = prev.year ?? e.year;
    prev.mediaType = prev.mediaType ?? e.mediaType;
    if (STATUS_RANK[e.status] > STATUS_RANK[prev.status]) prev.status = e.status;
    if (e.vote !== null) prev.vote = e.vote;
    prev.watchedDates = [...new Set([...prev.watchedDates, ...e.watchedDates])];
    const seen = new Set(prev.episodes.map((x) => `${x.season}:${x.episode}`));
    for (const ep of e.episodes) if (!seen.has(`${ep.season}:${ep.episode}`)) prev.episodes.push(ep);
    prev.rewatch = Math.max(prev.rewatch, e.rewatch);
    prev.fav = prev.fav || e.fav;
  }
  for (const e of merged.values()) {
    e.watchedDates.sort();
    e.episodes.sort((a, b) => a.season - b.season || a.episode - b.episode);
    // Più date di visione di un film sono più visioni: le seconde contano come
    // revisioni, anche se il file non lo diceva.
    if (e.mediaType !== "tv") e.rewatch = Math.max(e.rewatch, e.watchedDates.length - 1);
    if (e.status === "Da vedere" && e.watchedDates.length > 0 && e.mediaType !== "tv") e.status = "Visto";
    // Di una serie con gli episodi è il registro a dire a che punto sei: «In
    // visione», finché la libreria non sa quante puntate ha e vede che le hai
    // segnate tutte.
    if (e.mediaType === "tv" && e.episodes.length > 0) e.status = "In visione";
  }
  return [...merged.values()];
}
