import { useState } from 'react';
import { PlayIcon } from './Icons';

/**
 * Le puntate della serie che stai guardando, dentro il lettore.
 *
 * Il pannello «Episodi» elencava le *altre cose riproducibili* — gli altri
 * titoli del tuo scaffale — che è una risposta a una domanda diversa. Quello
 * che si cerca mentre si guarda una serie è la stagione: quale puntata è
 * questa, come si chiama la prossima, quanto dura, e saltare alla settima
 * senza tornare indietro di tre schermate.
 *
 * È presentazionale di proposito: riceve le puntate già pronte e non sa niente
 * né di TMDB né degli store di CineMate. Il lettore è un modulo a sé, e questa
 * è la regola che lo tiene tale — chi le carica è la pagina, che quelle cose
 * le conosce già.
 */

export type SeriesEpisode = {
  number: number;
  title: string;
  overview: string;
  /** Il fotogramma 16:9. Assente per le puntate non ancora uscite. */
  stillUrl: string | null;
  runtime: number | null;
};

export type SeriesEpisodesProps = {
  /** Le stagioni disponibili, numerate. */
  seasons: number[];
  season: number;
  onSeason: (season: number) => void;
  /** `null` mentre arrivano da TMDB. */
  episodes: SeriesEpisode[] | null;
  /** La puntata in riproduzione, quando si sa quale sia. */
  current: number | null;
  onPlay: (episode: SeriesEpisode) => void;
};

export default function SeriesEpisodes({
  seasons,
  season,
  onSeason,
  episodes,
  current,
  onPlay,
}: SeriesEpisodesProps) {
  const [menu, setMenu] = useState(false);

  return (
    <div className="pv-series">
      {seasons.length > 1 && (
        <div className="pv-series-season">
          <button type="button" className="pv-season-btn" aria-expanded={menu} onClick={() => setMenu((v) => !v)}>
            Stagione {season}
            <span aria-hidden="true">⌄</span>
          </button>
          {menu && (
            <ul className="pv-season-menu" role="listbox" aria-label="Stagioni">
              {seasons.map((s) => (
                <li key={s}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={s === season}
                    onClick={() => {
                      onSeason(s);
                      setMenu(false);
                    }}
                  >
                    {s === season ? '✓ ' : ''}Stagione {s}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {episodes === null ? (
        <p className="pv-dim">Sto leggendo la stagione…</p>
      ) : episodes.length === 0 ? (
        <p className="pv-dim">Per questa stagione non risultano puntate.</p>
      ) : (
        <ul className="pv-series-list">
          {episodes.map((episode) => {
            const now = episode.number === current;
            return (
              <li key={episode.number}>
                <button
                  type="button"
                  className={`pv-series-card ${now ? 'active' : ''}`}
                  aria-current={now}
                  onClick={() => onPlay(episode)}
                >
                  <span className="pv-series-art">
                    {episode.stillUrl ? <img src={episode.stillUrl} alt="" loading="lazy" /> : <span className="pv-series-art-empty" />}
                    <span className="pv-series-play" aria-hidden="true">
                      <PlayIcon />
                    </span>
                  </span>
                  <span className="pv-series-head">
                    <strong>
                      {episode.number}. {episode.title}
                    </strong>
                    {episode.runtime ? <span className="pv-dim">{episode.runtime}m</span> : null}
                  </span>
                  {episode.overview && <span className="pv-series-plot">{episode.overview}</span>}
                  {now && <span className="pv-episode-flag">In riproduzione</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
