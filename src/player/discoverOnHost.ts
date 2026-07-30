import type { Item } from "../types";
import { hasPlaceholder, looksLikeFile, normalizeBase, slugify } from "../lib/sourceTemplate";

/**
 * Reading the index of a folder you pointed at, when guessing the filename
 * didn't work.
 *
 * Guessed addresses (lib/sourceTemplate) only find a title whose file is named
 * the way the app would name it. Real folders aren't: the file is
 * `Il.Padrino.1972.1080p.m3u8`, or `padrino_ita`, or has the release group
 * stuck on the end. So when no guess answers, the folder itself is asked what
 * it contains, and the entry that matches the title wins.
 *
 * What this is *not*: a search engine. It reads the listing of a directory on a
 * server you named and nothing else — no catalogue, no third-party index, no
 * following links off the host. If the folder doesn't publish a listing (most
 * don't, and a cross-origin one can't be read anyway) it finds nothing and the
 * player says so.
 */

const INDEX_TIMEOUT_MS = 5000;
/** Enough for a big directory listing, small enough not to swallow a video. */
const MAX_INDEX_BYTES = 400_000;
const MEDIA_FILE = /\.(m3u8?|mp4|mkv|webm|mov)(\?|#|$)/i;

/** The folders looked into under a bare address, in order. */
function indexUrlsFor(base: string, item: Item): string[] {
  const root = normalizeBase(base);
  const slug = slugify(item.title);
  const folders =
    item.kind === "film"
      ? ["", "film/", "films/", "movies/", "video/", `${slug}/`]
      : [`${slug}/`, "serie/", "series/", "tv/", "", `serie/${slug}/`];
  return folders.map((folder) => `${root}/${folder}`);
}

/** Every media file an index page or JSON listing mentions, as absolute URLs. */
function linksIn(text: string, indexUrl: string): string[] {
  const out = new Set<string>();
  // Covers both shapes with one pass: `href="…"` in an HTML autoindex, and any
  // quoted string in a JSON listing. Both end up as a candidate path, and the
  // extension check below throws away everything that isn't a video.
  for (const match of text.matchAll(/(?:href=|["'])\s*["']?([^"'<>\s]+)["']?/gi)) {
    const raw = match[1];
    if (!raw || !MEDIA_FILE.test(raw)) continue;
    try {
      out.add(new URL(raw, indexUrl).toString());
    } catch {
      continue;
    }
  }
  return [...out];
}

/** Words worth matching on — "il", "the", "di" say nothing about which film it is. */
function significantWords(title: string): string[] {
  return slugify(title)
    .split("-")
    .filter((word) => word.length > 2);
}

/**
 * How well a filename answers to a title. Every significant word has to be in
 * there — a partial match is how you end up playing the wrong film — and the
 * year, the episode number and a shorter name break the ties.
 */
function scoreOf(url: string, item: Item): number {
  const name = slugify(decodeURIComponent(url.split("/").pop() ?? ""));
  const words = significantWords(item.title);
  if (!words.length || !words.every((word) => name.includes(word))) return 0;

  let score = 10 + words.length;
  if (item.year && name.includes(String(item.year))) score += 4;
  if (item.kind !== "film") {
    const episode = String((item.seen || 0) + 1).padStart(2, "0");
    // s01e04, 1x04, or the bare number with a separator around it.
    if (new RegExp(`(s01e${episode}|1x${episode}|-e?${episode}(-|$))`).test(name)) score += 6;
    else score -= 2;
  }
  if (/\.m3u8?$/i.test(url)) score += 2;
  // A shorter name is the plainer one: "il-padrino.m3u8" over
  // "il-padrino-trailer-teaser.m3u8".
  return score - Math.min(name.length / 40, 2);
}

async function readIndex(url: string, signal?: AbortSignal): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), INDEX_TIMEOUT_MS);
  const onAbort = () => controller.abort();
  signal?.addEventListener("abort", onAbort);
  try {
    const res = await fetch(url, { signal: controller.signal, cache: "no-store" });
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "";
    // A listing is HTML, JSON or plain text. Anything else is the video itself,
    // or a page that isn't a listing, and reading it whole would be rude.
    if (!/text\/|json|xml/i.test(type)) return null;
    const text = await res.text();
    return text.slice(0, MAX_INDEX_BYTES);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}

/** The best matching file published by any folder under the given addresses. */
export async function discoverOnHosts(
  item: Item,
  addresses: string[],
  signal?: AbortSignal,
): Promise<string | null> {
  // Only bare addresses have a folder to look into: a pattern already says
  // exactly where the file is, and a full file address is one file.
  const bases = addresses
    .map((a) => a.trim())
    .filter((a) => a && !hasPlaceholder(a) && !looksLikeFile(a));

  for (const base of bases) {
    for (const indexUrl of indexUrlsFor(base, item)) {
      if (signal?.aborted) return null;
      const text = await readIndex(indexUrl, signal);
      if (!text) continue;
      const best = linksIn(text, indexUrl)
        .map((url) => ({ url, score: scoreOf(url, item) }))
        .filter((c) => c.score > 0)
        .sort((a, b) => b.score - a.score)[0];
      if (best) return best.url;
    }
  }
  return null;
}
