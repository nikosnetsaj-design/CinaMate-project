import type { ReactNode } from 'react';
import type { useVideoPlayer } from '../hooks/useVideoPlayer';
import type { SettingsTab } from './SettingsMenu';
import {
  EpisodesIcon, ExitFullscreenIcon, FullscreenIcon, MiniPlayerIcon, MuteIcon, NextEpisodeIcon,
  PipIcon, ScissorsIcon, SettingsIcon, SpeedIcon, SubtitlesIcon, VolumeIcon,
} from './Icons';

/**
 * La fascia in fondo: l'avanzamento, e sotto le cose che si fanno *a* ciò che
 * si sta guardando.
 *
 * Le cinque azioni hanno un'etichetta scritta e non solo un'icona. È la
 * differenza fra un player che si impara e uno che si indovina: "sottotitoli"
 * dietro un fumetto lo trova chi già sa che è lì. I comandi di finestra —
 * volume, PiP, mini, schermo intero — restano a destra come icone sole, perché
 * quelli sì che hanno una forma universale, e perché su un telefono non
 * servono quasi mai.
 */

type Props = {
  player: ReturnType<typeof useVideoPlayer>;
  /** La barra di avanzamento, costruita da chi possiede il tempo del video. */
  progress: ReactNode;
  onOpenSettings: (tab: SettingsTab) => void;
  onOpenEpisodes: () => void;
  /** Assente quando c'è un titolo solo da riprodurre. */
  hasEpisodes: boolean;
  onOpenClip: () => void;
  /** Assente in coda alla libreria: niente da mandare dopo. */
  onNext: (() => void) | null;
  onToggleMini: () => void;
  onToggleFullscreen: () => void;
};

export default function ControlsBar({
  player, progress, onOpenSettings, onOpenEpisodes, hasEpisodes, onOpenClip, onNext,
  onToggleMini, onToggleFullscreen,
}: Props) {
  return (
    <div className="pv-controls-bar">
      {progress}

      <div className="pv-actions">
        <button type="button" className="pv-action" onClick={onOpenClip}>
          <ScissorsIcon />
          <span>Ritaglia</span>
        </button>
        <button type="button" className="pv-action" onClick={() => onOpenSettings('speed')}>
          <SpeedIcon />
          <span>Velocità ({player.playbackRate}x)</span>
        </button>
        {hasEpisodes && (
          <button type="button" className="pv-action" onClick={onOpenEpisodes}>
            <EpisodesIcon />
            <span>Episodi</span>
          </button>
        )}
        <button type="button" className="pv-action" onClick={() => onOpenSettings('audio')}>
          <SubtitlesIcon />
          <span>Audio e sottotitoli</span>
        </button>
        {onNext && (
          <button type="button" className="pv-action" onClick={onNext}>
            <NextEpisodeIcon />
            <span>Pross. ep.</span>
          </button>
        )}

        <div className="pv-controls-spacer" />

        {/* Volume, PiP, mini, impostazioni e schermo intero stanno in un
            gruppo solo: quando lo spazio finisce vanno a capo assieme, invece
            di lasciare un pulsante orfano su una riga tutta sua. */}
        <div className="pv-actions-tools">
          <div className="pv-volume">
            <button className="pv-icon-btn" aria-label={player.muted ? 'Riattiva l’audio' : 'Muto'} onClick={player.toggleMute}>
              {player.muted || player.volume === 0 ? <MuteIcon /> : <VolumeIcon />}
            </button>
            <input
              type="range" min={0} max={1} step={0.05}
              aria-label="Volume"
              value={player.muted ? 0 : player.volume}
              onChange={e => player.setVolume(Number(e.target.value))}
            />
          </div>

          {player.pipSupported && (
            <button className="pv-icon-btn" aria-label="Picture in Picture" onClick={player.togglePiP}>
              <PipIcon />
            </button>
          )}
          <button className="pv-icon-btn" aria-label="Mini player" onClick={onToggleMini}>
            <MiniPlayerIcon />
          </button>
          <button className="pv-icon-btn" aria-label="Impostazioni" onClick={() => onOpenSettings('quality')}>
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
    </div>
  );
}
