import { useState } from "react";
import { useSettings } from "../store/useSettings";
import { useLibrary } from "../store/useLibrary";
import { spoilerFreeRecap, translateOverview, ClaudeApiError } from "../lib/anthropic";
import { getOverviewInEnglish, getSeason } from "../lib/tmdb";
import { episodeLabel, isEpisodic, lastWatched } from "../lib/episodes";
import {
  cachedRecap,
  RECAP_DETAILS,
  recapKey,
  savedDetail,
  saveDetail,
  storeRecap,
  type EpisodeSynopsis,
  type RecapDetail,
} from "../lib/recap";
import type { Item } from "../types";

function Panel({ children }: { children: React.ReactNode }) {
  return <div className="mt-4 rounded-lg bg-surface-2 p-4">{children}</div>;
}

function Label({ children }: { children: string }) {
  return (
    <span className="mb-1.5 block text-xs font-medium text-text-faint">{children}</span>
  );
}

/**
 * «Nelle puntate precedenti», per una serie lasciata a metà.
 *
 * Solo dove risponde a una domanda vera: una serie iniziata e non finita. Su
 * un film sarebbe la trama di qualcosa che hai già visto, e a zero episodi
 * sarebbe una pubblicità.
 *
 * Il confine è l'ultimo episodio del registro, detto per nome — stagione,
 * numero, titolo — e le sinossi di TMDB arrivano al modello solo fino a lì.
 * Mai chiesto da solo: costa credito dell'utente. Una volta chiesto resta in
 * memoria per quel confine e quel livello, e riaprire la scheda non lo ripaga.
 */
export function SpoilerFreeRecap({ item }: { item: Item }) {
  const apiKey = useSettings((s) => s.apiKey);
  const model = useSettings((s) => s.model);
  const tmdbApiKey = useSettings((s) => s.tmdbApiKey);
  const [detail, setDetail] = useState<RecapDetail>(savedDetail);
  const [fresh, setFresh] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const last = lastWatched(item);
  const relevant = isEpisodic(item) && last && (!item.episodes || item.seen < item.episodes);
  if (!relevant || !apiKey) return null;

  const key = recapKey(item.id, last, detail);
  const recap = fresh[key] ?? cachedRecap(key);

  const load = async () => {
    setBusy(true);
    setError(null);
    try {
      // Le sinossi della stagione del confine, fino al confine: aiutano, ma
      // se TMDB non risponde il riassunto si fa lo stesso.
      let synopses: EpisodeSynopsis[] = [];
      if (tmdbApiKey && item.tmdbId && item.tmdbMediaType === "tv") {
        try {
          const season = await getSeason(item.tmdbId, last.season, tmdbApiKey);
          synopses = season.map((e) => ({ season: e.seasonNumber, episode: e.episodeNumber, title: e.title, overview: e.overview }));
        } catch {
          synopses = [];
        }
      }
      const lastTitle = synopses.find((s) => s.season === last.season && s.episode === last.episode)?.title ?? null;
      const text = await spoilerFreeRecap(
        { title: item.title, year: item.year || null, last, lastTitle, watchedCount: item.seen, synopses, detail },
        apiKey,
        model,
      );
      storeRecap(key, text);
      setFresh((f) => ({ ...f, [key]: text }));
    } catch (e) {
      setError(e instanceof ClaudeApiError ? e.message : "Riassunto non riuscito.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-lg bg-surface p-4 shadow-[var(--shadow-sm)]" aria-label="Nelle puntate precedenti">
      <Label>Nelle puntate precedenti</Label>
      <p className="text-xs leading-relaxed text-text-muted">
        Fino alla fine di {episodeLabel(last)}, l'ultimo che hai segnato. Niente di quello che viene dopo.
      </p>
      <div className="segmented segmented-full mt-3" role="radiogroup" aria-label="Quanto dettaglio">
        {RECAP_DETAILS.map((d) => (
          <button
            key={d.id}
            type="button"
            role="radio"
            aria-checked={detail === d.id}
            onClick={() => {
              setDetail(d.id);
              saveDetail(d.id);
            }}
          >
            {d.label}
          </button>
        ))}
      </div>
      {recap ? (
        <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-text">{recap}</p>
      ) : (
        <button type="button" onClick={load} disabled={busy} className="btn btn-secondary mt-3 w-full">
          {busy ? "Sto ricostruendo…" : "Ricordami dove eravamo"}
        </button>
      )}
      {error && (
        <p role="alert" className="mt-2 text-xs" style={{ color: "var(--danger)" }}>
          {error}
        </p>
      )}
    </section>
  );
}

/**
 * Fills in a synopsis TMDB only holds in English.
 *
 * Shown only when the Italian one is genuinely missing — this is a blank card
 * becoming a readable one, not a machine translation displacing a human one.
 * The result is written back to the library so it is translated once, not once
 * per visit.
 */
export function TranslateOverview({ item }: { item: Item }) {
  const apiKey = useSettings((s) => s.apiKey);
  const model = useSettings((s) => s.model);
  const tmdbApiKey = useSettings((s) => s.tmdbApiKey);
  const updateItem = useLibrary((s) => s.updateItem);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (item.overview.trim() || !apiKey || !tmdbApiKey || !item.tmdbId || !item.tmdbMediaType) return null;

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      const english = await getOverviewInEnglish(item.tmdbId!, item.tmdbMediaType!, tmdbApiKey);
      if (!english) {
        setError("Su TMDB non c'è nessuna sinossi, nemmeno in inglese.");
        return;
      }
      updateItem(item.id, { overview: await translateOverview(item.title, english, apiKey, model) });
    } catch (e) {
      setError(e instanceof ClaudeApiError ? e.message : "Traduzione non riuscita.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel>
      <Label>Sinossi mancante</Label>
      <p className="text-xs leading-relaxed text-text-faint">
        TMDB non ha la trama in italiano per questo titolo. Posso prendere quella inglese e
        tradurla: resta salvata, quindi si fa una volta sola.
      </p>
      <button
        type="button"
        onClick={run}
        disabled={busy}
        className="btn btn-secondary mt-2.5 w-full disabled:opacity-50"
      >
        {busy ? "Traduco…" : "Traduci la sinossi"}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-xs" style={{ color: "var(--danger)" }}>
          {error}
        </p>
      )}
    </Panel>
  );
}
