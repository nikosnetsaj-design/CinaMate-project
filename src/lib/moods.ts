import type { Item } from "../types";

/**
 * La scoperta per stato d'animo.
 *
 * La domanda vera davanti a una libreria di duecento titoli non è "di che
 * genere ho voglia" — è "che serata è". Il genere è una proprietà del film,
 * l'umore è una proprietà della sera, e sono cose diverse: un documentario
 * può essere riposante o pesantissimo, un fantascientifico può essere una
 * corsa o un rompicapo.
 *
 * Come è costruito, e perché così: nessun vocabolario emotivo importato e
 * nessuna chiamata a un servizio esterno. I punteggi si compongono da quello
 * che la libreria *già sa* di ogni titolo — genere, durata, voto TMDB, tipo —
 * il che ha tre conseguenze che valgono più della raffinatezza: funziona
 * offline, funziona al primo colpo su una libreria appena importata, e
 * soprattutto è spiegabile. Ogni risultato sa dire perché è lì, e questa app
 * il "perché" lo mostra sempre (vedi `recommend.ts`).
 */

export type MoodId = "rilassante" | "adrenalinico" | "ispirazionale" | "cervellotico";

export interface Mood {
  id: MoodId;
  label: string;
  /** La domanda a cui risponde, in una riga, per l'interfaccia. */
  blurb: string;
}

export const MOODS: Mood[] = [
  { id: "rilassante", label: "Rilassante", blurb: "Niente che chieda troppo" },
  { id: "adrenalinico", label: "Adrenalinico", blurb: "Qualcosa che corra" },
  { id: "ispirazionale", label: "Ispirazionale", blurb: "Che lasci qualcosa" },
  { id: "cervellotico", label: "Cervellotico", blurb: "Da guardare con la testa accesa" },
];

/**
 * I generi, come TMDB li scrive in italiano, con il peso che hanno per ogni
 * umore. I pesi negativi contano quanto i positivi: sapere cosa *non* è una
 * serata rilassante (l'horror) è più discriminante che sapere cosa lo è, dato
 * che la commedia la propone chiunque.
 */
const GENRE_WEIGHTS: Record<MoodId, Record<string, number>> = {
  rilassante: {
    Commedia: 3,
    Famiglia: 3,
    Animazione: 2,
    Musica: 2,
    Romance: 2,
    Fantasy: 1,
    Documentario: 1,
    Horror: -4,
    Thriller: -3,
    Guerra: -3,
    Crime: -2,
    Dramma: -1,
  },
  adrenalinico: {
    Azione: 3,
    Thriller: 3,
    Avventura: 2,
    Guerra: 2,
    Crime: 1,
    Fantascienza: 1,
    Horror: 1,
    Documentario: -2,
    Romance: -2,
    Famiglia: -1,
  },
  ispirazionale: {
    Dramma: 2,
    Storia: 2,
    Documentario: 2,
    Musica: 2,
    Avventura: 1,
    Famiglia: 1,
    Horror: -3,
    Commedia: -1,
  },
  cervellotico: {
    Mistero: 3,
    Fantascienza: 3,
    Thriller: 2,
    Dramma: 1,
    Crime: 1,
    Commedia: -2,
    Famiglia: -2,
    Animazione: -1,
  },
};

/** Parole che, quando compaiono nella sinossi, spostano l'ago. */
const OVERVIEW_HINTS: Record<MoodId, string[]> = {
  rilassante: ["commedia", "amicizia", "estate", "famiglia", "romantic", "leggerezza"],
  adrenalinico: ["inseguimento", "fuga", "missione", "vendetta", "sopravviv", "esplos", "combatt"],
  ispirazionale: ["vera storia", "realmente", "riscatto", "sogno", "impresa", "coraggio", "maestro"],
  cervellotico: ["enigma", "indagine", "mistero", "identità", "tempo", "realtà", "cospiraz", "memoria"],
};

/** Sopra questo punteggio un titolo entra nella selezione dell'umore. */
const THRESHOLD = 2;

export interface MoodMatch {
  item: Item;
  score: number;
  /** Perché è finito qui: una riga, mostrata sotto la copertina. */
  reason: string;
}

/**
 * Il punteggio di un titolo per un umore, con la ragione principale.
 *
 * La ragione è quella del contributo più alto, non un riassunto di tutti: una
 * spiegazione sola e vera vale più di tre messe in fila.
 */
function score(item: Item, mood: MoodId): { score: number; reason: string } {
  const weights = GENRE_WEIGHTS[mood];
  let total = 0;
  let reason = "";
  let best = 0;

  // Il genere principale, che è l'unico che la libreria conserva.
  const genreWeight = item.genre ? (weights[item.genre] ?? 0) : 0;
  total += genreWeight;
  if (genreWeight > best) {
    best = genreWeight;
    reason = `${item.genre}, che è la serata giusta`;
  }

  // La durata. Conta solo agli estremi: un film di 95 minuti è un impegno
  // diverso da uno di 160, mentre fra 110 e 120 non c'è nulla da dire.
  const runtime = item.runtime || 0;
  if (mood === "rilassante" && runtime > 0 && runtime <= 100) {
    total += 2;
    if (2 > best) {
      best = 2;
      reason = `Sotto le due ore: ${runtime} minuti`;
    }
  }
  if (mood === "cervellotico" && runtime >= 130) {
    total += 2;
    if (2 > best) {
      best = 2;
      reason = `${runtime} minuti: si prende il suo tempo`;
    }
  }
  if (mood === "rilassante" && runtime >= 150) total -= 2;

  // Il voto TMDB, e solo dove il genere ha già detto di sì.
  //
  // È un moltiplicatore, non un lasciapassare: un voto alto rende *migliore*
  // un titolo già adatto, non rende adatto un titolo qualsiasi. Senza questa
  // condizione bastava un 8.0 per far entrare un documentario fra i film
  // "cervellotici" — cosa che il primo giro di prove ha effettivamente fatto,
  // ed è il modo classico in cui un punteggio a somma smette di significare
  // quello che dice il suo nome.
  const rating = item.tmdbRating ?? 0;
  if ((mood === "ispirazionale" || mood === "cervellotico") && genreWeight > 0 && rating >= 7.5) {
    total += 2;
    if (2 > best) {
      best = 2;
      reason = `${rating.toFixed(1)} su TMDB`;
    }
  }

  // Le serie, per una maratona rilassante, hanno un vantaggio: si guarda una
  // puntata e si smette senza aver deciso niente.
  if (mood === "rilassante" && item.kind !== "film" && (item.episodes ?? 0) > 0) total += 1;

  // La sinossi, come ultimo indizio e col peso più basso: è la fonte più
  // ricca e la meno affidabile, perché descrive la trama e non il tono.
  const haystack = `${item.overview} ${item.notes}`.toLowerCase();
  for (const hint of OVERVIEW_HINTS[mood]) {
    if (haystack.includes(hint)) {
      total += 1;
      break;
    }
  }

  if (!reason) reason = "Somiglia a quello che cerchi stasera";
  return { score: total, reason };
}

/**
 * I titoli della libreria che rispondono a un umore, dal più adatto in giù.
 *
 * Esclude ciò che è già stato visto e non è un preferito: la domanda "che
 * guardo stasera" quasi mai vuole per risposta un titolo già consumato — ma
 * un preferito resta candidato, perché rivedere un film che si ama è
 * esattamente una serata rilassante.
 */
export function itemsForMood(items: Item[], mood: MoodId, limit = 20): MoodMatch[] {
  return items
    .filter((item) => item.status !== "Abbandonato")
    .filter((item) => item.status !== "Visto" || item.fav)
    .map((item) => ({ item, ...score(item, mood) }))
    .filter((m) => m.score >= THRESHOLD)
    .sort((a, b) => b.score - a.score || (b.item.tmdbRating ?? 0) - (a.item.tmdbRating ?? 0))
    .slice(0, limit);
}

/** Quanti titoli risponderebbero a ciascun umore. Serve a non offrire una via vuota. */
export function moodCounts(items: Item[]): Record<MoodId, number> {
  const out = {} as Record<MoodId, number>;
  for (const mood of MOODS) out[mood.id] = itemsForMood(items, mood.id, Number.MAX_SAFE_INTEGER).length;
  return out;
}
