import { useEffect, useMemo, useState } from "react";
import { useLibrary } from "../store/useLibrary";
import { useSettings } from "../store/useSettings";
import { useTitleExtras } from "./useTitleExtras";
import {
  buildFranchise,
  franchiseProgress,
  franchiseRoot,
  fromSagaParts,
  isFranchiseKeyword,
  belongsByTitle,
  mergeFranchise,
  type FranchiseEntry,
  type FranchiseProgress,
  type FranchiseTarget,
} from "./franchise";
import { cleanSagaName, getKeywordTitles, getSaga, searchFranchiseTitles, type TmdbFranchiseEntry } from "./tmdb";
import type { Item, Kind } from "../types";

/**
 * La collezione di un titolo, pronta da disegnare.
 *
 * Le regole di chi ci sta dentro stanno in `lib/franchise.ts`, che è codice
 * puro e si prova da riga di comando; qui c'è solo il lavoro che va fatto in
 * rete e il modo di non rifarlo. Tre richieste al massimo, e quasi mai tre:
 * la collezione TMDB la conosce già lo store delle saghe, le parole chiave
 * arrivano dentro la richiesta che la scheda fa comunque (`useTitleExtras`), e
 * la ricerca per nome parte solo se il nome è abbastanza lungo da significare
 * qualcosa.
 *
 * Il risultato viene tenuto per id del titolo, promessa compresa: quattro
 * riquadri della stessa scheda che chiedono la collezione insieme sono una
 * richiesta sola, come per gli extra.
 */

export interface FranchiseView {
  entries: FranchiseEntry[];
  progress: FranchiseProgress;
  /** Il nome della collezione, quando TMDB gliene dà uno. */
  name: string;
  loading: boolean;
}

const EMPTY: FranchiseEntry[] = [];

/** Le collezioni già montate, per non rifare il giro a ogni riapertura. */
const cache = new Map<string, Promise<TmdbFranchiseEntry[]>>();

interface Ingredients {
  tmdbId: number;
  mediaType: "movie" | "tv";
  title: string;
  kind: Kind;
  year: number | null;
  posterPath: string | null;
  collectionId: number | null;
  /** Titolo originale e parole chiave: arrivano dagli extra della scheda. */
  originalTitle: string;
  keywords: { id: number; name: string }[];
}

/**
 * Il titolo aperto, nella forma delle voci della collezione.
 *
 * Va in fondo ai gruppi, non in cima: se la collezione lo contiene già — e
 * quasi sempre è così — vince la voce di TMDB, che ha la locandina giusta e la
 * data giusta. Serve per il caso opposto, che esiste: uno spin-off trovato per
 * parola chiave dove la parola chiave sulla scheda *madre* nessuno l'ha messa.
 * Senza, la griglia mostrerebbe la famiglia senza «sei qui» dentro.
 */
function selfEntry(source: Ingredients): TmdbFranchiseEntry {
  return {
    tmdbId: source.tmdbId,
    mediaType: source.mediaType,
    kind: source.kind,
    title: source.title,
    releaseDate: source.year ? `${source.year}-01-01` : null,
    year: source.year,
    overview: "",
    posterPath: source.posterPath,
    popularity: 0,
  };
}

async function collect(source: Ingredients, apiKey: string): Promise<TmdbFranchiseEntry[]> {
  const aliases = [source.title, source.originalTitle].filter(Boolean);
  const root = franchiseRoot(source.title) ?? franchiseRoot(source.originalTitle);

  // La keyword giusta è una sola: quella che si chiama come il titolo. Se ce ne
  // fossero due (nome italiano e originale entrambi registrati) valgono
  // entrambe, ma oltre non si va — ogni keyword sono due richieste.
  const franchiseKeywords = source.keywords.filter((k) => isFranchiseKeyword(k.name, aliases)).slice(0, 2);

  const [collection, byKeyword, byName] = await Promise.all([
    source.collectionId != null
      ? getSaga(source.collectionId, apiKey)
          .then((saga) => fromSagaParts(saga.parts))
          .catch(() => [])
      : Promise.resolve<TmdbFranchiseEntry[]>([]),
    Promise.all(franchiseKeywords.map((k) => getKeywordTitles(k.id, apiKey).catch(() => []))).then((lists) =>
      lists.flat(),
    ),
    root
      ? searchFranchiseTitles(root, apiKey)
          .then((found) => found.filter((f) => belongsByTitle(f.title, root)))
          .catch(() => [])
      : Promise.resolve<TmdbFranchiseEntry[]>([]),
  ]);

  const target: FranchiseTarget = { tmdbId: source.tmdbId, mediaType: source.mediaType, title: source.title };
  const merged = mergeFranchise([collection, byKeyword, byName, [selfEntry(source)]], target);
  // Una collezione fatta solo di sé stessi non è una collezione: chi disegna se
  // ne accorgerebbe comunque, ma dirlo qui evita di far girare una griglia da
  // una locandina sola per poi non mostrarla.
  return merged.length > 1 ? merged : [];
}

function load(source: Ingredients, apiKey: string): Promise<TmdbFranchiseEntry[]> {
  const key = `${source.mediaType}:${source.tmdbId}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const promise = collect(source, apiKey);
  cache.set(key, promise);
  // Un giro fallito non deve restare in cache come fallimento eterno: la scheda
  // riaperta fra un minuto deve poter riprovare.
  promise.catch(() => cache.delete(key));
  return promise;
}

/**
 * Dimentica le collezioni montate. Va insieme a `clearTmdbCaches`: quelle
 * buttano via le risposte di TMDB, questa il risultato del montaggio — che
 * senza, resterebbe quello di prima con dentro dati che non ci sono più.
 */
export function clearFranchiseCache(): void {
  cache.clear();
}

export function useFranchise(item: Item): FranchiseView {
  const tmdbApiKey = useSettings((s) => s.tmdbApiKey);
  const items = useLibrary((s) => s.items);
  const { extras, loading: extrasLoading } = useTitleExtras(item);
  const [parts, setParts] = useState<TmdbFranchiseEntry[] | null>(null);

  const linked = Boolean(tmdbApiKey) && item.tmdbId != null && item.tmdbMediaType != null;
  // Le parole chiave arrivano con gli extra: prima di quelli si può già cercare
  // per nome e per collezione, ma il giro si fa una volta sola, quindi si
  // aspetta. Un titolo non collegato a TMDB non ha niente da aspettare.
  const ready = linked && !extrasLoading;

  useEffect(() => {
    setParts(null);
    if (!ready || !tmdbApiKey || item.tmdbId == null || item.tmdbMediaType == null) return;

    let cancelled = false;
    load(
      {
        tmdbId: item.tmdbId,
        mediaType: item.tmdbMediaType,
        title: item.title,
        kind: item.kind,
        year: item.year || null,
        posterPath: item.posterPath,
        collectionId: item.collectionId ?? null,
        originalTitle: extras?.originalTitle ?? "",
        keywords: extras?.keywords ?? [],
      },
      tmdbApiKey,
    )
      .then((found) => {
        if (!cancelled) setParts(found);
      })
      .catch(() => {
        if (!cancelled) setParts([]);
      });

    return () => {
      cancelled = true;
    };
    // `extras` è un oggetto nuovo a ogni caricamento ma il suo contenuto dipende
    // solo dal titolo: `ready` è il momento in cui è arrivato.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, tmdbApiKey, item.tmdbId, item.tmdbMediaType, item.collectionId]);

  const entries = useMemo(() => {
    if (!parts || parts.length === 0) return EMPTY;
    const target: FranchiseTarget = {
      tmdbId: item.tmdbId,
      mediaType: item.tmdbMediaType,
      title: item.title,
    };
    return buildFranchise(parts, items, target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parts, items, item.tmdbId, item.tmdbMediaType, item.title]);

  const progress = useMemo(() => franchiseProgress(entries), [entries]);

  return {
    entries,
    progress,
    name: item.collectionName ? cleanSagaName(item.collectionName) : "",
    loading: linked && (extrasLoading || parts === null),
  };
}
