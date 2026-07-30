import { useState } from 'react';
import type { useVideoPlayer } from '../hooks/useVideoPlayer';
import type { useCast } from '../hooks/useCast';
import {
  PlayIcon, PauseIcon, RewindIcon, ForwardIcon, VolumeIcon, MuteIcon,
  SettingsIcon, PipIcon, CastIcon, FullscreenIcon, ExitFullscreenIcon, MiniPlayerIcon,
} from './Icons';

type Props = {
  player: ReturnType<typeof useVideoPlayer>;
  title: string;
  seriesTitle?: string;
  cast: ReturnType<typeof useCast>;
  onOpenSettings: () => void;
  onToggleMini: () => void;
  onToggleFullscreen: () => void;
};

const RATES = [0.5, 0.75, 1, 1.25, 1.5, 2];

export default function ControlsBar({ player, title, seriesTitle, cast, onOpenSettings, onToggleMini, onToggleFullscreen }: Props) {
  const [rateMenuOpen, setRateMenuOpen] = useState(false);
  // Support is asked of the player, not of `document`: on iOS the standard
  // flags are false while the WebKit equivalents work, so testing only the
  // standard ones hid both buttons on exactly the device that needed them.

  return (
    <div className="pv-controls-bar">
      <div className="pv-controls-titles">
        {seriesTitle && <span className="pv-controls-series">{seriesTitle}</span>}
        <span className="pv-controls-title">{title}</span>
      </div>

      <div className="pv-controls-row">
        <button className="pv-icon-btn" aria-label="Indietro di 10 secondi" onClick={() => player.seekBy(-10)}>
          <RewindIcon /><span className="pv-seek-label">10</span>
        </button>
        <button className="pv-icon-btn pv-btn-play" aria-label={player.isPlaying ? 'Pausa' : 'Play'} onClick={player.togglePlay}>
          {player.isPlaying ? <PauseIcon /> : <PlayIcon />}
        </button>
        <button className="pv-icon-btn" aria-label="Avanti di 10 secondi" onClick={() => player.seekBy(10)}>
          <span className="pv-seek-label">10</span><ForwardIcon />
        </button>

        <span className="pv-time pv-mono">{formatTime(player.currentTime)} / {formatTime(player.duration)}</span>

        <div className="pv-controls-spacer" />

        <div className="pv-volume">
          <button className="pv-icon-btn" aria-label="Muto" onClick={player.toggleMute}>
            {player.muted || player.volume === 0 ? <MuteIcon /> : <VolumeIcon />}
          </button>
          <input
            type="range" min={0} max={1} step={0.05}
            value={player.muted ? 0 : player.volume}
            onChange={e => player.setVolume(Number(e.target.value))}
          />
        </div>

        <div className="pv-rate-menu">
          <button className="pv-icon-btn pv-mono" onClick={() => setRateMenuOpen(v => !v)}>{player.playbackRate}x</button>
          {rateMenuOpen && (
            <div className="pv-dropdown">
              {RATES.map(r => (
                <button
                  key={r}
                  className={r === player.playbackRate ? 'active' : ''}
                  onClick={() => { player.setPlaybackRate(r); setRateMenuOpen(false); }}
                >
                  {r}x
                </button>
              ))}
            </div>
          )}
        </div>

        {(cast.castAvailable || cast.airPlayAvailable) && (
          <button
            className={`pv-icon-btn ${cast.castConnected ? 'active' : ''}`}
            aria-label="Trasmetti"
            onClick={cast.airPlayAvailable ? cast.openAirPlayPicker : cast.openCastPicker}
          >
            <CastIcon />
          </button>
        )}

        {player.pipSupported && (
          <button className="pv-icon-btn" aria-label="Picture in Picture" onClick={player.togglePiP}>
            <PipIcon />
          </button>
        )}

        <button className="pv-icon-btn" aria-label="Mini player" onClick={onToggleMini}>
          <MiniPlayerIcon />
        </button>
        <button className="pv-icon-btn" aria-label="Impostazioni" onClick={onOpenSettings}>
          <SettingsIcon />
        </button>
        {player.fullscreenSupported && (
          <button
            className="pv-icon-btn"
            aria-label={player.isFullscreen ? 'Esci da schermo intero' : 'Schermo intero'}
            onClick={onToggleFullscreen}
          >
            {player.isFullscreen ? <ExitFullscreenIcon /> : <FullscreenIcon />}
          </button>
        )}
      </div>
    </div>
  );
}

function formatTime(sec: number): string {
  if (!isFinite(sec)) return '0:00';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const mm = String(m).padStart(h > 0 ? 2 : 1, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
