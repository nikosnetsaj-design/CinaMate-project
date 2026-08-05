import type { Item } from "../types";
import { candidatesFor } from "../lib/sourceTemplate";
import type { EpisodePick } from "../lib/sourceTemplate";
import { discoverOnHosts } from "./discoverOnHost";
import { isHlsUrl } from "./fromLibrary";
import type { SourceLookup } from "./fromLibrary";
import type { EpisodePosition, LinkHost } from "../lib/linkHost";
import { searchOnLinkHosts } from "./searchOnLinkHost";
import type { SearchOutcome } from "./searchOnLinkHost";

/**
 * Where a title's stream comes from, in priority order:
 *
 *   1. the address set for that one title in the player's Sorgenti panel;
 *   2. an `.m3u8` among its personal links;
 *   3. the addresses configured once — the three fields in Settings and the
 *      hosts in the player's Host panel (see sourceAddresses.ts) — either
 *      written as a pattern or left bare, in which case the usual layouts under
 *      them are tried;
 *   4. failing that, the folder listing of those same addresses, read to find
 *      the file whose name matches the title;
 *   5. failing *that*, the Link Hosts: the sites you named, searched with the
 *      title's own metadata, with the `.m3u8` pulled out of whatever answers
 *      (see searchOnLinkHost.ts).
 *
 * (3) and (4) are what remove the per-title work: name your server once and
 * every title on the shelf resolves through it. They are also the fallback
 * chain — if the first host doesn't answer, the second is tried, then the
 * third.
 *
 * (5) is last on purpose, and the order is the whole argument. Steps 1–4 ask a
 * server you own for a file you know is there; step 5 asks a stranger a
 * question and reads the answer. The first four are cheap, private and almost
 * always right, so a title that resolves on your own host never touches a third
 * site at all.
 */

export type ResolvedSource = {
  url: string;
  /** How it was found — shown in the UI so the origin is never a mystery. */
  via: "titolo" | "link" | "modello" | "indice" | "sito";
  /** Index of the address that produced it, when via === "modello". */
  templateIndex?: number;
  /** The page the stream was lifted from, when via === "sito". */
  pageUrl?: string;
};

/**
 * The answer *and* what happened on the way. The player needs both: a title
 * that didn't resolve has to say whether nothing matched, or the browser
 * refused to read the page — the two lead to different next steps, and only
 * one of them is worth opening the Web Viewer for.
 */
export interface Resolution {
  source: ResolvedSource | null;
  site?: SearchOutcome;
}

/** Everything that could serve this title, cheapest-to-know first. */
export function candidateSources(
  item: Item,
  lookup: SourceLookup,
  addresses: string[],
  /**
   * La puntata scelta, quando qualcuno l'ha scelta: l'elenco degli episodi
   * nella scheda del titolo la conosce, e senza passarla di qui gli indirizzi
   * costruiti punterebbero comunque a `S01E{visti+1}` — cioè all'episodio
   * sbagliato ogni volta che ne apri uno a mano.
   */
  pick: EpisodePick = {},
): ResolvedSource[] {
  const out: ResolvedSource[] = [];

  const configured = lookup(item.id).manifestUrl?.trim();
  if (configured) out.push({ url: configured, via: "titolo" });

  const link = item.links.find(isHlsUrl);
  if (link && link !== configured) out.push({ url: link, via: "link" });

  const applicable = addresses.map((a, i) => ({ a, i })).filter(({ a }) => a.trim());
  for (const { a, i } of applicable) {
    for (const url of candidatesFor(item, [a], pick)) {
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
  options: {
    signal?: AbortSignal;
    linkHosts?: LinkHost[];
    /** Quale episodio chiedere ai siti, quando non è `S01E{visti+1}`. */
    position?: Partial<EpisodePosition>;
  } = {},
): Promise<Resolution> {
  const { signal, linkHosts = [], position } = options;
  const candidates = candidateSources(item, lookup, addresses, {
    season: position?.season,
    episode: position?.episode,
  });
  const pinned = candidates.find((c) => c.via !== "modello");
  if (pinned) return { source: pinned };

  const guessed = await firstResponding(candidates, signal);
  if (guessed) return { source: guessed };

  // Nothing was where it would have been. Ask the folders themselves.
  const found = await discoverOnHosts(item, addresses, signal);
  if (found) return { source: { url: found, via: "indice" } };

  // Still nothing of your own. Now, and only now, ask the sites.
  if (!linkHosts.length) return { source: null };
  const site = await searchOnLinkHosts(item, linkHosts, signal, position);
  return {
    source: site.kind === "flusso" ? { url: site.url, via: "sito", pageUrl: site.pageUrl } : null,
    site,
  };
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

/**
 * True when a title has at least one address worth trying — a built address, a
 * pinned one, or a site to ask. A Link Host counts even though nothing has been
 * probed yet: it is a real way for the title to start, and hiding "Guarda"
 * until after a network round trip would make the button flicker in and out.
 */
export function hasAnySource(
  item: Item,
  lookup: SourceLookup,
  addresses: string[],
  linkHosts: LinkHost[] = [],
): boolean {
  if (candidateSources(item, lookup, addresses).length > 0) return true;
  return linkHosts.some((h) => h.enabled && h.url.trim());
}
