import { useEffect, useState } from "react";
import { PosterArt } from "./PosterArt";
import { getDetails, TmdbApiError, type TmdbDetails, type TmdbSearchResult } from "../lib/tmdb";
import { formatRuntime } from "../lib/format";
import { serviceLinkFor } from "../lib/deepLinks";

/**
 * The full card of a title you have not added — and may decide not to.
 *
 * Until now the only way to see a plot, a cast or a runtime was to save the
 * title first and read it in the library, which gets the order backwards: those
 * are the facts you need in order to decide whether to save it at all. Anyone
 * who looked something up out of curiosity was left with a shelf to tidy.
 */
export function TitlePreview({
  result,
  onBack,
  onAdd,
  adding,
  alreadyInLibrary,
  apiKey,
}: {
  result: TmdbSearchResult;
  onBack: () => void;
  onAdd: (details: TmdbDetails) => void;
  adding: boolean;
  alreadyInLibrary: boolean;
  apiKey: string;
}) {
  const [details, setDetails] = useState<TmdbDetails | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setDetails(null);
    setError("");
    getDetails(result.tmdbId, result.mediaType, apiKey)
      .then((d) => {
        if (!cancelled) setDetails(d);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof TmdbApiError ? e.message : "Impossibile caricare i dettagli.");
      });
    return () => {
      cancelled = true;
    };
  }, [result.tmdbId, result.mediaType, apiKey]);

  // The search result already carries a title, a year and a poster, so the
  // header is drawn immediately and only the rest waits — which makes the
  // panel feel like it opened rather than like it is loading.
  const title = details?.title || result.title;
  const year = details?.year ?? result.year;

  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={onBack}
        className="-ml-1 w-fit rounded-sm px-1 py-0.5 text-sm text-text-muted hover:text-text"
      >
        ← Torna ai risultati
      </button>

      <div className="flex gap-4">
        <PosterArt
          item={{ title, kind: result.kind, posterPath: details?.posterPath ?? result.posterPath }}
          size="md"
          showTitle={false}
          className="w-24 shrink-0 sm:w-28"
        />
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-lg font-semibold leading-tight text-text">{title}</h3>
          <p className="mt-1 text-xs text-text-faint">
            {[year, details?.genre, details?.runtime ? formatRuntime(details.runtime) : null]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {details && (
            <p className="mt-1 text-xs text-text-faint">
              {[
                details.seasons ? `${details.seasons} stagion${details.seasons === 1 ? "e" : "i"}` : null,
                details.episodes ? `${details.episodes} episodi` : null,
                details.tmdbRating ? `TMDB ${details.tmdbRating.toFixed(1)}` : null,
                details.certification || null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
          {alreadyInLibrary && (
            <p className="mt-2 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ background: "color-mix(in srgb, var(--accent) 18%, transparent)", color: "var(--accent-text)" }}>
              È già nella tua libreria
            </p>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-text-muted">{error}</p>}

      {!details && !error && (
        <div className="flex flex-col gap-2" aria-hidden="true">
          <div className="skeleton h-3 w-full rounded-xs" />
          <div className="skeleton h-3 w-11/12 rounded-xs" />
          <div className="skeleton h-3 w-2/3 rounded-xs" />
        </div>
      )}

      {details?.overview && <p className="text-sm leading-relaxed text-text-muted">{details.overview}</p>}

      {details && (details.director || details.cast.length > 0) && (
        <div className="flex flex-col gap-1.5 text-xs">
          {details.director && (
            <p className="text-text-faint">
              <span className="text-text-muted">Regia</span> · {details.director}
            </p>
          )}
          {details.cast.length > 0 && (
            <p className="text-text-faint">
              <span className="text-text-muted">Cast</span> · {details.cast.slice(0, 6).join(", ")}
            </p>
          )}
          {details.studio && (
            <p className="text-text-faint">
              <span className="text-text-muted">Studio</span> · {details.studio}
            </p>
          )}
        </div>
      )}

      {details && details.watchProviders.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-text-muted">Dove guardarlo:</span>
          {details.watchProviders.slice(0, 5).map((p) => {
            // Apribile anche da qui: capita di cercare un titolo per guardarlo
            // stasera, non per metterlo in libreria.
            const link = serviceLinkFor(p.name, details.title);
            return link ? (
              <a
                key={p.name}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                title={`Apri ${details.title} su ${link.service}`}
                className="rounded-full border border-border-strong px-2.5 py-1 text-xs font-medium hover:bg-surface-hover"
                style={{ color: "var(--accent-text)" }}
              >
                {p.name} ↗
              </a>
            ) : (
              <span key={p.name} className="rounded-full bg-surface-hover px-2.5 py-1 text-xs text-text">
                {p.name}
              </span>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => details && onAdd(details)}
          disabled={!details || adding}
          className="flex-1 rounded-sm px-4 py-2.5 text-sm font-semibold disabled:opacity-50"
          style={{ background: "var(--accent)", color: "var(--accent-contrast)" }}
        >
          {adding ? "…" : alreadyInLibrary ? "Aggiungi comunque" : "Aggiungi alla libreria"}
        </button>
        {details?.trailerUrl && (
          <a
            href={details.trailerUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-sm border border-border-strong px-4 py-2.5 text-sm font-medium text-text hover:bg-surface-hover"
          >
            Trailer
          </a>
        )}
      </div>
    </div>
  );
}
