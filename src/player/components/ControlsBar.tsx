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
  /**
   * Dove far arrivare il motivo quando un comando non ha potuto agire. Un
   * pulsante che si preme e non fa niente è la cosa peggiore che ci sia in una
   * fascia di comandi: chi lo preme non sa se sia rotto lui o il telefono.
   */
  onNotice: (message: string) => void;
};

export default function ControlsBar({
  player, progress, onOpenSettings, onOpenEpisodes, hasEpisodes, onOpenClip, onNext,
  onToggleMini, onToggleFullscreen, onNotice,
}: Props) {
  return (
    <div className="pv-controls-bar">
      {progress}

      <div className="pv-actions">
        <button type="button" className="pv-action" aria-label="Ritaglia" onClick={onOpenClip}>
          <ScissorsIcon />
          <span>Ritaglia</span>
        </button>
        <button type="button" className="pv-action" aria-label="Velocità di riproduzione" onClick={() => onOpenSettings('speed')}>
          <SpeedIcon />
          <span>Velocità ({player.playbackRate}x)</span>
        </button>
        {hasEpisodes && (
          <button type="button" className="pv-action" aria-label="Episodi" onClick={onOpenEpisodes}>
            <EpisodesIcon />
            <span>Episodi</span>
          </button>
        )}
        <button type="button" className="pv-action" aria-label="Audio e sottotitoli" onClick={() => onOpenSettings('audio')}>
          <SubtitlesIcon />
          <span>Audio e sottotitoli</span>
        </button>
        {onNext && (
          <button type="button" className="pv-action" aria-label="Prossimo episodio" onClick={onNext}>
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
            <button
              className="pv-icon-btn"
              aria-label="Immagine nell'immagine"
              title="Immagine nell'immagine: il video esce in una finestrella sopra le altre app"
              onClick={async () => {
                const esito = await player.togglePiP();
                if (esito === 'non-ora') {
                  onNotice('L’immagine nell’immagine ha bisogno di un video già avviato.');
                } else if (esito === 'non-supportato') {
                  onNotice('Questo browser non concede l’immagine nell’immagine.');
                }
              }}
            >
              <PipIcon />
              <span className="pv-tool-label">Finestrella</span>
            </button>
          )}
          <button
            className="pv-icon-btn"
            aria-label="Mini player"
            title="Mini player: la scena si rimpicciolisce in un angolo di CineMate"
            onClick={onToggleMini}
          >
            <MiniPlayerIcon />
            <span className="pv-tool-label">Mini</span>
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
