import { useState } from 'react';
import type { QualityLevel, AudioTrack, SubtitleTrack, SubtitleStyle } from '../types';
import { CloseIcon } from './Icons';

type Tab = 'quality' | 'audio' | 'subtitles' | 'speed';

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
  onClose: () => void;
};

const RATES = [0.5, 0.75, 1, 1.25, 1.5, 2];
const SIZES: SubtitleStyle['fontSize'][] = ['small', 'medium', 'large', 'extraLarge'];
const SIZE_LABELS: Record<SubtitleStyle['fontSize'], string> = {
  small: 'Piccoli', medium: 'Medi', large: 'Grandi', extraLarge: 'Molto grandi',
};
const COLORS = ['#F5F1E8', '#F2C879', '#7FD8C6', '#E36F6F'];

export default function SettingsMenu(props: Props) {
  const [tab, setTab] = useState<Tab>('quality');

  return (
    <div className="pv-settings-overlay" onClick={props.onClose}>
      <div className="pv-settings-panel" onClick={e => e.stopPropagation()}>
        <div className="pv-settings-header">
          <div className="pv-settings-tabs">
            <button className={tab === 'quality' ? 'active' : ''} onClick={() => setTab('quality')}>Qualità</button>
            <button className={tab === 'audio' ? 'active' : ''} onClick={() => setTab('audio')}>Audio</button>
            <button className={tab === 'subtitles' ? 'active' : ''} onClick={() => setTab('subtitles')}>Sottotitoli</button>
            <button className={tab === 'speed' ? 'active' : ''} onClick={() => setTab('speed')}>Velocità</button>
          </div>
          <button className="pv-icon-btn" aria-label="Chiudi impostazioni" onClick={props.onClose}><CloseIcon /></button>
        </div>

        {tab === 'quality' && (
          <div className="pv-settings-list">
            <button className={props.currentLevel === -1 ? 'active' : ''} onClick={() => props.onSelectLevel(-1)}>
              Automatica
            </button>
            {[...props.levels].sort((a, b) => b.height - a.height).map(l => (
              <button
                key={l.id}
                className={props.currentLevel === Number(l.id) ? 'active' : ''}
                onClick={() => props.onSelectLevel(Number(l.id))}
              >
                {l.label}
                {l.bitrate > 0 && <span className="pv-dim pv-mono"> {Math.round(l.bitrate / 1000)} kbps</span>}
              </button>
            ))}
            <label className="pv-toggle">
              <input
                type="checkbox"
                checked={props.dataSaver}
                onChange={e => props.onToggleDataSaver(e.target.checked)}
              />
              Modalità risparmio dati
            </label>
          </div>
        )}

        {tab === 'audio' && (
          <div className="pv-settings-list">
            {props.audioTracks.length === 0 && <p className="pv-dim">Nessuna traccia audio alternativa disponibile.</p>}
            {props.audioTracks.map(a => (
              <button
                key={a.id}
                className={props.currentAudioTrack === Number(a.id) ? 'active' : ''}
                onClick={() => props.onSelectAudio(Number(a.id))}
              >
                {a.label} {a.channels ? <span className="pv-dim">({a.channels})</span> : null}
              </button>
            ))}
          </div>
        )}

        {tab === 'subtitles' && (
          <div className="pv-settings-list">
            <button className={props.activeSubtitleId === null ? 'active' : ''} onClick={() => props.onSelectSubtitle(null)}>
              Disattivati
            </button>
            {props.subtitleTracks.map(t => (
              <button
                key={t.id}
                className={props.activeSubtitleId === t.id ? 'active' : ''}
                onClick={() => props.onSelectSubtitle(t.id)}
              >
                {t.label}
              </button>
            ))}

            {props.activeSubtitleId && (
              <div className="pv-subtitle-customize">
                <div className="pv-field">
                  <span>Dimensione</span>
                  <div className="pv-field-options">
                    {SIZES.map(s => (
                      <button
                        key={s}
                        className={props.subtitleStyle.fontSize === s ? 'active' : ''}
                        onClick={() => props.onUpdateSubtitleStyle({ fontSize: s })}
                      >
                        {SIZE_LABELS[s]}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="pv-field">
                  <span>Colore</span>
                  <div className="pv-field-options">
                    {COLORS.map(c => (
                      <button
                        key={c}
                        className={`pv-swatch ${props.subtitleStyle.color === c ? 'active' : ''}`}
                        style={{ backgroundColor: c }}
                        onClick={() => props.onUpdateSubtitleStyle({ color: c })}
                        aria-label={`Colore ${c}`}
                      />
                    ))}
                  </div>
                </div>
                <div className="pv-field">
                  <span>Sfondo ({Math.round(props.subtitleStyle.backgroundOpacity * 100)}%)</span>
                  <input
                    type="range" min={0} max={1} step={0.1}
                    value={props.subtitleStyle.backgroundOpacity}
                    onChange={e => props.onUpdateSubtitleStyle({ backgroundOpacity: Number(e.target.value) })}
                  />
                </div>
                <div className="pv-field">
                  <span>Posizione</span>
                  <div className="pv-field-options">
                    <button className={props.subtitleStyle.position === 'bottom' ? 'active' : ''} onClick={() => props.onUpdateSubtitleStyle({ position: 'bottom' })}>In basso</button>
                    <button className={props.subtitleStyle.position === 'top' ? 'active' : ''} onClick={() => props.onUpdateSubtitleStyle({ position: 'top' })}>In alto</button>
                  </div>
                </div>
                <div className="pv-field">
                  <span>Sincronizzazione ({props.subtitleStyle.syncOffsetMs > 0 ? '+' : ''}{props.subtitleStyle.syncOffsetMs}ms)</span>
                  <input
                    type="range" min={-5000} max={5000} step={100}
                    value={props.subtitleStyle.syncOffsetMs}
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
              <button key={r} className={props.playbackRate === r ? 'active' : ''} onClick={() => props.onSelectRate(r)}>
                {r}x
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
