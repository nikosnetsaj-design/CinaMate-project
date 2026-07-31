/**
 * Route preloading on intent.
 *
 * The Player chunk is larger than the whole rest of the app — hls.js sees to
 * that — and it is loaded lazily so a diary visit never pays for it. The cost
 * of that trade is a visible wait for anyone who *does* open the player.
 *
 * Preloading on intent recovers it: pointing at the link, focusing it with the
 * keyboard or beginning a tap all happen a few hundred milliseconds before the
 * navigation, which is enough for the chunk to arrive. Intent rather than idle
 * time because "download 600 KB in the background just in case" is precisely
 * the behaviour that empties a phone battery on a mobile connection.
 */

const started = new Set<string>();

function once(key: string, load: () => Promise<unknown>) {
  if (started.has(key)) return;
  started.add(key);
  // Failures are swallowed on purpose: this is speculative, and the real
  // navigation will import the same module again and surface any error there,
  // where there is a UI to show it in.
  void load().catch(() => started.delete(key));
}

export function prefetchRoute(path: string) {
  if (path.startsWith("/player")) once("player", () => import("../pages/Player"));
}

/** Spread onto a link to make hovering, focusing or touching it preload. */
export function prefetchHandlers(path: string) {
  const trigger = () => prefetchRoute(path);
  return {
    onMouseEnter: trigger,
    onFocus: trigger,
    onTouchStart: trigger,
  };
}
