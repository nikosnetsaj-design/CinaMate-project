import { useState } from 'react';
import { useFocusTrap } from '../../lib/useFocusTrap';
import { CloseIcon, PlayIcon } from './Icons';
import SeriesEpisodes, { type SeriesEpisodesProps } from './SeriesEpisodes';

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
  /**
   * Le puntate della serie in riproduzione, quando ce ne sono.
   *
   * Sono due domande diverse e adesso hanno due schede: «quale puntata di
   * questa serie» e «cos'altro posso far partire». Prima c'era solo la
   * seconda, che è la risposta che nessuno cerca mentre sta guardando una
   * serie a metà stagione.
   */
  series?: SeriesEpisodesProps | null;
};

export default function EpisodesPanel({ entries, currentId, onSelect, onClose, series }: Props) {
  const panelRef = useFocusTrap(onClose);
  const [tab, setTab] = useState<'serie' | 'altro'>(series ? 'serie' : 'altro');
  const showSeries = Boolean(series) && tab === 'serie';

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

        {series && entries.length > 1 && (
          <div className="pv-side-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'serie'}
              className={tab === 'serie' ? 'active' : ''}
              onClick={() => setTab('serie')}
            >
              Questa serie
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'altro'}
              className={tab === 'altro' ? 'active' : ''}
              onClick={() => setTab('altro')}
            >
              Da riprodurre
            </button>
          </div>
        )}

        {showSeries && series && <SeriesEpisodes {...series} />}

        {!showSeries && (
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
        )}
      </div>
    </div>
  );
}
