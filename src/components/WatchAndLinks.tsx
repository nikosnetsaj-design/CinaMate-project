import { useEffect, useState } from "react";
import { useSettings } from "../store/useSettings";
import { CatalogNote } from "./NeedsCatalog";
import { useWatchSession } from "../store/useWatchSession";
import { getWatchProviders, providerLogoUrl, type TmdbWatchInfo, type TmdbWatchProvider } from "../lib/tmdb";
import { useServices } from "../store/useServices";
import { countryLabel } from "../lib/palate";
import { ErrorState } from "./ErrorState";
import { serviceLinkFor } from "../lib/deepLinks";
import { useLinkHosts } from "../store/useLinkHosts";
import { useWebViewer } from "../store/useWebViewer";
import { buildQuery, effectiveUrl, hostLabel, searchUrlsFor } from "../lib/linkHost";
import type { Item } from "../types";
import { ChevronRightIcon, ExternalIcon, LinkIcon, PlayIcon } from "./icons";
import { t } from "../lib/i18n";

function linkLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/**
 * L'icona del servizio, grande abbastanza da riconoscerla senza leggerla.
 *
 * Le pastiglie col nome scritto erano corrette e lente: «Disney+» in mezzo ad
 * altre cinque scritte si legge, il quadratino azzurro con il castello lo si
 * *vede*. Il nome resta nell'`alt` e nel `title`, quindi chi usa un lettore di
 * schermo sente lo stesso identico elenco di prima.
 */
function ProviderTile({ provider, title, onOpen }: { provider: TmdbWatchProvider; title: string; onOpen: () => void }) {
  const logo = providerLogoUrl(provider.logoPath, "w154");
  const link = serviceLinkFor(provider.name, title);

  const face = logo ? (
    <img src={logo} alt={provider.name} loading="lazy" decoding="async" className="h-full w-full object-cover" />
  ) : (
    <span className="flex h-full w-full items-center justify-center px-1 text-center text-[9px] font-semibold leading-tight text-text">
      {provider.name}
    </span>
  );

  const shell =
    "block h-14 w-14 shrink-0 overflow-hidden rounded-[14px] border bg-surface-2 transition-transform";

  return link ? (
    <a
      href={link.url}
      onClick={onOpen}
      target="_blank"
      rel="noopener noreferrer"
      title={t("WatchAndLinks.apri_su", { v0: title, v1: link.service })}
      className={`${shell} hover:scale-105`}
    >
      {face}
    </a>
  ) : (
    <span className={shell} title={t("WatchAndLinks.cercalo_dal_servizio", { v0: provider.name })}>
      {face}
    </span>
  );
}

/** Una fila di servizi sotto la sua etichetta: abbonamento, gratis, noleggio, acquisto. */
function ProviderGroup({
  label,
  providers,
  title,
  onOpen,
}: {
  label: string;
  providers: TmdbWatchProvider[];
  title: string;
  onOpen: () => void;
}) {
  if (providers.length === 0) return null;
  return (
    <div>
      <span className="mb-1.5 block text-xs font-medium text-text-muted">
        {label}
      </span>
      <div className="flex flex-wrap gap-2">
        {providers.map((p) => (
          <ProviderTile key={`${label}-${p.id}`} provider={p} title={title} onOpen={onOpen} />
        ))}
      </div>
    </div>
  );
}

const EMPTY_WATCH: TmdbWatchInfo = { streaming: [], free: [], rent: [], buy: [], link: null };

/**
 * «Dove guardarlo» da solo, per la scheda di un titolo che non hai.
 *
 * Il blocco intero porta con sé i tuoi siti e i tuoi link personali, che di un
 * titolo mai aggiunto non esistono: qui serve la sola domanda che ha una
 * risposta anche per uno sconosciuto — su quale servizio si guarda.
 */
export function WatchProvidersBlock({ item }: { item: Item }) {
  return (
    <div className="mt-4 rounded-lg bg-surface-2 p-4">
      <WatchProviders item={item} />
    </div>
  );
}

function WatchProviders({ item }: { item: Item }) {
  const tmdbApiKey = useSettings((s) => s.tmdbApiKey);
  const start = useWatchSession((s) => s.start);
  // Un titolo di anteprima non ha un posto in libreria dove segnare «l'ho
  // aperto»: la sessione di visione si apre solo per ciò che possiedi.
  const startWatching = (id: string) => {
    if (id) start(id);
  };
  const [state, setState] = useState<"idle" | "busy" | "error" | "done">("idle");
  const [watch, setWatch] = useState<TmdbWatchInfo>(EMPTY_WATCH);
  const [attempt, setAttempt] = useState(0);
  const region = useServices((s) => s.region);
  const link = watch.link;

  useEffect(() => {
    if (!item.tmdbId || !item.tmdbMediaType || !tmdbApiKey) return;
    let cancelled = false;
    setState("busy");
    getWatchProviders(item.tmdbId, item.tmdbMediaType, tmdbApiKey)
      .then((res) => {
        if (cancelled) return;
        setWatch(res);
        // Liste vuote perché TMDB non ha risposto non vogliono dire «da nessuna parte».
        setState(res.unavailable ? "error" : "done");
      })
      .catch(() => {
        if (!cancelled) setState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [item.tmdbId, item.tmdbMediaType, tmdbApiKey, region, attempt]);

  const linked = Boolean(item.tmdbId && item.tmdbMediaType);
  const providers = [...watch.streaming, ...watch.free, ...watch.rent, ...watch.buy];
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
      {/* Titolo pieno e non maiuscoletto grigio: è una domanda che si fa a voce
          alta — «dove lo guardo?» — e merita lo stesso peso di «Regia e
          troupe» o «Dati finanziari», che le stanno sotto. */}
      <h2 className="mb-2.5 font-display text-lg font-semibold text-text">{t("WatchAndLinks.dove_guardarlo")}</h2>
      {linked && !tmdbApiKey && <CatalogNote what={t("WatchAndLinks.dove_danno_un_titolo")} />}
      {linked && tmdbApiKey && state === "busy" && (
        <div className="flex items-center gap-2 text-xs text-text-faint">
          <span className="spinner h-3.5 w-3.5 rounded-full border-2" style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }} />
          {t("WatchAndLinks.verifico_su_tmdb")}
        </div>
      )}
      {/* «Non disponibile» sembrava dire che il film non c'è. La cosa che
          manca è la nostra informazione, non il titolo. */}
      {linked && tmdbApiKey && state === "error" && (
        <ErrorState compact title={t("WatchAndLinks.non_so_dove_danno")} description={t("WatchAndLinks.tmdb_non_ha_risposto")} onRetry={() => setAttempt((n) => n + 1)} />
      )}
      {linked && tmdbApiKey && state === "done" && providers.length === 0 && (
        <p className="text-xs text-text-faint">{t("WatchAndLinks.non_risulta_disponibile_in")} {countryLabel(region)} {t("WatchAndLinks.al_momento")}</p>
      )}
      {linked && tmdbApiKey && state === "done" && providers.length > 0 && (
        <div className="flex flex-col gap-3">
          <ProviderGroup label={t("WatchAndLinks.streaming")} providers={watch.streaming} title={item.title} onOpen={() => startWatching(item.id)} />
          <ProviderGroup label={t("WatchAndLinks.gratis")} providers={watch.free} title={item.title} onOpen={() => startWatching(item.id)} />
          <ProviderGroup label={t("WatchAndLinks.noleggia")} providers={watch.rent} title={item.title} onOpen={() => startWatching(item.id)} />
          <ProviderGroup label={t("WatchAndLinks.acquista")} providers={watch.buy} title={item.title} onOpen={() => startWatching(item.id)} />
        </div>
      )}

      {own && showOwn && (
        <a
          href={own.url}
          onClick={() => startWatching(item.id)}
          target="_blank"
          rel="noopener noreferrer"
          title={t("WatchAndLinks.apri_su", { v0: item.title, v1: own.service })}
          className="chip mt-1.5 text-accent-text"
        >
          {t("WatchAndLinks.apri_su_2")} {own.service}
          <ExternalIcon size={12} />
        </a>
      )}

      {/*
        Detto una volta sola, sotto le pastiglie: il collegamento apre la
        ricerca del servizio, non la scheda del film. Nessun catalogo pubblico
        espone l'indirizzo interno di un titolo, e promettere un salto esatto
        che non c'è è peggio che spiegare quello che si fa davvero.
      */}
      {(showOwn || openable.some((p) => p.link)) && (
        <p className="mt-1.5 text-xs text-text-faint">{t("WatchAndLinks.si_apre_la_ricerca")}</p>
      )}

      {linked && tmdbApiKey && state === "done" && providers.length > 0 && link && (
        <a
          href={link}
          onClick={() => startWatching(item.id)}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1.5 inline-flex items-center gap-0.5 text-xs underline-offset-2 hover:underline"
          style={{ color: "var(--accent-text)" }}
        >
          {t("WatchAndLinks.vedi_tutte_le_opzioni")}
          <ChevronRightIcon size={14} />
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
      <span className="mb-2 block text-xs font-medium text-text-faint">
        {t("WatchAndLinks.cerca_sui_tuoi_siti")}
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
              className="chip text-accent-text"
            >
              {hostLabel(effectiveUrl(host))}
            </button>
          );
        })}
      </div>
      <p className="mt-1.5 text-xs text-text-faint">
        {t("WatchAndLinks.si_apre_il_web")}{" "}
        <span className="font-mono">{buildQuery(item, enabled[0].recipe)}</span>{t("WatchAndLinks.script_pop_up_e")}
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
    <div className="mt-4 flex flex-col gap-3.5 rounded-lg bg-surface-2 p-4">
      <WatchProviders item={item} />
      <LinkHostSearch item={item} />
      {(item.trailerUrl || hasLinks) && (
        <div className="flex flex-wrap gap-2">
          {item.trailerUrl && (
            <a
              href={item.trailerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="chip gap-1.5"
            >
              <PlayIcon size={12} />
              {t("WatchAndLinks.trailer")}
            </a>
          )}
          {item.links.map((l) => (
            <a
              key={l}
              href={l}
              onClick={() => startWatching(item.id)}
              target="_blank"
              rel="noopener noreferrer"
              className="chip gap-1.5"
            >
              <LinkIcon size={13} />
              {linkLabel(l)}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
