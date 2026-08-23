import { useSelectedItem } from "../store/useSelectedItem";
import { useSagas } from "../store/useSagas";
import { useCatalogPreview } from "../store/useCatalogPreview";
import { useFranchise } from "../lib/useFranchise";
import { PART_STATE_META } from "../lib/sagas";
import { PosterArt } from "./PosterArt";
import type { FranchiseEntry } from "../lib/franchise";
import type { Item, Kind } from "../types";

/**
 * La **collezione**: tutto quello che sta nella stessa storia, in griglia.
 *
 * È la sezione che mancava alle serie. Un film aveva la sua linea di prequel e
 * sequel — la collezione TMDB — e una serie non aveva niente: «La casa di
 * carta» non portava da nessuna parte, e le altre quattro schede della stessa
 * storia (il remake coreano, lo spin-off su Berlino, i due documentari)
 * esistevano senza che dalla prima ci fosse un modo di sapere che esistono.
 * Chi le mette insieme è `lib/franchise.ts`.
 *
 * Griglia e non fila che scorre, al contrario dei correlati: una collezione si
 * guarda tutta insieme — sono cinque o sei titoli, non venti — e la domanda che
 * le si fa è «quanto me ne manca», che in una fila da scorrere non si legge.
 * Da qui la riga di avanzamento in cima e **Continua con** in fondo: la
 * collezione è una cosa da finire, i correlati sono una proposta.
 *
 * Ogni locandina dice a colpo d'occhio in che rapporto sei con quel titolo —
 * visto, in visione (con la barra degli episodi), in libreria, o non ce l'hai —
 * e **SEI QUI** marca quello da cui sei arrivato, che è il modo di leggere una
 * griglia come un percorso invece che come una vetrina.
 */

const KIND_LABEL: Record<Kind, string> = {
  film: "Film",
  serie: "Serie",
  anime: "Anime",
  doc: "Documentario",
};

function CollectionCard({ entry, onOpen }: { entry: FranchiseEntry; onOpen: (item: Item) => void }) {
  const openPreview = useCatalogPreview((s) => s.open);
  const { part, item, state, current, pct } = entry;
  const meta = PART_STATE_META[state];

  return (
    <li className="flex flex-col">
      <button
        type="button"
        onClick={() =>
          item
            ? onOpen(item)
            : openPreview({
                tmdbId: part.tmdbId,
                mediaType: part.mediaType,
                kind: part.kind,
                title: part.title,
                year: part.year,
                posterPath: part.posterPath,
              })
        }
        aria-label={item ? `Apri ${part.title}` : `Apri la scheda di ${part.title}`}
        aria-current={current ? "true" : undefined}
        className="relative block w-full text-left"
      >
        <span
          className="relative block overflow-hidden rounded-sm transition-transform"
          style={{
            outline: current ? "2px solid var(--accent)" : undefined,
            outlineOffset: current ? "2px" : undefined,
            // I titoli che non hai restano leggibili ma spenti: si vede dove
            // finisce la parte di collezione che possiedi.
            opacity: state === "assente" ? 0.6 : 1,
          }}
        >
          <PosterArt
            item={{ title: part.title, kind: part.kind, posterPath: part.posterPath }}
            size="sm"
            showTitle={!part.posterPath}
            className="w-full"
          />

          {part.year != null && (
            <span className="absolute right-1 top-1 rounded-full bg-black/65 px-1.5 py-0.5 font-mono tabular text-[10px] text-white backdrop-blur-sm">
              {part.year}
            </span>
          )}

          {state !== "assente" && (
            <span
              className="absolute bottom-1 left-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-bold"
              style={{ background: meta.color, color: "var(--accent-contrast)" }}
              title={meta.label}
            >
              {meta.icon}
            </span>
          )}

          {state === "assente" && (
            <span className="absolute inset-x-0 bottom-0 bg-black/65 py-1 text-center text-[10px] font-semibold text-white">
              Vedi scheda
            </span>
          )}

          {/* La barra degli episodi solo dove vuol dire qualcosa: una serie che
              hai cominciato. Su un film "al 40%" non esiste. */}
          {pct != null && pct > 0 && pct < 100 && (
            <span className="absolute inset-x-0 bottom-0 block h-1 bg-black/50">
              <span
                className="block h-full"
                style={{ width: `${pct}%`, background: "var(--status-watching)" }}
              />
            </span>
          )}
        </span>
      </button>

      <p className="mt-1.5 line-clamp-2 text-xs font-medium leading-snug text-text">{part.title}</p>
      <p className="mt-0.5 font-mono tabular text-[10px] text-text-faint">
        {KIND_LABEL[part.kind]}
        {item?.seasons ? ` · ${item.seasons} st.` : ""}
      </p>
      {current && (
        <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: "var(--accent-text)" }}>
          Sei qui
        </p>
      )}
    </li>
  );
}

export function CollectionGrid({ item }: { item: Item }) {
  const { entries, progress, name, loading } = useFranchise(item);
  const openItem = useSelectedItem((s) => s.open);
  const openPreview = useCatalogPreview((s) => s.open);
  const sagas = useSagas((s) => s.sagas);

  /**
   * I film che la linea «Prequel & Sequel» sta già mostrando qui sopra.
   *
   * Quando il titolo ha una collezione TMDB vera, quei capitoli hanno già una
   * resa migliore di una griglia: in fila, numerati, con la linea del tempo
   * dietro. Ripeterli qui sotto sarebbe la stessa cosa detta due volte, quindi
   * la griglia si tiene solo il resto — le serie, gli spin-off, i documentari:
   * esattamente quello che una collezione TMDB non sa contenere.
   */
  const saga = item.collectionId != null ? sagas[String(item.collectionId)] : undefined;
  const inLine =
    saga && saga.parts.length > 1 ? new Set(saga.parts.map((p) => `movie:${p.tmdbId}`)) : null;

  if (loading) {
    return (
      <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4" aria-hidden="true">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton aspect-2/3 rounded-sm" />
        ))}
      </div>
    );
  }

  // Un titolo solo non è una collezione: è sé stesso, e annunciarlo come
  // "collezione" sarebbe una sezione che promette qualcosa e non lo mantiene.
  if (entries.length < 2) return null;

  const shown = inLine
    ? entries.filter((e) => !inLine.has(`${e.part.mediaType}:${e.part.tmdbId}`))
    : entries;
  // Tutta la collezione era già nella linea: qui non resta niente da dire.
  if (shown.length === 0) return null;

  // Il seguito e l'avanzamento parlano della collezione intera, e la griglia
  // parziale ne mostra solo una parte: affiancarli lì direbbe «1 su 5» sopra a
  // due locandine. Nella fila dei capitoli quel conto c'è già, sotto.
  const next = inLine ? null : progress.next;

  return (
    <section>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-display text-lg font-semibold text-text">
          {inLine ? "Anche in questa storia" : "Collezione"}{" "}
          <span className="text-sm font-normal text-text-faint">· {shown.length}</span>
        </h3>
        {name && !inLine && <span className="truncate text-xs text-text-faint">{name}</span>}
      </div>

      {/* Quanto ne hai visto, che è la domanda che si fa a una collezione. La
          percentuale è sul totale della storia, non su quello che possiedi:
          dire "100%" avendo tre titoli su sei sarebbe una bugia gentile. */}
      {!inLine && (
        <div className="mt-2 flex items-center gap-2.5">
          <div className="h-[3px] flex-1 overflow-hidden rounded-full bg-surface-hover">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${progress.pct}%`, background: "var(--status-done)" }}
            />
          </div>
          <span className="font-mono tabular text-[11px] text-text-faint">
            {progress.watched}/{progress.total} visti
          </span>
        </div>
      )}

      <ul className="mt-3 grid grid-cols-3 gap-x-2.5 gap-y-3.5 sm:grid-cols-4">
        {shown.map((entry) => (
          <CollectionCard key={`${entry.part.mediaType}-${entry.part.tmdbId}`} entry={entry} onOpen={openItem} />
        ))}
      </ul>

      {/* «Continua con»: il primo titolo non visto dopo questo. È la stessa
          promessa della fine di un capitolo di saga — la collezione sa cosa
          viene dopo, e farlo cercare nella griglia sarebbe un compito. */}
      {next && (
        <button
          type="button"
          onClick={() => {
            if (next.item) {
              openItem(next.item);
              return;
            }
            openPreview({
              tmdbId: next.part.tmdbId,
              mediaType: next.part.mediaType,
              kind: next.part.kind,
              title: next.part.title,
              year: next.part.year,
              posterPath: next.part.posterPath,
            });
          }}
          className="mt-4 flex w-full items-center gap-3 rounded-md border py-3 pl-3.5 pr-3 text-left"
          style={{
            borderColor: "color-mix(in srgb, var(--accent) 35%, transparent)",
            background: "color-mix(in srgb, var(--accent) 10%, transparent)",
          }}
        >
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] uppercase tracking-[0.16em] text-text-faint">Continua con</span>
            <span className="block truncate font-display text-sm font-semibold text-text">{next.part.title}</span>
          </span>
          <span className="shrink-0" style={{ color: "var(--accent-text)" }}>
            →
          </span>
        </button>
      )}
    </section>
  );
}
