import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useLibrary } from "../store/useLibrary";
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
import { buildPlayerCatalog, originOf } from "../player/fromLibrary";
import type { MediaContent } from "../player/types";
import "../player/styles/player.css";

const IDENTITY_KEY = "cinemate:player-identity";

/**
 * hls.js's own public test stream. Shown only when nothing on the shelf has
 * a source yet, so the controls, adaptive quality and host failover are all
 * demonstrably working before you have wired up a single title of your own.
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

/**
 * Watch Party needs an id that is stable across reloads (so a rejoin isn't a
 * new participant) but is not an account — this app has no accounts. A random
 * id in localStorage is exactly as much identity as the feature requires.
 */
function useIdentity() {
  return useMemo(() => {
    try {
      const saved = localStorage.getItem(IDENTITY_KEY);
      if (saved) return JSON.parse(saved) as { id: string; name: string };
    } catch {
      // Fall through and mint a fresh one.
    }
    const identity = { id: `u-${crypto.randomUUID().slice(0, 8)}`, name: "Tu" };
    try {
      localStorage.setItem(IDENTITY_KEY, JSON.stringify(identity));
    } catch {
      // Best effort: an unpersisted identity still works for this session.
    }
    return identity;
  }, []);
}

function Toolbar({
  panel,
  onToggle,
  hours,
}: {
  panel: Panel;
  onToggle: (next: Panel) => void;
  hours: string;
}) {
  const tabs: { id: Exclude<Panel, null>; label: string }[] = [
    { id: "downloads", label: "Download" },
    { id: "party", label: "Watch Party" },
    { id: "hosts", label: "Host" },
  ];
  return (
    <div className="pv-app-toolbar">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          aria-pressed={panel === t.id}
          onClick={() => onToggle(panel === t.id ? null : t.id)}
        >
          {t.label}
        </button>
      ))}
      <span className="pv-stat-chip">Ore totali: {hours}h</span>
    </div>
  );
}

type Panel = "downloads" | "party" | "hosts" | null;

export function Player() {
  const items = useLibrary((s) => s.items);
  const identity = useIdentity();
  const [searchParams, setSearchParams] = useSearchParams();

  const catalog = useMemo(() => buildPlayerCatalog(items), [items]);
  const playable = useMemo(() => (catalog.length ? catalog : [TEST_STREAM]), [catalog]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const content = playable.find((c) => c.id === selectedId) ?? playable[0];

  const [panel, setPanel] = useState<Panel>(null);
  const watchParty = useWatchParty(identity.id, identity.name);
  const hostMonitor = useHostMonitor();

  const marathonPlaylist = useMemo(
    () =>
      playable.map((c, i) => ({
        id: c.id,
        order: i,
        title: c.title,
        durationSec: c.durationSec,
        posterUrl: c.posterUrl,
      })),
    [playable],
  );
  // Keyed by the titles in it, so adding a source to another title starts a
  // new marathon instead of resuming the old one at a stale index.
  const marathon = useMarathonMode(marathonPlaylist, playable.map((c) => c.id).join("|"));

  // Polled rather than read once, so the chip keeps ticking up while a video
  // is playing instead of only when this page happens to re-render.
  const [lifetime, setLifetime] = useState(getLifetimeStats);
  useEffect(() => {
    const id = window.setInterval(() => setLifetime(getLifetimeStats()), 5000);
    return () => window.clearInterval(id);
  }, []);

  // Opened from an invite link (?party=<id>): join that room straight away
  // rather than making the guest find the code and paste it back in. The
  // param is then dropped so a refresh doesn't try to rejoin.
  const partyParam = searchParams.get("party");
  useEffect(() => {
    if (!partyParam) return;
    watchParty.joinRoom(partyParam);
    setPanel("party");
    setSearchParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partyParam]);

  const hasOwnSources = catalog.length > 0;

  // Host failover works by rewriting the origin of every segment request to
  // the active host, which is only correct for a title actually served by the
  // mirrored pool. Left unchecked it would redirect *any* source — a link to
  // a box on your LAN, a one-off origin — at whichever host happens to be
  // configured, and nothing would play. So the rewrite is handed to the
  // player only when this title's manifest already lives on one of the hosts.
  const pooledOrigins = useMemo(
    () => new Set(hostMonitor.hosts.map((h) => originOf(h.url)).filter((o): o is string => o !== null)),
    [hostMonitor.hosts],
  );
  const servedByPool = pooledOrigins.has(originOf(content.manifestUrl) ?? "");
  const activeHost = servedByPool ? hostMonitor.activeHost : null;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4 px-4 py-6 sm:px-6 sm:py-10">
      <header className="flex flex-col gap-1.5">
        <h1 className="font-display text-3xl font-semibold text-text">Player</h1>
        <p className="text-sm text-text-muted">
          Riproduce le sorgenti HLS che aggiungi tu, come link personale di un titolo. CineMate non
          cerca e non ospita video: senza un tuo link, qui non c'è niente da guardare.
        </p>
      </header>

      {!hasOwnSources && (
        <EmptyState
          title="Nessuna sorgente sul tuo scaffale"
          description="Apri un titolo della libreria e incolla un manifest HLS (un indirizzo che finisce in .m3u8) fra i suoi link personali: comparirà qui. Sotto c'è lo stream di test, per vedere subito come si comporta il player."
        />
      )}

      {playable.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {playable.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setSelectedId(c.id)}
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
          onSelectContent={setSelectedId}
          watchParty={panel === "party" ? watchParty : undefined}
          activeHostOrigin={activeHost?.url ?? null}
          activeHostName={activeHost?.name ?? null}
          isPrimaryHostActive={!activeHost || activeHost.role === "primary"}
        />

        <MarathonBar
          marathon={marathon}
          onJumpTo={(i) => setSelectedId(playable[i]?.id ?? null)}
        />

        <Toolbar
          panel={panel}
          onToggle={setPanel}
          hours={(lifetime.totalWatchedSec / 3600).toFixed(1)}
        />

        {panel === "downloads" && <DownloadManagerUI library={playable} />}
        {panel === "party" && <WatchPartyPanel watchParty={watchParty} />}
        {panel === "hosts" && <HostManagerPanel hostMonitor={hostMonitor} />}
      </div>
    </div>
  );
}
