import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLibrary } from "../store/useLibrary";
import { useSelectedItem } from "../store/useSelectedItem";
import { useWatchProgress } from "../store/useWatchProgress";
import { useVisibleItems } from "../lib/useVisibleItems";
import { continueWatching, lastSeenDates, type ResumeEntry } from "../lib/continueWatching";
import type { PosterBadge } from "../lib/homeBadges";
import { formatRuntime } from "../lib/format";
import { backdropUrl } from "../lib/tmdb";
import { PosterArt } from "./PosterArt";
import { RowHeader } from "./RowHeader";
import { DotsIcon, InfoIcon, PlayIcon } from "./icons";
import { t } from "../lib/i18n";

const MAX_SHOWN = 12;

/** "3 min", "1h 12min", or the honest nothing when the runtime is unknown. */
function remainingText(entry: ResumeEntry): string | null {
  if (!entry.remainingMin) return null;
  if (entry.hasPlayhead) return t("ContinueWatchingRow.restano", { v0: formatRuntime(entry.remainingMin) });
  const left = entry.item.episodes ? (entry.item.episodes - (entry.item.seen || 0)) : 0;
  if (left > 0) return t(left === 1 ? "ContinueWatchingRow.episodio" : "ContinueWatchingRow.episodi", { v0: left, v1: formatRuntime(entry.remainingMin) });
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
    <div className="group relative w-64 sm:w-72">
      <button
        type="button"
        onClick={() => navigate(`/player?titolo=${encodeURIComponent(item.id)}`)}
        aria-label={
          entry.hasPlayhead
            ? t("ContinueWatchingRow.riprendi_da_minuti", { v0: item.title, v1: Math.floor(entry.positionSec / 60) })
            : t("ContinueWatchingRow.guarda", { v0: item.title })
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
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-md transition-transform duration-200 group-hover:scale-105 group-active:scale-95">
              <PlayIcon size={22} />
            </span>
          </span>

          {/* Dove sei nella serie, sul fotogramma: "S2 · E4" per una serie,
              l'anno per un film — e la pastiglia della copertina se ce n'è una
              ("Nuova stagione"), che qui vale più del titolo. */}
          <span className="absolute left-2.5 top-2.5 flex flex-wrap items-center gap-1.5">
            <span className="rounded-xs bg-black/65 px-1.5 py-0.5 tabular text-xs font-semibold text-white backdrop-blur-sm">
              {entry.label}
            </span>
            {/* «Da iniziare» invece di una barra dell'avanzamento a zero: una
                puntata mai aperta e una lasciata al primo minuto sono due cose
                diverse, e un trattino di colore largo due pixel non le
                distingue. */}
            {pct <= 0 && (
              <span
                className="rounded-xs bg-black/65 px-1.5 py-0.5 text-xs font-semibold text-white backdrop-blur-sm"
              >
                {t("ContinueWatchingRow.da_iniziare")}
              </span>
            )}
            {badge && (
              <span
                className="rounded-xs bg-black/65 px-1.5 py-0.5 text-xs font-semibold text-white backdrop-blur-sm"
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
              <span className="mt-0.5 block truncate text-xs font-medium tabular text-white/80">{left}</span>
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
          aria-label={t("ContinueWatchingRow.scheda_di", { v0: item.title })}
          className="icon-btn icon-btn-sm bg-black/45 text-white backdrop-blur-md hover:bg-black/65 hover:text-white"
        >
          <InfoIcon size={16} />
        </button>
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label={t("ContinueWatchingRow.altre_azioni_per", { v0: item.title })}
          aria-expanded={menuOpen}
          className="icon-btn icon-btn-sm bg-black/45 text-white backdrop-blur-md hover:bg-black/65 hover:text-white"
        >
          <DotsIcon size={16} />
        </button>
      </div>

      {menuOpen && (
        <>
          {/* Chiude toccando altrove, come ogni menu dell'app. */}
          <button
            type="button"
            aria-label={t("ContinueWatchingRow.chiudi_il_menu")}
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setMenuOpen(false)}
          />
          <div className="absolute right-2 top-11 z-50 w-60 overflow-hidden rounded-md bg-surface shadow-[var(--shadow-md),0_0_0_1px_var(--separator)]">
            <button
              type="button"
              onClick={() => {
                setStatus(item.id, "Visto");
                setMenuOpen(false);
              }}
              className="list-row min-h-11 py-2 text-sm text-text"
            >
              {t("ContinueWatchingRow.segna_come_visto")}
            </button>
            {entry.hasPlayhead && (
              <button
                type="button"
                onClick={() => {
                  forget(item.id);
                  setMenuOpen(false);
                }}
                className="list-row min-h-11 py-2 text-sm text-text"
              >
                {t("ContinueWatchingRow.togli_da_continua_a")}
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
    <section className="flex flex-col gap-4">
      <RowHeader
        title={t("ContinueWatchingRow.continua_a_guardare")}
        count={entries.length}
        note={t("ContinueWatchingRow.riparte_dal_punto_esatto")}
        to="/tu"
      />

      <div className="shelf">
        {entries.map((entry) => (
          <ContinueWatchingCard key={entry.item.id} entry={entry} badge={badges?.[entry.item.id]} />
        ))}
      </div>
    </section>
  );
}
