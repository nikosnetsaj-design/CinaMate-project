import type { ReactNode } from 'react';
import type { useVideoPlayer } from '../hooks/useVideoPlayer';
import type { SettingsTab } from './SettingsMenu';
import {
  EpisodesIcon, ExitFullscreenIcon, FullscreenIcon, MiniPlayerIcon, MuteIcon, NextEpisodeIcon,
  PipIcon, ScissorsIcon, SettingsIcon, SpeedIcon, SubtitlesIcon, VolumeIcon,
} from './Icons';
import { t } from "../../lib/i18n";

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
        <button type="button" className="pv-action" aria-label={t("player_ControlsBar.ritaglia")} onClick={onOpenClip}>
          <ScissorsIcon />
          <span>{t("player_ControlsBar.ritaglia")}</span>
        </button>
        <button type="button" className="pv-action" aria-label={t("player_ControlsBar.velocita_di_riproduzione")} onClick={() => onOpenSettings('speed')}>
          <SpeedIcon />
          <span>{t("player_ControlsBar.velocita")}{player.playbackRate}x)</span>
        </button>
        {hasEpisodes && (
          <button type="button" className="pv-action" aria-label={t("player_ControlsBar.episodi")} onClick={onOpenEpisodes}>
            <EpisodesIcon />
            <span>{t("player_ControlsBar.episodi")}</span>
          </button>
        )}
        <button type="button" className="pv-action" aria-label={t("player_ControlsBar.audio_e_sottotitoli")} onClick={() => onOpenSettings('audio')}>
          <SubtitlesIcon />
          <span>{t("player_ControlsBar.audio_e_sottotitoli")}</span>
        </button>
        {onNext && (
          <button type="button" className="pv-action" aria-label={t("player_ControlsBar.prossimo_episodio")} onClick={onNext}>
            <NextEpisodeIcon />
            <span>{t("player_ControlsBar.pross_ep")}</span>
          </button>
        )}

        <div className="pv-controls-spacer" />

        {/* Volume, PiP, mini, impostazioni e schermo intero stanno in un
            gruppo solo: quando lo spazio finisce vanno a capo assieme, invece
            di lasciare un pulsante orfano su una riga tutta sua. */}
        <div className="pv-actions-tools">
          <div className="pv-volume">
            <button className="pv-icon-btn" aria-label={player.muted ? t("player_ControlsBar.riattiva_l_audio") : t("player_ControlsBar.muto")} onClick={player.toggleMute}>
              {player.muted || player.volume === 0 ? <MuteIcon /> : <VolumeIcon />}
            </button>
            <input
              type="range" min={0} max={1} step={0.05}
              aria-label={t("player_ControlsBar.volume")}
              value={player.muted ? 0 : player.volume}
              onChange={e => player.setVolume(Number(e.target.value))}
            />
          </div>

          {player.pipSupported && (
            <button
              className="pv-icon-btn"
              aria-label={t("player_ControlsBar.immagine_nell_immagine")}
              title={t("player_ControlsBar.immagine_nell_immagine_il")}
              onClick={async () => {
                const esito = await player.togglePiP();
                if (esito === 'non-ora') {
                  onNotice(t("player_ControlsBar.l_immagine_nell_immagine"));
                } else if (esito === 'non-supportato') {
                  onNotice(t("player_ControlsBar.questo_browser_non_concede"));
                }
              }}
            >
              <PipIcon />
              <span className="pv-tool-label">{t("player_ControlsBar.finestrella")}</span>
            </button>
          )}
          <button
            className="pv-icon-btn"
            aria-label={t("player_ControlsBar.mini_player")}
            title={t("player_ControlsBar.mini_player_la_scena")}
            onClick={onToggleMini}
          >
            <MiniPlayerIcon />
            <span className="pv-tool-label">{t("player_ControlsBar.mini")}</span>
          </button>
          <button className="pv-icon-btn" aria-label={t("player_ControlsBar.impostazioni")} onClick={() => onOpenSettings('quality')}>
            <SettingsIcon />
          </button>
          {player.fullscreenSupported && (
            <button
              className="pv-icon-btn"
              aria-label={player.isFullscreen ? t("player_ControlsBar.esci_da_schermo_intero") : t("player_ControlsBar.schermo_intero")}
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
