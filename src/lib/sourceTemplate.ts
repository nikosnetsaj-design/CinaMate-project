import type { Item } from "../types";

/**
 * Addresses for your own sources, written once in Settings instead of pasted
 * per title.
 *
 * Two ways to write one, and you pick by how much you feel like typing:
 *
 *   - a **pattern**, with a placeholder where the title goes
 *     (`https://mio-server/film/{slug}.m3u8`) — exact, one address per title;
 *   - a **bare address**, just the server (`https://mio-server`) — the app
 *     builds the usual layouts under it (`/il-padrino.m3u8`,
 *     `/film/il-padrino/index.m3u8`, `/il-padrino/s01e04.m3u8`, …) and tries
 *     them until one answers.
 *
 * The second is there because the first asks you to know how your own server
 * spells things, which is exactly the thing nobody remembers. Either way the
 * rule is unchanged: an address is only ever built on a host *you* named, from
 * data the app already has. Nothing here queries a catalogue or goes looking
 * for a title somewhere you didn't point it.
 */

export interface TemplateField {
  token: string;
  label: string;
  example: string;
}

export const TEMPLATE_FIELDS: TemplateField[] = [
  { token: "{titolo}", label: "Titolo così com'è", example: "Il Padrino" },
  { token: "{slug}", label: "Titolo minuscolo con i trattini", example: "il-padrino" },
  { token: "{anno}", label: "Anno di uscita", example: "1972" },
  { token: "{tmdb}", label: "Id TMDB, quando il titolo è collegato", example: "238" },
  { token: "{s}", label: "Stagione — sempre 1: la libreria conta gli episodi, non le stagioni", example: "1" },
  { token: "{e}", label: "Episodio: il prossimo da vedere", example: "4" },
  { token: "{ss}", label: "Stagione a due cifre", example: "01" },
  { token: "{ee}", label: "Episodio a due cifre", example: "04" },
];

/** Lowercase, accents stripped, non-alphanumerics collapsed to single dashes. */
export function slugify(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Quale puntata cercare, quando qualcuno l'ha scelta davvero — l'elenco degli
 * episodi nella scheda del titolo, o le due caselle del pannello Siti.
 */
export interface EpisodePick {
  season?: number;
  episode?: number;
}

// Senza una scelta esplicita la stagione resta 1: la libreria conta gli episodi
// visti come un totale unico, non per stagione, quindi da lì una stagione non si
// ricava in modo onesto. È un valore dichiarato, non indovinato — ed è
// esattamente il motivo per cui l'elenco degli episodi, che la stagione la sa,
// può ora passarla di qui.
const DEFAULT_SEASON = "1";

function nextEpisodeOf(item: Item): string {
  // The episode you would watch next, which is the one after those already
  // seen — the same number the library shows as progress.
  return String((item.seen || 0) + 1);
}

function pad(value: string): string {
  return value.padStart(2, "0");
}

export function fillTemplate(template: string, item: Item, pick: EpisodePick = {}): string {
  const episode = pick.episode != null ? String(pick.episode) : nextEpisodeOf(item);
  const SEASON = pick.season != null ? String(pick.season) : DEFAULT_SEASON;
  return template
    .replace(/\{titolo\}/gi, encodeURIComponent(item.title))
    .replace(/\{slug\}/gi, slugify(item.title))
    .replace(/\{anno\}/gi, String(item.year || ""))
    .replace(/\{tmdb\}/gi, item.tmdbId == null ? "" : String(item.tmdbId))
    .replace(/\{ss\}/gi, pad(SEASON))
    .replace(/\{ee\}/gi, pad(episode))
    .replace(/\{s\}/gi, SEASON)
    .replace(/\{e\}/gi, episode);
}

const PLACEHOLDER = /\{(titolo|slug|anno|tmdb|ss|ee|s|e)\}/i;

/** Whether an address says where the title goes, or is just a server. */
export function hasPlaceholder(address: string): boolean {
  return PLACEHOLDER.test(address);
}

const MEDIA_FILE = /\.(m3u8?|mp4|mkv|webm|mov)$/i;

/** Whether an address already points at a file rather than at a directory. */
export function looksLikeFile(address: string): boolean {
  try {
    return MEDIA_FILE.test(new URL(withProtocol(address)).pathname);
  } catch {
    return MEDIA_FILE.test(address);
  }
}

/**
 * `mio-server.com/film` typed into the field means `https://mio-server.com/film`.
 * Nobody types the protocol, and an address without one isn't a URL at all —
 * so the field would silently do nothing, which is the worst possible answer.
 */
function withProtocol(address: string): string {
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(address.trim()) ? address.trim() : `https://${address.trim()}`;
}

/**
 * A bare address with its trailing slashes removed, ready to have a path
 * appended — or nothing at all when it isn't an address yet. Half of a typed
 * address is the normal state of the Settings field, and the preview under it
 * should stay quiet rather than show nonsense built out of `https://`.
 */
export function normalizeBase(address: string): string {
  const withScheme = withProtocol(address);
  try {
    if (!new URL(withScheme).hostname) return "";
  } catch {
    return "";
  }
  return withScheme.replace(/\/+$/, "");
}

/**
 * The layouts tried under a bare address, most common first.
 *
 * The order matters: each one is a real request, so the shapes that self-hosted
 * setups actually use (jellyfin-style folders, a flat dump of manifests, an
 * `index.m3u8` per title) come before the long shots.
 */
const FILM_LAYOUTS = [
  "{slug}.m3u8",
  "{slug}/index.m3u8",
  "{slug}/master.m3u8",
  "{slug}/playlist.m3u8",
  "{slug}/{slug}.m3u8",
  "{slug}-{anno}.m3u8",
  "film/{slug}.m3u8",
  "film/{slug}/index.m3u8",
  "films/{slug}.m3u8",
  "movies/{slug}/index.m3u8",
  "video/{slug}.m3u8",
  "hls/{slug}/index.m3u8",
  "{tmdb}.m3u8",
  "{titolo}.m3u8",
  "{slug}.mp4",
  "film/{slug}.mp4",
];

/**
 * The same idea for something with episodes: the address has to carry which
 * episode, and the numbering is the one the library already tracks (the next
 * one you haven't seen).
 */
const EPISODE_LAYOUTS = [
  "{slug}/s{ss}e{ee}.m3u8",
  "{slug}/{s}x{ee}.m3u8",
  "{slug}/s{ss}/e{ee}.m3u8",
  "{slug}/ep{e}.m3u8",
  "{slug}/{e}.m3u8",
  "serie/{slug}/s{ss}e{ee}.m3u8",
  "tv/{slug}/s{ss}e{ee}.m3u8",
  "{slug}/s{ss}e{ee}.mp4",
];

/**
 * A pattern is usable for a title only if every placeholder it contains can
 * actually be filled: a pattern keyed on `{tmdb}` is useless for a title that
 * was typed in by hand and never linked, and asking for it would just produce a
 * malformed address.
 */
export function templateApplies(template: string, item: Item): boolean {
  if (!template.trim()) return false;
  if (/\{tmdb\}/i.test(template) && item.tmdbId == null) return false;
  if (/\{anno\}/i.test(template) && !item.year) return false;
  return true;
}

/** Every address to try under a bare server address, for this one title. */
export function expandBase(base: string, item: Item, pick: EpisodePick = {}): string[] {
  const root = normalizeBase(base);
  if (!root) return [];
  // Something with episodes gets the episode layouts first: a series stored as
  // one file per episode is the common case, and the film layouts still follow
  // for the odd one-shot special or a series kept as a single manifest.
  const layouts = item.kind === "film" ? FILM_LAYOUTS : [...EPISODE_LAYOUTS, ...FILM_LAYOUTS];
  return layouts
    .filter((layout) => templateApplies(layout, item))
    .map((layout) => `${root}/${fillTemplate(layout, item, pick)}`);
}

/**
 * Every address to try for a title, in order. A pattern gives one address; a
 * bare server address gives the layouts under it. Malformed results are dropped
 * rather than attempted.
 */
export function candidatesFor(item: Item, addresses: string[], pick: EpisodePick = {}): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const address of addresses) {
    const raw = address.trim();
    if (!raw) continue;
    const urls = hasPlaceholder(raw)
      ? templateApplies(raw, item)
        ? [fillTemplate(withProtocol(raw), item, pick)]
        : []
      : looksLikeFile(raw)
        ? [withProtocol(raw)]
        : expandBase(raw, item, pick);
    for (const url of urls) {
      try {
        // http(s) only: this list is fed to `fetch` and to hls.js, and a
        // `file:` or `javascript:` address typed into the field is either a
        // mistake or something that has no business being requested.
        if (!/^https?:$/.test(new URL(url).protocol)) continue;
      } catch {
        continue;
      }
      if (seen.has(url)) continue;
      seen.add(url);
      out.push(url);
    }
  }
  return out;
}

const SAMPLE: Pick<Item, "title" | "year" | "tmdbId" | "seen" | "seasons" | "kind"> = {
  title: "Il Padrino",
  year: 1972,
  tmdbId: 238,
  seen: 3,
  seasons: 1,
  kind: "film",
};

/** A preview of what an address produces, for the Settings field. */
export function previewTemplate(address: string): string {
  if (!address.trim()) return "";
  return candidatesFor(SAMPLE as Item, [address])[0] ?? "";
}

/**
 * How many addresses a bare server address turns into — shown next to the
 * preview so "ne provo altri" isn't a vague promise.
 */
export function previewCount(address: string): number {
  if (!address.trim()) return 0;
  return candidatesFor(SAMPLE as Item, [address]).length;
}
