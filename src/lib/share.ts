import type { Item } from "../types";

/**
 * Sharing without a server.
 *
 * There is no backend, so a shared list cannot live anywhere: the link *is*
 * the list. Everything needed to rebuild it travels in the URL fragment, which
 * is the one part of a URL browsers never send to a server — so even the
 * GitHub Pages host this is published on never sees what you shared.
 *
 * That also sets the ceiling. A fragment stays comfortable to perhaps a few
 * hundred titles and a QR code to far fewer, so what travels is the minimum
 * that lets the other side look a title up, not a copy of the record.
 */

export interface SharedEntry {
  /** Title — the only field that is always present. */
  t: string;
  /** Year, when known. */
  y?: number;
  /** TMDB id, so the receiving side can resolve it exactly rather than by name. */
  i?: number;
  /** TMDB media type, meaningless without `i`. */
  m?: "movie" | "tv";
}

export interface SharedList {
  /** List name. */
  n: string;
  e: SharedEntry[];
}

/**
 * base64url over UTF-8. `btoa` only accepts Latin-1, so an accented title —
 * which in an Italian library is most of them — throws without the
 * encodeURIComponent round trip.
 */
function encodeBase64Url(value: string): string {
  const utf8 = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of utf8) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decodeBase64Url(value: string): string {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function encodeList(name: string, items: Item[]): string {
  const payload: SharedList = {
    n: name,
    e: items.map((item) => ({
      t: item.title,
      ...(item.year ? { y: item.year } : {}),
      ...(item.tmdbId ? { i: item.tmdbId } : {}),
      ...(item.tmdbMediaType ? { m: item.tmdbMediaType } : {}),
    })),
  };
  return encodeBase64Url(JSON.stringify(payload));
}

export function decodeList(encoded: string): SharedList | null {
  try {
    const parsed = JSON.parse(decodeBase64Url(encoded)) as unknown;
    if (typeof parsed !== "object" || parsed === null) return null;
    const record = parsed as Partial<SharedList>;
    if (!Array.isArray(record.e)) return null;
    const entries = record.e.filter(
      (entry): entry is SharedEntry => !!entry && typeof (entry as SharedEntry).t === "string",
    );
    if (entries.length === 0) return null;
    return { n: typeof record.n === "string" ? record.n : "Lista condivisa", e: entries };
  } catch {
    // A truncated link — mail clients love to wrap long URLs — decodes to
    // nonsense rather than throwing anything specific. Either way: not a list.
    return null;
  }
}

/** Absolute URL of the app, honouring the base path it is published under. */
function appUrl(): URL {
  return new URL(import.meta.env.BASE_URL, window.location.origin);
}

export function listShareUrl(name: string, items: Item[]): string {
  const url = appUrl();
  url.hash = `lista=${encodeList(name, items)}`;
  return url.toString();
}

/**
 * A link that opens one title. Carries the TMDB id when there is one so the
 * other device resolves the same record rather than the closest name match,
 * and falls back to title plus year when there isn't.
 */
export function itemShareUrl(item: Item): string {
  const url = appUrl();
  const params = new URLSearchParams({ t: item.title });
  if (item.year) params.set("a", String(item.year));
  if (item.tmdbId) params.set("tmdb", String(item.tmdbId));
  if (item.tmdbMediaType) params.set("tipo", item.tmdbMediaType);
  url.hash = `titolo?${params.toString()}`;
  return url.toString();
}

/**
 * Un momento dentro un titolo: il collegamento apre il player esattamente a
 * quel secondo.
 *
 * Vale per te su un altro dispositivo e per chi ha lo stesso titolo sullo
 * scaffale — nessun video viaggia nel link, perché nessun video è nostro da
 * spedire. La durata viaggia con lui solo per essere scritta accanto: il player
 * parte da `t` e prosegue, non si ferma dopo trenta secondi.
 */
export function momentShareUrl(itemId: string, startSec: number, lengthSec: number): string {
  const url = appUrl();
  const base = url.pathname.endsWith("/") ? url.pathname : `${url.pathname}/`;
  url.pathname = `${base}player`;
  url.search = new URLSearchParams({
    titolo: itemId,
    t: String(Math.max(0, Math.round(startSec))),
    d: String(Math.round(lengthSec)),
  }).toString();
  return url.toString();
}

export interface SharedTitle {
  title: string;
  year: number | null;
  tmdbId: number | null;
  mediaType: "movie" | "tv" | null;
}

export function readSharedTitle(hash: string): SharedTitle | null {
  const raw = hash.replace(/^#/, "");
  if (!raw.startsWith("titolo?")) return null;
  const params = new URLSearchParams(raw.slice("titolo?".length));
  const title = params.get("t");
  if (!title) return null;
  const year = Number(params.get("a"));
  const tmdbId = Number(params.get("tmdb"));
  const mediaType = params.get("tipo");
  return {
    title,
    year: Number.isFinite(year) && year > 0 ? year : null,
    tmdbId: Number.isFinite(tmdbId) && tmdbId > 0 ? tmdbId : null,
    mediaType: mediaType === "movie" || mediaType === "tv" ? mediaType : null,
  };
}

export function readSharedList(hash: string): SharedList | null {
  const raw = hash.replace(/^#/, "");
  if (!raw.startsWith("lista=")) return null;
  return decodeList(raw.slice("lista=".length));
}

/**
 * Native share sheet when the browser has one, clipboard otherwise. Returns
 * what actually happened so the caller can say so — a silent "copied" toast
 * after the user cancelled the iOS share sheet would be a lie.
 */
export async function shareOrCopy(payload: { title: string; text?: string; url: string }): Promise<"shared" | "copied" | "failed"> {
  if (navigator.share) {
    try {
      await navigator.share(payload);
      return "shared";
    } catch (error) {
      // AbortError means the user closed the sheet on purpose; falling through
      // to the clipboard would then paste something they chose not to send.
      if (error instanceof DOMException && error.name === "AbortError") return "failed";
    }
  }
  try {
    await navigator.clipboard.writeText(payload.url);
    return "copied";
  } catch {
    return "failed";
  }
}
