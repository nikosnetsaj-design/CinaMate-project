import { useEffect, useState } from "react";
import { backdropUrl, posterUrl, youtubeThumb, youtubeWatchUrl, type TmdbVideo } from "../lib/tmdb";
import { PlayIcon } from "./icons";

/**
 * Il materiale del titolo: video, locandine, sfondi.
 *
 * Tre schede e non tre file una sotto l'altra, perché sono tre cose che si
 * cercano una alla volta — «fammi rivedere il trailer», «voglio la locandina
 * originale» — e messe insieme diventerebbero mezzo schermo di immagini che
 * nessuno stava chiedendo. Le schede vuote non compaiono affatto: un titolo
 * senza video non deve mostrare una linguetta "Video" che non apre niente.
 *
 * Tutto si apre qui dentro, in un pannello sopra la scheda: mandare fuori dal
 * sito per guardare un trailer di novanta secondi vuol dire perdere il posto
 * in cui si stava — e al ritorno l'app si ricarica da capo.
 */

type Tab = "video" | "poster" | "sfondi";

/** Il pannello a tutto schermo che mostra un video o un'immagine sola. */
function Lightbox({
  content,
  title,
  onClose,
}: {
  content: { kind: "video"; key: string; name: string } | { kind: "image"; url: string; label: string };
  title: string;
  onClose: () => void;
}) {
  useEffect(() => {
    /*
     * Esc chiude *questo* pannello e basta. La scheda del titolo sotto ha il
     * suo ascoltatore su `document`, quindi senza fermare l'evento in fase di
     * cattura un solo tasto chiuderebbe tutte e due — e chi voleva uscire dal
     * trailer si ritroverebbe fuori dalla scheda.
     */
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      onClose();
    }
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-80 flex items-center justify-center bg-black/92 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
      <button type="button" aria-label="Chiudi" className="absolute inset-0 cursor-default" onClick={onClose} />

      <button
        type="button"
        onClick={onClose}
        aria-label="Chiudi"
        className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-black/60 text-lg text-white"
      >
        ✕
      </button>

      {content.kind === "video" ? (
        <div className="relative z-10 w-full max-w-4xl">
          <div className="aspect-video w-full overflow-hidden rounded-md bg-black shadow-[var(--shadow-lg)]">
            <iframe
              // `youtube-nocookie` invece di `youtube`: stesso video, nessun
              // cookie di profilazione finché non si preme play.
              src={`https://www.youtube-nocookie.com/embed/${content.key}?autoplay=1&rel=0&modestbranding=1`}
              title={content.name}
              allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen"
              allowFullScreen
              className="h-full w-full border-0"
            />
          </div>
          <div className="mt-2.5 flex items-center justify-between gap-3">
            <p className="min-w-0 flex-1 truncate text-sm text-white/85">{content.name}</p>
            <a
              href={youtubeWatchUrl(content.key)}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 text-xs text-white/60 underline-offset-2 hover:underline"
            >
              Apri su YouTube ↗
            </a>
          </div>
        </div>
      ) : (
        <div className="relative z-10 flex max-h-full flex-col items-center gap-2.5">
          <img
            src={content.url}
            alt={`${content.label} di ${title}`}
            className="max-h-[80vh] w-auto max-w-full rounded-md object-contain shadow-[var(--shadow-lg)]"
          />
          <a
            href={content.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-white/60 underline-offset-2 hover:underline"
          >
            Apri l'immagine intera ↗
          </a>
        </div>
      )}
    </div>
  );
}

export function MediaGallery({
  title,
  videos,
  posters,
  backdrops,
}: {
  title: string;
  videos: TmdbVideo[];
  posters: string[];
  backdrops: string[];
}) {
  const tabs = (
    [
      { id: "video", label: "Video", count: videos.length },
      { id: "poster", label: "Poster", count: posters.length },
      { id: "sfondi", label: "Sfondi", count: backdrops.length },
    ] satisfies { id: Tab; label: string; count: number }[]
  ).filter((t) => t.count > 0);

  const [tab, setTab] = useState<Tab>(tabs[0]?.id ?? "video");
  const [open, setOpen] = useState<
    { kind: "video"; key: string; name: string } | { kind: "image"; url: string; label: string } | null
  >(null);

  if (tabs.length === 0) return null;
  const active = tabs.some((t) => t.id === tab) ? tab : tabs[0].id;

  return (
    <section className="mt-5">
      <h3 className="font-display text-lg font-semibold text-text">Media</h3>

      <div className="mt-2.5 flex gap-1.5" role="tablist" aria-label="Materiale del titolo">
        {tabs.map((t) => {
          const on = t.id === active;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setTab(t.id)}
              className="rounded-full px-4 py-1.5 text-sm font-medium transition-colors"
              style={
                on
                  ? { background: "var(--accent)", color: "var(--accent-contrast)" }
                  : { color: "var(--text-muted)", background: "var(--surface-2)" }
              }
            >
              {t.label} <span className="font-mono tabular text-[11px] opacity-70">{t.count}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-3">
        {active === "video" && (
          <div className="flex gap-3 overflow-x-auto pb-1">
            {videos.map((v) => (
              <button
                key={v.key}
                type="button"
                onClick={() => setOpen({ kind: "video", key: v.key, name: v.name })}
                aria-label={`Guarda ${v.name}`}
                className="w-52 shrink-0 text-left sm:w-60"
              >
                <span className="relative block aspect-video overflow-hidden rounded-sm bg-surface-2">
                  <img src={youtubeThumb(v.key)} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                  <span className="absolute inset-0 flex items-center justify-center bg-black/25 text-white transition-colors hover:bg-black/10">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-white/85 bg-black/45">
                      <PlayIcon size={16} />
                    </span>
                  </span>
                </span>
                <span className="mt-1.5 block line-clamp-2 text-xs font-medium leading-snug text-text">{v.name}</span>
                <span className="mt-0.5 block text-[11px] text-text-faint">
                  {v.kind}
                  {v.language === "it" && " · in italiano"}
                </span>
              </button>
            ))}
          </div>
        )}

        {active === "poster" && (
          <div className="flex gap-2.5 overflow-x-auto pb-1">
            {posters.map((path) => (
              <button
                key={path}
                type="button"
                onClick={() => setOpen({ kind: "image", url: posterUrl(path, "w780") ?? "", label: "Locandina" })}
                aria-label={`Ingrandisci una locandina di ${title}`}
                className="w-24 shrink-0 overflow-hidden rounded-sm bg-surface-2 sm:w-28"
              >
                <img
                  src={posterUrl(path, "w185") ?? undefined}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="aspect-[2/3] w-full object-cover"
                />
              </button>
            ))}
          </div>
        )}

        {active === "sfondi" && (
          <div className="flex gap-2.5 overflow-x-auto pb-1">
            {backdrops.map((path) => (
              <button
                key={path}
                type="button"
                onClick={() => setOpen({ kind: "image", url: backdropUrl(path, "w1280") ?? "", label: "Sfondo" })}
                aria-label={`Ingrandisci uno sfondo di ${title}`}
                className="w-52 shrink-0 overflow-hidden rounded-sm bg-surface-2 sm:w-64"
              >
                <img
                  src={backdropUrl(path, "w780") ?? undefined}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="aspect-video w-full object-cover"
                />
              </button>
            ))}
          </div>
        )}
      </div>

      {open && <Lightbox content={open} title={title} onClose={() => setOpen(null)} />}
    </section>
  );
}
