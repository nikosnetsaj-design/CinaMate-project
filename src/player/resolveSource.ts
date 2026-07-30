import type { Item } from "../types";
import { candidatesFor } from "../lib/sourceTemplate";
import { discoverOnHosts } from "./discoverOnHost";
import { isHlsUrl } from "./fromLibrary";
import type { SourceLookup } from "./fromLibrary";

/**
 * Where a title's stream comes from, in priority order:
 *
 *   1. the address set for that one title in the player's Sorgenti panel;
 *   2. an `.m3u8` among its personal links;
 *   3. the addresses configured once — the three fields in Settings and the
 *      hosts in the player's Host panel (see sourceAddresses.ts) — either
 *      written as a pattern or left bare, in which case the usual layouts under
 *      them are tried;
 *   4. failing all that, the folder listing of those same addresses, read to
 *      find the file whose name matches the title.
 *
 * (3) and (4) are what remove the per-title work: name your server once and
 * every title on the shelf resolves through it. They are also the fallback
 * chain — if the first host doesn't answer, the second is tried, then the
 * third.
 */

export type ResolvedSource = {
  url: string;
  /** How it was found — shown in the UI so the origin is never a mystery. */
  via: "titolo" | "link" | "modello" | "indice";
  /** Index of the address that produced it, when via === "modello". */
  templateIndex?: number;
};

/** Everything that could serve this title, cheapest-to-know first. */
export function candidateSources(
  item: Item,
  lookup: SourceLookup,
  addresses: string[],
): ResolvedSource[] {
  const out: ResolvedSource[] = [];

  const configured = lookup(item.id).manifestUrl?.trim();
  if (configured) out.push({ url: configured, via: "titolo" });

  const link = item.links.find(isHlsUrl);
  if (link && link !== configured) out.push({ url: link, via: "link" });

  const applicable = addresses.map((a, i) => ({ a, i })).filter(({ a }) => a.trim());
  for (const { a, i } of applicable) {
    for (const url of candidatesFor(item, [a])) {
      if (out.some((c) => c.url === url)) continue;
      out.push({ url, via: "modello", templateIndex: i });
    }
  }
  return out;
}

/**
 * The first candidate that actually answers.
 *
 * A source that is already pinned to the title (panel or link) is trusted
 * without a probe: you put it there, and a probe would only add a round trip
 * and a CORS failure mode. Built addresses are guesses by nature, so those are
 * checked — that check is what makes "try host 1, then 2, then 3" work without
 * you doing anything.
 */
export async function resolvePlayable(
  item: Item,
  lookup: SourceLookup,
  addresses: string[],
  signal?: AbortSignal,
): Promise<ResolvedSource | null> {
  const candidates = candidateSources(item, lookup, addresses);
  const pinned = candidates.find((c) => c.via !== "modello");
  if (pinned) return pinned;

  const guessed = await firstResponding(candidates, signal);
  if (guessed) return guessed;

  // Nothing was where it would have been. Ask the folders themselves.
  const found = await discoverOnHosts(item, addresses, signal);
  return found ? { url: found, via: "indice" } : null;
}

const PROBE_TIMEOUT_MS = 5000;
/**
 * How many addresses are asked at once. A bare address expands into a couple of
 * dozen candidates, and asking them strictly one after another meant a title
 * that resolves on the twentieth spent two minutes on a spinner. The batch
 * keeps the priority order — the earliest one that answers within a batch wins,
 * regardless of which came back first — while cutting the wait to a few
 * seconds.
 */
const PROBE_BATCH = 6;

async function firstResponding(
  candidates: ResolvedSource[],
  signal?: AbortSignal,
): Promise<ResolvedSource | null> {
  for (let start = 0; start < candidates.length; start += PROBE_BATCH) {
    if (signal?.aborted) return null;
    const batch = candidates.slice(start, start + PROBE_BATCH);
    const answers = await Promise.all(batch.map((c) => responds(c.url, signal)));
    const hit = batch.find((_, i) => answers[i]);
    if (hit) return hit;
  }
  return null;
}

/**
 * Whether an address serves something. `HEAD` first, so a probe never pulls
 * down a video that a `GET` would have started streaming; servers that don't
 * implement it get a second chance with a one-byte range request.
 *
 * Deliberately lenient about failures: a cross-origin host that doesn't send
 * CORS headers makes `fetch` throw even when the file is perfectly there, and
 * hls.js would hit the same wall — so a failure here is reported as "not
 * usable", which is the honest answer either way.
 */
async function responds(url: string, outer?: AbortSignal): Promise<boolean> {
  if (await request(url, { method: "HEAD" }, outer)) return true;
  return request(url, { method: "GET", headers: { Range: "bytes=0-0" } }, outer);
}

async function request(url: string, init: RequestInit, outer?: AbortSignal): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  const onOuterAbort = () => controller.abort();
  outer?.addEventListener("abort", onOuterAbort);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
    outer?.removeEventListener("abort", onOuterAbort);
  }
}

/** True when a title has at least one address worth trying. */
export function hasAnySource(item: Item, lookup: SourceLookup, addresses: string[]): boolean {
  return candidateSources(item, lookup, addresses).length > 0;
}
