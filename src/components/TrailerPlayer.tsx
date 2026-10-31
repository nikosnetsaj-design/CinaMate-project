import { useEffect, useRef, useState } from "react";
import { CloseIcon, ExternalIcon, PictureInPictureIcon } from "./icons";
import { youtubeWatchUrl } from "../lib/tmdb";
import { useFocusTrap } from "../lib/useFocusTrap";

const ORIGIN = "https://www.youtube-nocookie.com";

interface DocumentPip {
  requestWindow: (options: { width: number; height: number }) => Promise<Window>;
}

function documentPip(): DocumentPip | null {
  return (window as unknown as { documentPictureInPicture?: DocumentPip }).documentPictureInPicture ?? null;
}

/**
 * Il trailer, dentro l'app.
 *
 * `youtube-nocookie`: stesso video, nessun cookie di profilazione finché non si
 * preme play. Il punto in cui sei arriva dal lettore stesso, con il protocollo
 * di messaggi che YouTube espone agli incorporati (`enablejsapi=1`): serve a
 * una cosa sola, ripartire dallo stesso secondo nell'immagine nell'immagine.
 *
 * **Immagine nell'immagine.** Un video di YouTube vive in un riquadro di un
 * altro dominio, e il PiP del browser funziona solo sui `<video>` della pagina.
 * Dove c'è la Document Picture-in-Picture API (Chrome e Edge sul computer) si
 * apre una finestrella che resta sopra tutte le altre e il trailer riparte lì,
 * dal secondo in cui eri; dove non c'è, il pulsante non compare, invece di
 * comparire e non fare niente.
 */
export function TrailerPlayer({ videoKey, title, onClose }: { videoKey: string; title: string; onClose: () => void }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const time = useRef(0);
  const [pipError, setPipError] = useState(false);
  const pip = documentPip();

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.origin !== ORIGIN || typeof e.data !== "string") return;
      try {
        const data = JSON.parse(e.data) as { event?: string; info?: { currentTime?: number } };
        if (data.event === "infoDelivery" && typeof data.info?.currentTime === "number") time.current = data.info.currentTime;
      } catch {
        // non è uno dei messaggi che ci interessano
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  // Il fuoco resta nel pannello; Esc chiude lui solo, non la scheda sotto
  // (useFocusTrap passa i tasti solo al foglio in cima).
  const trapRef = useFocusTrap(onClose);

  function listen() {
    // Chiede al lettore di mandare i suoi aggiornamenti, fra cui la posizione.
    frame.current?.contentWindow?.postMessage(JSON.stringify({ event: "listening", id: 1, channel: "widget" }), ORIGIN);
  }

  async function openPip() {
    if (!pip) return;
    try {
      const win = await pip.requestWindow({ width: 480, height: 270 });
      win.document.title = title;
      win.document.body.style.cssText = "margin:0;background:#000;overflow:hidden";
      const player = win.document.createElement("iframe");
      player.src = `${ORIGIN}/embed/${videoKey}?autoplay=1&rel=0&playsinline=1&start=${Math.floor(time.current)}`;
      player.title = title;
      player.allow = "autoplay; encrypted-media; fullscreen";
      player.style.cssText = "border:0;width:100vw;height:100vh;display:block";
      win.document.body.append(player);
      onClose();
    } catch {
      setPipError(true);
    }
  }

  const src = `${ORIGIN}/embed/${videoKey}?autoplay=1&rel=0&modestbranding=1&playsinline=1&enablejsapi=1&origin=${encodeURIComponent(
    window.location.origin,
  )}`;

  return (
    <div ref={trapRef} className="fixed inset-0 z-80 flex items-center justify-center bg-black/92 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={`Trailer di ${title}`}>
      <button type="button" aria-label="Chiudi il trailer" tabIndex={-1} className="absolute inset-0 cursor-default" onClick={onClose} />

      <button
        type="button"
        onClick={onClose}
        aria-label="Chiudi il trailer"
        className="icon-btn icon-btn-media absolute right-4 top-4 z-10"
        style={{ top: "max(1rem, env(safe-area-inset-top))" }}
      >
        <CloseIcon size={18} />
      </button>

      <div className="relative z-10 w-full max-w-4xl">
        <div className="aspect-video w-full overflow-hidden rounded-md bg-black shadow-[var(--shadow-lg)]">
          <iframe
            ref={frame}
            src={src}
            onLoad={listen}
            title={title}
            allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
            className="h-full w-full border-0"
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <p className="min-w-0 flex-1 truncate text-sm text-white/85">{title}</p>
          <span className="flex items-center gap-1">
            {pip && (
              <button type="button" onClick={() => void openPip()} className="btn btn-sm text-white/85 hover:bg-white/10">
                <PictureInPictureIcon size={16} />
                Immagine nell'immagine
              </button>
            )}
            <a
              href={youtubeWatchUrl(videoKey)}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-sm text-white/85 hover:bg-white/10"
            >
              YouTube
              <ExternalIcon size={14} />
            </a>
          </span>
        </div>
        {pipError && <p className="mt-2 text-sm text-white/70">Il browser non ha aperto la finestra: riprova dal pulsante.</p>}
      </div>
    </div>
  );
}
