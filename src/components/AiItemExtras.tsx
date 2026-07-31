import { useState } from "react";
import { useSettings } from "../store/useSettings";
import { useLibrary } from "../store/useLibrary";
import { spoilerFreeRecap, translateOverview, ClaudeApiError } from "../lib/anthropic";
import { getOverviewInEnglish } from "../lib/tmdb";
import type { Item } from "../types";

function Panel({ children }: { children: React.ReactNode }) {
  return <div className="mt-4 rounded-md border border-border bg-surface-2 p-4">{children}</div>;
}

function Label({ children }: { children: string }) {
  return (
    <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-text-faint">{children}</span>
  );
}

/**
 * "Dove eravamo" for a series you left part-way through.
 *
 * Only offered where it answers a real question: a series, started, not
 * finished. On a film it would be a plot summary of something you already
 * watched, and on episode zero it would be an advert.
 *
 * Never fetched automatically. This costs the user's own API credit, and a
 * recap that appears unasked on every detail sheet spends it on the many
 * occasions nobody wanted one.
 */
export function SpoilerFreeRecap({ item }: { item: Item }) {
  const apiKey = useSettings((s) => s.apiKey);
  const model = useSettings((s) => s.model);
  const [recap, setRecap] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const relevant =
    item.kind !== "film" && (item.seen || 0) > 0 && (!item.episodes || (item.seen || 0) < item.episodes);
  if (!relevant || !apiKey) return null;

  const load = async () => {
    setBusy(true);
    setError(null);
    try {
      setRecap(await spoilerFreeRecap(item.title, item.seen || 0, item.episodes, apiKey, model));
    } catch (e) {
      setError(e instanceof ClaudeApiError ? e.message : "Riassunto non riuscito.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel>
      <Label>Dove eravamo</Label>
      {recap ? (
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-text">{recap}</p>
      ) : (
        <>
          <p className="text-xs leading-relaxed text-text-faint">
            Un riassunto fino all'episodio {item.seen}, senza anticipare niente di quello che viene
            dopo.
          </p>
          <button
            type="button"
            onClick={load}
            disabled={busy}
            className="mt-2.5 w-full rounded-sm border py-2.5 text-sm font-semibold disabled:opacity-50"
            style={{
              borderColor: "color-mix(in srgb, var(--cyan) 35%, transparent)",
              background: "color-mix(in srgb, var(--cyan) 12%, transparent)",
              color: "var(--cyan)",
            }}
          >
            {busy ? "Sto ricostruendo…" : "Ricordami dove eravamo"}
          </button>
        </>
      )}
      {error && (
        <p role="alert" className="mt-2 text-xs" style={{ color: "var(--danger)" }}>
          {error}
        </p>
      )}
    </Panel>
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
        className="mt-2.5 w-full rounded-sm border border-border-strong py-2.5 text-sm font-medium text-text disabled:opacity-50"
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
