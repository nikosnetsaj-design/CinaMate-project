/**
 * Cosa fare di quello che arriva da «Condividi» in un'altra app.
 *
 * Sul telefono CineMate installata compare fra le app a cui mandare un link
 * (`share_target` nel manifest). Arriva un titolo, un testo, un indirizzo — in
 * qualunque combinazione, perché ogni app riempie i campi a modo suo — e qui
 * si decide cosa sono:
 *
 * - un link di CineMate stessa (una lista, un titolo, «Stasera in due») → si
 *   apre com'è;
 * - una pagina di TMDB → la scheda di quel titolo, esatta;
 * - una pagina di IMDb → la scheda, tramite l'id (serve il catalogo);
 * - Letterboxd, JustWatch → il nome del film dall'indirizzo, da cercare;
 * - qualunque altra cosa → il testo, da cercare per aggiungerlo.
 */

export type Shared =
  | { kind: "app"; href: string }
  | { kind: "tmdb"; tmdbId: number; mediaType: "movie" | "tv"; title: string }
  | { kind: "imdb"; imdbId: string; title: string }
  | { kind: "search"; query: string };

const URL_RE = /https?:\/\/[^\s<>"']+/i;

function slugToTitle(slug: string): string {
  return decodeURIComponent(slug)
    .replace(/-(19|20)\d{2}$/, "")
    .replace(/[-_]+/g, " ")
    .trim()
    .replace(/^\w/, (c) => c.toUpperCase());
}

/** Il testo condiviso senza indirizzi e senza i soliti «Guarda … su …». */
function cleanText(value: string): string {
  return value
    .replace(new RegExp(URL_RE, "gi"), "")
    .replace(/\s*[|·–—-]\s*(IMDb|Letterboxd|JustWatch|TMDB|The Movie Database).*$/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

export function parseShared(params: { title?: string | null; text?: string | null; url?: string | null }, appBase: string): Shared | null {
  const title = cleanText(params.title ?? "");
  const text = params.text ?? "";
  const raw = (params.url && URL_RE.test(params.url) ? params.url : text.match(URL_RE)?.[0]) ?? "";

  if (raw) {
    let u: URL | null = null;
    try {
      u = new URL(raw);
    } catch {
      u = null;
    }
    if (u) {
      if (raw.startsWith(appBase)) return { kind: "app", href: raw };
      const host = u.hostname.replace(/^www\.|^m\./, "");
      const path = u.pathname;
      let m: RegExpMatchArray | null;
      if (host === "themoviedb.org" && (m = path.match(/^\/(movie|tv)\/(\d+)/))) {
        return { kind: "tmdb", tmdbId: Number(m[2]), mediaType: m[1] as "movie" | "tv", title };
      }
      if (host.endsWith("imdb.com") && (m = path.match(/\/title\/(tt\d+)/))) return { kind: "imdb", imdbId: m[1], title };
      if (host === "letterboxd.com" && (m = path.match(/\/film\/([^/]+)/))) return { kind: "search", query: title || slugToTitle(m[1]) };
      if (host === "justwatch.com" && (m = path.match(/\/(?:film|movie|serie-tv|tv-show|tv-series)\/([^/]+)/))) {
        return { kind: "search", query: title || slugToTitle(m[1]) };
      }
    }
  }

  const query = title || cleanText(text);
  return query ? { kind: "search", query } : null;
}
