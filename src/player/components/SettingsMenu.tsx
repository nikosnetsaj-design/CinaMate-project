import { useState } from 'react';
import type { QualityLevel, AudioTrack, SubtitleTrack, SubtitleStyle } from '../types';
// The one CineMate import in this folder, and a deliberate one: it is a generic
// dialog utility with no knowledge of the app's data, and every other modal in
// CineMate uses it. Re-implementing a focus trap here to keep the folder
// technically pure would be worse than sharing the one that already works.
import { useFocusTrap } from '../../lib/useFocusTrap';
import { BRIGHTNESS_MIN, BRIGHTNESS_MAX } from '../hooks/usePlayerGestures';
import { SLEEP_PRESETS, type SleepChoice } from '../hooks/useSleepTimer';
import type { PlaybackPrefs } from '../services/playbackPrefs';
import { CloseIcon } from './Icons';
import { t } from "../../lib/i18n";

export type SettingsTab = 'quality' | 'audio' | 'subtitles' | 'speed' | 'general';

type Props = {
  levels: QualityLevel[];
  currentLevel: number;
  onSelectLevel: (id: number) => void;
  audioTracks: AudioTrack[];
  currentAudioTrack: number;
  onSelectAudio: (id: number) => void;
  subtitleTracks: SubtitleTrack[];
  activeSubtitleId: string | null;
  onSelectSubtitle: (id: string | null) => void;
  subtitleStyle: SubtitleStyle;
  onUpdateSubtitleStyle: (patch: Partial<SubtitleStyle>) => void;
  playbackRate: number;
  onSelectRate: (r: number) => void;
  dataSaver: boolean;
  onToggleDataSaver: (enabled: boolean) => void;
  brightness: number;
  onSelectBrightness: (v: number) => void;
  /** Seconds already downloaded ahead of the playhead, and the current target. */
  bufferHealthSec: number;
  bufferTargetSec: number;
  /** Cross-title preferences — see services/playbackPrefs. */
  prefs: PlaybackPrefs;
  onUpdatePrefs: (patch: Partial<PlaybackPrefs>) => void;
  onSelectMaxHeight: (height: number | null) => void;
  sleep: { choice: SleepChoice | null; remainingSec: number | null; arm: (c: SleepChoice) => void; cancel: () => void };
  wakeLockSupported: boolean;
  /**
   * Su quale scheda aprirsi. La riga di azioni entra qui da due porte diverse
   * — "Velocità" e "Audio e sottotitoli" — e atterrare ogni volta su Qualità
   * significherebbe far cercare due volte la stessa cosa.
   */
  initialTab?: SettingsTab;
  onClose: () => void;
};

const RATES = [0.5, 0.75, 1, 1.25, 1.5, 2];
const SIZES: SubtitleStyle['fontSize'][] = ['small', 'medium', 'large', 'extraLarge'];
const SIZE_LABELS: Record<SubtitleStyle['fontSize'], string> = {
  small: 'Piccoli', medium: 'Medi', large: t("player_SettingsMenu.grandi"), extraLarge: t("player_SettingsMenu.molto_grandi"),
};
const COLORS = ['#F5F1E8', '#F2C879', '#7FD8C6', '#E36F6F'];

/** Il ritardo detto a parole: «anticipati di 0,3 s», non «+300ms». */
function syncLabel(ms: number): string {
  if (ms === 0) return t("player_SettingsMenu.in_sincrono");
  const sec = (Math.abs(ms) / 1000).toLocaleString('it-IT', { maximumFractionDigits: 1 });
  return ms > 0 ? t("player_SettingsMenu.anticipati_di_s", { v0: sec }) : t("player_SettingsMenu.ritardati_di_s", { v0: sec });
}

export default function SettingsMenu(props: Props) {
  const [tab, setTab] = useState<SettingsTab>(props.initialTab ?? 'quality');
  const panelRef = useFocusTrap(props.onClose);

  return (
    <div className="pv-settings-overlay" onClick={props.onClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={t("player_SettingsMenu.impostazioni_di_riproduzione")}
        className="pv-settings-panel"
        onClick={e => e.stopPropagation()}
      >
        <div className="pv-settings-header">
          <div className="pv-settings-tabs">
            <button className={tab === 'quality' ? "active" : ''} onClick={() => setTab('quality')}>{t("player_SettingsMenu.qualita")}</button>
            <button className={tab === 'audio' ? "active" : ''} onClick={() => setTab('audio')}>{t("player_SettingsMenu.audio")}</button>
            <button className={tab === 'subtitles' ? "active" : ''} onClick={() => setTab('subtitles')}>{t("player_SettingsMenu.sottotitoli")}</button>
            <button className={tab === 'speed' ? "active" : ''} onClick={() => setTab('speed')}>{t("player_SettingsMenu.velocita")}</button>
            <button className={tab === 'general' ? "active" : ''} onClick={() => setTab('general')}>{t("player_SettingsMenu.generale")}</button>
          </div>
          <button className="pv-icon-btn" aria-label={t("player_SettingsMenu.chiudi_impostazioni")} onClick={props.onClose}><CloseIcon /></button>
        </div>

        {tab === 'quality' && (
          <div className="pv-settings-list">
            <button className={props.currentLevel === -1 ? "active" : ''} onClick={() => props.onSelectLevel(-1)}>
              {t("player_SettingsMenu.automatica")}
            </button>
            {[...props.levels].sort((a, b) => b.height - a.height).map(l => (
              <button
                key={l.id}
                className={props.currentLevel === Number(l.id) ? "active" : ''}
                onClick={() => props.onSelectLevel(Number(l.id))}
              >
                {l.label}
                {l.bitrate > 0 && <span className="pv-dim pv-num"> {Math.round(l.bitrate / 1000)} {t("player_SettingsMenu.kbps")}</span>}
              </button>
            ))}
            <label className="pv-toggle">
              <input
                type="checkbox"
                checked={props.dataSaver}
                onChange={e => props.onToggleDataSaver(e.target.checked)}
              />
              {t("player_SettingsMenu.modalita_risparmio_dati")}
            </label>

            <div className="pv-field">
              <span>{t("player_SettingsMenu.luminosita")}{Math.round(props.brightness * 100)}%)</span>
              <input
                type="range"
                min={BRIGHTNESS_MIN}
                max={BRIGHTNESS_MAX}
                step={0.05}
                value={props.brightness}
                aria-label={t("player_SettingsMenu.luminosita_dell_immagine")}
                onChange={e => props.onSelectBrightness(Number(e.target.value))}
              />
            </div>

            {/* Says what the adaptive buffer is doing rather than leaving it an
                invisible tuning knob: how many seconds are already downloaded,
                and how many it is currently aiming to hold. */}
            <p className="pv-dim pv-buffer-readout">
              {t("player_SettingsMenu.buffer")} <span className="pv-num">{Math.round(props.bufferHealthSec)}s</span> {t("player_SettingsMenu.di")}{' '}
              <span className="pv-num">{props.bufferTargetSec}s</span>
              {props.dataSaver
                ? t("player_SettingsMenu.ridotto_dal_risparmio_dati")
                : t("player_SettingsMenu.si_adatta_da_solo")}
            </p>
          </div>
        )}

        {tab === 'audio' && (
          <div className="pv-settings-list">
            {props.audioTracks.length === 0 && <p className="pv-dim">{t("player_SettingsMenu.nessuna_traccia_audio_alternativa")}</p>}
            {props.audioTracks.map(a => (
              <button
                key={a.id}
                className={props.currentAudioTrack === Number(a.id) ? "active" : ''}
                onClick={() => props.onSelectAudio(Number(a.id))}
              >
                {a.label} {a.channels ? <span className="pv-dim">({a.channels})</span> : null}
              </button>
            ))}
          </div>
        )}

        {tab === 'subtitles' && (
          <div className="pv-settings-list">
            <button className={props.activeSubtitleId === null ? "active" : ''} onClick={() => props.onSelectSubtitle(null)}>
              {t("player_SettingsMenu.disattivati")}
            </button>
            {props.subtitleTracks.map(t => (
              <button
                key={t.id}
                className={props.activeSubtitleId === t.id ? "active" : ''}
                onClick={() => props.onSelectSubtitle(t.id)}
              >
                {t.label}
              </button>
            ))}

            {props.activeSubtitleId && (
              <div className="pv-subtitle-customize">
                <div className="pv-field">
                  <span>{t("player_SettingsMenu.dimensione")}</span>
                  <div className="pv-field-options">
                    {SIZES.map(s => (
                      <button
                        key={s}
                        className={props.subtitleStyle.fontSize === s ? "active" : ''}
                        onClick={() => props.onUpdateSubtitleStyle({ fontSize: s })}
                      >
                        {SIZE_LABELS[s]}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="pv-field">
                  <span>{t("player_SettingsMenu.colore")}</span>
                  <div className="pv-field-options">
                    {COLORS.map(c => (
                      <button
                        key={c}
                        className={`pv-swatch ${props.subtitleStyle.color === c ? "active" : ''}`}
                        style={{ backgroundColor: c }}
                        onClick={() => props.onUpdateSubtitleStyle({ color: c })}
                        aria-label={t("player_SettingsMenu.colore_2", { v0: c })}
                      />
                    ))}
                  </div>
                </div>
                <div className="pv-field">
                  <span>{t("player_SettingsMenu.sfondo")}{Math.round(props.subtitleStyle.backgroundOpacity * 100)}%)</span>
                  <input
                    type="range" min={0} max={1} step={0.1}
                    value={props.subtitleStyle.backgroundOpacity}
                    onChange={e => props.onUpdateSubtitleStyle({ backgroundOpacity: Number(e.target.value) })}
                  />
                </div>
                <div className="pv-field">
                  <span>{t("player_SettingsMenu.posizione")}</span>
                  <div className="pv-field-options">
                    <button className={props.subtitleStyle.position === 'bottom' ? "active" : ''} onClick={() => props.onUpdateSubtitleStyle({ position: 'bottom' })}>{t("player_SettingsMenu.in_basso")}</button>
                    <button className={props.subtitleStyle.position === 'top' ? "active" : ''} onClick={() => props.onUpdateSubtitleStyle({ position: 'top' })}>{t("player_SettingsMenu.in_alto")}</button>
                  </div>
                </div>
                {/* Avanti e indietro di un decimo alla volta: con il solo
                    cursore, su un telefono, centrare 300 ms era fortuna. Il
                    valore resta su questo titolo (per una serie, su tutta). */}
                <div className="pv-field">
                  <span>{t("player_SettingsMenu.sincronizzazione")} {syncLabel(props.subtitleStyle.syncOffsetMs)}</span>
                  <div className="pv-field-options">
                    <button aria-label={t("player_SettingsMenu.sottotitoli_piu_tardi_di")} onClick={() => props.onUpdateSubtitleStyle({ syncOffsetMs: Math.max(-30000, props.subtitleStyle.syncOffsetMs - 100) })}>−0,1 s</button>
                    <button aria-label={t("player_SettingsMenu.sottotitoli_in_sincrono")} className={props.subtitleStyle.syncOffsetMs === 0 ? "active" : ''} onClick={() => props.onUpdateSubtitleStyle({ syncOffsetMs: 0 })}>0</button>
                    <button aria-label={t("player_SettingsMenu.sottotitoli_prima_di_un")} onClick={() => props.onUpdateSubtitleStyle({ syncOffsetMs: Math.min(30000, props.subtitleStyle.syncOffsetMs + 100) })}>+0,1 s</button>
                  </div>
                  <input
                    type="range" min={-5000} max={5000} step={100}
                    aria-label={t("player_SettingsMenu.sincronizzazione_dei_sottotitoli")}
                    aria-valuetext={syncLabel(props.subtitleStyle.syncOffsetMs)}
                    value={Math.max(-5000, Math.min(5000, props.subtitleStyle.syncOffsetMs))}
                    onChange={e => props.onUpdateSubtitleStyle({ syncOffsetMs: Number(e.target.value) })}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'speed' && (
          <div className="pv-settings-list">
            {RATES.map(r => (
              <button key={r} className={props.playbackRate === r ? "active" : ''} onClick={() => props.onSelectRate(r)}>
                {r}x
              </button>
            ))}
          </div>
        )}

        {tab === 'general' && (
          <div className="pv-settings-list">
            <div className="pv-field">
              <span>{t("player_SettingsMenu.salta_intro_e_sigle")}</span>
              <div className="pv-field-options">
                <button
                  className={props.prefs.autoSkip === 'manual' ? "active" : ''}
                  onClick={() => props.onUpdatePrefs({ autoSkip: 'manual' })}
                >
                  {t("player_SettingsMenu.chiedi")}
                </button>
                <button
                  className={props.prefs.autoSkip === 'intro' ? "active" : ''}
                  onClick={() => props.onUpdatePrefs({ autoSkip: 'intro' })}
                >
                  {t("player_SettingsMenu.intro_e_recap")}
                </button>
                <button
                  className={props.prefs.autoSkip === 'all' ? "active" : ''}
                  onClick={() => props.onUpdatePrefs({ autoSkip: 'all' })}
                >
                  {t("player_SettingsMenu.tutto")}
                </button>
              </div>
            </div>

            <label className="pv-toggle">
              <input
                type="checkbox"
                checked={props.prefs.autoplayNext}
                onChange={e => props.onUpdatePrefs({ autoplayNext: e.target.checked })}
              />
              {t("player_SettingsMenu.avvia_da_solo_il")}
            </label>

            {props.wakeLockSupported && (
              <label className="pv-toggle">
                <input
                  type="checkbox"
                  checked={props.prefs.keepScreenAwake}
                  onChange={e => props.onUpdatePrefs({ keepScreenAwake: e.target.checked })}
                />
                {t("player_SettingsMenu.tieni_acceso_lo_schermo")}
              </label>
            )}

            <div className="pv-field">
              <span>
                {t("player_SettingsMenu.spegnimento_automatico")}
                {props.sleep.remainingSec !== null && (
                  <span className="pv-dim pv-num"> · {Math.ceil(props.sleep.remainingSec / 60)} {t("player_SettingsMenu.min")}</span>
                )}
              </span>
              <div className="pv-field-options">
                <button className={props.sleep.choice === null ? "active" : ''} onClick={props.sleep.cancel}>
                  {t("player_SettingsMenu.mai")}
                </button>
                {SLEEP_PRESETS.map(p => (
                  <button
                    key={String(p.value)}
                    className={props.sleep.choice === p.value ? "active" : ''}
                    onClick={() => props.sleep.arm(p.value)}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="pv-field">
              <span>{t("player_SettingsMenu.qualita_massima")}</span>
              <div className="pv-field-options">
                <button
                  className={props.prefs.maxHeight === null ? "active" : ''}
                  onClick={() => props.onSelectMaxHeight(null)}
                >
                  {t("player_SettingsMenu.nessun_limite")}
                </button>
                {[480, 720, 1080].map(h => (
                  <button
                    key={h}
                    className={props.prefs.maxHeight === h ? "active" : ''}
                    onClick={() => props.onSelectMaxHeight(h)}
                  >
                    {h}p
                  </button>
                ))}
              </div>
            </div>

            {/* Says the quiet part: these are remembered. Otherwise the only
                way to find out is to notice, three episodes later, that the
                player kept the language you picked. */}
            <p className="pv-dim">
              {t("player_SettingsMenu.volume_velocita_lingua_di")}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
