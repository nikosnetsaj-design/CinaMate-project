import { useEffect, useMemo, useState } from "react";
import { useSettings } from "../store/useSettings";
import { useLibrary } from "../store/useLibrary";
import { getSeason, type TmdbEpisode } from "../lib/tmdb";
import { formatRuntime } from "../lib/format";
import type { Item } from "../types";

/**
 * Stagioni ed episodi, uno per uno.
 *
 * Il contatore sopra risponde a "a che punto sono"; questo risponde a "l'ho
 * visto, questo?", che è un'altra domanda e finora non aveva risposta: chi
 * salta un episodio, chi ne recupera uno vecchio o chi guarda una serie in
 * disordine aveva solo un numero che non lo descriveva.
 *
 * **Come convivono i due.** `seen` resta il numero che leggono statistiche,
 * diario e percentuali; questa griglia scrive `watchedEpisodes` e da lì `seen`
 * viene ricalcolato. Alla prima spunta su una scheda che aveva solo il
 * contatore, i primi `seen` episodi in ordine vengono dati per visti — è
 * l'unica lettura sensata di "ne ho visti cinque" e lo dice anche
 * l'interfaccia, così chi li aveva visti in disordine sa che deve correggere
 * invece di scoprirlo dopo.
 */
function codeOf(season: number, episode: number): string {
  return `${season}x${episode}`;
}

export function SeasonEpisodes({ item }: { item: Item }) {
  const tmdbApiKey = useSettings((s) => s.tmdbApiKey);
  const setWatchedEpisodes = useLibrary((s) => s.setWatchedEpisodes);

  const seasonCount = item.seasons ?? 0;
  const [season, setSeason] = useState(1);
  const [episodes, setEpisodes] = useState<TmdbEpisode[] | null>(null);
  const [state, setState] = useState<"idle" | "busy" | "error">("idle");

  const linked = Boolean(item.tmdbId && item.tmdbMediaType === "tv" && tmdbApiKey && seasonCount > 0);

  useEffect(() => {
    if (!linked || !item.tmdbId) return;
    let cancelled = false;
    setState("busy");
    setEpisodes(null);
    getSeason(item.tmdbId, season, tmdbApiKey)
      .then((res) => {
        if (cancelled) return;
        setEpisodes(res);
        setState("idle");
      })
      .catch(() => {
        if (!cancelled) setState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [linked, item.tmdbId, season, tmdbApiKey]);

  /**
   * La lista con cui lavorare: quella salvata se c'è, altrimenti quella dedotta
   * dal contatore. Dedurla qui e non alla scrittura significa che la griglia
   * mostra subito lo stato giusto, prima ancora che si tocchi qualcosa.
   */
  const watched = useMemo(() => {
    if (item.watchedEpisodes) return new Set(item.watchedEpisodes);
    const seen = item.seen || 0;
    if (seen <= 0) return new Set<string>();
    // Senza sapere quanti episodi ha ogni stagione si numera di seguito dalla
    // prima: è l'ipotesi che sbaglia meno, ed è correggibile a mano.
    const guessed = new Set<string>();
    let left = seen;
    for (let s = 1; s <= Math.max(1, seasonCount) && left > 0; s += 1) {
      const perSeason = Math.ceil((item.episodes ?? seen) / Math.max(1, seasonCount));
      for (let e = 1; e <= perSeason && left > 0; e += 1, left -= 1) guessed.add(codeOf(s, e));
    }
    return guessed;
  }, [item.watchedEpisodes, item.seen, item.episodes, seasonCount]);

  const inferred = !item.watchedEpisodes && (item.seen || 0) > 0;

  if (!linked) return null;

  function toggle(episodeNumber: number) {
    const code = codeOf(season, episodeNumber);
    const next = new Set(watched);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    setWatchedEpisodes(item.id, Array.from(next));
  }

  function markUpTo(episodeNumber: number) {
    const next = new Set(watched);
    for (let e = 1; e <= episodeNumber; e += 1) next.add(codeOf(season, e));
    setWatchedEpisodes(item.id, Array.from(next));
  }

  const seasonWatched = episodes?.filter((e) => watched.has(codeOf(season, e.episodeNumber))).length ?? 0;

  return (
    <div className="mt-4 rounded-md border border-border bg-surface-2 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-text-faint">Episodi</span>
        {episodes && (
          <span className="font-mono tabular text-[11px] text-text-faint">
            {seasonWatched} di {episodes.length} in questa stagione
          </span>
        )}
      </div>

      {seasonCount > 1 && (
        <div className="mt-2.5 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Stagione">
          {Array.from({ length: seasonCount }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={season === n}
              onClick={() => setSeason(n)}
              className="rounded-full border px-2.5 py-1 text-xs transition-colors"
              style={
                season === n
                  ? {
                      borderColor: "color-mix(in srgb, var(--status-watching) 45%, transparent)",
                      background: "color-mix(in srgb, var(--status-watching) 16%, transparent)",
                      color: "var(--status-watching)",
                    }
                  : { borderColor: "var(--border-strong)", color: "var(--text-muted)" }
              }
            >
              S{n}
            </button>
          ))}
        </div>
      )}

      {state === "busy" && <p className="mt-3 text-xs text-text-faint">Carico la stagione…</p>}
      {state === "error" && <p className="mt-3 text-xs text-text-faint">Non riesco a leggere questa stagione da TMDB.</p>}

      {episodes && episodes.length > 0 && (
        <ul className="mt-2.5 flex flex-col">
          {episodes.map((ep) => {
            const code = codeOf(season, ep.episodeNumber);
            const done = watched.has(code);
            return (
              <li key={code} className="flex items-center gap-2 border-b border-border py-1.5 last:border-b-0">
                <button
                  type="button"
                  onClick={() => toggle(ep.episodeNumber)}
                  aria-pressed={done}
                  aria-label={`${done ? "Segna come non visto" : "Segna come visto"}: S${season}E${ep.episodeNumber} ${ep.name}`}
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px]"
                  style={
                    done
                      ? {
                          borderColor: "var(--status-watching)",
                          background: "var(--status-watching)",
                          color: "var(--accent-contrast)",
                        }
                      : { borderColor: "var(--border-strong)", color: "var(--text-faint)" }
                  }
                >
                  {done ? "✓" : ep.episodeNumber}
                </button>
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-xs ${done ? "text-text-faint" : "text-text"}`}>{ep.name}</p>
                  <p className="font-mono tabular text-[10px] text-text-faint">
                    S{season}E{ep.episodeNumber}
                    {ep.runtime ? ` · ${formatRuntime(ep.runtime)}` : ""}
                    {ep.airDate ? ` · ${ep.airDate.slice(0, 4)}` : ""}
                  </p>
                </div>
                {!done && (
                  <button
                    type="button"
                    onClick={() => markUpTo(ep.episodeNumber)}
                    className="shrink-0 rounded-xs border border-border-strong px-1.5 py-0.5 text-[10px] text-text-faint hover:text-text"
                    title={`Segna visti tutti gli episodi fino al ${ep.episodeNumber}`}
                  >
                    fin qui
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {inferred && (
        <p className="mt-2.5 text-[11px] leading-relaxed text-text-faint">
          Le spunte qui sopra sono dedotte dai {item.seen} episodi che avevi segnato col contatore,
          contati di seguito dal primo. Se li avevi visti in disordine, correggili: da qui in poi
          conta quello che spunti tu.
        </p>
      )}
    </div>
  );
}
