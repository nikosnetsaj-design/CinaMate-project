import { PauseIcon, PlayIcon } from './Icons';

/**
 * I tre comandi che si usano davvero, al centro della scena e grandi.
 *
 * Stavano in fondo assieme ad altri otto pulsanti: su un telefono in
 * orizzontale erano bersagli da otto millimetri in fila, e il "avanti di 10"
 * finiva sotto il pollice destro solo per fortuna. Al centro sono tre bersagli
 * lontani fra loro, che è la sola cosa che li rende premibili al buio.
 */

type Props = {
  isPlaying: boolean;
  onTogglePlay: () => void;
  onSeekBy: (delta: number) => void;
};

/** Freccia circolare con dentro i secondi, come la scritta sul pulsante. */
function SeekIcon({ direction }: { direction: -1 | 1 }) {
  return (
    <svg viewBox="0 0 44 44" width={44} height={44} fill="none" aria-hidden="true">
      <g transform={direction === -1 ? 'scale(-1 1) translate(-44 0)' : undefined}>
        <path
          d="M22 9.5a12.5 12.5 0 1 1-11.6 7.9"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        <polygon points="22,4.5 22,14.5 29,9.5" fill="currentColor" />
      </g>
      <text
        x="22"
        y="26.5"
        textAnchor="middle"
        fill="currentColor"
        fontSize="12"
        fontWeight="700"
        fontFamily="var(--pv-font-mono)"
      >
        10
      </text>
    </svg>
  );
}

export default function CenterTransport({ isPlaying, onTogglePlay, onSeekBy }: Props) {
  return (
    <div className="pv-transport">
      <button
        type="button"
        className="pv-transport-btn"
        aria-label="Indietro di 10 secondi"
        onClick={() => onSeekBy(-10)}
      >
        <SeekIcon direction={-1} />
      </button>
      <button
        type="button"
        className="pv-transport-btn pv-transport-play"
        aria-label={isPlaying ? 'Pausa' : 'Riproduci'}
        onClick={onTogglePlay}
      >
        {isPlaying ? <PauseIcon /> : <PlayIcon />}
      </button>
      <button
        type="button"
        className="pv-transport-btn"
        aria-label="Avanti di 10 secondi"
        onClick={() => onSeekBy(10)}
      >
        <SeekIcon direction={1} />
      </button>
    </div>
  );
}
