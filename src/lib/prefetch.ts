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

/**
 * Le pagine a caricamento differito, per il primo pezzo dell'indirizzo. Sono
 * pezzi piccoli — decine di kB, non seicento — ma la stessa regola vale lo
 * stesso: si scaricano quando c'è un'intenzione, non «per sicurezza».
 */
const ROUTES: Record<string, () => Promise<unknown>> = {
  player: () => import("../pages/Player"),
  libreria: () => import("../pages/Library"),
  saghe: () => import("../pages/Sagas"),
  scopri: () => import("../pages/Discover"),
  cerca: () => import("../pages/Search"),
  tu: () => import("../pages/Tu"),
  critico: () => import("../pages/Critic"),
};

export function prefetchRoute(path: string) {
  const segment = path.replace(/^\//, "").split(/[/?#]/)[0];
  const load = ROUTES[segment];
  if (load) once(segment, load);
}

/** Il foglio delle Impostazioni, che si apre da un bottone e non da un indirizzo. */
export function prefetchSettings() {
  once("impostazioni", () => import("../components/SettingsSheet"));
}

/** Gli stessi tre segnali d'intenzione, per un bottone che apre le Impostazioni. */
export function settingsPrefetchHandlers() {
  return {
    onMouseEnter: prefetchSettings,
    onFocus: prefetchSettings,
    onTouchStart: prefetchSettings,
  };
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
