import { useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useLibrary } from "../store/useLibrary";
import { useWatchProgress } from "../store/useWatchProgress";
import { useVisibleItems } from "../lib/useVisibleItems";
import { continueWatching, lastSeenDates } from "../lib/continueWatching";
import { prefetchHandlers } from "../lib/prefetch";
import { PosterArt } from "./PosterArt";
import { PlayIcon } from "./icons";

/**
 * La riga che dice cosa hai lasciato a metà, e da cui ci si rientra.
 *
 * Ha preso il posto della voce «Player» nella barra di navigazione, e non è
 * un pareggio: la voce era un indirizzo — si toccava e si arrivava su una
 * pagina che, senza un titolo scelto, non sapeva cosa fare — mentre questa è
 * *lo stato*. Compare quando c'è qualcosa in sospeso e sparisce quando non
 * c'è, che è la differenza fra una destinazione e un lettore.
 *
 * Il commento in `Nav.tsx` diceva che il Player non si poteva togliere dalla
 * barra perché sul telefono nient'altro ci portava, e la pagina diventava
 * irraggiungibile. Vero allora: adesso questa riga è quel collegamento, ed è
 * migliore perché arriva con il titolo già in mano invece di far ricominciare
 * la scelta da capo.
 *
 * Sta sopra la barra di navigazione e sotto i fogli, e sul lettore non si
 * mostra: lì è la pagina stessa.
 */
export function MiniPlayerBar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const items = useVisibleItems();
  const history = useLibrary((s) => s.history);
  const progress = useWatchProgress((s) => s.progress);

  const entry = useMemo(() => {
    const list = continueWatching(items, progress, lastSeenDates(history));
    // Solo ciò che ha un segnaposto vero. Un titolo a metà secondo il contatore
    // degli episodi è una cosa che *stai guardando*, ma non è una cosa che sta
    // suonando: prometterne la ripresa al secondo esatto sarebbe una bugia
    // piccola e verificabile, cioè la peggiore specie.
    return list.find((e) => e.hasPlayhead) ?? null;
  }, [items, progress, history]);

  const visible = !!entry && pathname !== "/player";
  // La pagina sotto deve sapere che la barra c'è, per finire sopra di lei
  // invece di sparirle dietro (vedi `has-miniplayer` in index.css).
  useEffect(() => {
    document.documentElement.classList.toggle("has-miniplayer", visible);
    return () => document.documentElement.classList.remove("has-miniplayer");
  }, [visible]);

  if (!entry || !visible) return null;

  const { item, pct, remainingMin, label } = entry;

  return (
    <div className="fixed inset-x-0 bottom-[calc(var(--tabbar-h)+env(safe-area-inset-bottom))] z-40 px-2 pb-2 lg:bottom-0 lg:left-60 lg:px-4 lg:pb-4">
      <div
        className="mx-auto flex max-w-3xl items-center gap-3 overflow-hidden rounded-md bg-material p-2 backdrop-blur-xl backdrop-saturate-150 lg:max-w-md"
        style={{ boxShadow: "var(--shadow-md), 0 0 0 1px var(--separator)" }}
      >
        <button
          type="button"
          {...prefetchHandlers("/player")}
          onClick={() => navigate(`/player?titolo=${encodeURIComponent(item.id)}`)}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <PosterArt item={item} size="sm" showTitle={false} className="w-9 shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-text">{item.title}</span>
            <span className="block truncate t-caption tabular text-text-muted">
              {label} ·{" "}
              <span className="t-numeral">
                {remainingMin > 0 ? `${remainingMin} min alla fine` : "quasi finito"}
              </span>
            </span>
          </span>
        </button>

        <button
          type="button"
          {...prefetchHandlers("/player")}
          onClick={() => navigate(`/player?titolo=${encodeURIComponent(item.id)}`)}
          aria-label={`Riprendi ${item.title}`}
          className="icon-btn"
          style={{ background: "var(--accent)", color: "var(--accent-contrast)" }}
        >
          <PlayIcon size={17} />
        </button>
      </div>

      {/* Il punto in cui sei, come un capello sul bordo inferiore: l'unica
          informazione che non ha bisogno di una parola per essere letta. */}
      <div
        aria-hidden="true"
        className="mx-auto -mt-1 h-0.5 max-w-3xl overflow-hidden rounded-full lg:max-w-md"
        style={{ background: "var(--border)" }}
      >
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "var(--accent)" }} />
      </div>
    </div>
  );
}
