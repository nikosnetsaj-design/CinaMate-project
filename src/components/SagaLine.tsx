import { useCallback } from "react";
import { useLibrary } from "../store/useLibrary";
import { useSagas, sagaKey } from "../store/useSagas";
import { useSelectedItem } from "../store/useSelectedItem";
import { buildEntries, orderParts, type SagaEntry } from "../lib/sagas";
import { useAddFromCatalog } from "../lib/useAddFromCatalog";
import { posterUrl } from "../lib/tmdb";
import { paletteFor } from "../lib/palette";
import type { Item } from "../types";

/**
 * Prequel e sequel come una linea da percorrere, non come un elenco.
 *
 * La striscia sopra dice *quanto* della saga hai visto; questa dice **dove
 * sei**. Sono due domande diverse e la seconda ha una sola risposta buona: una
 * fila in ordine, con il capitolo aperto in mezzo e il numero grande dietro a
 * ogni locandina, così la posizione si legge senza contare le copertine.
 *
 * I capitoli che non hai aprono il foglio di aggiunta già compilato: un buco
 * nella saga è esattamente il momento in cui uno vuole tapparlo.
 */

const POSTER_W = "w-32";

function Chapter({ entry, current, onOpen }: { entry: SagaEntry; current: boolean; onOpen: (item: Item) => void }) {
  const closeItem = useSelectedItem((s) => s.close);
  const { add, adding } = useAddFromCatalog(closeItem);
  const { part, item, number, state } = entry;
  const poster = posterUrl(part.posterPath, "w342");
  const [a, b] = paletteFor(part.title);
  const busy = adding === part.tmdbId;

  return (
    <div className={`relative shrink-0 ${POSTER_W} text-center`}>
      {/* Il numero del capitolo, grande e dietro: fa da segnaposto sulla linea
          anche mentre la locandina sta ancora arrivando. */}
      {/* Sporge a sinistra della locandina, nello spazio fra una carta e
          l'altra: dietro e basta sarebbe invisibile sui capitoli che hai
          (quelli a piena opacità), che sono proprio quelli da numerare. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -left-6 top-6 select-none font-display text-7xl font-bold leading-none text-text opacity-[0.13]"
      >
        {number}
      </span>

      <button
        type="button"
        disabled={busy}
        onClick={() =>
          item
            ? onOpen(item)
            : void add({
                tmdbId: part.tmdbId,
                mediaType: "movie",
                kind: "film",
                title: part.title,
                year: part.year,
                posterPath: part.posterPath,
              })
        }
        aria-label={item ? `Apri ${part.title}` : `Aggiungi ${part.title} alla libreria`}
        aria-current={current ? "true" : undefined}
        className="relative block w-full disabled:opacity-60"
      >
        <span
          className="relative block aspect-[2/3] w-full overflow-hidden rounded-sm transition-transform"
          style={{
            background: `linear-gradient(150deg, ${b}, ${a})`,
            outline: current ? "2px solid var(--accent)" : undefined,
            outlineOffset: current ? "2px" : undefined,
            // I capitoli che non hai restano leggibili ma spenti: si vede a
            // colpo d'occhio dove finisce la parte di saga che possiedi.
            opacity: state === "assente" ? 0.55 : 1,
          }}
        >
          {poster && (
            <img
              src={poster}
              alt=""
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover"
            />
          )}
          {part.year != null && (
            <span className="absolute right-1 top-1 rounded-full bg-black/65 px-1.5 py-0.5 font-mono tabular text-[10px] text-white backdrop-blur-sm">
              {part.year}
            </span>
          )}
          {state === "visto" && (
            <span
              className="absolute left-1 top-1 flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold"
              style={{ background: "var(--status-done)", color: "var(--accent-contrast)" }}
            >
              ✓
            </span>
          )}
          {state === "assente" && (
            <span className="absolute inset-x-0 bottom-0 bg-black/60 py-1 text-[10px] font-semibold text-white">
              {busy ? "…" : "＋ aggiungi"}
            </span>
          )}
        </span>
      </button>

      <p className="mt-1.5 line-clamp-2 text-[11px] font-medium leading-snug text-text">{part.title}</p>
      {current && (
        <p className="mt-0.5 text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: "var(--accent-text)" }}>
          Sei qui
        </p>
      )}
    </div>
  );
}

export function SagaLine({ item }: { item: Item }) {
  const items = useLibrary((s) => s.items);
  const sagas = useSagas((s) => s.sagas);
  const orders = useSagas((s) => s.orders);
  const prefs = useSagas((s) => s.prefs);
  const openItem = useSelectedItem((s) => s.open);

  // Alla prima apertura la fila si porta da sola sul capitolo corrente: in una
  // saga da dieci film "sei qui" sarebbe fuori schermo, a destra, invisibile.
  const centerOnCurrent = useCallback((node: HTMLDivElement | null) => {
    node?.scrollIntoView({ block: "nearest", inline: "center" });
  }, []);

  const saga = item.collectionId != null ? sagas[String(item.collectionId)] : undefined;
  if (!saga || saga.parts.length < 2) return null;

  const key = sagaKey(saga.id);
  const entries = buildEntries(orderParts(saga.parts, prefs.order[key] ?? "uscita", orders[key]), items);

  return (
    <section className="mt-1">
      <h3 className="font-display text-lg font-semibold text-text">
        Prequel &amp; Sequel <span className="text-sm font-normal text-text-faint">· {entries.length}</span>
      </h3>

      <div className="relative mt-3">
        {/* La linea del tempo passa dietro le locandine, all'altezza del loro
            centro: è quella che rende la fila un percorso invece che una
            vetrina. */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-24 h-px bg-border-strong" />
        <div className="flex gap-6 overflow-x-auto pb-1 pl-7">
          {entries.map((entry) => {
            const current = entry.item?.id === item.id;
            return (
              <div key={entry.part.tmdbId} ref={current ? centerOnCurrent : undefined}>
                <Chapter entry={entry} current={current} onOpen={openItem} />
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
