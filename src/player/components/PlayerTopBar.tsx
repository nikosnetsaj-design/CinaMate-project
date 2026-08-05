import type { ReactNode } from 'react';
import type { useCast } from '../hooks/useCast';
import type { Reaction } from '../types';
import { CastIcon, CloseIcon, LockIcon, ThumbDownIcon, ThumbUpDoubleIcon, ThumbUpIcon } from './Icons';

/**
 * La riga in cima alla scena: dove sei, cosa ne pensi, e le tre uscite.
 *
 * Sta sopra il video e non sotto la barra dei comandi perché risponde a una
 * domanda diversa: i comandi in basso muovono il tempo, questa dice *cosa* si
 * sta guardando e permette di uscirne. Tenerle separate è ciò che rende
 * leggibile un player a tutto schermo su un telefono in orizzontale.
 */

type Props = {
  /** "S2:E10 «Braccata come dai segugi»" oppure il solo titolo per un film. */
  label: string;
  reaction: Reaction | null;
  /** Assente quando il titolo non è in libreria — lo stream di test, per dire. */
  onReact?: (reaction: Reaction) => void;
  cast: ReturnType<typeof useCast>;
  onLock: () => void;
  /** Assente quando non c'è nessun posto da cui il player sia stato aperto. */
  onClose?: () => void;
};

const REACTIONS: { id: Reaction; label: string; Icon: () => ReactNode }[] = [
  { id: 'down', label: 'Non fa per me', Icon: ThumbDownIcon },
  { id: 'up', label: 'Mi piace', Icon: ThumbUpIcon },
  { id: 'love', label: 'Adoro', Icon: ThumbUpDoubleIcon },
];

export default function PlayerTopBar({ label, reaction, onReact, cast, onLock, onClose }: Props) {
  return (
    <div className="pv-topbar">
      <span className="pv-topbar-label" title={label}>{label}</span>

      {/* Il voto in tre gesti. Scrive lo stesso campo della scheda titolo: un
          pollice dato qui è il voto che poi si legge in libreria, non una
          reazione parallela che non conta da nessuna parte. */}
      {onReact && (
        <div className="pv-reactions" role="group" aria-label="Il tuo voto">
          {REACTIONS.map(({ id, label: name, Icon }) => (
            <button
              key={id}
              type="button"
              className={`pv-reaction ${reaction === id ? 'active' : ''}`}
              aria-label={name}
              aria-pressed={reaction === id}
              title={name}
              onClick={() => onReact(id)}
            >
              <Icon />
            </button>
          ))}
        </div>
      )}

      <div className="pv-topbar-right">
        {(cast.castAvailable || cast.airPlayAvailable) && (
          <button
            type="button"
            className={`pv-icon-btn ${cast.castConnected ? 'active' : ''}`}
            aria-label="Trasmetti"
            onClick={cast.airPlayAvailable ? cast.openAirPlayPicker : cast.openCastPicker}
          >
            <CastIcon />
          </button>
        )}
        {/* Blocca i comandi, non lo schermo: il telefono in mano durante un
            film riceve decine di tocchi involontari, e questo è l'unico modo
            per farli finire nel vuoto senza mettere via il telefono. */}
        <button type="button" className="pv-icon-btn" aria-label="Blocca i comandi" onClick={onLock}>
          <LockIcon />
        </button>
        {onClose && (
          <button type="button" className="pv-icon-btn" aria-label="Chiudi il player" onClick={onClose}>
            <CloseIcon />
          </button>
        )}
      </div>
    </div>
  );
}
