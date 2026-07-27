import type { Item, LookupResult } from "../types";

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

export async function lookupTitles(query: string, apiKey: string, model: string): Promise<LookupResult[]> {
  const prompt = `Sei un database cinematografico. L'utente cerca: "${query}".
Restituisci fino a 5 titoli corrispondenti (film, serie TV, anime o documentari), i più probabili per primi.
Rispondi ESCLUSIVAMENTE con JSON valido, senza markdown, senza backtick, senza testo prima o dopo:
{"results":[{"title":"titolo italiano o originale","kind":"film|serie|anime|doc","year":2008,"genre":"genere principale in italiano","runtime":49,"episodes":62,"seasons":5,"overview":"trama in italiano, max 180 caratteri","director":"regista o creatore","cast":["attore 1","attore 2"],"platform":"piattaforma streaming più probabile in Italia","similar":["titolo simile 1","titolo simile 2","titolo simile 3"]}]}
Per i film ometti episodes e seasons (usa null). Per le serie runtime è la durata media di un episodio.
Se non trovi nulla restituisci {"results":[]}.`;

  const raw = await callClaude({ apiKey, model, prompt, maxTokens: 1200, effort: "medium" });
  const clean = raw.replace(/```json|```/g, "").trim();
  const start = clean.indexOf("{");
  const end = clean.lastIndexOf("}");
  if (start === -1 || end === -1) throw new ClaudeApiError("Risposta non interpretabile.");
  let parsed: { results?: unknown[] };
  try {
    parsed = JSON.parse(clean.slice(start, end + 1));
  } catch {
    throw new ClaudeApiError("Risposta non interpretabile.");
  }
  if (!Array.isArray(parsed.results)) return [];
  return parsed.results.filter((r): r is LookupResult => !!r && typeof (r as LookupResult).title === "string");
}

export async function askCritic(question: string, items: Item[], apiKey: string, model: string): Promise<string> {
  const done = items.filter((i) => i.status === "Visto");
  const watching = items.filter((i) => i.status === "In visione");
  const planned = items.filter((i) => i.status === "Da vedere");
  const favs = items.filter((i) => i.fav);

  const context = `Visti: ${done.map((i) => `${i.title} (${i.vote ?? "?"}/10, ${i.genre})`).join("; ") || "nessuno"}.
In corso: ${watching.map((i) => i.title).join("; ") || "nessuno"}.
In watchlist: ${planned.map((i) => i.title).join("; ") || "nessuno"}.
Preferiti: ${favs.map((i) => i.title).join("; ") || "nessuno"}.`;

  const prompt = `Sei un critico cinematografico appassionato e diretto. Profilo dell'utente:
${context}

Domanda: "${question}"

Rispondi in italiano, max 200 parole, concreto e con opinioni vere. Consiglia titoli specifici collegandoli ai suoi gusti, e indica dove vederli in Italia se lo sai. Niente elenchi generici da wikipedia.`;

  return callClaude({ apiKey, model, prompt, maxTokens: 1200, effort: "high" });
}
