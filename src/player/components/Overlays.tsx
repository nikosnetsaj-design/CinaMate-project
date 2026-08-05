import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import type { SkipMarker, SubtitleStyle, MediaContent } from '../types';
import { getEndScreenRecommendations } from '../services/recommendationService';
import type { Recommendation } from '../services/recommendationService';
import type { GestureFeedback } from '../hooks/usePlayerGestures';
import { AUTOPLAY_COUNTDOWN_SEC } from '../hooks/usePlaybackExtras';
import { ErrorIcon } from './Icons';

const MARKER_LABELS: Record<SkipMarker['type'], string> = {
  intro: "Salta l'intro",
  recap: 'Salta il riepilogo',
  credits: 'Salta i titoli di coda',
};

export function SkipButton({ marker, onSkip }: { marker: SkipMarker; onSkip: () => void }) {
  return (
    <button className="pv-skip-btn" onClick={onSkip}>
      {MARKER_LABELS[marker.type]}
    </button>
  );
}

/**
 * La schermata di fine: cosa parte dopo, e le due sole risposte possibili.
 *
 * Occupa tutta la scena invece di essere una tessera in un angolo, perché a
 * fine episodio la scena non serve più a niente — sono i titoli di coda — e una
 * decisione che parte da sola in otto secondi merita di essere davanti agli
 * occhi. "Guarda i titoli di coda" è l'annullamento detto per quello che è:
 * nessuno annulla un episodio, si sceglie di restare su questo.
 */
export function PostPlayOverlay({
  seconds, title, posterUrl, onCancel, onPlayNow,
}: {
  seconds: number; title: string; posterUrl: string; onCancel: () => void; onPlayNow: () => void;
}) {
  const pct = Math.round(((AUTOPLAY_COUNTDOWN_SEC - seconds) / AUTOPLAY_COUNTDOWN_SEC) * 100);
  return (
    <div className="pv-postplay">
      <div className="pv-postplay-next">
        {posterUrl && <img className="pv-postplay-poster" src={posterUrl} alt="" />}
        <div>
          <span className="pv-dim">Il prossimo</span>
          <h4>{title}</h4>
        </div>
      </div>

      <div className="pv-postplay-actions">
        <button type="button" className="pv-btn-secondary" onClick={onCancel}>
          Guarda i titoli di coda
        </button>
        <button type="button" className="pv-postplay-play" onClick={onPlayNow}>
          {/* Il riempimento *è* il conto alla rovescia: un numero che scende
              va letto, una barra che avanza si vede con la coda dell'occhio. */}
          <span className="pv-postplay-fill" style={{ '--pct': `${pct}%` } as CSSProperties} aria-hidden="true" />
          <span className="pv-postplay-label">
            <svg viewBox="0 0 24 24" width={18} height={18} aria-hidden="true">
              <polygon points="6,4 20,12 6,20" fill="currentColor" />
            </svg>
            Prossimo episodio
            <span className="pv-mono">{seconds}</span>
          </span>
        </button>
      </div>
    </div>
  );
}

const GESTURE_LABELS: Record<GestureFeedback['kind'], string> = {
  seek: 'Avanzamento',
  volume: 'Volume',
  brightness: 'Luminosità',
};

/**
 * The readout for a gesture in progress. A swipe that changes something
 * invisible — a volume the phone is already showing nowhere, a brightness that
 * only affects the picture — needs to say what it did, otherwise the gesture
 * reads as the player glitching.
 */
export function GestureOverlay({ feedback }: { feedback: GestureFeedback | null }) {
  if (!feedback) return null;
  // A seek has no meaningful 0–1 fill; the two level gestures do.
  const pct = feedback.kind === 'seek' ? null : Math.round(feedback.value * 100);
  return (
    <div className="pv-gesture" role="status" aria-live="polite">
      <span className="pv-gesture-kind">{GESTURE_LABELS[feedback.kind]}</span>
      <strong className="pv-gesture-value pv-mono">{feedback.label}</strong>
      {pct !== null && (
        <div className="pv-gesture-track">
          <div className="pv-gesture-fill" style={{ width: `${Math.min(100, pct)}%` }} />
        </div>
      )}
    </div>
  );
}

/**
 * A failure worth reading: what happened, and what to do about it.
 *
 * "Riprova" is only offered for failures that waiting could actually fix. On a
 * 404 or a missing codec the button would be a lie — it would fail identically,
 * and hide the fact that the answer is in the configuration, not in the network.
 */
export function ErrorOverlay({
  failure,
  onRetry,
}: {
  failure: { message: string; hint: string; transient: boolean };
  onRetry: () => void;
}) {
  return (
    <div className="pv-error-overlay">
      <ErrorIcon />
      <p>{failure.message}</p>
      {failure.hint && <p className="pv-error-hint">{failure.hint}</p>}
      {failure.transient && <button onClick={onRetry}>Riprova</button>}
    </div>
  );
}

/** Receipt for a marker the player jumped on its own. */
export function AutoSkipNote({ type }: { type: SkipMarker['type'] }) {
  const what = type === 'intro' ? 'Intro saltata' : type === 'recap' ? 'Recap saltato' : 'Crediti saltati';
  return (
    <div className="pv-autoskip-note" role="status">
      {what}
    </div>
  );
}

export function SubtitleOverlay({ text, style }: { text: string | null; style: SubtitleStyle }) {
  if (!text) return null;
  const sizeMap: Record<SubtitleStyle['fontSize'], string> = {
    small: '1.05rem', medium: '1.3rem', large: '1.65rem', extraLarge: '2rem',
  };
  return (
    <div className={`pv-subtitle pv-subtitle-${style.position}`}>
      <span
        style={{
          fontSize: sizeMap[style.fontSize],
          color: style.color,
          backgroundColor: hexToRgba(style.backgroundColor, style.backgroundOpacity),
        }}
      >
        {text}
      </span>
    </div>
  );
}

function hexToRgba(hex: string, alpha: number) {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function EndScreenRecommendations({
  content,
  resolve,
  onSelect,
}: {
  content: MediaContent;
  /**
   * Where the suggestions come from. The host app passes its own resolver —
   * CineMate builds them from the library — and the default is the service's
   * endpoint-plus-fallback path.
   */
  resolve?: (content: MediaContent) => Promise<Recommendation[]>;
  onSelect?: (id: string) => void;
}) {
  const [recs, setRecs] = useState<Recommendation[]>([]);
  useEffect(() => {
    let cancelled = false;
    (resolve ?? getEndScreenRecommendations)(content).then(r => { if (!cancelled) setRecs(r); });
    return () => { cancelled = true; };
    // Keyed on the id alone: a fresh `content` object for the same title must
    // not re-request the recommendations.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content.id]);

  if (!recs.length) return null;
  return (
    <div className="pv-recommendations">
      <h4>Continua a guardare</h4>
      <div className="pv-recommendations-grid">
        {recs.map(r => (
          <button
            key={r.id}
            type="button"
            className="pv-rec-card"
            // Only playable suggestions are clickable: a title the library
            // knows but has no source for can still be *shown* (it's a real
            // recommendation) without pretending it will play.
            disabled={!onSelect || !r.playable}
            onClick={() => onSelect?.(r.id)}
          >
            {r.posterUrl && <img src={r.posterUrl} alt="" />}
            <span>{r.title}</span>
            {r.reason && <em className="pv-rec-reason">{r.reason}</em>}
          </button>
        ))}
      </div>
    </div>
  );
}
