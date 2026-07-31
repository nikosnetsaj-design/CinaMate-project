import type { Item } from "../types";
import type { SagaOrders } from "./sagas";
import type { TmdbSagaPart, DiscoverQuery } from "./tmdb";
import { MOVIE_GENRES, TV_GENRES } from "./tmdb";

const ENDPOINT = "https://api.anthropic.com/v1/messages";

export class MissingApiKeyError extends Error {
  constructor() {
    super("Nessuna chiave API Anthropic configurata.");
    this.name = "MissingApiKeyError";
  }
}

export class ClaudeApiError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "ClaudeApiError";
    this.status = status;
  }
}

interface ContentBlock {
  type: string;
  text?: string;
}

async function callClaude(opts: {
  apiKey: string;
  model: string;
  system?: string;
  prompt: string;
  maxTokens: number;
  effort?: "low" | "medium" | "high";
}): Promise<string> {
  const { apiKey, model, system, prompt, maxTokens, effort } = opts;
  if (!apiKey) throw new MissingApiKeyError();

  let response: Response;
  try {
    response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        ...(system ? { system } : {}),
        ...(effort ? { output_config: { effort } } : {}),
        messages: [{ role: "user", content: prompt }],
      }),
    });
  } catch {
    throw new ClaudeApiError("Connessione ad Anthropic non riuscita. Controlla la rete e riprova.");
  }

  if (!response.ok) {
    let message = `Richiesta rifiutata (HTTP ${response.status}).`;
    try {
      const body = (await response.json()) as { error?: { message?: string; type?: string } };
      if (response.status === 401) message = "Chiave API non valida o scaduta.";
      else if (response.status === 429) message = "Limite di richieste raggiunto. Riprova tra poco.";
      else if (body?.error?.message) message = body.error.message;
    } catch {
      /* keep the generic message */
    }
    throw new ClaudeApiError(message, response.status);
  }

  const data = (await response.json()) as { content?: ContentBlock[]; stop_reason?: string };
  if (data.stop_reason === "refusal") {
    throw new ClaudeApiError("Claude non ha potuto rispondere a questa richiesta.");
  }
  const text = (data.content ?? [])
    .filter((b) => b.type === "text" && typeof b.text === "string")
    .map((b) => b.text)
    .join("");
  if (!text.trim()) throw new ClaudeApiError("Risposta vuota da Claude.");
  return text;
}

export async function askCritic(question: string, items: Item[], apiKey: string, model: string): Promise<string> {
  const done = items.filter((i) => i.status === "Visto");
  const watching = items.filter((i) => i.status === "In visione");
  const planned = items.filter((i) => i.status === "Da vedere");
  const favs = items.filter((i) => i.fav);

  // Sagas the user is partway through are the highest-value context there is:
  // "what next" usually has a correct answer sitting inside one of them.
  const bySaga = new Map<string, { seen: string[]; pending: string[] }>();
  for (const i of items) {
    if (!i.collectionName) continue;
    const entry = bySaga.get(i.collectionName) ?? { seen: [], pending: [] };
    (i.status === "Visto" ? entry.seen : entry.pending).push(i.title);
    bySaga.set(i.collectionName, entry);
  }
  const sagaLines = Array.from(bySaga.entries())
    .filter(([, v]) => v.seen.length > 0 && v.pending.length > 0)
    .map(([name, v]) => `${name}: visti ${v.seen.join(", ")}; ancora da vedere ${v.pending.join(", ")}`);

  const context = `Visti: ${done.map((i) => `${i.title} (${i.vote ?? "?"}/10, ${i.genre})`).join("; ") || "nessuno"}.
In corso: ${watching.map((i) => (i.episodes ? `${i.title} (episodio ${i.seen || 0} di ${i.episodes})` : i.title)).join("; ") || "nessuno"}.
In watchlist: ${planned.map((i) => i.title).join("; ") || "nessuno"}.
Preferiti: ${favs.map((i) => i.title).join("; ") || "nessuno"}.
Saghe iniziate e non finite: ${sagaLines.join(" | ") || "nessuna"}.`;

  const prompt = `Sei un critico cinematografico appassionato e diretto. Profilo dell'utente:
${context}

Domanda: "${question}"

Rispondi in italiano, max 200 parole, concreto e con opinioni vere. Consiglia titoli specifici collegandoli ai suoi gusti, e indica dove vederli in Italia se lo sai. Se la domanda riguarda "cosa guardo dopo" e c'è una saga iniziata a metà, di' esattamente qual è il capitolo successivo. Niente elenchi generici da wikipedia.`;

  return callClaude({ apiKey, model, prompt, maxTokens: 1200, effort: "high" });
}

/**
 * Models sometimes wrap JSON in prose or a fenced block however firmly they are
 * asked not to. Taking the outermost braces is cheaper and more forgiving than
 * failing the whole feature over a stray "Ecco il risultato:".
 */
function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) throw new ClaudeApiError("Risposta non interpretabile.");
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    throw new ClaudeApiError("Risposta non interpretabile.");
  }
}

function idsFrom(value: unknown, allowed: Set<number>): number[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<number>();
  return value
    .map((v) => (typeof v === "number" ? v : Number(v)))
    .filter((n) => Number.isFinite(n) && allowed.has(n) && !seen.has(n) && seen.add(n));
}

// ---------------------------------------------------------------------------
// Natural-language search.
//
// The model's job here is translation, not retrieval: it turns a sentence into
// TMDB filter parameters and TMDB answers. That division matters — asking a
// model for "sci-fi films from the nineties" directly gets a list from memory,
// with the confident wrong years and the occasional film that doesn't exist.
// Asking it for `{genres:[878], yearFrom:1990, yearTo:1999}` and letting the
// catalogue answer gets a list that is true by construction.
// ---------------------------------------------------------------------------

function numberOrUndefined(value: unknown, min: number, max: number): number | undefined {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n >= min && n <= max ? n : undefined;
}

export interface ParsedQuery extends DiscoverQuery {
  /** One line saying what it understood, so a wrong reading is visible. */
  explanation: string;
}

export async function parseNaturalQuery(
  question: string,
  apiKey: string,
  model: string,
): Promise<ParsedQuery> {
  const movieList = Object.entries(MOVIE_GENRES).map(([id, name]) => `${id}=${name}`).join(", ");
  const tvList = Object.entries(TV_GENRES).map(([id, name]) => `${id}=${name}`).join(", ");
  const thisYear = new Date().getFullYear();

  const prompt = `Traduci questa richiesta in filtri per il catalogo TMDB: "${question}"

Generi per i film: ${movieList}
Generi per le serie: ${tvList}

Restituisci SOLO un oggetto JSON, senza testo intorno, con questa forma:
{"mediaType":"movie"|"tv","genreIds":[numeri],"yearFrom":numero,"yearTo":numero,"runtimeMin":minuti,"runtimeMax":minuti,"voteMin":numero,"person":"nome","keywords":"parola","sortBy":"popularity.desc"|"vote_average.desc"|"primary_release_date.desc","explanation":"una frase"}

Regole:
- Includi solo i campi che la richiesta implica davvero. Ometti gli altri: un campo inventato restringe la ricerca senza che l'utente l'abbia chiesto.
- "mediaType" è sempre obbligatorio; usa "tv" solo se si parla di serie, altrimenti "movie".
- Usa esclusivamente gli id di genere elencati sopra, quelli della mediaType scelta.
- Gli anni sono anni pieni a quattro cifre. "anni '90" significa 1990-1999. L'anno corrente è ${thisYear}.
- "person" solo se è nominata una persona (attore o regista). Non metterci un titolo o un genere.
- "keywords" solo per un concetto che non è un genere (es. "viaggi nel tempo", "supereroi").
- "voteMin" solo se si chiede qualità ("belli", "i migliori"): usa 7.
- "explanation": una frase in italiano, max 20 parole, che dica cosa hai capito.`;

  const raw = await callClaude({ apiKey, model, prompt, maxTokens: 700, effort: "low" });
  const parsed = extractJson(raw) as Record<string, unknown>;

  const mediaType = parsed.mediaType === "tv" ? "tv" : "movie";
  const allowed = new Set(Object.keys(mediaType === "tv" ? TV_GENRES : MOVIE_GENRES).map(Number));
  const genreIds = Array.isArray(parsed.genreIds)
    ? parsed.genreIds.map(Number).filter((n) => allowed.has(n))
    : [];

  const sortBy =
    parsed.sortBy === "vote_average.desc" || parsed.sortBy === "primary_release_date.desc"
      ? parsed.sortBy
      : "popularity.desc";

  return {
    mediaType,
    genreIds,
    // Bounded rather than trusted: a hallucinated `yearFrom: 19900` would
    // silently return nothing at all, which reads as "the search is broken"
    // rather than "the model slipped".
    yearFrom: numberOrUndefined(parsed.yearFrom, 1880, thisYear + 5),
    yearTo: numberOrUndefined(parsed.yearTo, 1880, thisYear + 5),
    runtimeMin: numberOrUndefined(parsed.runtimeMin, 1, 600),
    runtimeMax: numberOrUndefined(parsed.runtimeMax, 1, 600),
    voteMin: numberOrUndefined(parsed.voteMin, 0, 10),
    person: typeof parsed.person === "string" && parsed.person.trim() ? parsed.person.trim() : undefined,
    keywords: typeof parsed.keywords === "string" && parsed.keywords.trim() ? parsed.keywords.trim() : undefined,
    sortBy,
    explanation: typeof parsed.explanation === "string" ? parsed.explanation.trim() : "",
  };
}

/**
 * "Dove eravamo rimasti" for a series picked up months later.
 *
 * The whole value is in the boundary, so the prompt states it twice and in
 * terms of the episode number: a recap that leaks what happens next is not a
 * slightly worse recap, it is the thing the user was specifically avoiding by
 * asking for one.
 */
export async function spoilerFreeRecap(
  title: string,
  seenEpisodes: number,
  totalEpisodes: number | null,
  apiKey: string,
  model: string,
): Promise<string> {
  const prompt = `La serie è "${title}". L'utente ha visto ${seenEpisodes} episodi${
    totalEpisodes ? ` su ${totalEpisodes}` : ""
  } e riprende adesso dopo una pausa.

Scrivi "dove eravamo": un riassunto in italiano, max 150 parole, di dove si trova la storia alla fine dell'episodio ${seenEpisodes}.

Vincoli assoluti:
- NON rivelare nulla che accada dopo l'episodio ${seenEpisodes}. Nemmeno un accenno, nemmeno "e da lì tutto cambierà".
- Niente anticipazioni su morti, colpi di scena o rivelazioni future.
- Se non conosci questa serie abbastanza da rispettare il confine, dillo in una riga invece di inventare.
- Parla di personaggi e situazioni al punto in cui sono, non della trama complessiva della serie.`;

  return callClaude({ apiKey, model, prompt, maxTokens: 700, effort: "medium" });
}

/**
 * Translates a synopsis TMDB only holds in English.
 *
 * This exists because TMDB's `language=it-IT` returns an *empty* overview
 * rather than the English one when nobody has contributed a translation, so
 * the app is choosing between a blank card and a translated one — not between
 * an Italian original and a machine version of it.
 */
export async function translateOverview(
  title: string,
  overview: string,
  apiKey: string,
  model: string,
): Promise<string> {
  const prompt = `Traduci in italiano la sinossi di "${title}". Restituisci solo la traduzione, senza introduzioni, virgolette o note.

${overview}`;

  return callClaude({ apiKey, model, prompt, maxTokens: 700, effort: "low" });
}

/**
 * Release order is a fact TMDB already knows. Story chronology and "the order
 * that reads best the first time" are editorial judgements no catalogue holds,
 * so they are asked for once per saga and then cached — see `useSagas`.
 */
export async function computeSagaOrders(
  sagaName: string,
  parts: TmdbSagaPart[],
  apiKey: string,
  model: string,
): Promise<SagaOrders> {
  const list = parts.map((p) => `${p.tmdbId} = "${p.title}" (${p.year ?? "senza data"})`).join("\n");

  const prompt = `Saga: "${sagaName}". Questi sono i suoi capitoli, con l'id TMDB e l'anno di uscita:
${list}

Restituisci SOLO un oggetto JSON, senza testo intorno, con questa forma esatta:
{"chronological": [id, ...], "recommended": [id, ...], "note": "una frase"}

- "chronological": tutti gli id, ordinati secondo quando gli eventi accadono nella storia (prequel e flashback al loro posto reale).
- "recommended": tutti gli id, nell'ordine migliore per chi guarda la saga per la prima volta.
- "note": una sola frase in italiano, max 20 parole, che dica cosa cambia fra i due ordini. Se coincidono con l'ordine di uscita, dillo.

Usa esclusivamente gli id elencati sopra e includili tutti in entrambe le liste.`;

  const raw = await callClaude({ apiKey, model, prompt, maxTokens: 1500, effort: "high" });
  const parsed = extractJson(raw) as { chronological?: unknown; recommended?: unknown; note?: unknown };
  const allowed = new Set(parts.map((p) => p.tmdbId));

  const chronological = idsFrom(parsed.chronological, allowed);
  const recommended = idsFrom(parsed.recommended, allowed);
  if (chronological.length === 0 && recommended.length === 0) {
    throw new ClaudeApiError("Claude non è riuscito a ordinare questa saga.");
  }

  return {
    chronological,
    recommended: recommended.length ? recommended : chronological,
    note: typeof parsed.note === "string" ? parsed.note.trim() : "",
    computedAt: Date.now(),
  };
}
