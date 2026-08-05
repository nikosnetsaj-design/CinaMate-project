import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useLibrary } from "../store/useLibrary";
import { useSelectedItem } from "../store/useSelectedItem";
import { useWatchProgress } from "../store/useWatchProgress";
import { useVisibleItems } from "../lib/useVisibleItems";
import { continueWatching, lastSeenDates, type ResumeEntry } from "../lib/continueWatching";
import type { PosterBadge } from "../lib/homeBadges";
import { formatRuntime } from "../lib/format";
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

export function ContinueWatchingCard({ entry, badge }: { entry: ResumeEntry; badge?: PosterBadge }) {
  const navigate = useNavigate();
  const openItem = useSelectedItem((s) => s.open);
  const forget = useWatchProgress((s) => s.forget);
  const setStatus = useLibrary((s) => s.setStatus);
  const [menuOpen, setMenuOpen] = useState(false);
  const { item, pct } = entry;
  const left = remainingText(entry);
  // Quanto alzare avanzamento e sfumatura: una riga di pastiglia, due, o niente.
  const lift = badge
    ? badge.detail
      ? { bar: "bottom-12", scrim: "bottom-11" }
      : { bar: "bottom-8", scrim: "bottom-7" }
    : { bar: "bottom-2", scrim: "bottom-0" };

  return (
    <div className="group relative w-40 shrink-0 sm:w-44">
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
        <div className="relative overflow-hidden rounded-t-sm">
          <PosterArt item={item} size="sm" className="w-full" badge={badge} />

          {/* Il play sta sulla copertina e si vede sempre, non solo al passaggio
              del mouse: questa riga esiste per essere toccata, e un telefono il
              passaggio del mouse non ce l'ha. */}
          <span
            aria-hidden="true"
            className="absolute inset-0 flex items-center justify-center transition-colors group-hover:bg-black/20"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-white/85 bg-black/45 text-white shadow-[var(--shadow-md)] backdrop-blur-[1px]">
              <PlayIcon size={20} />
            </span>
          </span>

          {/* L'avanzamento è disegnato sulla copertina e non sotto: così tutta
              la riga si legge in una passata sola, "a che punto sono".
              Quando c'è una pastiglia sale sopra di essa invece di finirci
              addosso — la pastiglia occupa il fondo, una riga o due. */}
          <span
            aria-hidden="true"
            className={`absolute inset-x-0 h-9 bg-gradient-to-t from-black/80 to-transparent ${lift.scrim}`}
          />
          <span className={`absolute inset-x-2 flex items-center gap-1.5 ${lift.bar}`}>
            <span className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/25">
              <span
                className="block h-full rounded-full"
                style={{ width: `${Math.max(pct, 2)}%`, background: "var(--accent)" }}
              />
            </span>
            <span className="font-mono tabular text-[10px] font-semibold text-white/90">{pct}%</span>
          </span>
        </div>
      </button>

      {/* La striscia sotto la copertina: la scheda a sinistra, tutto il resto
          dietro i tre puntini. Due bersagli grandi al posto di due parole
          minuscole, e la copertina resta un unico bersaglio: riprendere. */}
      <div className="flex items-stretch rounded-b-sm bg-surface-2">
        <button
          type="button"
          onClick={() => openItem(item)}
          aria-label={`Scheda di ${item.title}`}
          className="flex flex-1 items-center justify-center py-2 text-text-muted transition-colors hover:text-text"
        >
          <InfoIcon size={17} />
        </button>
        <span aria-hidden="true" className="my-1.5 w-px bg-border" />
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label={`Altre azioni per ${item.title}`}
          aria-expanded={menuOpen}
          className="flex flex-1 items-center justify-center py-2 text-text-muted transition-colors hover:text-text"
        >
          <DotsIcon size={17} />
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
          {/* Sopra la copertina e non sotto la striscia: la riga scorre in
              orizzontale, e un contenitore che scorre ritaglia tutto quello che
              esce dai suoi bordi — menu compreso. */}
          <div className="absolute inset-x-2 bottom-16 z-50 overflow-hidden rounded-sm border border-border-strong bg-surface shadow-[var(--shadow-md)]">
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

      <p className="mt-1.5 line-clamp-1 text-xs font-semibold text-text">{item.title}</p>
      <p className="line-clamp-1 text-[11px] text-text-faint">
        {entry.label}
        {left ? ` · ${left}` : ""}
      </p>
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
          <h2 className="font-display text-xl font-semibold text-text">
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
