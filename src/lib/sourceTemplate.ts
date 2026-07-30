import type { Item } from "../types";

/**
 * Address patterns for your own sources, written once in Settings instead of
 * pasted per title.
 *
 * The point is to remove the per-title work without turning CineMate into
 * something that goes looking for content: a pattern only ever produces an
 * address on a host *you* named, built from data the app already has. It never
 * queries a catalogue, follows a search page or reads a listing — it fills in
 * the blanks and asks whether that exact address answers.
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

// The library records episodes seen as one running total, not per season, so
// there is no honest way to derive a current season from it. `{s}` is a fixed 1
// — enough for the common "one long season" layout, and documented as such
// rather than guessed at.
const SEASON = "1";

function nextEpisodeOf(item: Item): string {
  // The episode you would watch next, which is the one after those already
  // seen — the same number the library shows as progress.
  return String((item.seen || 0) + 1);
}

export function fillTemplate(template: string, item: Item): string {
  return template
    .replace(/\{titolo\}/gi, encodeURIComponent(item.title))
    .replace(/\{slug\}/gi, slugify(item.title))
    .replace(/\{anno\}/gi, String(item.year || ""))
    .replace(/\{tmdb\}/gi, item.tmdbId == null ? "" : String(item.tmdbId))
    .replace(/\{s\}/gi, SEASON)
    .replace(/\{e\}/gi, nextEpisodeOf(item));
}

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

/**
 * Every address to try for a title, in order: the patterns that apply, filled
 * in. Malformed results are dropped rather than attempted.
 */
export function candidatesFor(item: Item, templates: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const template of templates) {
    if (!templateApplies(template, item)) continue;
    const url = fillTemplate(template.trim(), item);
    try {
      new URL(url);
    } catch {
      continue;
    }
    if (seen.has(url)) continue;
    seen.add(url);
    out.push(url);
  }
  return out;
}

/** A preview of what a pattern produces, for the Settings field. */
export function previewTemplate(template: string): string {
  if (!template.trim()) return "";
  const sample: Pick<Item, "title" | "year" | "tmdbId" | "seen" | "seasons"> = {
    title: "Il Padrino",
    year: 1972,
    tmdbId: 238,
    seen: 3,
    seasons: 1,
  };
  return fillTemplate(template.trim(), sample as Item);
}
