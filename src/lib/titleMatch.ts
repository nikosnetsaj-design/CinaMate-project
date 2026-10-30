/**
 * Quando due titoli sono lo stesso titolo scritto da due programmi diversi.
 *
 * Serve in due momenti: quando un export di Letterboxd, IMDb o Netflix arriva
 * con dei nomi e bisogna trovare *quale* scheda di TMDB vogliono dire, e
 * quando la passata di collegamento in sottofondo cerca la copertina di un
 * titolo scritto a mano. In entrambi i casi la prima risposta della ricerca
 * non basta: «Dune» del 1984 e quello del 2021 rispondono alla stessa
 * domanda, e solo l'anno li separa.
 */

const ARTICLE = /^(the|a|an|il|lo|la|i|gli|le|l'|un|uno|una|un'|les|el|los|las|der|die|das)\s+/;

/**
 * La forma con cui i titoli si confrontano: minuscole, senza accenti, la «&»
 * detta per esteso e la punteggiatura ridotta a spazi. Lettere e cifre di
 * qualunque alfabeto restano: un titolo giapponese ridotto a stringa vuota
 * sarebbe uguale a tutti gli altri titoli giapponesi.
 */
export function foldTitle(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(/[’‘`´]/g, "'")
    .replace(/[^\p{L}\p{N}']+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function withoutArticle(folded: string): string {
  // L'apostrofo dell'articolo elidato è attaccato alla parola: «l'amica».
  return folded.replace(/^(l'|un')/, "").replace(ARTICLE, "");
}

/**
 * Da 0 a 1. Uguali dopo la piegatura valgono 1; uguali a meno dell'articolo
 * 0,95 («The Thing» e «Thing»); uno che è l'inizio dell'altro, a confine di
 * parola, 0,8 («Dune» e «Dune: Parte uno»). Il resto è la sovrapposizione
 * delle parole, pesata meno: due titoli che condividono «love» non sono lo
 * stesso film.
 */
export function titleSimilarity(a: string, b: string): number {
  const x = foldTitle(a);
  const y = foldTitle(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  const ax = withoutArticle(x);
  const ay = withoutArticle(y);
  if (ax === ay) return 0.95;
  if (ax.startsWith(`${ay} `) || ay.startsWith(`${ax} `)) return 0.8;
  const wa = new Set(ax.split(" "));
  const wb = new Set(ay.split(" "));
  let common = 0;
  for (const word of wa) if (wb.has(word)) common++;
  return ((2 * common) / (wa.size + wb.size)) * 0.75;
}

export interface MatchCandidate {
  title: string;
  /** Il titolo originale, quando la sorgente lo dà: è quello che usano gli export stranieri. */
  originalTitle?: string;
  year: number | null;
}

export interface MatchWanted {
  title: string;
  /** `null` o `0` quando non si sa. */
  year: number | null;
}

/**
 * Il candidato giusto fra quelli che la ricerca ha restituito, o nessuno.
 *
 * Con l'anno noto vince chi ha quell'anno, poi chi sta a un anno di distanza
 * (un film passato da un festival a dicembre esce in sala a gennaio, e i
 * cataloghi non sono d'accordo su quale sia «il» suo anno); dentro lo stesso
 * gruppo un titolo che somiglia davvero passa davanti, e a parità decide
 * l'ordine di TMDB, che conosce anche i titoli alternativi. Un candidato
 * dell'anno giusto che non somiglia per niente resta accettabile: TMDB l'ha
 * trovato per un titolo alternativo («The Great Beauty» →
 * «La grande bellezza»), e l'anno lo conferma.
 *
 * `strictYear`: con l'anno noto e nessun candidato entro un anno, la risposta
 * è «nessuno» invece del primo risultato. È la regola per i titoli importati,
 * il cui anno è un dato e non un valore predefinito: meglio un titolo senza
 * copertina che la copertina del remake.
 */
export function pickCandidate<T extends MatchCandidate>(
  candidates: T[],
  wanted: MatchWanted,
  { strictYear = false }: { strictYear?: boolean } = {},
): T | null {
  if (candidates.length === 0) return null;
  const year = wanted.year && wanted.year > 1800 ? wanted.year : null;
  const scored = candidates.map((c, rank) => ({
    c,
    rank,
    sim: Math.max(titleSimilarity(c.title, wanted.title), c.originalTitle ? titleSimilarity(c.originalTitle, wanted.title) : 0),
    dy: year !== null && c.year ? Math.abs(c.year - year) : null,
  }));
  const tier = (sim: number) => (sim >= 0.9 ? 0 : sim >= 0.6 ? 1 : 2);

  if (year !== null) {
    for (const tolerance of [0, 1]) {
      const pool = scored.filter((s) => s.dy !== null && s.dy <= tolerance);
      if (pool.length) {
        pool.sort((a, b) => tier(a.sim) - tier(b.sim) || a.rank - b.rank);
        return pool[0].c;
      }
    }
    if (strictYear) return null;
  }

  // Senza anno (o senza nessuno dell'anno giusto, nella regola larga): il più
  // somigliante, e a pari somiglianza l'ordine di TMDB.
  const best = scored.slice().sort((a, b) => tier(a.sim) - tier(b.sim) || a.rank - b.rank)[0];
  return best.c;
}
