import { useEffect, useState } from "react";
import { useSettings } from "../store/useSettings";
import { getWatchProviders, type TmdbWatchProvider } from "../lib/tmdb";
import type { Item } from "../types";

function linkLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function WatchProviders({ item }: { item: Item }) {
  const tmdbApiKey = useSettings((s) => s.tmdbApiKey);
  const [state, setState] = useState<"idle" | "busy" | "error" | "done">("idle");
  const [providers, setProviders] = useState<TmdbWatchProvider[]>([]);
  const [link, setLink] = useState<string | null>(null);

  useEffect(() => {
    if (!item.tmdbId || !item.tmdbMediaType || !tmdbApiKey) return;
    let cancelled = false;
    setState("busy");
    getWatchProviders(item.tmdbId, item.tmdbMediaType, tmdbApiKey)
      .then((res) => {
        if (cancelled) return;
        setProviders(res.providers);
        setLink(res.link);
        setState("done");
      })
      .catch(() => {
        if (!cancelled) setState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [item.tmdbId, item.tmdbMediaType, tmdbApiKey]);

  if (!item.tmdbId || !item.tmdbMediaType) return null;

  return (
    <div>
      <span className="mb-2 block text-xs font-medium uppercase tracking-wide text-text-faint">Dove guardarlo</span>
      {!tmdbApiKey && <p className="text-xs text-text-faint">Aggiungi la tua chiave TMDB nelle Impostazioni per vedere la disponibilità.</p>}
      {tmdbApiKey && state === "busy" && (
        <div className="flex items-center gap-2 text-xs text-text-faint">
          <span className="spinner h-3.5 w-3.5 rounded-full border-2" style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }} />
          Verifico su TMDB…
        </div>
      )}
      {tmdbApiKey && state === "error" && <p className="text-xs text-text-faint">Non disponibile al momento.</p>}
      {tmdbApiKey && state === "done" && providers.length === 0 && (
        <p className="text-xs text-text-faint">Non risulta in streaming in Italia al momento.</p>
      )}
      {tmdbApiKey && state === "done" && providers.length > 0 && (
        <a
          href={link ?? undefined}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-wrap gap-1.5"
          aria-label="Vedi dove guardarlo su JustWatch"
        >
          {providers.map((p) => (
            <span key={p.name} className="rounded-full bg-surface-hover px-2.5 py-1 text-xs text-text">
              {p.name}
            </span>
          ))}
        </a>
      )}
    </div>
  );
}

export function WatchAndLinks({ item }: { item: Item }) {
  const hasLinks = item.links.length > 0;
  if (!item.tmdbId && !item.trailerUrl && !hasLinks) return null;

  return (
    <div className="mt-4 flex flex-col gap-3.5 rounded-md border border-border bg-surface-2 p-4">
      <WatchProviders item={item} />
      {(item.trailerUrl || hasLinks) && (
        <div className="flex flex-wrap gap-2">
          {item.trailerUrl && (
            <a
              href={item.trailerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border border-border-strong px-3 py-1.5 text-xs font-medium text-text hover:bg-surface-hover"
            >
              ▶ Trailer
            </a>
          )}
          {item.links.map((l) => (
            <a
              key={l}
              href={l}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border border-border-strong px-3 py-1.5 text-xs font-medium text-text hover:bg-surface-hover"
            >
              🔗 {linkLabel(l)}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
