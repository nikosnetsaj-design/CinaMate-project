import type { QualityLevel, NetworkQuality } from '../types';

type Props = {
  quality?: QualityLevel;
  isAuto: boolean;
  audioLabel?: string;
  subtitleLabel?: string;
  castDeviceName: string | null;
  resumed: boolean;
  isDownloaded?: boolean;
  hostName?: string | null;
  networkQuality?: NetworkQuality;
  /** Where the bytes are coming from, when it isn't the title's own source. */
  sourceLabel?: string | null;
  /** Minutes left on the sleep timer, or 0 for "stops at the end of this one". */
  sleepMinutes?: number | null;
  sleepAtEnd?: boolean;
};

const NETWORK_DOT: Record<NetworkQuality, string> = { excellent: '🟢', good: '🟢', poor: '🟠', offline: '🔴' };
const NETWORK_LABEL: Record<NetworkQuality, string> = { excellent: 'Ottima', good: 'Buona', poor: 'Debole', offline: 'Assente' };

export default function PlayerIndicators({
  quality, isAuto, audioLabel, subtitleLabel, castDeviceName, resumed, isDownloaded, hostName, networkQuality,
  sourceLabel, sleepMinutes, sleepAtEnd,
}: Props) {
  // Only surface the network badge when it's actually worth flagging —
  // clutter-free during normal "good/excellent" playback, same convention
  // as the other conditional badges here.
  const showNetworkBadge = networkQuality === 'poor' || networkQuality === 'offline';
  return (
    <div className="pv-indicators">
      {quality && <span className="pv-badge">{quality.label}{isAuto ? ' · Auto' : ''}</span>}
      {audioLabel && <span className="pv-badge">{audioLabel}</span>}
      {subtitleLabel && <span className="pv-badge">CC {subtitleLabel}</span>}
      {sourceLabel && <span className="pv-badge pv-badge-active">{sourceLabel}</span>}
      {isDownloaded && !sourceLabel && <span className="pv-badge">Offline</span>}
      {resumed && <span className="pv-badge pv-badge-muted">Ripresa</span>}
      {/* An armed sleep timer has to be visible: playback that stops by itself
          with nothing on screen to explain it looks exactly like a failure. */}
      {sleepAtEnd && <span className="pv-badge pv-badge-active">Stop a fine episodio</span>}
      {!sleepAtEnd && sleepMinutes != null && (
        <span className="pv-badge pv-badge-active">Stop fra {sleepMinutes} min</span>
      )}
      {castDeviceName && <span className="pv-badge pv-badge-active">In riproduzione su {castDeviceName}</span>}
      {hostName && <span className="pv-badge pv-badge-warn">Host: {hostName}</span>}
      {showNetworkBadge && networkQuality && (
        <span className="pv-badge pv-badge-warn">{NETWORK_DOT[networkQuality]} Rete {NETWORK_LABEL[networkQuality]}</span>
      )}
    </div>
  );
}
