import { useEffect, useRef, useState } from "react";
import { Sheet } from "./Sheet";
import { useLibrary } from "../store/useLibrary";
import { canvasToBlob, CARD_SIZE, drawYearCard, loadPoster, readTheme, type CardFormat } from "../lib/yearCard";
import type { YearInReview } from "../lib/stats";
import { downloadFile } from "../lib/format";
import { DownloadIcon, ShareIcon } from "./icons";

const FORMATS: { id: CardFormat; label: string }[] = [
  { id: "story", label: "Storia 9:16" },
  { id: "square", label: "Post 1:1" },
];

/**
 * L'anno come immagine: si sceglie il formato, si vede l'anteprima, si
 * condivide (dove il telefono lo permette, con il foglio di sistema) o si
 * scarica il PNG. L'immagine non dice niente che non sia già nell'anno in
 * rassegna, e niente parte da qui senza che tu lo mandi.
 */
export default function YearShareSheet({ review, onClose }: { review: YearInReview; onClose: () => void }) {
  const pushToast = useLibrary((s) => s.pushToast);
  const [format, setFormat] = useState<CardFormat>("story");
  const [posters, setPosters] = useState<(HTMLImageElement | null)[] | null>(null);
  const [busy, setBusy] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const titleId = "year-share-title";

  useEffect(() => {
    let cancelled = false;
    void Promise.all(review.top.map((i) => loadPoster(i.posterPath))).then((imgs) => {
      if (!cancelled) setPosters(imgs);
    });
    return () => {
      cancelled = true;
    };
  }, [review]);

  useEffect(() => {
    if (!posters || !canvas.current) return;
    let cancelled = false;
    // I caratteri dell'app devono essere pronti, o il canvas scrive col
    // carattere di ripiego.
    void document.fonts.ready.then(() => {
      if (!cancelled && canvas.current) drawYearCard(canvas.current, format, { review, posters }, readTheme());
    });
    return () => {
      cancelled = true;
    };
  }, [posters, format, review]);

  const fileName = `cinemate-${review.year}-${format === "story" ? "storia" : "post"}.png`;

  async function file(): Promise<File | null> {
    if (!canvas.current) return null;
    const blob = await canvasToBlob(canvas.current);
    return blob ? new File([blob], fileName, { type: "image/png" }) : null;
  }

  async function share() {
    setBusy(true);
    try {
      const f = await file();
      if (!f) throw new Error("vuoto");
      if (navigator.canShare?.({ files: [f] })) {
        await navigator.share({ files: [f], title: `Il mio ${review.year} con CineMate` });
      } else {
        downloadFile(f, fileName);
      }
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) pushToast("error", "Non sono riuscito a preparare l'immagine.");
    } finally {
      setBusy(false);
    }
  }


  async function save() {
    const f = await file();
    if (f) downloadFile(f, fileName);
    else pushToast("error", "Non sono riuscito a preparare l'immagine.");
  }

  const size = CARD_SIZE[format];

  return (
    <Sheet onClose={onClose} titleId={titleId} maxWidthClass="max-w-md">
      <div className="flex flex-col gap-4 p-5 pt-8 sm:p-6">
        <h2 id={titleId} className="t-title text-text">
          Il tuo {review.year} come immagine
        </h2>
        <div className="segmented segmented-full" role="radiogroup" aria-label="Formato">
          {FORMATS.map((f) => (
            <button key={f.id} type="button" role="radio" aria-checked={format === f.id} onClick={() => setFormat(f.id)}>
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex justify-center rounded-md bg-surface-2 p-3">
          {posters === null && <div className="skeleton rounded-sm" style={{ aspectRatio: `${size.w} / ${size.h}`, height: "min(52dvh, 420px)" }} aria-hidden="true" />}
          <canvas
            ref={canvas}
            role="img"
            aria-label={`Anteprima: ${review.watchedCount} titoli completati nel ${review.year}, ${review.hours} ore`}
            className={`h-auto max-w-full rounded-sm shadow-[var(--shadow-md)] ${posters === null ? "hidden" : ""}`}
            style={{ aspectRatio: `${size.w} / ${size.h}`, maxHeight: "min(52dvh, 420px)" }}
          />
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn btn-primary flex-1" disabled={busy || posters === null} onClick={() => void share()}>
            <ShareIcon size={16} />
            Condividi
          </button>
          <button type="button" className="btn btn-secondary flex-1" disabled={posters === null} onClick={() => void save()}>
            <DownloadIcon size={16} />
            Scarica
          </button>
        </div>
      </div>
    </Sheet>
  );
}
