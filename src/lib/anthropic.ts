import type { Item } from "../types";
import type { SagaOrders } from "./sagas";
import type { TmdbSagaPart } from "./tmdb";

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
