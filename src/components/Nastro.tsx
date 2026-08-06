import { useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useLibrary } from "../store/useLibrary";
import { voteColor } from "../lib/vote";
import type { HistoryEntry, Item } from "../types";

interface Stripe {
  key: string;
  minutes: number;
  color: string;
  label: string;
}

function minutesFor(entry: HistoryEntry, item: Item): number {
  if (entry.action === "episode") return item.runtime * (entry.count ?? 1);
  if (item.kind === "film" || item.kind === "doc") return item.runtime;
  return 0;
}

function buildStripes(history: HistoryEntry[], items: Item[], since: string | null, until?: string): Stripe[] {
  const byId = new Map(items.map((i) => [i.id, i]));
  return history
    .filter((h) => (since ? h.date >= since : true))
    .filter((h) => (until ? h.date <= until : true))
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((h) => {
      const item = byId.get(h.itemId);
      if (!item) return null;
      const minutes = minutesFor(h, item);
      if (minutes <= 0) return null;
      return {
        key: h.id,
        minutes,
        color: item.vote != null ? voteColor(item.vote) : "var(--text-faint)",
        label: `${item.title}, ${h.date}`,
      };
    })
    .filter((s): s is Stripe => s !== null);
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

/**
 * "Il Nastro" — the signature. Every viewing session becomes one vertical
 * thread: hue from the vote (cold blue = left me cold, hot magenta =
 * obsession), width from the minutes actually watched. Woven together they
 * make a textile of a stretch of your life — a picture no two people share.
 */
export function Nastro({
  days = 30,
  from,
  to,
  height = 56,
  caption,
}: {
  days?: number;
  /**
   * Data ISO da cui partire, quando la finestra è un periodo con un nome —
   * "il 2026" — e non "gli ultimi N giorni".
   *
   * Esiste perché la didascalia e i dati devono dire la stessa cosa: la pagina
   * Dati scriveva «un filo per ogni sessione del 2026» sopra un nastro lungo
   * trecentosessantacinque giorni, che a febbraio è per tre quarti il 2025.
   */
  from?: string;
  /** Data ISO finale, inclusa. Serve a chiudere un anno passato invece di tirarlo fino a oggi. */
  to?: string;
  height?: number;
  caption?: string;
}) {
  const history = useLibrary((s) => s.history);
  const items = useLibrary((s) => s.items);
  const reduceMotion = useReducedMotion();
  const since = useMemo(() => from ?? daysAgo(days), [from, days]);

  // An empty band is a bad first impression when the only history is older
  // than the window, so fall back to the most recent sessions and say so
  // rather than showing nothing.
  const { stripes, fellBack } = useMemo(() => {
    const inWindow = buildStripes(history, items, since, to);
    if (inWindow.length > 0) return { stripes: inWindow, fellBack: false };
    const all = buildStripes(history, items, null);
    return { stripes: all.slice(-60), fellBack: all.length > 0 };
  }, [history, items, since, to]);

  const totalMinutes = stripes.reduce((a, s) => a + s.minutes, 0);
  const hours = Math.round(totalMinutes / 60);

  if (stripes.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        <div
          className="w-full rounded-sm border border-dashed border-border-strong"
          style={{ height }}
          aria-hidden="true"
        />
        <p className="text-xs text-text-faint">
          Il nastro si tesse da solo: segna un titolo come visto e comparirà il primo filo.
        </p>
      </div>
    );
  }

  return (
    <figure className="m-0 flex flex-col gap-2">
      {/* The one curated motion in the app: the ribbon unspools left to right,
          like film coming off a reel. It explains what the band is by showing
          it being made. Skipped entirely when reduced motion is requested. */}
      <motion.div
        role="img"
        aria-label={`Nastro: ${stripes.length} sessioni, ${hours} ore guardate.`}
        className="relative flex w-full overflow-hidden rounded-sm"
        style={{ height, transformOrigin: "left center" }}
        initial={reduceMotion ? false : { scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
      >
        {stripes.map((s) => (
          <div
            key={s.key}
            title={s.label}
            className="h-full"
            style={{ flexGrow: s.minutes, flexBasis: 0, minWidth: 2, background: s.color }}
          />
        ))}
        {/* Velvet sheen: the band reads as fabric rather than as a chart bar. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "linear-gradient(to bottom, rgba(255,255,255,0.16), transparent 42%, rgba(0,0,0,0.28))",
          }}
        />
      </motion.div>
      <figcaption className="flex items-baseline justify-between gap-3 text-xs text-text-faint">
        <span>{fellBack ? "Le tue ultime sessioni" : (caption ?? `Ultimi ${days} giorni`)}</span>
        <span className="font-mono tabular">
          {stripes.length} sessioni · {hours}h
        </span>
      </figcaption>
    </figure>
  );
}
