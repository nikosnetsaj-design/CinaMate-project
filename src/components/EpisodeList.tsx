import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSettings } from "../store/useSettings";
import { useSettingsSheet } from "../store/useSettingsSheet";
import { useLibrary } from "../store/useLibrary";
import { usePlayerSources } from "../store/usePlayerSources";
import { getSeason, stillUrl, type TmdbEpisode } from "../lib/tmdb";
import { countdown, daysBetweenToday } from "../lib/format";
import { prefetchHandlers } from "../lib/prefetch";
import { CheckIcon, PlayIcon, StarIcon } from "./icons";
import { isWatched, nextEpisode } from "../lib/episodes";
import { useLongPress } from "../lib/useLongPress";
import type { Item } from "../types";

/**
 * Gli episodi di una stagione, con la puntata come unità invece che come
 * numero in un contatore.
 *
 * Fino a qui la libreria sapeva solo *quanti* episodi avevi visto: un totale
 * unico, senza nomi e senza stagioni. Bastava per il diario e non basta per
 * scegliere, che è il momento in cui serve sapere che la 4 si chiama «0-8-4» e
 * dura 43 minuti. I dati arrivano da TMDB e restano in cache sei ore.
 *
 * La cosa che cambia davvero è il pulsante di riproduzione su ogni riga:
 * scegliere S2E7 scrive la posizione nelle sorgenti del titolo, e da lì
 * l'indirizzo che il player costruisce diventa `…/s02e07.m3u8` invece del
 * solito `S01E{visti+1}`. Prima quella scelta non esisteva e la stagione era
 * fissa a 1.
 */

function EpisodeRow({
  episode,
  watched,
  onPlay,
  onToggle,
  onMarkUpTo,
}: {
  episode: TmdbEpisode;
  watched: boolean;
  onPlay: (episode: TmdbEpisode) => void;
  onToggle: (episode: TmdbEpisode) => void;
  onMarkUpTo: (episode: TmdbEpisode) => void;
}) {
  const still = stillUrl(episode.stillPath);
  // Tocco: questa puntata. Pressione lunga (o Maiuscolo + clic): anche tutte
  // quelle prima — la stessa grammatica della griglia delle stagioni.
  const press = useLongPress(
    () => onToggle(episode),
    () => onMarkUpTo(episode),
  );
  // Una puntata non ancora andata in onda non si riproduce: il pulsante
  // manderebbe il player a cercare un file che non esiste da nessuna parte.
  const unreleased = episode.airDate != null && daysBetweenToday(episode.airDate) > 0;

  return (
    <li className="flex items-center gap-3 rounded-lg bg-surface-2 p-2 transition-colors hover:bg-surface-hover">
      <div className="relative aspect-video w-28 shrink-0 overflow-hidden rounded-sm bg-surface sm:w-36">
        {still ? (
          <img
            src={still}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
            // Le puntate già viste restano riconoscibili senza doverle leggere:
            // spente, con il segno sopra. È l'unico modo per capire a colpo
            // d'occhio dove sei in una stagione da ventiquattro episodi.
            style={watched ? { opacity: 0.45 } : undefined}
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center font-mono text-xs text-text-faint">
            {episode.episodeNumber}
          </span>
        )}
        {watched && (
          <span
            className="absolute left-1 top-1 flex h-5 w-5 items-center justify-center rounded-full"
            style={{ background: "var(--text)", color: "var(--bg)" }}
          >
            <CheckIcon size={12} />
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-text">
          {episode.episodeNumber}. {episode.title}
        </p>

        {episode.overview && (
          <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-text-muted">{episode.overview}</p>
        )}

        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-xs text-text-faint">
          {episode.rating != null && (
            <span className="flex items-center gap-1">
              <span className="flex" style={{ color: "var(--yellow)" }}><StarIcon size={11} filled /></span>
              <span className="font-semibold text-text">{episode.rating.toFixed(1)}</span>
            </span>
          )}
          {episode.runtime && <span>{episode.runtime} min</span>}
          {unreleased && episode.airDate && (
            <span style={{ color: "var(--accent-text)" }}>esce {countdown(episode.airDate)}</span>
          )}
        </p>
      </div>

      {/* I due gesti della riga, sempre visibili e grandi da premere col dito.
          Il play stava nascosto sulla miniatura e compariva solo passandoci
          sopra col puntatore: su un telefono, dove questa lista si usa, quel
          passaggio non esiste e il pulsante era invisibile. */}
      <div className="flex shrink-0 flex-col items-center gap-2.5">
        {!unreleased && (
          <button
            type="button"
            onClick={() => onPlay(episode)}
            {...prefetchHandlers("/player")}
            aria-label={`Riproduci episodio ${episode.episodeNumber}, ${episode.title}`}
            title="Riproduci"
            className="icon-btn icon-btn-filled text-accent-text hover:text-accent-text"
          >
            <PlayIcon size={16} />
          </button>
        )}
        <button
          type="button"
          {...press}
          aria-pressed={watched}
          aria-label={`Episodio ${episode.episodeNumber}${watched ? ", visto" : ""}. Tieni premuto per segnare anche i precedenti`}
          title="Tocca per segnarlo, tieni premuto per segnare anche i precedenti"
          className="icon-btn icon-btn-sm"
          style={
            watched
              ? { background: "var(--text)", color: "var(--bg)" }
              : { background: "var(--surface)", color: "var(--text-muted)" }
          }
        >
          <CheckIcon size={15} />
        </button>
      </div>
    </li>
  );
}

export function EpisodeList({ item, onNavigate }: { item: Item; onNavigate?: () => void }) {
  const tmdbApiKey = useSettings((s) => s.tmdbApiKey);
  const openSettings = useSettingsSheet((s) => s.open);
  const toggleEpisode = useLibrary((s) => s.toggleEpisode);
  const markEpisodesUpTo = useLibrary((s) => s.markEpisodesUpTo);
  const patchSource = usePlayerSources((s) => s.patch);
  const navigate = useNavigate();

  const seasons = useMemo(
    () => Array.from({ length: Math.max(1, item.seasonEpisodes?.length || item.seasons || 1) }, (_, i) => i + 1),
    [item.seasons, item.seasonEpisodes],
  );
  // Si apre sulla stagione del prossimo episodio: è quella che si cerca.
  const [season, setSeason] = useState(() => nextEpisode(item)?.season ?? seasons[0]);
  const [seasonMenu, setSeasonMenu] = useState(false);
  const [episodes, setEpisodes] = useState<TmdbEpisode[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!tmdbApiKey || item.tmdbId == null) return;
    let cancelled = false;
    setEpisodes(null);
    setFailed(false);

    // Una stagione sola: il registro degli episodi sa già stagione per
    // stagione cosa hai visto, quindi le precedenti non servono più a
    // tradurre «fino a S3E4» in un totale.
    const load = async () => {
      const current = await getSeason(item.tmdbId!, season, tmdbApiKey);
      if (cancelled) return;
      setEpisodes(current);
    };

    void load().catch(() => {
      if (!cancelled) setFailed(true);
    });
    return () => {
      cancelled = true;
    };
  }, [item.tmdbId, tmdbApiKey, season]);

  if (item.kind === "film" || item.kind === "doc") return null;

  if (!tmdbApiKey || item.tmdbId == null) {
    return (
      <div className="flex flex-col items-start gap-2 rounded-md bg-surface-2 p-4 text-sm text-text-muted">
        {tmdbApiKey
          ? "Questo titolo non è collegato a TMDB, quindi titoli e trame delle puntate non ci sono. La griglia qui sotto funziona lo stesso."
          : "Titoli, trame e miniature delle puntate arrivano da TMDB. La griglia qui sotto funziona anche senza."}
        {!tmdbApiKey && (
          <button type="button" onClick={() => openSettings("chiavi")} className="btn btn-plain btn-sm -ml-3">
            Aggiungi la chiave
          </button>
        )}
      </div>
    );
  }

  const playEpisode = (episode: TmdbEpisode) => {
    // La scelta viene scritta dove il player la legge già: le due caselle del
    // pannello Sorgenti, che valgono sia per gli indirizzi costruiti sia per la
    // ricerca sui siti.
    patchSource(item.id, { searchSeason: episode.seasonNumber, searchEpisode: episode.episodeNumber });
    onNavigate?.();
    navigate(`/player?titolo=${encodeURIComponent(item.id)}`);
  };

  const toggle = (episode: TmdbEpisode) =>
    toggleEpisode(item.id, { season: episode.seasonNumber, episode: episode.episodeNumber });
  const markUpTo = (episode: TmdbEpisode) =>
    markEpisodesUpTo(item.id, { season: episode.seasonNumber, episode: episode.episodeNumber });

  return (
    <div className="flex flex-col gap-3">
      {/* Una tendina e non una fila di pastiglie: sette stagioni in orizzontale
          costringono a scorrere per arrivare all'ultima, e la settima è
          esattamente quella che si cerca in una serie che stai finendo. */}
      {seasons.length > 1 && (
        <div className="relative self-start">
          <button
            type="button"
            onClick={() => setSeasonMenu((v) => !v)}
            aria-expanded={seasonMenu}
            aria-haspopup="listbox"
            className="btn btn-secondary"
          >
            Stagione {season}
            <span aria-hidden="true" className="text-text-faint">
              ⌄
            </span>
          </button>

          {seasonMenu && (
            <>
              <button
                type="button"
                aria-label="Chiudi l'elenco delle stagioni"
                className="fixed inset-0 z-30 cursor-default"
                onClick={() => setSeasonMenu(false)}
              />
              <ul
                role="listbox"
                aria-label="Stagioni"
                className="absolute left-0 top-full z-40 mt-1 max-h-64 min-w-44 overflow-y-auto rounded-md bg-surface py-1 shadow-[var(--shadow-md),0_0_0_1px_var(--separator)]"
              >
                {seasons.map((s) => (
                  <li key={s}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={s === season}
                      onClick={() => {
                        setSeason(s);
                        setSeasonMenu(false);
                      }}
                      className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-sm text-text hover:bg-surface-hover"
                    >
                      <span className="w-4 shrink-0" style={{ color: "var(--accent-text)" }}>
                        {s === season ? <CheckIcon size={14} /> : null}
                      </span>
                      Stagione {s}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {failed ? (
        <p className="text-xs text-text-faint">
          Non sono riuscito a leggere questa stagione da TMDB. Riprova più tardi.
        </p>
      ) : episodes === null ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton h-20 rounded-md" aria-hidden="true" />
          ))}
        </div>
      ) : episodes.length === 0 ? (
        <p className="text-xs text-text-faint">TMDB non elenca episodi per questa stagione.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {episodes.map((episode) => (
            <EpisodeRow
              key={`${episode.seasonNumber}-${episode.episodeNumber}`}
              episode={episode}
              watched={isWatched(item, { season: episode.seasonNumber, episode: episode.episodeNumber })}
              onPlay={playEpisode}
              onToggle={toggle}
              onMarkUpTo={markUpTo}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
