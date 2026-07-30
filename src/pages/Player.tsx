import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useLibrary } from "../store/useLibrary";
import { useSagas } from "../store/useSagas";
import { usePlayerSources } from "../store/usePlayerSources";
import { usePlayerPrefs } from "../store/usePlayerPrefs";
import { EmptyState } from "../components/EmptyState";
import VideoPlayer from "../player/components/VideoPlayer";
import DownloadManagerUI from "../player/components/DownloadManagerUI";
import WatchPartyPanel from "../player/components/WatchPartyPanel";
import MarathonBar from "../player/components/MarathonBar";
import HostManagerPanel from "../player/components/HostManagerPanel";
import { useWatchParty } from "../player/hooks/useWatchParty";
import { useMarathonMode } from "../player/hooks/useMarathonMode";
import { useHostMonitor } from "../player/hooks/useHostMonitor";
import { getLifetimeStats } from "../player/services/statsAndHistory";
import { getOfflineSourceUrl } from "../player/services/downloadService";
import { WebSocketTransport } from "../player/services/watchPartyTransport";
import { buildPlayerCatalog, originOf, streamUrlOf } from "../player/fromLibrary";
import { recommendFromLibrary } from "../player/recommendFromLibrary";
import { resolvePlayable } from "../player/resolveSource";
import { SourcePanel } from "../player/SourcePanel";
import { EMPTY_SOURCE } from "../store/usePlayerSources";
import type { MediaContent } from "../player/types";
import "../player/styles/player.css";

const IDENTITY_KEY = "cinemate:player-identity";

/**
 * hls.js's own public test stream. Shown only when nothing on the shelf has a
 * source yet, so the controls, adaptive quality and host failover are all
 * demonstrably working before a single title of your own is wired up.
 */
const TEST_STREAM: MediaContent = {
  id: "cinemate-test-stream",
  type: "movie",
  title: "Stream di test",
  posterUrl: "",
  backdropUrl: "",
  durationSec: 0,
  manifestUrl: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
  audioTracks: [],
  subtitleTracks: [],
  skipMarkers: [],
};

type Panel = "sources" | "downloads" | "party" | "hosts" | null;

const TABS: { id: Exclude<Panel, null>; label: string }[] = [
  { id: "sources", label: "Sorgenti" },
  { id: "downloads", label: "Download" },
  { id: "party", label: "Watch Party" },
  { id: "hosts", label: "Host" },
];

/**
 * Watch Party needs an id stable across reloads (so a refresh isn't a new
 * participant) but not an account — this app has none.
 *
 * Held in sessionStorage, which is per-tab, rather than localStorage, which is
 * per-browser. The default transport is BroadcastChannel, whose whole purpose is
 * syncing tabs of the same browser: with a shared id every tab looked like the
 * same participant, so each one discarded the others' play/pause as its own echo
 * and the room never worked in exactly the mode it ships in.
 */
function useStableId(): string {
  return useMemo(() => {
    try {
      const saved = sessionStorage.getItem(IDENTITY_KEY);
      if (saved) return saved;
    } catch {
      // Fall through and mint a fresh one.
    }
    const id = `u-${crypto.randomUUID().slice(0, 8)}`;
    try {
      sessionStorage.setItem(IDENTITY_KEY, id);
    } catch {
      // Best effort: an unpersisted id still works for this session.
    }
    return id;
  }, []);
}

export function Player() {
  const items = useLibrary((s) => s.items);
  const sources = usePlayerSources((s) => s.sources);
  const sagas = useSagas((s) => s.sagas);
  const orders = useSagas((s) => s.orders);
  const sagaPrefs = useSagas((s) => s.prefs);
  const prefs = usePlayerPrefs();
  const userId = useStableId();
  const [searchParams, setSearchParams] = useSearchParams();

  const lookup = useCallback((itemId: string) => sources[itemId] ?? EMPTY_SOURCE, [sources]);

  const catalog = useMemo(
    () =>
      buildPlayerCatalog(
        items,
        lookup,
        { sagas, orders, preferredOrder: sagaPrefs.order },
        prefs.sourceTemplates,
      ),
    [items, lookup, sagas, orders, sagaPrefs.order, prefs.sourceTemplates],
  );
  const playable = useMemo(() => (catalog.length ? catalog : [TEST_STREAM]), [catalog]);
  const playableIds = useMemo(() => new Set(catalog.map((c) => c.id)), [catalog]);

  // Opened from a "Guarda" button: start on that title instead of the first.
  const requestedId = searchParams.get("titolo");
  const [selectedId, setSelectedId] = useState<string | null>(requestedId);
  useEffect(() => {
    if (requestedId) setSelectedId(requestedId);
  }, [requestedId]);

  const baseContent = playable.find((c) => c.id === selectedId) ?? playable[0];

  // --- Finding a working address -------------------------------------------
  // The catalogue entry carries the *first* candidate. When that came from a
  // pattern it is a guess, so before playing we walk the candidates until one
  // answers — this is what lets you write an address once and have every title
  // resolve, and what makes the second and third slots act as fallbacks.
  const [resolved, setResolved] = useState<Record<string, string | null>>({});
  const [resolving, setResolving] = useState(false);
  const targetItem = items.find((i) => i.id === baseContent.id) ?? null;

  useEffect(() => {
    if (!targetItem) return;
    if (resolved[targetItem.id] !== undefined) return;
    const controller = new AbortController();
    setResolving(true);
    resolvePlayable(targetItem, lookup, prefs.sourceTemplates, controller.signal)
      .then((found) => {
        if (controller.signal.aborted) return;
        setResolved((r) => ({ ...r, [targetItem.id]: found?.url ?? null }));
      })
      .finally(() => {
        if (!controller.signal.aborted) setResolving(false);
      });
    return () => controller.abort();
  }, [targetItem, lookup, prefs.sourceTemplates, resolved]);

  const resolvedUrl = targetItem ? resolved[targetItem.id] : undefined;
  const networkContent = useMemo(
    () => (resolvedUrl ? { ...baseContent, manifestUrl: resolvedUrl } : baseContent),
    [baseContent, resolvedUrl],
  );

  // --- Offline playback -----------------------------------------------------
  // A completed download is played by handing hls.js a blob playlist built from
  // the stored segments, so every other feature (seeking, subtitles, skip
  // markers) keeps working unchanged. The blob URLs are revoked when the
  // selection changes, otherwise they'd pin the whole film in memory.
  const [offline, setOffline] = useState<{ contentId: string; url: string; revoke: () => void } | null>(null);
  const clearOffline = useCallback(() => {
    setOffline((current) => {
      current?.revoke();
      return null;
    });
  }, []);
  useEffect(() => clearOffline, [clearOffline]);

  const playOffline = useCallback(
    async (contentId: string, downloadId: string) => {
      const source = await getOfflineSourceUrl(downloadId);
      if (!source) return;
      setOffline((current) => {
        current?.revoke();
        return { contentId, url: source.url, revoke: source.revoke };
      });
      setSelectedId(contentId);
    },
    [],
  );

  const isOffline = offline?.contentId === networkContent.id;
  const content = useMemo(
    () => (isOffline && offline ? { ...networkContent, manifestUrl: offline.url } : networkContent),
    [isOffline, offline, networkContent],
  );

  const selectContent = useCallback(
    (id: string | null) => {
      clearOffline();
      setSelectedId(id);
    },
    [clearOffline],
  );

  // --- Panels, party, hosts -------------------------------------------------
  const [panel, setPanel] = useState<Panel>(null);

  // Empty relay URL keeps the BroadcastChannel default (same-browser tabs);
  // a ws:// or wss:// address makes the room reach other devices.
  const transport = useMemo(
    () => (prefs.watchPartyRelayUrl.trim() ? new WebSocketTransport(prefs.watchPartyRelayUrl.trim()) : undefined),
    [prefs.watchPartyRelayUrl],
  );
  const watchParty = useWatchParty(userId, prefs.displayName || "Tu", transport);
  const hostMonitor = useHostMonitor();

  // A marathon in CineMate is a *saga* run with a bookmark (PRODUCT.md §3.4),
  // not "everything you own". The bar used to queue up the whole shelf, which
  // meant two different things called Maratona in the same app; it now covers
  // the saga of whatever is playing, and disappears for a standalone title.
  const currentCollectionId = items.find((i) => i.id === networkContent.id)?.collectionId ?? null;
  const marathonPlaylist = useMemo(() => {
    if (currentCollectionId == null) return [];
    const byId = new Map(items.map((i) => [i.id, i]));
    return playable
      .filter((c) => byId.get(c.id)?.collectionId === currentCollectionId)
      .map((c, i) => ({
        id: c.id,
        order: i,
        title: c.title,
        durationSec: c.durationSec,
        posterUrl: c.posterUrl,
      }));
  }, [playable, items, currentCollectionId]);

  // Keyed by the saga, so the bookmark survives adding a source to another
  // title — and matches the key the rest of the app uses for the same saga.
  const marathon = useMarathonMode(marathonPlaylist, `saga:${currentCollectionId ?? "none"}`);

  // Keep the bar describing what is actually on screen: picking a chapter from
  // the chips is the same intention as advancing the queue.
  const marathonIndex = marathonPlaylist.findIndex((e) => e.id === networkContent.id);
  const jumpTo = marathon.jumpTo;
  useEffect(() => {
    if (marathonIndex >= 0 && marathonIndex !== marathon.index) jumpTo(marathonIndex);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marathonIndex, jumpTo]);

  // Polled rather than read once, so the chip keeps ticking up while a video is
  // playing instead of only when this page happens to re-render.
  const [lifetime, setLifetime] = useState(getLifetimeStats);
  useEffect(() => {
    const id = window.setInterval(() => setLifetime(getLifetimeStats()), 5000);
    return () => window.clearInterval(id);
  }, []);

  // Opened from an invite link (?party=<id>): join that room straight away
  // rather than making the guest find the code and paste it back in. The param
  // is then dropped so a refresh doesn't try to rejoin.
  const partyParam = searchParams.get("party");
  useEffect(() => {
    if (!partyParam) return;
    watchParty.joinRoom(partyParam);
    setPanel("party");
    setSearchParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partyParam]);

  // Host failover works by rewriting the origin of every segment request to the
  // active host, which is only correct for a title actually served by the
  // mirrored pool. Left unchecked it would redirect *any* source — a box on
  // your LAN, a one-off origin, a blob URL from a download — at whichever host
  // happens to be configured, and nothing would play.
  const pooledOrigins = useMemo(
    () => new Set(hostMonitor.hosts.map((h) => originOf(h.url)).filter((o): o is string => o !== null)),
    [hostMonitor.hosts],
  );
  const servedByPool = !isOffline && pooledOrigins.has(originOf(content.manifestUrl) ?? "");
  const activeHost = servedByPool ? hostMonitor.activeHost : null;

  // Reads the playhead for "use the current position" in the source panel.
  // Pulled from the player on demand rather than tracked here, so pausing at
  // the exact frame you want to mark gives that exact second.
  const playerApi = useRef<{ getCurrentTime: () => number } | null>(null);
  const onPlayerReady = useCallback((api: { getCurrentTime: () => number }) => {
    playerApi.current = api;
  }, []);
  const getCurrentTime = useCallback(() => playerApi.current?.getCurrentTime() ?? 0, []);

  const resolveRecommendations = useCallback(
    async (forContent: MediaContent) => recommendFromLibrary(forContent, items, playableIds),
    [items, playableIds],
  );

  // Watching a title to the end here is the same event as ticking it off by
  // hand: it belongs in the diary, and going through setStatus means the
  // history entry, the achievements and the "continua la storia" prompt all
  // fire exactly as they do from the library. Only ever an upgrade to "Visto" —
  // never a downgrade, and never a second entry for something already watched.
  const setStatus = useLibrary((s) => s.setStatus);
  const markWatchedInLibrary = useCallback(
    (contentId: string) => {
      const item = useLibrary.getState().items.find((i) => i.id === contentId);
      if (item && item.status !== "Visto") setStatus(contentId, "Visto");
    },
    [setStatus],
  );

  const hasOwnSources = catalog.length > 0;
  const selectedItem = items.find((i) => i.id === content.id) ?? null;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4 px-4 py-6 sm:px-6 sm:py-10">
      <header className="flex flex-col gap-1.5">
        <h1 className="font-display text-3xl font-semibold text-text">Player</h1>
        <p className="text-sm text-text-muted">
          Riproduce le sorgenti HLS che aggiungi tu, titolo per titolo. CineMate non cerca e non
          ospita video: senza un tuo indirizzo, qui non c'è niente da guardare.
        </p>
      </header>

      {!hasOwnSources && (
        <EmptyState
          title="Nessuna sorgente sul tuo scaffale"
          description="Scrivi l'indirizzo del tuo server una volta sola in Impostazioni → Indirizzi delle tue sorgenti, e ogni titolo avrà il suo pulsante Guarda. In alternativa incolla un manifest HLS su un singolo titolo, dal pannello Sorgenti qui sotto. Intanto c'è lo stream di test, per vedere come si comporta il player."
        />
      )}

      {/* What the player is doing about the address, so a title that won't
          start says why instead of sitting on a black rectangle. */}
      {resolving && (
        <p className="flex items-center gap-2 text-xs text-text-faint">
          <span
            className="spinner h-3 w-3 rounded-full border-2"
            style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }}
          />
          Cerco un indirizzo che risponda per «{baseContent.title}»…
        </p>
      )}
      {!resolving && resolvedUrl === null && (
        <p
          role="alert"
          className="rounded-sm border px-3 py-2 text-xs leading-relaxed"
          style={{
            borderColor: "color-mix(in srgb, var(--danger) 45%, transparent)",
            color: "var(--danger)",
          }}
        >
          Nessuno degli indirizzi configurati risponde per «{baseContent.title}». Controlla i modelli
          in Impostazioni, oppure che il server sia raggiungibile e permetta le richieste da questa
          pagina (CORS).
        </p>
      )}

      {playable.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {playable.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => selectContent(c.id)}
              aria-current={c.id === content.id}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                c.id === content.id
                  ? "border-accent text-text"
                  : "border-border-strong text-text-muted hover:bg-surface-hover"
              }`}
            >
              {c.title}
            </button>
          ))}
        </div>
      )}

      <div className="pv-app">
        <VideoPlayer
          content={content}
          onSelectContent={selectContent}
          dataSaverMode={prefs.dataSaver}
          watchParty={panel === "party" ? watchParty : undefined}
          activeHostOrigin={activeHost?.url ?? null}
          activeHostName={activeHost?.name ?? null}
          isPrimaryHostActive={!activeHost || activeHost.role === "primary"}
          resolveRecommendations={resolveRecommendations}
          onPlayerReady={onPlayerReady}
          sourceLabel={isOffline ? "Dai download" : null}
          onCompleted={markWatchedInLibrary}
        />

        <MarathonBar marathon={marathon} onJumpTo={(i) => selectContent(marathonPlaylist[i]?.id ?? null)} />

        <div className="pv-app-toolbar">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-pressed={panel === t.id}
              className={panel === t.id ? "active" : ""}
              onClick={() => setPanel(panel === t.id ? null : t.id)}
            >
              {t.label}
            </button>
          ))}
          <span className="pv-stat-chip">
            Ore totali: {(lifetime.totalWatchedSec / 3600).toFixed(1)}h
          </span>
        </div>

        {panel === "sources" && (
          selectedItem ? (
            <SourcePanel
              itemId={selectedItem.id}
              title={selectedItem.title}
              // Resolved with an empty lookup on purpose: the panel wants the
              // link the title carries, not the override it may already have.
              linkManifest={streamUrlOf(selectedItem, () => EMPTY_SOURCE)}
              getCurrentTime={getCurrentTime}
            />
          ) : (
            <div className="pv-panel">
              <p className="pv-empty">
                Lo stream di test non è un titolo della libreria, quindi non ha sorgenti da
                configurare. Aggiungi un titolo e torna qui.
              </p>
            </div>
          )
        )}
        {panel === "downloads" && (
          <DownloadManagerUI
            library={playable}
            onPlayOffline={playOffline}
            offlineContentId={offline?.contentId ?? null}
          />
        )}
        {panel === "party" && (
          <>
            <WatchPartyPanel watchParty={watchParty} />
            <div className="pv-panel">
              <div className="pv-panel-header">
                <h3>Impostazioni</h3>
              </div>
              <label className="pv-field">
                <span>Il tuo nome nella stanza</span>
                <input
                  value={prefs.displayName}
                  onChange={(e) => prefs.set({ displayName: e.target.value })}
                  placeholder="Tu"
                />
              </label>
              <label className="pv-field">
                <span>Relay per guardare assieme da dispositivi diversi</span>
                <input
                  value={prefs.watchPartyRelayUrl}
                  onChange={(e) => prefs.set({ watchPartyRelayUrl: e.target.value })}
                  placeholder="wss://…"
                />
              </label>
              <p className="pv-empty">
                {prefs.watchPartyRelayUrl.trim()
                  ? "La stanza passa dal relay: funziona fra dispositivi diversi."
                  : "Senza relay la stanza vive dentro questo browser: sincronizza solo fra schede aperte qui."}
              </p>
              <label className="pv-toggle">
                <input
                  type="checkbox"
                  checked={prefs.dataSaver}
                  onChange={(e) => prefs.set({ dataSaver: e.target.checked })}
                />
                Risparmio dati (limita la qualità automatica)
              </label>
            </div>
          </>
        )}
        {panel === "hosts" && <HostManagerPanel hostMonitor={hostMonitor} />}
      </div>
    </div>
  );
}
