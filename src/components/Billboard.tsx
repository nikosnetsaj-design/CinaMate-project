import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLibrary } from "../store/useLibrary";
import { useSelectedItem } from "../store/useSelectedItem";
import { useWatchProgress } from "../store/useWatchProgress";
import { useVisibleItems } from "../lib/useVisibleItems";
import { useUpcoming } from "../lib/useUpcoming";
import { continueWatching, lastSeenDates } from "../lib/continueWatching";
import { pickFeaturedList } from "../lib/featured";
import { backdropSrcSet, backdropUrl, posterUrl } from "../lib/tmdb";
import { paletteFor } from "../lib/palette";
import { useTitleLogo } from "../lib/useTitleLogo";
import { CheckIcon, InfoIcon, PlayIcon, PlusIcon } from "./icons";
import type { Item } from "../types";

/**
 * La vetrina: un titolo solo, grande, con la ragione per cui è lì e due modi
 * per agire.
 *
 * È la cosa che Netflix fa meglio di chiunque — si apre l'app e c'è già una
 * proposta, non una griglia da scandagliare — ed è anche il posto dove Netflix
 * mente di più, perché lì sopra finisce ciò che va promosso. Qui non c'è niente
 * da promuovere: la riga sotto il titolo dice sempre un fatto verificabile (una
 * data, i minuti che restano, il giorno in cui l'hai aggiunto), e la scelta
 * segue la gerarchia dichiarata in lib/featured.
 */

/** Segnaposto per l'hook del logo quando la vetrina è ancora vuota. */
const EMPTY_ITEM = { id: "", tmdbId: null, tmdbMediaType: null } as unknown as Item;

export function Billboard() {
  const items = useVisibleItems();
  const history = useLibrary((s) => s.history);
  const progress = useWatchProgress((s) => s.progress);
  const { upcoming } = useUpcoming();
  const setStatus = useLibrary((s) => s.setStatus);
  const pushToast = useLibrary((s) => s.pushToast);
  const openItem = useSelectedItem((s) => s.open);
  const navigate = useNavigate();

  const resuming = useMemo(
    () => continueWatching(items, progress, lastSeenDates(history)),
    [items, progress, history],
  );
  const featured = useMemo(() => pickFeaturedList(items, upcoming, resuming), [items, upcoming, resuming]);

  // Quale delle proposte è a schermo. Non gira da sola: un carosello che si
  // muove mentre stai leggendo è la ragione per cui i caroselli si ignorano.
  const [index, setIndex] = useState(0);
  const touchX = useRef<number | null>(null);
  const current = featured[Math.min(index, featured.length - 1)];
  // Sempre chiamato, anche quando non c'è ancora nulla in vetrina: gli hook non
  // possono stare dietro a un ritorno anticipato.
  const logo = useTitleLogo(current?.item ?? EMPTY_ITEM);

  if (!current) return null;
  const { item, line } = current;

  // L'immagine orizzontale quando c'è; la locandina quando manca — riempita e
  // sfocata sotto una sfumatura, che è meglio di un ritaglio a mezzo mento.
  const wide = backdropUrl(item.backdropPath, "w1280");
  const tall = posterUrl(item.posterPath, "w500");
  const [a, b] = paletteFor(item.title);
  const inList = item.status === "Da vedere";

  return (
    <section
      aria-label="In vetrina"
      aria-roledescription="carosello"
      className="relative overflow-hidden rounded-md"
      onTouchStart={(e) => {
        touchX.current = e.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(e) => {
        const start = touchX.current;
        touchX.current = null;
        const end = e.changedTouches[0]?.clientX;
        if (start == null || end == null) return;
        const delta = end - start;
        // Quaranta pixel: sotto è un tocco storto, non uno scorrimento.
        if (Math.abs(delta) < 40) return;
        setIndex((i) => Math.min(featured.length - 1, Math.max(0, i + (delta < 0 ? 1 : -1))));
      }}
    >
      {/* Alta come una locandina sul telefono, larga come una scena sul
          desktop, e mai più di due terzi dello schermo: una vetrina che copre
          tutta la pagina nasconde proprio le righe che deve introdurre. */}
      <div className="relative aspect-4/5 max-h-[68vh] w-full sm:aspect-video">
        {wide ? (
          <img
            src={wide}
            srcSet={backdropSrcSet(item.backdropPath)}
            sizes="(min-width: 768px) 900px, 100vw"
            alt=""
            // La prima immagine della pagina: caricarla pigramente vuol dire
            // aspettare il layout prima ancora di chiederla.
            fetchPriority="high"
            className="h-full w-full object-cover"
          />
        ) : tall ? (
          <img src={tall} alt="" className="h-full w-full object-cover object-top" />
        ) : (
          <div className="h-full w-full" style={{ background: `linear-gradient(150deg, ${b} 0%, ${a} 100%)` }} />
        )}
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{ background: "linear-gradient(to top, rgba(0,0,0,0.92) 6%, rgba(0,0,0,0.35) 45%, transparent 78%)" }}
        />

        <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-3 p-4 text-center sm:p-6">
          {/* Il logo disegnato del titolo quando TMDB ce l'ha: è metà
              dell'effetto di una vetrina, perché il lettering *è* la locandina
              mentre lo stesso nome nel font dell'app è una didascalia. */}
          <h2
            className="font-display text-3xl font-semibold leading-[1.05] text-white sm:text-4xl"
            style={{ textShadow: "0 2px 12px rgba(0,0,0,0.7)" }}
          >
            {logo ? (
              <img
                src={logo}
                alt={item.title}
                className="mx-auto max-h-28 w-auto max-w-[85%] object-contain drop-shadow-[0_2px_12px_rgba(0,0,0,0.7)]"
              />
            ) : (
              item.title
            )}
          </h2>
          <p className="text-sm font-medium text-white/85">{line}</p>

          <div className="mt-1 flex w-full max-w-md items-stretch gap-2.5">
            <button
              type="button"
              onClick={() => navigate(`/player?titolo=${encodeURIComponent(item.id)}`)}
              className="flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-sm bg-white px-3 py-3 text-[13px] font-semibold text-black transition-opacity hover:opacity-90 sm:text-sm"
            >
              <PlayIcon size={17} />
              Riproduci
            </button>

            {/* Un titolo qui dentro è già in libreria: "La mia lista" può
                solo significare "mettilo fra quelli da vedere". Quando ci è
                già, il pulsante smette di fingere di essere un interruttore e
                porta dove lo stato si cambia davvero — la scheda. */}
            {inList ? (
              <button
                type="button"
                onClick={() => openItem(item)}
                className="flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-sm bg-white/20 px-3 py-3 text-[13px] font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/30 sm:text-sm"
              >
                <CheckIcon size={17} />
                Nella tua lista
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setStatus(item.id, "Da vedere");
                  pushToast("success", `«${item.title}» è nella tua lista`);
                }}
                className="flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-sm bg-white/20 px-3 py-3 text-[13px] font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/30 sm:text-sm"
              >
                <PlusIcon size={17} />
                La mia lista
              </button>
            )}

            <button
              type="button"
              onClick={() => openItem(item)}
              aria-label={`Altre info su ${item.title}`}
              className="flex w-11 shrink-0 items-center justify-center rounded-sm bg-white/20 text-white backdrop-blur-sm transition-colors hover:bg-white/30"
            >
              <InfoIcon size={19} />
            </button>
          </div>

          {featured.length > 1 && (
            <div className="mt-1 flex items-center justify-center gap-2" role="tablist" aria-label="Proposte in vetrina">
              {featured.map((entry, i) => (
                <button
                  key={entry.item.id}
                  type="button"
                  role="tab"
                  aria-selected={i === index}
                  aria-label={`Vetrina ${i + 1} di ${featured.length}: ${entry.item.title}`}
                  onClick={() => setIndex(i)}
                  className="h-2 rounded-full transition-all"
                  style={{
                    width: i === index ? 22 : 8,
                    background: i === index ? "var(--accent)" : "rgba(255,255,255,0.45)",
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
