/*
 * CineMate — service worker.
 *
 * The app already keeps every byte of its data on the device, so the only
 * reason it could not be opened on a plane was the shell itself: the HTML, the
 * JavaScript and the fonts still had to come off the network. This closes that
 * gap, which is the offline browsing PRODUCT.md §3.8 asks for.
 *
 * Written by hand rather than generated. A build-time precache manifest would
 * mean a new dependency and a plugin in the build, and it buys little here: the
 * caches below fill themselves on the first visit and stay correct across
 * releases because each strategy decides freshness for itself.
 *
 * Three rules, one per kind of request:
 *
 *  - Navigations: network first. The app is a single page whose content lives
 *    in localStorage, so a stale shell is nearly harmless — but "nearly" is not
 *    "entirely", and while there is a network the newest shell is the right one.
 *    Offline, the cached shell answers and everything still works.
 *  - Built assets (hashed): cache first. The hash *is* the version, so a file
 *    that is in the cache can never be the wrong one, and going to the network
 *    for it would be pure latency.
 *  - Posters from TMDB: cache first with a cap. They never change for a given
 *    URL, and they are what makes an offline library look like a library
 *    instead of a list of gradients.
 */

const VERSION = 'v1';
const SHELL_CACHE = `cinemate-shell-${VERSION}`;
const ASSET_CACHE = `cinemate-assets-${VERSION}`;
const IMAGE_CACHE = `cinemate-images-${VERSION}`;

/** Roughly a full library's worth of posters; oldest are dropped past this. */
const MAX_IMAGES = 400;

// Everything is resolved against the registration scope rather than the origin
// root: on GitHub Pages the app is served from /<repo>/, and an absolute "/"
// here would cache the wrong document and answer navigations with someone
// else's page.
const SCOPE = new URL(self.registration.scope);
const SHELL_URL = new URL('index.html', SCOPE).toString();

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll([SHELL_URL, SCOPE.toString()]))
      // A failed precache must not leave a broken worker installed: the runtime
      // rules below will fill the cache on the first navigation anyway.
      .catch(() => undefined)
      // Activate as soon as it is installed. Waiting for every tab to close
      // would mean an update sits unused for days on a phone where the app is
      // never really closed; the page asks before reloading (see UpdatePrompt).
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('cinemate-') && !key.endsWith(VERSION))
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  // Lets the page trigger the swap it just asked the user about.
  if (event.data === 'skip-waiting') {
    self.skipWaiting();
    return;
  }

  /*
   * The page telling us which files it is actually made of.
   *
   * A worker cannot know this by itself: the filenames carry a build hash, and
   * the ones loaded on the very first visit were requested *before* this worker
   * took control, so they never passed through the fetch handler above and are
   * not in any cache. Without this the app only survived going offline from the
   * second visit onward — and "open it once with a connection" is exactly the
   * promise the offline mode makes.
   *
   * The page knows precisely what it loaded, so it sends the list.
   */
  if (event.data && event.data.type === 'cache-assets' && Array.isArray(event.data.urls)) {
    event.waitUntil(
      caches.open(ASSET_CACHE).then(async (cache) => {
        await Promise.all(
          event.data.urls.map(async (url) => {
            try {
              if (await cache.match(url, { ignoreVary: true })) return;
              await cache.add(url);
            } catch {
              // One asset that will not cache is not worth failing the rest for.
            }
          }),
        );
      }),
    );
  }
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Never touched: TMDB's JSON and Anthropic's API are answers to questions
  // asked now, and a cached one would be worse than an honest failure.
  if (url.hostname === 'api.themoviedb.org' || url.hostname.endsWith('anthropic.com')) return;

  // Video is deliberately excluded. Segments are large, already handled by the
  // download manager on IndexedDB, and caching them here would quietly fill a
  // phone's storage with a film nobody asked to keep.
  if (request.destination === 'video' || url.pathname.endsWith('.m3u8') || url.pathname.endsWith('.ts')) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
    return;
  }

  if (url.hostname === 'image.tmdb.org') {
    event.respondWith(cacheFirst(request, IMAGE_CACHE, MAX_IMAGES));
    return;
  }

  if (url.origin === SCOPE.origin) {
    event.respondWith(cacheFirst(request, ASSET_CACHE));
  }
});

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    // Only the shell is kept, under one key: caching every navigated URL would
    // store the same document once per route the user happens to visit.
    if (response.ok) {
      const cache = await caches.open(SHELL_CACHE);
      cache.put(SHELL_URL, response.clone());
    }
    return response;
  } catch {
    const cached =
      (await caches.match(SHELL_URL, { ignoreVary: true })) ??
      (await caches.match(SCOPE.toString(), { ignoreVary: true }));
    if (cached) return cached;
    return new Response(
      '<!doctype html><meta charset="utf-8"><title>CineMate</title>' +
        '<body style="font-family:system-ui;background:#1b1221;color:#f6eff6;padding:2rem">' +
        '<h1>CineMate non è disponibile offline</h1>' +
        '<p>Apri l’app una volta con la connessione attiva: da quel momento funzionerà anche senza rete.</p>',
      { headers: { 'Content-Type': 'text/html; charset=utf-8' }, status: 503 },
    );
  }
}

async function cacheFirst(request, cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  // `ignoreVary` is what makes this work at all, and it took a fetch log inside
  // the worker to see why. An asset precached by the page-priming message is
  // stored against a request the worker issued, which carries no `Origin`
  // header; the browser then asks for the same file with one, and because the
  // server answers with `Vary`, the default match treats the two as different
  // entries. The cache was full and every lookup missed — the app opened
  // offline to a blank shell whose scripts all failed.
  const cached = await cache.match(request, { ignoreVary: true });
  if (cached) return cached;
  try {
    const response = await fetch(request);
    // Opaque responses (no-cors, e.g. a poster) report status 0 and are still
    // worth keeping — that is what makes covers survive offline.
    if (response.ok || response.type === 'opaque') {
      await cache.put(request, response.clone());
      if (maxEntries) void trim(cacheName, maxEntries);
    }
    return response;
  } catch {
    // Nothing cached and no network: let the caller's own fallback happen —
    // PosterArt already draws its own artwork when an image fails.
    return Response.error();
  }
}

/** Keeps a cache bounded, dropping the oldest entries first. */
async function trim(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= maxEntries) return;
  await Promise.all(keys.slice(0, keys.length - maxEntries).map((key) => cache.delete(key)));
}
