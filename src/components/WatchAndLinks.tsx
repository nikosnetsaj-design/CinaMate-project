import { useEffect, useState } from "react";
import { useSettings } from "../store/useSettings";
import { useWatchSession } from "../store/useWatchSession";
import { getWatchProviders, type TmdbWatchProvider } from "../lib/tmdb";
import { serviceLinkFor } from "../lib/deepLinks";
import { useLinkHosts } from "../store/useLinkHosts";
import { useWebViewer } from "../store/useWebViewer";
import { buildQuery, effectiveUrl, hostLabel, searchUrlsFor } from "../lib/linkHost";
import type { Item } from "../types";

function linkLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

const CHIP = "rounded-full px-2.5 py-1 text-xs";

function WatchProviders({ item }: { item: Item }) {
  const tmdbApiKey = useSettings((s) => s.tmdbApiKey);
  const startWatching = useWatchSession((s) => s.start);
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

  const linked = Boolean(item.tmdbId && item.tmdbMediaType);
  const openable = providers.map((p) => ({ name: p.name, link: serviceLinkFor(p.name, item.title) }));

  /**
   * La piattaforma che l'utente ha scritto sulla scheda. Vale come scorciatoia
   * anche senza chiave TMDB e anche per un titolo mai collegato al catalogo:
   * è un'informazione che l'app ha già. Si mostra solo quando TMDB non ha già
   * elencato lo stesso servizio, per non offrire due volte lo stesso tocco.
   */
  const own = serviceLinkFor(item.platform, item.title);
  // Finché TMDB sta ancora rispondendo la scorciatoia resta nascosta: comparire
  // per mezzo secondo e poi sparire, sostituita dalla pastiglia dello stesso
  // servizio, è un tremolio che non serve a nessuno.
  const pending = linked && Boolean(tmdbApiKey) && state !== "done" && state !== "error";
  const showOwn = own !== null && !pending && !openable.some((p) => p.link?.service === own.service);

  if (!linked && !own) return null;

  return (
    <div>
      <span className="mb-2 block text-xs font-medium uppercase tracking-wide text-text-faint">Dove guardarlo</span>
      {linked && !tmdbApiKey && (
        <p className="text-xs text-text-faint">Aggiungi la tua chiave TMDB nelle Impostazioni per vedere la disponibilità.</p>
      )}
      {linked && tmdbApiKey && state === "busy" && (
        <div className="flex items-center gap-2 text-xs text-text-faint">
          <span className="spinner h-3.5 w-3.5 rounded-full border-2" style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }} />
          Verifico su TMDB…
        </div>
      )}
      {linked && tmdbApiKey && state === "error" && <p className="text-xs text-text-faint">Non disponibile al momento.</p>}
      {linked && tmdbApiKey && state === "done" && providers.length === 0 && (
        <p className="text-xs text-text-faint">Non risulta in streaming in Italia al momento.</p>
      )}
      {linked && tmdbApiKey && state === "done" && providers.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {openable.map((p) =>
            p.link ? (
              <a
                key={p.name}
                href={p.link.url}
                onClick={() => startWatching(item.id)}
                target="_blank"
                rel="noopener noreferrer"
                title={`Apri ${item.title} su ${p.link.service}`}
                className={`${CHIP} border border-border-strong font-medium hover:bg-surface-hover`}
                style={{ color: "var(--accent-text)" }}
              >
                {p.name} ↗
              </a>
            ) : (
              <span key={p.name} className={`${CHIP} bg-surface-hover text-text`}>
                {p.name}
              </span>
            ),
          )}
        </div>
      )}

      {own && showOwn && (
        <a
          href={own.url}
          onClick={() => startWatching(item.id)}
          target="_blank"
          rel="noopener noreferrer"
          title={`Apri ${item.title} su ${own.service}`}
          className={`${CHIP} mt-1.5 inline-block border border-border-strong font-medium hover:bg-surface-hover`}
          style={{ color: "var(--accent-text)" }}
        >
          Apri su {own.service} ↗
        </a>
      )}

      {/*
        Detto una volta sola, sotto le pastiglie: il collegamento apre la
        ricerca del servizio, non la scheda del film. Nessun catalogo pubblico
        espone l'indirizzo interno di un titolo, e promettere un salto esatto
        che non c'è è peggio che spiegare quello che si fa davvero.
      */}
      {(showOwn || openable.some((p) => p.link)) && (
        <p className="mt-1.5 text-xs text-text-faint">Si apre la ricerca del servizio, già scritta. Su telefono apre l'app, se ce l'hai.</p>
      )}

      {linked && tmdbApiKey && state === "done" && providers.length > 0 && link && (
        <a
          href={link}
          onClick={() => startWatching(item.id)}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1.5 inline-block text-xs underline-offset-2 hover:underline"
          style={{ color: "var(--accent-text)" }}
        >
          Vedi tutte le opzioni su JustWatch →
        </a>
      )}
    </div>
  );
}

/**
 * La stessa ricerca del player, ma sulla scheda del titolo: la domanda è già
 * scritta, e il tocco apre il Web Viewer su quella pagina invece che sulla
 * home del sito.
 *
 * Sta qui e non solo nel player perché la scheda è il punto in cui uno decide
 * *se* guardare qualcosa, non solo dove: chi sta leggendo la trama e vuole
 * dare un'occhiata al sito non ha motivo di passare per il lettore.
 */
function LinkHostSearch({ item }: { item: Item }) {
  const hosts = useLinkHosts((s) => s.hosts);
  const openViewer = useWebViewer((s) => s.open);
  const startWatching = useWatchSession((s) => s.start);
  const enabled = hosts.filter((h) => h.enabled && h.url.trim());
  if (!enabled.length) return null;

  return (
    <div>
      <span className="mb-2 block text-xs font-medium uppercase tracking-wide text-text-faint">
        Cerca sui tuoi siti
      </span>
      <div className="flex flex-wrap gap-1.5">
        {enabled.map((host) => {
          const url = searchUrlsFor({ ...host, url: effectiveUrl(host) }, item)[0];
          if (!url) return null;
          return (
            <button
              key={host.id}
              type="button"
              onClick={() => {
                startWatching(item.id);
                openViewer(url, { itemId: item.id, title: item.title });
              }}
              title={url}
              className={`${CHIP} border border-border-strong font-medium hover:bg-surface-hover`}
              style={{ color: "var(--accent-text)" }}
            >
              {hostLabel(effectiveUrl(host))} ⧉
            </button>
          );
        })}
      </div>
      <p className="mt-1.5 text-xs text-text-faint">
        Si apre il Web Viewer con la ricerca già scritta:{" "}
        <span className="font-mono">{buildQuery(item, enabled[0].recipe)}</span>. Script, pop-up e
        cambi di pagina restano bloccati.
      </p>
    </div>
  );
}

export function WatchAndLinks({ item }: { item: Item }) {
  const startWatching = useWatchSession((s) => s.start);
  const hasLinkHosts = useLinkHosts((s) => s.hosts.some((h) => h.enabled && h.url.trim()));
  const hasLinks = item.links.length > 0;
  const hasPlatformLink = serviceLinkFor(item.platform, item.title) !== null;
  if (!item.tmdbId && !item.trailerUrl && !hasLinks && !hasPlatformLink && !hasLinkHosts) return null;

  return (
    <div className="mt-4 flex flex-col gap-3.5 rounded-md border border-border bg-surface-2 p-4">
      <WatchProviders item={item} />
      <LinkHostSearch item={item} />
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
              onClick={() => startWatching(item.id)}
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
