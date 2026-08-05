import { useFocusTrap } from '../../lib/useFocusTrap';
import { CloseIcon, PlayIcon } from './Icons';

/**
 * La lista di cosa altro c'è da riprodurre, senza uscire dal player.
 *
 * Prima questa scelta viveva in una fila di pastiglie sopra il video: fuori
 * dalla scena, invisibile a schermo intero, e illeggibile appena i titoli
 * riproducibili superavano la mezza dozzina. Qui è un foglio laterale come
 * ogni altro dell'app, con la copertina che rende riconoscibile la riga prima
 * ancora di leggerla.
 */

export type PlaylistEntry = {
  id: string;
  title: string;
  posterUrl: string;
  /** "S1 · E4", l'anno, la saga: qualunque cosa distingua la riga. */
  subtitle?: string;
};

type Props = {
  entries: PlaylistEntry[];
  currentId: string;
  onSelect: (id: string) => void;
  onClose: () => void;
};

export default function EpisodesPanel({ entries, currentId, onSelect, onClose }: Props) {
  const panelRef = useFocusTrap(onClose);

  return (
    <div className="pv-side-overlay" onClick={onClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Episodi e titoli da riprodurre"
        className="pv-side-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pv-side-header">
          <h3>Episodi</h3>
          <button className="pv-icon-btn" aria-label="Chiudi l'elenco" onClick={onClose}>
            <CloseIcon />
          </button>
        </div>

        <ul className="pv-episode-list">
          {entries.map((entry) => {
            const current = entry.id === currentId;
            return (
              <li key={entry.id}>
                <button
                  type="button"
                  className={`pv-episode ${current ? 'active' : ''}`}
                  aria-current={current}
                  onClick={() => {
                    if (!current) onSelect(entry.id);
                    onClose();
                  }}
                >
                  <span className="pv-episode-art">
                    {entry.posterUrl ? <img src={entry.posterUrl} alt="" /> : <span className="pv-episode-art-empty" />}
                    {current && (
                      <span className="pv-episode-now" aria-hidden="true">
                        <PlayIcon />
                      </span>
                    )}
                  </span>
                  <span className="pv-episode-text">
                    <strong>{entry.title}</strong>
                    {entry.subtitle && <span className="pv-dim">{entry.subtitle}</span>}
                  </span>
                  {current && <span className="pv-episode-flag">In riproduzione</span>}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
