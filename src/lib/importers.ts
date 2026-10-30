import type { HistoryEntry, Item, Kind, Platform, Status } from "../types";
import { parseCsv, rowsAsRecords } from "./csv";
import { foldTitle } from "./titleMatch";

/**
 * Leggere quello che un altro servizio sa di te.
 *
 * Una libreria nuova parte vuota, e chi arriva da Letterboxd, da IMDb o da
 * anni di Netflix ha già scritto altrove centinaia di voti e di date. Qui ci
 * sono solo i *formati*: quali file, quali colonne, cosa vuol dire ogni riga.
 * Niente rete e niente store — l'abbinamento con TMDB sta in `importMatch`, la
 * scrittura in `useLibrary.mergeImported` — così ogni regola si prova con un
 * file finto in `scripts/tests/importers.test.ts`.
 *
 * Due principi tengono insieme le scelte di dettaglio:
 *
 * 1. **Una data è una data.** Il diario di CineMate dice *quando* hai visto
 *    qualcosa. Letterboxd lo sa per le voci del diario; per un film segnato
 *    come visto senza voce sa solo il giorno in cui l'hai *registrato*, e IMDb
 *    sa il giorno del voto. Quelle date non diventano visioni: chi ha
 *    caricato cinquecento film su Letterboxd una domenica del 2019 non ha
 *    visto cinquecento film quella domenica. Il titolo entra come «Visto», e
 *    il diario resta vero.
 * 2. **Quello che hai scritto tu vince.** Un titolo che hai già non viene
 *    riscritto: si riempie solo ciò che è vuoto (vedi `planImport`).
 */

export type ImportSource = "letterboxd" | "imdb" | "netflix" | "csv";

export const SOURCE_LABELS: Record<ImportSource, string> = {
  letterboxd: "Letterboxd",
  imdb: "IMDb",
  netflix: "Netflix",
  csv: "CSV",
};

/** Una visione com'era scritta nel file, prima di decidere se è la prima o una seconda. */
export interface ImportedWatch {
  date: string;
  /** La sorgente la dichiara una rivisione (la colonna «Rewatch» di Letterboxd). */
  rewatch: boolean;
  /** Per le serie: quanti episodi quel giorno. Assente per i film. */
  episodes?: number;
}

export interface ImportedTitle {
  /** Come le righe di file diversi si riconoscono come lo stesso titolo. */
  key: string;
  source: ImportSource;
  title: string;
  year: number | null;
  mediaType: "movie" | "tv" | null;
  kind: Kind | null;
  imdbId: string | null;
  tmdbId: number | null;
  status: Status;
  vote: number | null;
  fav: boolean;
  watches: ImportedWatch[];
  /** Il giorno in cui è entrato nella libreria di là. */
  addedDate: string | null;
  notes: string;
  /** Episodi diversi visti, quando la sorgente li elenca (Netflix). */
  episodesSeen: number | null;
  runtime: number | null;
  director: string;
  platform: Platform | null;
  /** Entra solo perché sta in una lista: non è visto e non è in watchlist. */
  listOnly: boolean;
}

export interface ImportedList {
  name: string;
  description: string;
  /** Le chiavi dei titoli, nell'ordine della lista. */
  keys: string[];
}

export interface ImportFileReport {
  name: string;
  source: ImportSource | null;
  /** A parole: «Diario», «Voti», «Lista «Horror»», «Non riconosciuto». */
  label: string;
  rows: number;
}

export interface ImportBundle {
  titles: ImportedTitle[];
  lists: ImportedList[];
  files: ImportFileReport[];
  /** Righe lasciate fuori di proposito, e perché. */
  skipped: { reason: string; count: number }[];
}

export interface SourceFile {
  /** Il percorso dentro lo ZIP (`lists/horror.csv`) o il nome del file scelto. */
  name: string;
  text: string;
}

/* ------------------------------------------------------------------ */
/* Valori                                                               */
/* ------------------------------------------------------------------ */

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})/;

function validDay(y: number, m: number, d: number): string | null {
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return null;
  if (y < 1900 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCMonth() !== m - 1) return null; // 31 aprile
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export type DayOrder = "dmy" | "mdy";

/**
 * Giorno e mese, o mese e giorno? Netflix scrive la data nel formato del
 * paese dell'account — `28/10/26` in Italia, `10/28/26` negli Stati Uniti — e
 * dentro il file non c'è scritto quale. Lo dice la colonna intera: basta una
 * riga con un primo numero oltre il 12 per sapere che è il giorno. Se nessuna
 * riga lo rivela (tutte le date nei primi dodici giorni del mese), vale
 * l'ordine italiano.
 */
export function detectDayOrder(values: string[]): DayOrder {
  let dmy = 0;
  let mdy = 0;
  for (const value of values) {
    const parts = value.trim().split(/[/.-]/);
    if (parts.length !== 3 || parts[0].length === 4) continue;
    const a = Number(parts[0]);
    const b = Number(parts[1]);
    if (a > 12 && b <= 12) dmy++;
    else if (b > 12 && a <= 12) mdy++;
  }
  return mdy > dmy ? "mdy" : "dmy";
}

/** `2026-10-28`, `28/10/2026`, `10/28/26`, `28.10.26` → `2026-10-28`. */
export function parseDay(value: string, order: DayOrder = "dmy"): string | null {
  const text = value.trim();
  if (!text) return null;
  const iso = ISO_DAY.exec(text);
  if (iso) return validDay(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  const parts = text.split(/[/.-]/).map((p) => p.trim());
  if (parts.length !== 3 || parts.some((p) => !/^\d{1,4}$/.test(p))) return null;
  let [a, b, y] = parts.map(Number);
  if (parts[2].length <= 2) y += 2000;
  if (order === "mdy") [a, b] = [b, a];
  return validDay(y, b, a);
}

function parseYear(value: string | undefined): number | null {
  const n = Number((value ?? "").trim().slice(0, 4));
  return Number.isInteger(n) && n >= 1870 && n <= 2100 ? n : null;
}

/** Un voto su 10, da qualunque scala: `4.5` su cinque stelle è 9. */
function parseVote(value: string | undefined, scale: 5 | 10): number | null {
  const n = Number((value ?? "").trim().replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) return null;
  const ten = scale === 5 ? n * 2 : n;
  return Math.min(10, Math.max(1, Math.round(ten)));
}

function yes(value: string | undefined): boolean {
  return /^(yes|true|1|s[iì]|y|x)$/i.test((value ?? "").trim());
}

function imdbIdOf(value: string | undefined): string | null {
  const match = /tt\d{5,10}/.exec(value ?? "");
  return match ? match[0] : null;
}

function positiveInt(value: string | undefined): number | null {
  const n = Number((value ?? "").trim());
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** Le recensioni di Letterboxd arrivano con qualche tag HTML: qui restano parole. */
function plainText(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>\s*<p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .trim();
}

function basename(path: string): string {
  return path.split("/").pop()?.toLowerCase() ?? "";
}

/* ------------------------------------------------------------------ */
/* Il raccoglitore: righe di file diversi → un titolo                   */
/* ------------------------------------------------------------------ */

const WATCHED: Status[] = ["Visto", "In visione"];

class Collector {
  titles = new Map<string, ImportedTitle>();
  lists: ImportedList[] = [];
  files: ImportFileReport[] = [];
  skipped = new Map<string, number>();
  /** Da quale file arriva il voto, per far vincere il voto attuale su quello di una vecchia voce. */
  private votePriority = new Map<string, number>();

  title(key: string, base: Omit<ImportedTitle, "key" | "status" | "vote" | "fav" | "watches" | "addedDate" | "notes" | "episodesSeen" | "listOnly"> & Partial<ImportedTitle>): ImportedTitle {
    let t = this.titles.get(key);
    if (!t) {
      t = {
        key,
        status: "Da vedere",
        vote: null,
        fav: false,
        watches: [],
        addedDate: null,
        notes: "",
        episodesSeen: null,
        listOnly: true,
        ...base,
      };
      this.titles.set(key, t);
    }
    return t;
  }

  watched(t: ImportedTitle, status: Status = "Visto") {
    t.listOnly = false;
    // Visto vince su In visione, che vince su Da vedere.
    if (t.status === "Visto") return;
    if (status === "Visto" || !WATCHED.includes(t.status)) t.status = status;
  }

  wanted(t: ImportedTitle) {
    t.listOnly = false;
  }

  vote(t: ImportedTitle, vote: number | null, priority: number) {
    if (vote === null) return;
    if ((this.votePriority.get(t.key) ?? -1) > priority) return;
    this.votePriority.set(t.key, priority);
    t.vote = vote;
  }

  added(t: ImportedTitle, day: string | null) {
    if (day && (!t.addedDate || day < t.addedDate)) t.addedDate = day;
  }

  note(t: ImportedTitle, text: string) {
    const clean = text.trim();
    if (clean && !t.notes.includes(clean)) t.notes = t.notes ? `${t.notes}\n\n${clean}` : clean;
  }

  watch(t: ImportedTitle, watch: ImportedWatch) {
    const same = t.watches.find((w) => w.date === watch.date && w.rewatch === watch.rewatch);
    if (same) {
      if (watch.episodes) same.episodes = Math.max(same.episodes ?? 0, watch.episodes);
      return;
    }
    t.watches.push(watch);
  }

  skip(reason: string, count = 1) {
    if (count > 0) this.skipped.set(reason, (this.skipped.get(reason) ?? 0) + count);
  }

  report(name: string, source: ImportSource | null, label: string, rows: number) {
    this.files.push({ name, source, label, rows });
  }

  bundle(): ImportBundle {
    const titles = [...this.titles.values()];
    for (const t of titles) t.watches.sort((a, b) => a.date.localeCompare(b.date));
    return {
      titles,
      lists: this.lists,
      files: this.files,
      skipped: [...this.skipped.entries()].map(([reason, count]) => ({ reason, count })),
    };
  }
}

/* ------------------------------------------------------------------ */
/* Letterboxd                                                           */
/* ------------------------------------------------------------------ */

type LetterboxdPart = "watched" | "ratings" | "diary" | "reviews" | "watchlist" | "likes" | "list" | "ignore";

const LB_LABELS: Record<Exclude<LetterboxdPart, "ignore" | "list">, string> = {
  watched: "Film visti",
  ratings: "Voti",
  diary: "Diario",
  reviews: "Recensioni",
  watchlist: "Watchlist",
  likes: "Film che ti piacciono",
};

function letterboxdPart(path: string, headers: string[]): LetterboxdPart {
  const lower = path.toLowerCase();
  const name = basename(path);
  if (/(^|\/)(deleted|orphaned)\//.test(lower)) return "ignore";
  if (/(^|\/)likes\//.test(lower)) return name === "films.csv" ? "likes" : "ignore";
  if (/(^|\/)lists\//.test(lower)) return "list";
  if (name === "profile.csv" || name === "comments.csv") return "ignore";
  for (const part of ["watched", "ratings", "diary", "reviews", "watchlist"] as const) {
    if (name === `${part}.csv`) return part;
  }
  // Un file con un nome suo: lo dicono le colonne.
  if (headers.includes("review")) return "reviews";
  if (headers.includes("watcheddate")) return "diary";
  if (headers.includes("rating")) return "ratings";
  if (name.includes("watchlist")) return "watchlist";
  if (name.includes("like")) return "likes";
  return "watched";
}

function letterboxdKey(name: string, year: number | null): string {
  return `lb:${foldTitle(name)}|${year ?? ""}`;
}

function readLetterboxd(c: Collector, file: SourceFile, rows: string[][]) {
  const { headers, records } = rowsAsRecords(rows);
  const part = letterboxdPart(file.name, headers);
  if (part === "ignore") return;
  if (part === "list") {
    readLetterboxdList(c, file, rows);
    return;
  }

  let used = 0;
  for (const r of records) {
    const name = (r.name ?? "").trim();
    if (!name) {
      c.skip("righe senza titolo");
      continue;
    }
    used++;
    const year = parseYear(r.year);
    const t = c.title(letterboxdKey(name, year), {
      source: "letterboxd",
      title: name,
      year,
      // Letterboxd è un diario di cinema: le poche serie che ospita sono
      // miniserie e speciali, e l'abbinamento con TMDB le riconosce lo stesso.
      mediaType: "movie",
      kind: null,
      imdbId: null,
      tmdbId: null,
      runtime: null,
      director: "",
      platform: null,
    });
    const logged = parseDay(r.date ?? "");

    switch (part) {
      case "watched":
        c.watched(t);
        c.added(t, logged);
        break;
      case "ratings":
        c.watched(t);
        c.vote(t, parseVote(r.rating, 5), 2);
        c.added(t, logged);
        break;
      case "diary":
      case "reviews": {
        c.watched(t);
        const day = parseDay(r.watcheddate ?? "") ?? logged;
        // Una recensione senza data di visione non è una visione.
        if (day && (part === "diary" || r.watcheddate)) c.watch(t, { date: day, rewatch: yes(r.rewatch) });
        // Il voto di una voce vale quanto quello di quel giorno: quello di
        // ratings.csv, che è il voto di oggi, lo batte.
        c.vote(t, parseVote(r.rating, 5), 1);
        c.added(t, day);
        if (part === "reviews" && r.review) c.note(t, plainText(r.review));
        if (r.tags) c.note(t, `Etichette: ${r.tags}`);
        break;
      }
      case "watchlist":
        c.wanted(t);
        c.added(t, logged);
        break;
      case "likes":
        // Un cuore su Letterboxd vuol dire che l'hai visto e ti è piaciuto.
        c.watched(t);
        t.fav = true;
        break;
    }
  }
  c.report(file.name, "letterboxd", LB_LABELS[part], used);
}

/**
 * Una lista di Letterboxd: un'intestazione con il nome della lista, una riga
 * vuota, poi i film in ordine.
 *
 * ```
 * Letterboxd list export v7
 * Date,Name,Tags,URL,Description
 * 2024-10-01,Horror di ottobre,,https://letterboxd.com/…,
 *
 * Position,Name,Year,URL,Description
 * 1,The Thing,1982,https://boxd.it/29Tm,
 * ```
 */
function readLetterboxdList(c: Collector, file: SourceFile, rows: string[][]) {
  const cells = (r: string[]) => r.map((x) => x.trim().toLowerCase());
  const start = rows.findIndex((r) => {
    const h = cells(r);
    return h.includes("name") && (h.includes("position") || h.includes("year"));
  });
  if (start < 0) {
    c.report(file.name, "letterboxd", "Non riconosciuto", 0);
    return;
  }
  const metaHeader = rows.findIndex((r, i) => i < start && cells(r).includes("name") && cells(r).includes("date"));
  const meta = metaHeader >= 0 ? rowsAsRecords([rows[metaHeader], rows[metaHeader + 1] ?? []]).records[0] : undefined;
  const fallback = basename(file.name).replace(/\.csv$/, "").replace(/[-_]+/g, " ").trim();
  const listName = (meta?.name || fallback || "Lista di Letterboxd").trim();

  const { records } = rowsAsRecords(rows.slice(start));
  const keys: string[] = [];
  for (const r of records) {
    const name = (r.name ?? "").trim();
    if (!name) continue;
    const year = parseYear(r.year);
    const t = c.title(letterboxdKey(name, year), {
      source: "letterboxd",
      title: name,
      year,
      mediaType: "movie",
      kind: null,
      imdbId: null,
      tmdbId: null,
      runtime: null,
      director: "",
      platform: null,
    });
    if (!keys.includes(t.key)) keys.push(t.key);
  }
  if (keys.length) c.lists.push({ name: listName, description: plainText(meta?.description ?? ""), keys });
  c.report(file.name, "letterboxd", `Lista «${listName}»`, keys.length);
}

/* ------------------------------------------------------------------ */
/* IMDb                                                                 */
/* ------------------------------------------------------------------ */

/**
 * Il «Title Type» di IMDb. Il formato vecchio lo scriveva come identificatore
 * (`tvMiniSeries`), quello del 2024 a parole (`TV Mini Series`): piegati
 * entrambi diventano la stessa chiave.
 */
function imdbType(value: string | undefined): "movie" | "tv" | "episode" | "other" {
  const t = (value ?? "").toLowerCase().replace(/[\s_-]/g, "");
  if (["movie", "tvmovie", "short", "tvshort", "video", "tvspecial", "feature"].includes(t)) return "movie";
  if (["tvseries", "tvminiseries", "series", "miniseries"].includes(t)) return "tv";
  if (t === "tvepisode" || t === "episode") return "episode";
  // Un file a mano senza la colonna: si presume un film, come fa IMDb.
  if (!t) return "movie";
  return "other";
}

function readImdb(c: Collector, file: SourceFile, records: Record<string, string>[], headers: string[]) {
  const isList = headers.includes("position");
  let used = 0;
  let episodes = 0;
  let other = 0;
  for (const r of records) {
    const imdbId = imdbIdOf(r.const);
    const title = (r.title ?? "").trim();
    if (!imdbId || !title) {
      c.skip("righe senza titolo");
      continue;
    }
    const type = imdbType(r.titletype);
    if (type === "episode") {
      episodes++;
      continue;
    }
    if (type === "other") {
      other++;
      continue;
    }
    used++;
    const genres = (r.genres ?? "").toLowerCase();
    const kind: Kind = genres.includes("documentary") ? "doc" : type === "tv" ? "serie" : "film";
    const t = c.title(`imdb:${imdbId}`, {
      source: "imdb",
      title,
      year: parseYear(r.year),
      mediaType: type,
      kind,
      imdbId,
      tmdbId: null,
      runtime: positiveInt(r.runtimemins),
      // I nomi delle persone non hanno lingua; i generi sì, e restano a TMDB,
      // che li dà in italiano come al resto della libreria.
      director: (r.directors ?? "").split(",")[0]?.trim() ?? "",
      platform: null,
    });
    const vote = parseVote(r.yourrating, 10);
    if (!isList || vote !== null) {
      c.watched(t);
      c.vote(t, vote, 2);
      c.added(t, parseDay(r.daterated ?? ""));
    } else {
      c.wanted(t);
      c.added(t, parseDay(r.created ?? ""));
    }
  }
  c.skip("episodi votati uno per uno su IMDb (la serie conta per sé)", episodes);
  c.skip("videogiochi, podcast e altro che non è cinema né TV", other);
  c.report(file.name, "imdb", isList ? "Watchlist o lista" : "Voti", used);
}

/* ------------------------------------------------------------------ */
/* Netflix                                                              */
/* ------------------------------------------------------------------ */

/**
 * La parte di un titolo di Netflix che dice «da qui in poi è una puntata»:
 * `Stagione 2`, `Season 1`, `Parte 3`, `Miniserie`, `Limited Series`… Conta
 * solo se dopo c'è ancora qualcosa — il titolo della puntata — perché
 * «Kill Bill: Volume 1» e «Harry Potter e i doni della morte: Parte 1» sono
 * film, e lo si capisce proprio dal fatto che finiscono lì.
 */
const SEASON_SEGMENT =
  /^(stagione|season|staffel|temporada|saison|seizoen|sezon|parte|part|volume|vol\.?|libro|book|collezione|collection|capitolo|chapter|serie limitata|miniserie|limited series|stagione unica)\b/i;
const EPISODE_SEGMENT = /^(episodio|episode|ep\.?|capitolo|chapter|puntata)\s*\d+/i;

export interface NetflixTitle {
  show: string;
  /** Stagione e puntata, quando è una serie. */
  episode: string | null;
}

export function parseNetflixTitle(raw: string): NetflixTitle {
  const segments = raw.split(": ").map((s) => s.trim());
  for (let i = 1; i < segments.length - 1; i++) {
    if (SEASON_SEGMENT.test(segments[i])) {
      return { show: segments.slice(0, i).join(": "), episode: segments.slice(i).join(": ") };
    }
  }
  if (segments.length >= 2 && EPISODE_SEGMENT.test(segments[segments.length - 1])) {
    return { show: segments.slice(0, -1).join(": "), episode: segments[segments.length - 1] };
  }
  return { show: raw.trim(), episode: null };
}

/** Due giorni di fila sullo stesso film sono una visione a puntate, non due visioni. */
const SAME_VIEWING_DAYS = 3;

function daysApart(a: string, b: string): number {
  return Math.abs(Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000;
}

function readNetflix(c: Collector, file: SourceFile, records: Record<string, string>[]) {
  const order = detectDayOrder(records.map((r) => r.date ?? ""));
  const episodesByShow = new Map<string, Map<string, Set<string>>>();
  const movieDays = new Map<string, Set<string>>();
  let used = 0;

  for (const r of records) {
    const raw = (r.title ?? "").trim();
    const day = parseDay(r.date ?? "", order);
    if (!raw || !day) {
      c.skip("righe di Netflix senza titolo o data leggibile");
      continue;
    }
    used++;
    const { show, episode } = parseNetflixTitle(raw);
    const isSeries = episode !== null;
    const t = c.title(`nf:${foldTitle(show)}`, {
      source: "netflix",
      title: show,
      year: null,
      mediaType: isSeries ? "tv" : "movie",
      kind: isSeries ? "serie" : "film",
      imdbId: null,
      tmdbId: null,
      runtime: null,
      director: "",
      platform: "Netflix",
    });
    c.added(t, day);
    if (isSeries) {
      c.watched(t, "In visione");
      const byDay = episodesByShow.get(t.key) ?? new Map<string, Set<string>>();
      const set = byDay.get(day) ?? new Set<string>();
      set.add(episode);
      byDay.set(day, set);
      episodesByShow.set(t.key, byDay);
    } else {
      c.watched(t);
      const days = movieDays.get(t.key) ?? new Set<string>();
      days.add(day);
      movieDays.set(t.key, days);
    }
  }

  // Un film cominciato lunedì e finito martedì compare due volte: è una
  // visione sola, datata il giorno in cui è finito.
  for (const [key, days] of movieDays) {
    const t = c.titles.get(key);
    if (!t) continue;
    const viewings: string[] = [];
    for (const day of [...days].sort()) {
      const last = viewings[viewings.length - 1];
      if (last && daysApart(last, day) < SAME_VIEWING_DAYS) viewings[viewings.length - 1] = day;
      else viewings.push(day);
    }
    for (const day of viewings) c.watch(t, { date: day, rewatch: false });
  }

  for (const [key, byDay] of episodesByShow) {
    const t = c.titles.get(key);
    if (!t) continue;
    const distinct = new Set<string>();
    for (const [day, set] of byDay) {
      for (const e of set) distinct.add(e);
      c.watch(t, { date: day, rewatch: false, episodes: set.size });
    }
    t.episodesSeen = distinct.size;
  }
  c.report(file.name, "netflix", "Cronologia di visione", used);
}

/* ------------------------------------------------------------------ */
/* CSV generico (compreso quello che esporta CineMate)                  */
/* ------------------------------------------------------------------ */

/** Le intestazioni che vogliono dire la stessa cosa, già nella forma di `headerKey`. */
const COLUMNS = {
  title: ["title", "name", "titolo", "nome", "film", "movie", "movietitle", "originaltitle"],
  year: ["year", "anno", "releaseyear", "yearreleased"],
  imdb: ["imdbid", "imdb", "const", "imdbids"],
  tmdb: ["tmdbid", "tmdb"],
  tmdbType: ["tipotmdb", "tmdbtype", "tmdbmediatype"],
  type: ["type", "tipo", "kind", "mediatype", "titletype"],
  status: ["status", "stato"],
  vote10: ["rating10", "voto", "vote", "myrating", "yourrating", "punteggio", "score"],
  vote5: ["rating", "stars", "stelle"],
  watched: ["watcheddate", "datewatched", "watchedat", "watched", "datavisione", "vistoil", "ultimavisione", "lastwatched"],
  date: ["date", "data"],
  rewatch: ["rewatch", "rivisto", "rivisione"],
  review: ["review", "notes", "note", "recensione", "comment"],
  fav: ["favorite", "favourite", "preferito", "fav", "liked", "like"],
  seen: ["episodivisti", "episodesseen", "seen", "watchedepisodes"],
  added: ["added", "aggiunto", "dateadded", "created", "addedat"],
  tags: ["tags", "etichette"],
  platform: ["platform", "piattaforma", "service", "servizio"],
} as const;

function pick(r: Record<string, string>, names: readonly string[]): string | undefined {
  for (const n of names) if (r[n] !== undefined && r[n] !== "") return r[n];
  return undefined;
}

function genericType(value: string | undefined): { mediaType: "movie" | "tv" | null; kind: Kind | null } {
  const v = (value ?? "").toLowerCase().replace(/[\s_-]/g, "");
  if (!v) return { mediaType: null, kind: null };
  if (v.startsWith("anime")) return { mediaType: "tv", kind: "anime" };
  if (v.startsWith("doc")) return { mediaType: null, kind: "doc" };
  if (["tv", "serie", "series", "show", "tvshow", "tvseries", "tvminiseries", "miniserie", "miniseries", "episode", "episodes"].includes(v))
    return { mediaType: "tv", kind: "serie" };
  if (["movie", "movies", "film", "films", "tvmovie", "short"].includes(v)) return { mediaType: "movie", kind: "film" };
  return { mediaType: null, kind: null };
}

function genericStatus(value: string | undefined): Status | null {
  const v = (value ?? "").toLowerCase().trim();
  if (!v) return null;
  if (/^(visto|watched|completed|completato|finito|seen|done)$/.test(v)) return "Visto";
  if (/^(in visione|watching|in corso|current|currentlywatching)$/.test(v)) return "In visione";
  if (/^(da vedere|watchlist|plan to watch|plantowatch|planned|to watch|towatch|want to watch)$/.test(v)) return "Da vedere";
  if (/^(abbandonato|dropped|abandoned)$/.test(v)) return "Abbandonato";
  if (/^(in pausa|on hold|onhold|paused)$/.test(v)) return "In pausa";
  return null;
}

const PLATFORM_NAMES: Record<string, Platform> = {
  netflix: "Netflix",
  primevideo: "Prime Video",
  amazonprimevideo: "Prime Video",
  disney: "Disney+",
  disneyplus: "Disney+",
  appletv: "Apple TV+",
  appletvplus: "Apple TV+",
  skynow: "Sky / NOW",
  sky: "Sky / NOW",
  now: "Sky / NOW",
  hbomax: "HBO Max",
  max: "HBO Max",
  paramount: "Paramount+",
  paramountplus: "Paramount+",
  crunchyroll: "Crunchyroll",
  mubi: "MUBI",
  raiplay: "RaiPlay",
  cinema: "Cinema",
};

function platformOf(value: string | undefined): Platform | null {
  const v = (value ?? "").toLowerCase().replace(/[^a-z]/g, "");
  return PLATFORM_NAMES[v] ?? null;
}

function readGeneric(c: Collector, file: SourceFile, records: Record<string, string>[]) {
  const watchedValues = records.map((r) => pick(r, COLUMNS.watched) ?? pick(r, COLUMNS.date) ?? "");
  const order = detectDayOrder(watchedValues);
  // «rating» da solo è ambiguo: cinque stelle su Letterboxd, dieci altrove.
  // Lo decide la colonna intera — un solo 7 basta a dire che è su dieci.
  const fiveScale = records.every((r) => {
    const n = Number((pick(r, COLUMNS.vote5) ?? "").replace(",", "."));
    return !Number.isFinite(n) || n <= 5;
  });
  let used = 0;

  for (const r of records) {
    const title = (pick(r, COLUMNS.title) ?? "").trim();
    if (!title) {
      c.skip("righe senza titolo");
      continue;
    }
    used++;
    const year = parseYear(pick(r, COLUMNS.year));
    const imdbId = imdbIdOf(pick(r, COLUMNS.imdb));
    const tmdbId = positiveInt(pick(r, COLUMNS.tmdb));
    const typed = genericType(pick(r, COLUMNS.type));
    const tmdbType = (pick(r, COLUMNS.tmdbType) ?? "").toLowerCase();
    const mediaType: "movie" | "tv" | null = tmdbType === "tv" || tmdbType === "movie" ? tmdbType : typed.mediaType;
    const key = tmdbId
      ? `tmdb:${mediaType ?? "movie"}:${tmdbId}`
      : imdbId
        ? `imdb:${imdbId}`
        : `csv:${foldTitle(title)}|${year ?? ""}`;
    const t = c.title(key, {
      source: "csv",
      title,
      year,
      mediaType,
      kind: typed.kind ?? (mediaType === "tv" ? "serie" : null),
      imdbId,
      tmdbId,
      runtime: null,
      director: "",
      platform: platformOf(pick(r, COLUMNS.platform)),
    });

    const vote = pick(r, COLUMNS.vote10) !== undefined ? parseVote(pick(r, COLUMNS.vote10), 10) : parseVote(pick(r, COLUMNS.vote5), fiveScale ? 5 : 10);
    const watchedRaw = pick(r, COLUMNS.watched) ?? pick(r, COLUMNS.date);
    const day = watchedRaw ? parseDay(watchedRaw, order) : null;
    const declared = genericStatus(pick(r, COLUMNS.status));
    const seen = positiveInt(pick(r, COLUMNS.seen));

    if (declared === "Abbandonato" || declared === "In pausa") {
      // Sono scelte, non gradini: valgono così come sono scritte.
      t.listOnly = false;
      if (!WATCHED.includes(t.status)) t.status = declared;
    } else if (declared === "Da vedere") {
      c.wanted(t);
    } else if (declared || day || vote !== null) {
      c.watched(t, declared ?? "Visto");
    } else {
      c.wanted(t);
    }
    c.vote(t, vote, 1);
    if (day) {
      const isSeries = mediaType === "tv";
      c.watch(t, isSeries ? { date: day, rewatch: false, episodes: 1 } : { date: day, rewatch: yes(pick(r, COLUMNS.rewatch)) });
    }
    if (seen) t.episodesSeen = Math.max(t.episodesSeen ?? 0, seen);
    if (yes(pick(r, COLUMNS.fav))) t.fav = true;
    const review = pick(r, COLUMNS.review);
    if (review) c.note(t, plainText(review));
    const tags = pick(r, COLUMNS.tags);
    if (tags) c.note(t, `Etichette: ${tags}`);
    c.added(t, parseDay(pick(r, COLUMNS.added) ?? "", order));
  }
  c.report(file.name, "csv", "Elenco di titoli", used);
}

/* ------------------------------------------------------------------ */
/* Ingresso                                                             */
/* ------------------------------------------------------------------ */

/** Quale servizio ha scritto il file: lo dicono le colonne, e il nome quando le colonne sono troppo generiche. */
export function detectSource(name: string, headers: string[], firstCell: string): ImportSource | null {
  if (/^letterboxd list export/i.test(firstCell.trim())) return "letterboxd";
  // L'export di Letterboxd scrive «Name»; il formato d'*import* — quello che
  // producono gli strumenti di terzi, da Trakt o da Plex — scrive «Title», e
  // lo legge meglio il lettore generico, che conosce tmdbID e Rating10.
  if ((headers.includes("letterboxduri") || headers.includes("uri")) && headers.includes("name")) return "letterboxd";
  if (headers.includes("const") && (headers.includes("titletype") || headers.includes("yourrating") || headers.includes("position")))
    return "imdb";
  const meaningful = headers.filter(Boolean);
  if (meaningful.length === 2 && meaningful.includes("title") && meaningful.includes("date")) return "netflix";
  if (/netflix/i.test(name) && meaningful.includes("title") && meaningful.includes("date")) return "netflix";
  // Un export di Letterboxd con le colonne ridotte a Name e Year, che è come
  // lo scrivono molti strumenti di terzi.
  const lbFile = /(^|\/)(watched|ratings|diary|reviews|watchlist)\.csv$|(^|\/)(likes|lists)\//i.test(name);
  if (lbFile && meaningful.includes("name") && meaningful.includes("year")) return "letterboxd";
  if (COLUMNS.title.some((h) => meaningful.includes(h))) return "csv";
  return null;
}

/**
 * I file di un export di Letterboxd che non parlano di film: il profilo, i
 * commenti, i «mi piace» a liste e recensioni altrui, e le cartelle di ciò che
 * hai cancellato. Si saltano in silenzio — elencarli come «non riconosciuti»
 * farebbe pensare a un problema che non c'è.
 */
function isLetterboxdExtra(path: string): boolean {
  const lower = path.toLowerCase();
  return (
    /(^|\/)(deleted|orphaned)\//.test(lower) ||
    /(^|\/)likes\/(lists|reviews)\.csv$/.test(lower) ||
    /(^|\/)(profile|comments)\.csv$/.test(lower)
  );
}

/** Tutti i file scelti — i CSV di uno ZIP o quelli presi uno per uno — in un insieme solo. */
export function readImportFiles(files: SourceFile[]): ImportBundle {
  const c = new Collector();
  for (const file of files) {
    if (isLetterboxdExtra(file.name)) continue;
    const rows = parseCsv(file.text);
    const { headers, records } = rowsAsRecords(rows);
    const firstCell = rows.find((r) => r.some((cell) => cell.trim()))?.[0] ?? "";
    const source = detectSource(file.name, headers, firstCell);
    switch (source) {
      case "letterboxd":
        readLetterboxd(c, file, rows);
        break;
      case "imdb":
        readImdb(c, file, records, headers);
        break;
      case "netflix":
        readNetflix(c, file, records);
        break;
      case "csv":
        readGeneric(c, file, records);
        break;
      default:
        c.report(file.name, null, "Non riconosciuto", records.length);
    }
  }
  return c.bundle();
}

/* ------------------------------------------------------------------ */
/* Il piano: cosa entra, cosa si aggiorna, cosa va nel diario           */
/* ------------------------------------------------------------------ */

/** Quello che TMDB ha detto di un titolo importato. Tenuto minimo: è ciò che serve al piano. */
export interface ImportMatch {
  tmdbId: number;
  mediaType: "movie" | "tv";
  title: string;
  year: number | null;
  posterPath: string | null;
  kind: Kind;
  overview?: string;
}

export interface ImportOptions {
  /** I titoli della watchlist (e delle liste IMDb) entrano come «Da vedere». */
  watchlist: boolean;
  /** Le liste di Letterboxd diventano liste di CineMate, con i titoli che contengono. */
  lists: boolean;
  /** I titoli che TMDB non ha riconosciuto entrano lo stesso, col nome del file. */
  unmatched: boolean;
}

export const DEFAULT_IMPORT_OPTIONS: ImportOptions = { watchlist: true, lists: true, unmatched: true };

type NewItem = Omit<Item, "id" | "added">;

export interface PlannedDiary {
  index?: number;
  itemId?: string;
  date: string;
  action: HistoryEntry["action"];
  count?: number;
}

export interface ImportPlan {
  incoming: NewItem[];
  addedDates: (string | undefined)[];
  updates: { id: string; patch: Partial<Item> }[];
  diary: PlannedDiary[];
  lists: { name: string; members: ({ index: number } | { itemId: string })[] }[];
  summary: {
    added: number;
    addedByStatus: Partial<Record<Status, number>>;
    updated: number;
    unchanged: number;
    diary: number;
    /** Voci del diario che c'erano già, saltate per non contarle due volte. */
    duplicateDiary: number;
    lists: number;
    unmatched: number;
    /** Esclusi dalle opzioni (watchlist spenta, non riconosciuti spenti…). */
    excluded: number;
  };
}

function isSeriesKind(kind: Kind | null, mediaType: "movie" | "tv" | null): boolean {
  return mediaType === "tv" || kind === "serie" || kind === "anime";
}

/** Due righe che dopo l'abbinamento risultano lo stesso titolo diventano una. */
function combine(a: ImportedTitle, b: ImportedTitle): ImportedTitle {
  const rank = (s: Status) => (s === "Visto" ? 3 : s === "In visione" ? 2 : s === "Da vedere" ? 0 : 1);
  const watches = [...a.watches];
  for (const w of b.watches) if (!watches.some((x) => x.date === w.date && x.rewatch === w.rewatch)) watches.push(w);
  watches.sort((x, y) => x.date.localeCompare(y.date));
  return {
    ...a,
    status: rank(b.status) > rank(a.status) ? b.status : a.status,
    vote: a.vote ?? b.vote,
    fav: a.fav || b.fav,
    watches,
    addedDate: [a.addedDate, b.addedDate].filter((d): d is string => !!d).sort()[0] ?? null,
    notes: [a.notes, b.notes].filter(Boolean).filter((n, i, all) => all.indexOf(n) === i).join("\n\n"),
    episodesSeen: Math.max(a.episodesSeen ?? 0, b.episodesSeen ?? 0) || null,
    imdbId: a.imdbId ?? b.imdbId,
    tmdbId: a.tmdbId ?? b.tmdbId,
    runtime: a.runtime ?? b.runtime,
    director: a.director || b.director,
    platform: a.platform ?? b.platform,
    listOnly: a.listOnly && b.listOnly,
  };
}

/**
 * Le visioni di un film nell'ordine giusto: la prima è «la» visione, le altre
 * sono rivisioni — anche quando il file non lo dice, perché due «prima volta»
 * per lo stesso film non esistono. Una voce che il file dichiara rivisione
 * resta tale anche se è la prima che conosciamo: vuol dire che l'avevi visto
 * prima di cominciare a tenere il diario.
 */
function filmActions(watches: ImportedWatch[], alreadyWatched: boolean): HistoryEntry["action"][] {
  let first = !alreadyWatched;
  return watches.map((w) => {
    if (!w.rewatch && first) {
      first = false;
      return "watched";
    }
    return "rewatch";
  });
}

export function planImport(
  bundle: ImportBundle,
  items: Item[],
  history: HistoryEntry[],
  matches: Map<string, ImportMatch | null>,
  options: ImportOptions = DEFAULT_IMPORT_OPTIONS,
): ImportPlan {
  // 1. Come si ritrova un titolo nella libreria: id TMDB, id IMDb, e solo in
  // ultimo titolo e anno — che fra lingue diverse non coincide quasi mai, ed
  // è il motivo per cui l'abbinamento con TMDB viene prima.
  const byTmdb = new Map<string, Item>();
  const byImdb = new Map<string, Item>();
  const byTitleYear = new Map<string, Item>();
  const byTitle = new Map<string, Item[]>();
  for (const i of items) {
    if (i.tmdbId) byTmdb.set(`${i.tmdbMediaType ?? "movie"}:${i.tmdbId}`, i);
    if (i.imdbId) byImdb.set(i.imdbId, i);
    const folded = foldTitle(i.title);
    if (!byTitleYear.has(`${folded}|${i.year || ""}`)) byTitleYear.set(`${folded}|${i.year || ""}`, i);
    byTitle.set(folded, [...(byTitle.get(folded) ?? []), i]);
  }

  const findExisting = (t: ImportedTitle, m: ImportMatch | null): Item | undefined => {
    if (m) {
      const hit = byTmdb.get(`${m.mediaType}:${m.tmdbId}`);
      if (hit) return hit;
    }
    if (t.tmdbId) {
      const hit = byTmdb.get(`${t.mediaType ?? "movie"}:${t.tmdbId}`);
      if (hit) return hit;
    }
    if (t.imdbId) {
      const hit = byImdb.get(t.imdbId);
      if (hit) return hit;
    }
    for (const [title, year] of [
      [t.title, t.year],
      [m?.title, m?.year],
    ] as const) {
      if (!title) continue;
      const folded = foldTitle(title);
      if (year) {
        const hit = byTitleYear.get(`${folded}|${year}`);
        if (hit && (!m || !hit.tmdbId)) return hit;
      } else {
        // Senza anno (Netflix) basta il titolo, ma solo se è uno solo.
        const same = byTitle.get(folded) ?? [];
        if (same.length === 1 && (!m || !same[0].tmdbId)) return same[0];
      }
    }
    return undefined;
  };

  // 2. Righe di file diversi che sono lo stesso titolo diventano una.
  const canonical = new Map<string, { t: ImportedTitle; m: ImportMatch | null; keys: string[] }>();
  const canonicalOf = new Map<string, string>();
  for (const t of bundle.titles) {
    const m = matches.get(t.key) ?? null;
    const ck = m ? `tmdb:${m.mediaType}:${m.tmdbId}` : t.imdbId ? `imdb:${t.imdbId}` : t.key;
    canonicalOf.set(t.key, ck);
    const prev = canonical.get(ck);
    if (prev) {
      prev.t = combine(prev.t, t);
      prev.keys.push(t.key);
    } else {
      canonical.set(ck, { t, m, keys: [t.key] });
    }
  }

  const listKeys = new Set(options.lists ? bundle.lists.flatMap((l) => l.keys.map((k) => canonicalOf.get(k) ?? k)) : []);
  const historyByItem = new Map<string, HistoryEntry[]>();
  for (const h of history) historyByItem.set(h.itemId, [...(historyByItem.get(h.itemId) ?? []), h]);

  const plan: ImportPlan = {
    incoming: [],
    addedDates: [],
    updates: [],
    diary: [],
    lists: [],
    summary: { added: 0, addedByStatus: {}, updated: 0, unchanged: 0, diary: 0, duplicateDiary: 0, lists: 0, unmatched: 0, excluded: 0 },
  };
  /** Dove è finito ogni titolo canonico: un indice fra i nuovi o l'id di uno che c'era. */
  const placed = new Map<string, { index: number } | { itemId: string }>();
  const matchingRan = matches.size > 0;

  for (const [ck, { t, m }] of canonical) {
    const wantedOnly = !WATCHED.includes(t.status) && !(t.status === "Abbandonato" || t.status === "In pausa");
    const inList = listKeys.has(ck);
    if (t.listOnly && !inList) {
      plan.summary.excluded++;
      continue;
    }
    if (wantedOnly && !t.listOnly && !options.watchlist && !inList) {
      plan.summary.excluded++;
      continue;
    }
    if (!m && matchingRan && !t.tmdbId) {
      plan.summary.unmatched++;
      if (!options.unmatched) {
        plan.summary.excluded++;
        continue;
      }
    }

    const series = isSeriesKind(m?.kind ?? t.kind, m?.mediaType ?? t.mediaType);
    const existing = findExisting(t, m);

    if (existing) {
      placed.set(ck, { itemId: existing.id });
      const patch: Partial<Item> = {};
      // Lo stato sale solo da «Da vedere» (e un film «In visione» diventa
      // «Visto»): «Abbandonato» e «In pausa» sono scelte tue, non gradini.
      if (existing.status === "Da vedere" && WATCHED.includes(t.status)) patch.status = t.status;
      if (!series && existing.status === "In visione" && t.status === "Visto") patch.status = "Visto";
      if (existing.vote === null && t.vote !== null) patch.vote = t.vote;
      if (!existing.fav && t.fav) patch.fav = true;
      if (!existing.notes && t.notes) patch.notes = t.notes;
      if (!existing.imdbId && t.imdbId) patch.imdbId = t.imdbId;
      if (!existing.tmdbId && m) {
        patch.tmdbId = m.tmdbId;
        patch.tmdbMediaType = m.mediaType;
        if (!existing.posterPath && m.posterPath) patch.posterPath = m.posterPath;
      }
      if (existing.platform === "Altro" && t.platform) patch.platform = t.platform;
      if (series && t.episodesSeen && t.episodesSeen > (existing.seen || 0)) {
        patch.seen = existing.episodes ? Math.min(existing.episodes, t.episodesSeen) : t.episodesSeen;
      }

      // Il diario: solo i giorni che non ci sono già, così un secondo import
      // dello stesso file non conta niente due volte.
      const known = historyByItem.get(existing.id) ?? [];
      const knownDays = new Set(known.map((h) => `${h.date}|${h.action === "episode" ? "episode" : "view"}`));
      const fresh = t.watches.filter((w) => {
        const dup = knownDays.has(`${w.date}|${series ? "episode" : "view"}`);
        if (dup) plan.summary.duplicateDiary++;
        return !dup;
      });
      if (series) {
        for (const w of fresh) plan.diary.push({ itemId: existing.id, date: w.date, action: "episode", count: w.episodes ?? 1 });
      } else {
        const actions = filmActions(fresh, known.some((h) => h.action === "watched"));
        fresh.forEach((w, i) => plan.diary.push({ itemId: existing.id, date: w.date, action: actions[i] }));
        const rewatches = actions.filter((a) => a === "rewatch").length;
        if (rewatches) patch.rewatch = (existing.rewatch || 0) + rewatches;
      }

      if (Object.keys(patch).length) {
        plan.updates.push({ id: existing.id, patch });
        plan.summary.updated++;
      } else if (fresh.length === 0) {
        plan.summary.unchanged++;
      } else {
        plan.summary.updated++;
      }
      continue;
    }

    const index = plan.incoming.length;
    placed.set(ck, { index });
    const kind: Kind = m?.kind ?? t.kind ?? (series ? "serie" : "film");
    const actions = series ? [] : filmActions(t.watches, false);
    const status: Status = t.listOnly ? "Da vedere" : t.status;
    plan.incoming.push({
      title: m?.title || t.title,
      kind,
      year: m?.year ?? t.year ?? 0,
      genre: "",
      status,
      vote: t.vote,
      platform: t.platform ?? "Altro",
      runtime: t.runtime ?? 0,
      episodes: null,
      seen: series ? (t.episodesSeen ?? 0) : 0,
      seasons: null,
      fav: t.fav,
      rewatch: actions.filter((a) => a === "rewatch").length,
      overview: m?.overview ?? "",
      director: t.director,
      cast: [],
      similar: [],
      notes: t.notes,
      tmdbId: m?.tmdbId ?? t.tmdbId ?? null,
      tmdbMediaType: m?.mediaType ?? (t.tmdbId ? t.mediaType ?? "movie" : null),
      imdbId: t.imdbId,
      posterPath: m?.posterPath ?? null,
      trailerUrl: null,
      links: [],
    });
    // Senza data d'ingresso vale la prima visione: un film visto nel 2019
    // non è «aggiunto di recente» solo perché è arrivato oggi.
    plan.addedDates.push(t.addedDate ?? t.watches[0]?.date ?? undefined);
    plan.summary.added++;
    plan.summary.addedByStatus[status] = (plan.summary.addedByStatus[status] ?? 0) + 1;
    if (series) {
      for (const w of t.watches) plan.diary.push({ index, date: w.date, action: "episode", count: w.episodes ?? 1 });
    } else {
      t.watches.forEach((w, i) => plan.diary.push({ index, date: w.date, action: actions[i] }));
    }
  }

  plan.summary.diary = plan.diary.length;

  if (options.lists) {
    for (const list of bundle.lists) {
      const members: ({ index: number } | { itemId: string })[] = [];
      const seen = new Set<string>();
      for (const key of list.keys) {
        const ck = canonicalOf.get(key) ?? key;
        const where = placed.get(ck);
        if (!where || seen.has(ck)) continue;
        seen.add(ck);
        members.push(where);
      }
      if (members.length) plan.lists.push({ name: list.name, members });
    }
    plan.summary.lists = plan.lists.length;
  }
  return plan;
}
