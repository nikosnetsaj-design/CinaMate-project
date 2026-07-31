import type { Item } from "../types";
import { candidatesFor, looksLikeFile } from "../lib/sourceTemplate";
import { discoverOnHosts } from "./discoverOnHost";
import { isHlsUrl } from "./fromLibrary";
import type { SourceLookup } from "./fromLibrary";

/**
 * Where a title's stream comes from.
 *
 * One rule everywhere: **any address is allowed, and what it is gets worked out
 * here.** An address that already points at a file plays as it is; anything else
 * — a server, a folder, a pattern with a placeholder — is something to search
 * under, for this title. That holds for the field on the single title
 * (player → Sorgenti) exactly as it does for the three fields in Settings,
 * because being told "wrong, it has to end in .m3u8" is not an answer anyone
 * wants from a box that could go and look instead.
 *
 * The order in which things are tried:
 *
 *   1. the address set for that one title, if it is a file — you put it there;
 *   2. an `.m3u8` among its personal links;
 *   3. everything the addresses can build for this title: the title's own
 *      address first, then the three in Settings, then the hosts
 *      (see sourceAddresses.ts), each tried until one answers;
 *   4. failing all that, the folder listings of those same addresses, read to
 *      find the file whose name matches the title.
 */

export type ResolvedSource = {
  url: string;
  /** How it was found — shown in the UI so the origin is never a mystery. */
  via: "titolo" | "link" | "modello" | "indice";
  /** Index of the address that produced it, when via === "modello". */
  templateIndex?: number;
  /**
   * Set when you gave this exact address for this exact title, so it is used
   * without asking the network first.
   */
  trusted?: boolean;
};

/** Everything that could serve this title, cheapest-to-know first. */
export function candidateSources(
  item: Item,
  lookup: SourceLookup,
  addresses: string[],
): ResolvedSource[] {
  const out: ResolvedSource[] = [];
  const own = lookup(item.id).manifestUrl?.trim();

  // The title's own address, when it is already a file: nothing to search for.
  if (own && looksLikeFile(own)) out.push({ url: own, via: "titolo", trusted: true });

  const link = item.links.find(isHlsUrl);
  if (link && link !== own) out.push({ url: link, via: "link", trusted: true });

  // The title's own address goes in front of the shared ones: it was written
  // for this title, so it is the better guess.
  const all = own && !looksLikeFile(own) ? [own, ...addresses] : addresses;
  const applicable = all.map((a, i) => ({ a, i })).filter(({ a }) => a.trim());
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
 * A source pinned to the title (its own file address, or an `.m3u8` link) is
 * trusted without a probe: you put it there, and a probe would only add a round
 * trip and a CORS failure mode. Built addresses are guesses by nature, so those
 * are checked — that check is what makes "try host 1, then 2, then 3" work
 * without you doing anything.
 */
export async function resolvePlayable(
  item: Item,
  lookup: SourceLookup,
  addresses: string[],
  signal?: AbortSignal,
): Promise<ResolvedSource | null> {
  const candidates = candidateSources(item, lookup, addresses);
  const pinned = candidates.find((c) => c.trusted);
  if (pinned) return pinned;

  const guessed = await firstResponding(candidates, signal);
  if (guessed) return guessed;

  // Nothing was where it would have been. Ask the folders themselves, the
  // title's own address first.
  const own = lookup(item.id).manifestUrl?.trim();
  const bases = own && !looksLikeFile(own) ? [own, ...addresses] : addresses;
  const found = await discoverOnHosts(item, bases, signal);
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
