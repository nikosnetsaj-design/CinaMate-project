import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useLibrary } from "../store/useLibrary";
import { useSelectedItem } from "../store/useSelectedItem";
import { useWatchProgress } from "../store/useWatchProgress";
import { useVisibleItems } from "../lib/useVisibleItems";
import { continueWatching, lastSeenDates, type ResumeEntry } from "../lib/continueWatching";
import type { PosterBadge } from "../lib/homeBadges";
import { formatRuntime } from "../lib/format";
import { backdropUrl } from "../lib/tmdb";
import { PosterArt } from "./PosterArt";
import { DotsIcon, InfoIcon, PlayIcon } from "./icons";

const MAX_SHOWN = 12;

/** "3 min", "1h 12min", or the honest nothing when the runtime is unknown. */
function remainingText(entry: ResumeEntry): string | null {
  if (!entry.remainingMin) return null;
  if (entry.hasPlayhead) return `restano ${formatRuntime(entry.remainingMin)}`;
  const left = entry.item.episodes ? (entry.item.episodes - (entry.item.seen || 0)) : 0;
  if (left > 0) return `${left} episod${left === 1 ? "io" : "i"} · ${formatRuntime(entry.remainingMin)}`;
  return formatRuntime(entry.remainingMin);
}

/**
 * La scheda di ripresa: larga come una scena, non alta come una locandina.
 *
 * Erano copertine verticali, la stessa forma di ogni altra riga della Home. Ma
 * questa riga risponde a una domanda diversa — «dove ero rimasto» — e la
 * risposta è il fotogramma della scena, il punto in cui sei e quanto manca alla
 * fine: tre cose che in una locandina non ci stanno e che in un sedici a nove
 * si leggono tutte insieme, senza toccare niente.
 */
export function ContinueWatchingCard({ entry, badge }: { entry: ResumeEntry; badge?: PosterBadge }) {
  const navigate = useNavigate();
  const openItem = useSelectedItem((s) => s.open);
  const forget = useWatchProgress((s) => s.forget);
  const setStatus = useLibrary((s) => s.setStatus);
  const [menuOpen, setMenuOpen] = useState(false);
  const { item, pct } = entry;
  const left = remainingText(entry);
  // L'immagine larga quando c'è; la locandina riempita quando manca, che
  // ritagliata al centro resta comunque riconoscibile.
  const wide = backdropUrl(item.backdropPath, "w780");

  return (
    <div className="group relative w-64 shrink-0 sm:w-72">
      <button
        type="button"
        onClick={() => navigate(`/player?titolo=${encodeURIComponent(item.id)}`)}
        aria-label={
          entry.hasPlayhead
            ? `Riprendi ${item.title} da ${Math.floor(entry.positionSec / 60)} minuti`
            : `Guarda ${item.title}`
        }
        className="block w-full text-left"
      >
        <div className="relative aspect-video w-full overflow-hidden rounded-md bg-surface-2">
          {wide ? (
            <img src={wide} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
          ) : (
            <PosterArt item={item} size="sm" showTitle={false} className="h-full w-full [&>*]:h-full" />
          )}

          {/* La sfumatura tiene leggibile il testo su qualunque fotogramma:
              un'immagine chiara sotto un titolo bianco è un titolo che sparisce. */}
          <span
            aria-hidden="true"
            className="absolute inset-x-0 bottom-0 h-3/5"
            style={{ background: "linear-gradient(to top, rgba(0,0,0,0.88), rgba(0,0,0,0.35) 45%, transparent)" }}
          />

          {/* Il play si vede sempre, non solo al passaggio del mouse: questa
              riga esiste per essere toccata, e un telefono il puntatore non
              ce l'ha. */}
          <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-white/85 bg-black/45 text-white shadow-[var(--shadow-md)] backdrop-blur-[1px] transition-transform group-hover:scale-105">
              <PlayIcon size={20} />
            </span>
          </span>

          {/* Dove sei nella serie, sul fotogramma: "S2 · E4" per una serie,
              l'anno per un film — e la pastiglia della copertina se ce n'è una
              ("Nuova stagione"), che qui vale più del titolo. */}
          <span className="absolute left-2.5 top-2.5 flex flex-wrap items-center gap-1.5">
            <span className="rounded-xs bg-black/65 px-1.5 py-0.5 font-mono tabular text-[10px] font-semibold text-white backdrop-blur-sm">
              {entry.label}
            </span>
            {/* «Da iniziare» invece di una barra dell'avanzamento a zero: una
                puntata mai aperta e una lasciata al primo minuto sono due cose
                diverse, e un trattino di colore largo due pixel non le
                distingue. */}
            {pct <= 0 && (
              <span
                className="rounded-xs px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em]"
                style={{ background: "color-mix(in srgb, var(--accent) 22%, rgba(0,0,0,0.65))", color: "var(--accent-text)" }}
              >
                Da iniziare
              </span>
            )}
            {badge && (
              <span
                className="rounded-xs px-1.5 py-0.5 text-[10px] font-semibold"
                style={{ background: "var(--accent)", color: "var(--accent-contrast)" }}
              >
                {badge.label}
                {badge.detail ? ` · ${badge.detail}` : ""}
              </span>
            )}
          </span>

          <span className="absolute inset-x-3 bottom-3">
            <span className="block truncate text-sm font-semibold text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]">
              {item.title}
            </span>
            {left && (
              <span className="mt-0.5 block truncate text-[11px] font-medium text-white/80">{left}</span>
            )}
          </span>

          {/* L'avanzamento è appoggiato al bordo inferiore, come sul lettore:
              è la stessa informazione e conviene che abbia la stessa forma. */}
          <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-[3px] bg-white/25">
            <span
              className="block h-full"
              style={{ width: `${Math.max(pct, 2)}%`, background: "var(--accent)" }}
            />
          </span>
        </div>
      </button>

      {/* Scheda e altre azioni sull'immagine, in alto a destra: due bersagli
          tondi che non rubano larghezza al fotogramma. */}
      <div className="absolute right-2 top-2 flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => openItem(item)}
          aria-label={`Scheda di ${item.title}`}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm transition-colors hover:bg-black/75"
        >
          <InfoIcon size={16} />
        </button>
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label={`Altre azioni per ${item.title}`}
          aria-expanded={menuOpen}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm transition-colors hover:bg-black/75"
        >
          <DotsIcon size={16} />
        </button>
      </div>

      {menuOpen && (
        <>
          {/* Chiude toccando altrove, come ogni menu dell'app. */}
          <button
            type="button"
            aria-label="Chiudi il menu"
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setMenuOpen(false)}
          />
          <div className="absolute right-2 top-11 z-50 w-56 overflow-hidden rounded-sm border border-border-strong bg-surface shadow-[var(--shadow-md)]">
            <button
              type="button"
              onClick={() => {
                setStatus(item.id, "Visto");
                setMenuOpen(false);
              }}
              className="block w-full px-3 py-2.5 text-left text-xs text-text-muted hover:bg-surface-hover hover:text-text"
            >
              Segna come visto
            </button>
            {entry.hasPlayhead && (
              <button
                type="button"
                onClick={() => {
                  forget(item.id);
                  setMenuOpen(false);
                }}
                className="block w-full border-t border-border px-3 py-2.5 text-left text-xs text-text-muted hover:bg-surface-hover hover:text-text"
              >
                Togli da Continua a guardare
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * "Continua a guardare": what you left half-watched, most recent first, one tap
 * from the exact second you stopped.
 *
 * Distinct from *Riprendi*, which lists series by episode counter — this one is
 * driven by the playhead, so it also holds films, and it knows the minute.
 */
export function ContinueWatchingRow({ badges }: { badges?: Record<string, PosterBadge> }) {
  const items = useVisibleItems();
  const history = useLibrary((s) => s.history);
  const progress = useWatchProgress((s) => s.progress);

  const entries = useMemo(
    () => continueWatching(items, progress, lastSeenDates(history)).slice(0, MAX_SHOWN),
    [items, progress, history],
  );

  if (entries.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="section-mark font-display text-xl font-semibold text-text">
            Continua a guardare <span className="text-sm font-normal text-text-faint">· {entries.length}</span>
          </h2>
          <p className="mt-0.5 text-xs text-text-faint">Riparte dal punto esatto in cui hai smesso</p>
        </div>
        <Link to="/profilo" className="shrink-0 text-sm font-medium text-accent-text">
          profilo
        </Link>
      </div>

      <div className="flex gap-3.5 overflow-x-auto pb-1">
        {entries.map((entry) => (
          <ContinueWatchingCard key={entry.item.id} entry={entry} badge={badges?.[entry.item.id]} />
        ))}
      </div>
    </section>
  );
}
