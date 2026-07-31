// ---------- Playback ----------

export type QualityLevel = {
  id: string;
  height: number; // e.g. 2160 for 4K, 4320 for 8K
  bitrate: number; // bits per second
  label: string; // "4K", "1080p", ...
};

export type AudioTrack = {
  id: string;
  language: string;
  label: string;
  channels?: string; // "5.1", "Stereo"
};

export type SubtitleTrack = {
  id: string;
  language: string;
  label: string;
  url: string; // .vtt url
  forced?: boolean;
};

export type SubtitleStyle = {
  fontSize: 'small' | 'medium' | 'large' | 'extraLarge';
  color: string;
  backgroundColor: string;
  backgroundOpacity: number;
  position: 'bottom' | 'top';
  syncOffsetMs: number;
};

export type SkipMarker = {
  type: 'intro' | 'recap' | 'credits';
  startSec: number;
  endSec: number;
};

export type ThumbnailSprite = {
  url: string;
  interval: number; // seconds between tiles
  columns: number;
  rows: number;
  tileWidth: number;
  tileHeight: number;
  count: number;
};

export type WatchStatus = 'not_started' | 'in_progress' | 'completed';

export type EpisodeRef = {
  id: string;
  seasonNumber: number;
  episodeNumber: number;
  title: string;
  durationSec: number;
  posterUrl: string;
};

export type SagaEntry = {
  id: string;
  order: number;
  title: string;
  durationSec: number;
  posterUrl: string;
};

export type MediaContent = {
  id: string;
  type: 'movie' | 'episode';
  title: string;
  seriesTitle?: string;
  posterUrl: string;
  backdropUrl: string;
  durationSec: number;
  manifestUrl: string; // HLS .m3u8
  audioTracks: AudioTrack[];
  subtitleTracks: SubtitleTrack[];
  skipMarkers: SkipMarker[];
  thumbnailSprite?: ThumbnailSprite;
  nextEpisode?: EpisodeRef;
  nextInSaga?: SagaEntry;
  seasonPlaylist?: EpisodeRef[];
  sagaPlaylist?: SagaEntry[];
};

// ---------- Downloads ----------

export type DownloadQuality = 'sd' | 'hd' | 'fullhd' | '4k';
export type DownloadStatus = 'queued' | 'downloading' | 'paused' | 'completed' | 'error';

export type DownloadItem = {
  id: string;
  contentId: string;
  title: string;
  posterUrl: string;
  quality: DownloadQuality;
  totalBytes: number;
  downloadedBytes: number;
  status: DownloadStatus;
  createdAt: number;
};

// ---------- Watch Party ----------

export type WatchPartyRole = 'host' | 'guest';

export type WatchPartyParticipant = {
  id: string;
  name: string;
  role: WatchPartyRole;
  joinedAt: number;
};

export type WatchPartyChatMessage = {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
};

export type WatchPartyReaction = {
  id: string;
  senderId: string;
  emoji: string;
  timestamp: number;
};

export type WatchPartySyncEvent =
  | { type: 'play'; time: number; senderId: string }
  | { type: 'pause'; time: number; senderId: string }
  | { type: 'seek'; time: number; senderId: string }
  | { type: 'join'; participant: WatchPartyParticipant }
  | { type: 'leave'; participantId: string }
  | { type: 'chat'; message: WatchPartyChatMessage }
  | { type: 'reaction'; reaction: WatchPartyReaction }
  | { type: 'state_request'; senderId: string }
  | { type: 'state_response'; time: number; isPlaying: boolean; senderId: string };

// ---------- Stats ----------

export type SessionStats = {
  startedAt: number;
  watchedSec: number;
  pauseCount: number;
};

export type LifetimeStats = {
  totalWatchedSec: number;
  totalPauseCount: number;
  completedContentIds: string[];
  completedSeriesIds: string[];
  completedMarathons: number;
};

export type NetworkQuality = 'offline' | 'poor' | 'good' | 'excellent';

// ---------- Stream hosts (multi-CDN monitoring & failover) ----------

export type HostRole = 'primary' | 'secondary' | 'backup';
export type HostStatus = 'online' | 'slow' | 'offline' | 'unknown';

// The intervals offered by the "Controllo ogni" setting, in milliseconds.
export type MonitorIntervalMs = 60_000 | 300_000 | 600_000 | 1_800_000 | 3_600_000;

export type StreamHost = {
  id: string;
  name: string;
  // Origin the host serves from, e.g. "https://cdn1.example.com" — combined
  // with the active content's manifest path when resolving playback URLs.
  url: string;
  role: HostRole;
  priority: number; // lower = tried first; reorderable via drag & drop
  /**
   * Path the speed test downloads from, relative to `url`. Optional because
   * the honest default is the host root: a throughput figure needs a payload
   * big enough to measure, and only the person who runs the server knows
   * which path has one. Absent means "use the root and say so if it was too
   * small to mean anything".
   */
  speedTestPath?: string;
};

/**
 * How the active host is chosen. `priority` is the manual drag-and-drop order
 * and stays the default: it is the only mode where the answer to "why is it
 * using that one" is something the user typed. The other two are opt-in.
 */
export type HostSelectionMode = 'priority' | 'auto' | 'balanced';

export type HostSpeedSample = {
  hostId: string;
  /** Megabits per second, or null when the sample couldn't measure it. */
  mbps: number | null;
  sampleBytes: number;
  durationMs: number;
  measuredAt: number;
  /** Present only when `mbps` is null — says which of the three reasons it is. */
  note?: 'sample_too_small' | 'unreachable' | 'no_body';
};

export type HostCheckResult = {
  hostId: string;
  status: HostStatus;
  // Time-to-first-byte, in ms — the closest browser-available proxy for
  // "ping" (real ICMP ping isn't reachable from JS). Null if the request
  // never completed.
  pingMs: number | null;
  // Full request→response-complete time, in ms.
  responseTimeMs: number | null;
  checkedAt: number;
  httpOk: boolean;
  httpStatus: number | null;
  // True/false when inferable from fetch success/failure on an https URL;
  // null when genuinely undetermined (browsers don't expose certificate
  // details to JS — see README).
  sslOk: boolean | null;
  apiVersion: string | null;
  error?: HostCheckError;
};

export type HostCheckError = 'timeout' | 'network_error' | 'http_error';

export type HostStats = {
  hostId: string;
  avgPingMs: number | null;
  minPingMs: number | null;
  maxPingMs: number | null;
  uptimePercent: number; // across all stored history for this host
  reliability30d: number; // % of checks succeeded in the last 30 days
  errorCount: number;
  checksCount: number;
  lastDowntimeAt: number | null;
  // Duration of the current online streak, in ms — time since the last
  // recorded failure, or since the first check if it's never failed. Null
  // when there's no history yet. Distinct from uptimePercent: this is a
  // running clock, not a ratio.
  currentUptimeMs: number | null;
  // Mean of the stored throughput samples, in Mbit/s. Null until a speed
  // test has produced at least one measurable sample — speed tests are
  // expensive, so unlike ping they only run when asked.
  avgSpeedMbps: number | null;
  bestSpeedMbps: number | null;
  lastSpeedAt: number | null;
  // 0–100 composite of reliability, ping and throughput. What automatic
  // priority sorts by and what load balancing weights by; see
  // `computeHostScore` for how an unmeasured component is treated.
  score: number;
};

export type HostSwitchReason =
  | 'offline'
  | 'high_ping'
  | 'timeout'
  | 'http_error'
  | 'manual'
  | 'recovered_to_primary'
  | 'auto_ranked'
  | 'load_balanced';

export type HostSwitchEvent = {
  id: string;
  fromHostId: string | null;
  toHostId: string;
  reason: HostSwitchReason;
  at: number;
};

