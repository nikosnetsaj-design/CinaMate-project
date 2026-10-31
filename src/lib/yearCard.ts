import type { YearInReview } from "./stats";
import { posterUrl } from "./tmdb";

/**
 * L'anno in rassegna come immagine da condividere: 9:16 per le storie, 1:1
 * per un post. Disegnata su canvas qui, nel browser — niente server che la
 * generi, niente servizio che la veda passare.
 *
 * Le locandine arrivano da TMDB con `crossOrigin`, così il canvas resta
 * esportabile; quando una non arriva, al suo posto c'è un riquadro con il
 * titolo scritto, come nell'app.
 */

export type CardFormat = "story" | "square";

export const CARD_SIZE: Record<CardFormat, { w: number; h: number }> = {
  story: { w: 1080, h: 1920 },
  square: { w: 1080, h: 1080 },
};

export interface CardTheme {
  bg: string;
  surface: string;
  text: string;
  muted: string;
  accent: string;
  display: string;
  sans: string;
}

/** I colori e i caratteri dell'app, letti dai token del tema scuro attivo. */
export function readTheme(): CardTheme {
  const css = getComputedStyle(document.documentElement);
  const v = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
  return {
    // Sempre su fondo scuro: un'immagine condivisa vive fra le storie degli
    // altri, e il chiaro lì sembra uno schermo bianco.
    bg: "#141210",
    surface: "#1f1c19",
    text: "#f4efe8",
    muted: "#a8a097",
    accent: v("--accent", "#d9764a"),
    display: v("--font-display", "Georgia, serif"),
    sans: v("--font-sans", "system-ui, sans-serif"),
  };
}

export function loadPoster(path: string | null): Promise<HTMLImageElement | null> {
  const url = posterUrl(path, "w342");
  if (!url) return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
    // Una locandina che non risponde non deve tenere ferma l'immagine.
    setTimeout(() => resolve(null), 6000);
  });
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Accorcia un testo con i puntini finché sta nella larghezza. */
export function fit(ctx: CanvasRenderingContext2D, text: string, max: number): string {
  if (ctx.measureText(text).width <= max) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > max) t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
}

function poster(ctx: CanvasRenderingContext2D, theme: CardTheme, img: HTMLImageElement | null, title: string, x: number, y: number, w: number, h: number) {
  ctx.save();
  roundRect(ctx, x, y, w, h, 18);
  ctx.clip();
  if (img) {
    // Riempie il riquadro senza deformare: taglia i bordi in eccesso.
    const scale = Math.max(w / img.width, h / img.height);
    const dw = img.width * scale;
    const dh = img.height * scale;
    ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  } else {
    const g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, theme.surface);
    g.addColorStop(1, "#0c0b0a");
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = theme.text;
    ctx.font = `600 ${Math.round(w / 9)}px ${theme.display}`;
    ctx.textAlign = "center";
    ctx.fillText(fit(ctx, title, w - 28), x + w / 2, y + h / 2);
    ctx.textAlign = "left";
  }
  ctx.restore();
}

export interface CardData {
  review: YearInReview;
  posters: (HTMLImageElement | null)[];
}

export function drawYearCard(canvas: HTMLCanvasElement, format: CardFormat, data: CardData, theme: CardTheme): void {
  const { w, h } = CARD_SIZE[format];
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const { review } = data;
  const pad = 96;

  // Fondo: il buio della sala, con l'accento che sale dal basso come la luce
  // dello schermo.
  ctx.fillStyle = theme.bg;
  ctx.fillRect(0, 0, w, h);
  const glow = ctx.createRadialGradient(w / 2, h * 1.05, 0, w / 2, h * 1.05, h * 0.9);
  glow.addColorStop(0, theme.accent);
  glow.addColorStop(1, theme.bg);
  ctx.fillStyle = glow;
  ctx.globalAlpha = 0.32;
  ctx.fillRect(0, 0, w, h);
  ctx.globalAlpha = 1;

  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = theme.muted;
  ctx.font = `600 30px ${theme.sans}`;
  ctx.fillText("CINEMATE", pad, pad + 20);

  ctx.fillStyle = theme.text;
  const story = format === "story";
  ctx.font = `500 ${story ? 112 : 92}px ${theme.display}`;
  ctx.fillText(`Il mio ${review.year}`, pad, pad + (story ? 150 : 128));

  // La cifra grande.
  const bigY = story ? 560 : 490;
  ctx.fillStyle = theme.accent;
  ctx.font = `600 ${story ? 300 : 230}px ${theme.display}`;
  ctx.fillText(String(review.watchedCount), pad - 8, bigY);
  ctx.fillStyle = theme.text;
  ctx.font = `500 44px ${theme.sans}`;
  ctx.fillText(review.watchedCount === 1 ? "titolo completato" : "titoli completati", pad, bigY + 70);

  // Le altre cifre, in colonna o in riga.
  const facts: [string, string][] = [
    [`${review.hours}`, review.hours === 1 ? "ora" : "ore"],
    [`${review.episodes}`, review.episodes === 1 ? "episodio" : "episodi"],
  ];
  if (review.busiestMonth) facts.push([review.busiestMonth, "il mese più pieno"]);
  const factY = bigY + (story ? 200 : 170);
  const colW = (w - pad * 2) / facts.length;
  facts.forEach(([value, label], i) => {
    const x = pad + i * colW;
    ctx.fillStyle = theme.text;
    ctx.font = `600 ${story ? 84 : 68}px ${theme.display}`;
    ctx.fillText(fit(ctx, value, colW - 24), x, factY);
    ctx.fillStyle = theme.muted;
    ctx.font = `500 30px ${theme.sans}`;
    ctx.fillText(fit(ctx, label, colW - 24), x, factY + 46);
  });

  if (review.topGenre) {
    ctx.fillStyle = theme.muted;
    ctx.font = `500 34px ${theme.sans}`;
    const gy = factY + (story ? 150 : 118);
    ctx.fillText("Il genere dell'anno", pad, gy);
    ctx.fillStyle = theme.text;
    ctx.font = `500 ${story ? 64 : 52}px ${theme.display}`;
    ctx.fillText(fit(ctx, review.topGenre, w - pad * 2), pad, gy + (story ? 76 : 62));
  }

  // I tre titoli dell'anno (solo nella storia: nel quadrato non c'è posto per
  // farli leggere).
  if (story && review.top.length > 0) {
    const gap = 36;
    const pw = (w - pad * 2 - gap * 2) / 3;
    const ph = pw * 1.5;
    const py = h - pad - 140 - ph;
    ctx.fillStyle = theme.muted;
    ctx.font = `500 34px ${theme.sans}`;
    ctx.fillText("I miei tre dell'anno", pad, py - 34);
    review.top.forEach((item, i) => {
      const x = pad + i * (pw + gap);
      poster(ctx, theme, data.posters[i] ?? null, item.title, x, py, pw, ph);
      ctx.fillStyle = theme.text;
      ctx.font = `500 30px ${theme.sans}`;
      ctx.fillText(fit(ctx, item.title, pw), x, py + ph + 44);
    });
  }

  ctx.fillStyle = theme.muted;
  ctx.font = `500 26px ${theme.sans}`;
  ctx.fillText("Fatto con CineMate · i dati restano sul mio telefono", pad, h - pad + 20);
}

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/png"));
}
