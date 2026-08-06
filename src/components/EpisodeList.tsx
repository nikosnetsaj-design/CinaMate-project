import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSettings } from "../store/useSettings";
import { useSettingsSheet } from "../store/useSettingsSheet";
import { useLibrary } from "../store/useLibrary";
import { usePlayerSources } from "../store/usePlayerSources";
import { getSeason, stillUrl, type TmdbEpisode } from "../lib/tmdb";
import { countdown, daysBetweenToday } from "../lib/format";
import { prefetchHandlers } from "../lib/prefetch";
import { PlayIcon, CheckIcon } from "./icons";
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
  onMarkUpTo,
}: {
  episode: TmdbEpisode;
  watched: boolean;
  onPlay: (episode: TmdbEpisode) => void;
  onMarkUpTo: (episode: TmdbEpisode) => void;
}) {
  const still = stillUrl(episode.stillPath);
  // Una puntata non ancora andata in onda non si riproduce: il pulsante
  // manderebbe il player a cercare un file che non esiste da nessuna parte.
  const unreleased = episode.airDate != null && daysBetweenToday(episode.airDate) > 0;

  return (
    <li className="flex items-center gap-3 rounded-md border border-border bg-surface-2 p-2 transition-colors hover:bg-surface-hover">
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
            style={{ background: "var(--status-done)", color: "var(--accent-contrast)" }}
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

        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-[11px] text-text-faint">
          {episode.rating != null && (
            <span className="flex items-center gap-1">
              <span style={{ color: "var(--yellow)" }}>★</span>
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
      <div className="flex shrink-0 flex-col items-center gap-1.5">
        {!unreleased && (
          <button
            type="button"
            onClick={() => onPlay(episode)}
            {...prefetchHandlers("/player")}
            aria-label={`Riproduci episodio ${episode.episodeNumber}, ${episode.title}`}
            title="Riproduci"
            className="flex h-10 w-12 items-center justify-center rounded-sm border transition-transform hover:scale-105"
            style={{
              borderColor: "color-mix(in srgb, var(--accent) 45%, transparent)",
              background: "color-mix(in srgb, var(--accent) 18%, transparent)",
              color: "var(--accent-text)",
            }}
          >
            <PlayIcon size={16} />
          </button>
        )}
        <button
          type="button"
          onClick={() => onMarkUpTo(episode)}
          aria-pressed={watched}
          aria-label={
            watched
              ? `Segna la serie come vista fino all'episodio ${episode.episodeNumber - 1}`
              : `Segna la serie come vista fino all'episodio ${episode.episodeNumber}`
          }
          title="Segna visto fino a qui"
          className="flex h-6 w-6 items-center justify-center rounded-full border transition-colors"
          style={
            watched
              ? { borderColor: "var(--accent)", background: "var(--accent)", color: "var(--accent-contrast)" }
              : { borderColor: "var(--border-strong)", color: "var(--text-faint)" }
          }
        >
          <CheckIcon size={13} />
        </button>
      </div>
    </li>
  );
}

export function EpisodeList({ item, onNavigate }: { item: Item; onNavigate?: () => void }) {
  const tmdbApiKey = useSettings((s) => s.tmdbApiKey);
  const openSettings = useSettingsSheet((s) => s.open);
  const setEpisodesSeen = useLibrary((s) => s.setEpisodesSeen);
  const patchSource = usePlayerSources((s) => s.patch);
  const navigate = useNavigate();

  const seasons = useMemo(
    () => Array.from({ length: Math.max(1, item.seasons || 1) }, (_, i) => i + 1),
    [item.seasons],
  );
  const [season, setSeason] = useState(seasons[0]);
  const [seasonMenu, setSeasonMenu] = useState(false);
  const [episodes, setEpisodes] = useState<TmdbEpisode[] | null>(null);
  const [failed, setFailed] = useState(false);
  /** Quanti episodi stanno prima di questa stagione, per il contatore della libreria. */
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    if (!tmdbApiKey || item.tmdbId == null) return;
    let cancelled = false;
    setEpisodes(null);
    setFailed(false);

    // Le stagioni precedenti servono solo per una cosa: tradurre "visto fino a
    // S3E4" nel totale unico che la libreria tiene. Sono richieste in cache e
    // poche, ma vale la pena dirlo — non stiamo scaricando l'intera serie.
    const load = async () => {
      const current = await getSeason(item.tmdbId!, season, tmdbApiKey);
      const previous = await Promise.all(
        seasons.filter((s) => s < season).map((s) => getSeason(item.tmdbId!, s, tmdbApiKey)),
      );
      if (cancelled) return;
      setEpisodes(current);
      setOffset(previous.reduce((sum, list) => sum + list.length, 0));
    };

    void load().catch(() => {
      if (!cancelled) setFailed(true);
    });
    return () => {
      cancelled = true;
    };
  }, [item.tmdbId, tmdbApiKey, season, seasons]);

  if (item.kind === "film" || item.kind === "doc") return null;

  if (!tmdbApiKey || item.tmdbId == null) {
    return (
      <div className="rounded-md border border-dashed border-border-strong p-4 text-xs leading-relaxed text-text-faint">
        {tmdbApiKey
          ? "Questo titolo non è collegato a TMDB, quindi non so quali episodi abbia. Collegalo dalla scheda e l'elenco compare da solo."
          : "Gli episodi arrivano da TMDB: serve la tua chiave."}
        {!tmdbApiKey && (
          <button type="button" onClick={openSettings} className="ml-1.5 underline underline-offset-2">
            Aggiungila in Impostazioni
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

  const markUpTo = (episode: TmdbEpisode) => {
    const upTo = offset + episode.episodeNumber;
    // Ripremere sull'ultimo episodio segnato lo *toglie*: senza, l'unico modo
    // per correggere un tocco sbagliato sarebbe la slitta del contatore.
    setEpisodesSeen(item.id, (item.seen || 0) === upTo ? upTo - 1 : upTo);
  };

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
            className="flex items-center gap-2 rounded-sm border border-border-strong bg-surface-2 px-3.5 py-2 text-sm font-medium text-text"
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
                className="absolute left-0 top-full z-40 mt-1 max-h-64 min-w-44 overflow-y-auto rounded-md border border-border-strong bg-surface py-1 shadow-[var(--shadow-md)]"
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
                        {s === season ? "✓" : ""}
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
              watched={(item.seen || 0) >= offset + episode.episodeNumber}
              onPlay={playEpisode}
              onMarkUpTo={markUpTo}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
