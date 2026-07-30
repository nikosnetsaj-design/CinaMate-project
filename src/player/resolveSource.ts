import type { Item } from "../types";
import { candidatesFor } from "../lib/sourceTemplate";
import { isHlsUrl } from "./fromLibrary";
import type { SourceLookup } from "./fromLibrary";

/**
 * Where a title's stream comes from, in priority order:
 *
 *   1. the address set for that one title in the player's Sorgenti panel;
 *   2. an `.m3u8` among its personal links;
 *   3. the address patterns configured once in Settings, tried in order.
 *
 * (3) is what removes the per-title work: write the pattern once and every
 * title on the shelf resolves through it. The patterns are also the fallback
 * chain — if the first host doesn't answer, the second is tried, then the
 * third.
 */

export type ResolvedSource = {
  url: string;
  /** How it was found — shown in the UI so the origin is never a mystery. */
  via: "titolo" | "link" | "modello";
  /** Index of the pattern that produced it, when via === "modello". */
  templateIndex?: number;
};

/** Everything that could serve this title, cheapest-to-know first. */
export function candidateSources(
  item: Item,
  lookup: SourceLookup,
  templates: string[],
): ResolvedSource[] {
  const out: ResolvedSource[] = [];

  const configured = lookup(item.id).manifestUrl?.trim();
  if (configured) out.push({ url: configured, via: "titolo" });

  const link = item.links.find(isHlsUrl);
  if (link && link !== configured) out.push({ url: link, via: "link" });

  const applicable = templates.map((t, i) => ({ t, i })).filter(({ t }) => t.trim());
  for (const { t, i } of applicable) {
    for (const url of candidatesFor(item, [t])) {
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
 * and a CORS failure mode. Pattern-built addresses are guesses by nature, so
 * those are checked — that check is what makes "try host 1, then 2, then 3"
 * work without you doing anything.
 */
export async function resolvePlayable(
  item: Item,
  lookup: SourceLookup,
  templates: string[],
  signal?: AbortSignal,
): Promise<ResolvedSource | null> {
  const candidates = candidateSources(item, lookup, templates);
  const pinned = candidates.find((c) => c.via !== "modello");
  if (pinned) return pinned;

  for (const candidate of candidates) {
    if (signal?.aborted) return null;
    if (await responds(candidate.url, signal)) return candidate;
  }
  return null;
}

const PROBE_TIMEOUT_MS = 6000;

/**
 * Whether an address serves something. Deliberately lenient: a cross-origin
 * host that doesn't send CORS headers makes `fetch` throw even when the file is
 * perfectly there, and hls.js would hit the same wall — so a failure here is
 * reported as "not usable", which is the honest answer either way.
 */
async function responds(url: string, outer?: AbortSignal): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  const onOuterAbort = () => controller.abort();
  outer?.addEventListener("abort", onOuterAbort);
  try {
    const res = await fetch(url, { method: "GET", signal: controller.signal, cache: "no-store" });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
    outer?.removeEventListener("abort", onOuterAbort);
  }
}

/** True when a title has at least one address worth trying. */
export function hasAnySource(item: Item, lookup: SourceLookup, templates: string[]): boolean {
  return candidateSources(item, lookup, templates).length > 0;
}
