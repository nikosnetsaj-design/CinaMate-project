import { searchTitles, type TmdbSearchResult } from "./tmdb";
import { editDistance } from "./search";

export interface ForgivingSearch {
  results: TmdbSearchResult[];
  /**
   * True when nothing matched what was typed and these came from a relaxed
   * attempt instead. The caller says so on screen: presenting a guess as a
   * result is how an app ends up looking like it can't read.
   */
  corrected: boolean;
  /** The term that actually produced these, for the "forse cercavi" line. */
  usedTerm: string;
}

function fold(value: string): string {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/**
 * Progressively more forgiving versions of what was typed.
 *
 * TMDB has no fuzzy search — `/search/multi` matches substrings, so a single
 * wrong letter anywhere in the word returns an empty list, which is exactly the
 * failure this exists to fix. What it *does* do well is match a prefix, and
 * that is the lever: cutting characters off the end walks past the typo without
 * having to guess what the right letter was. "Interstellar" misspelled with one
 * l is found by searching "Interstel".
 *
 * Dropping the final word comes first, because the other common way a search
 * misses is extra words that aren't in the official title.
 */
function relaxations(term: string): string[] {
  const attempts: string[] = [];
  const words = term.split(/\s+/).filter(Boolean);

  if (words.length > 1) {
    attempts.push(words.slice(0, -1).join(" "));
    // The distinctive word is usually the longest one, not the first.
    const longest = words.slice().sort((a, b) => b.length - a.length)[0];
    if (longest && longest.length >= 4) attempts.push(longest);
  }

  // Prefixes of the whole term, shortest cut first. Stops at four characters:
  // below that almost anything matches and the suggestions stop being about
  // what was asked for.
  const compact = words.join(" ");
  for (let cut = 1; cut <= 3; cut += 1) {
    const prefix = compact.slice(0, compact.length - cut);
    if (prefix.trim().length >= 4) attempts.push(prefix.trim());
  }

  // Deduplicated, keeping the order — each attempt costs a request.
  return attempts.filter((a, i) => a && a !== term && attempts.indexOf(a) === i);
}

/** How far a result's title is from what was typed — lower is closer. */
function closeness(title: string, term: string): number {
  const a = fold(title);
  const b = fold(term);
  if (a === b) return 0;
  if (a.startsWith(b)) return 1;
  if (a.includes(b)) return 2;
  // Bounded generously: at this point we already know it is not a clean match
  // and only want the ordering to be sensible.
  return 3 + editDistance(a.slice(0, b.length + 4), b, 8);
}

/**
 * Searches TMDB and, when the term as typed finds nothing, tries again with
 * relaxed versions of it rather than reporting "nessun titolo trovato".
 *
 * Results from a relaxed attempt are re-sorted by how close their title is to
 * what was actually typed, so the title being reached for comes first even
 * though TMDB ranked the list by its own popularity.
 */
export async function searchTitlesForgiving(
  term: string,
  apiKey: string,
  signal?: AbortSignal,
): Promise<ForgivingSearch> {
  const query = term.trim();
  const direct = await searchTitles(query, apiKey, signal);
  if (direct.length > 0) return { results: direct, corrected: false, usedTerm: query };

  for (const attempt of relaxations(query)) {
    if (signal?.aborted) break;
    const results = await searchTitles(attempt, apiKey, signal);
    if (results.length === 0) continue;
    const ranked = results
      .map((r) => ({ r, score: closeness(r.title, query) }))
      .sort((a, b) => a.score - b.score)
      .map((entry) => entry.r);
    return { results: ranked, corrected: true, usedTerm: attempt };
  }

  return { results: [], corrected: false, usedTerm: query };
}
