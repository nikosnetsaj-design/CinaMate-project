import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLibrary } from "../store/useLibrary";
import { useSettings } from "../store/useSettings";
import { useSettingsSheet } from "../store/useSettingsSheet";
import { useCriticDraft } from "../store/useCriticDraft";
import { askCritic, ClaudeApiError, MissingApiKeyError } from "../lib/anthropic";
import { voteColor } from "../lib/vote";
import type { Item } from "../types";

const PROMPTS = [
  "Cosa guardo stasera?",
  "Qual è il prossimo capitolo che dovrei vedere?",
  "Consigliami qualcosa di corto",
  "Che saga dovrei iniziare?",
  "Anime da provare",
  "Descrivi il mio gusto cinematografico",
  "Cosa manca alla mia lista?",
];

/**
 * The "simile a X" question only helps when X is a film the user actually
 * cares about, so it is built from their own shelf rather than hardcoded.
 */
function similarPrompt(items: Item[]): string | null {
  const best = items
    .filter((i) => i.vote != null && i.status === "Visto")
    .sort((a, b) => (b.vote ?? 0) - (a.vote ?? 0))[0];
  return best ? `Voglio un film simile a "${best.title}"` : null;
}

export function Critic() {
  const items = useLibrary((s) => s.items);
  const apiKey = useSettings((s) => s.apiKey);
  const model = useSettings((s) => s.model);
  const openSettingsSheet = useSettingsSheet((s) => s.open);
  const consumeDraft = useCriticDraft((s) => s.consume);
  const navigate = useNavigate();

  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [missingKey, setMissingKey] = useState(false);

  const done = items.filter((i) => i.status === "Visto");
  const similar = similarPrompt(items);
  const prompts = similar ? [similar, ...PROMPTS] : PROMPTS;

  useEffect(() => {
    const draft = consumeDraft();
    if (draft) {
      setQuestion(draft);
      void ask(draft);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function ask(text?: string) {
    const q = (text ?? question).trim();
    if (!q || busy) return;
    setBusy(true);
    setAnswer("");
    setErr("");
    setMissingKey(false);
    try {
      const out = await askCritic(q, items, apiKey, model);
      setAnswer(out);
    } catch (e) {
      if (e instanceof MissingApiKeyError) setMissingKey(true);
      else if (e instanceof ClaudeApiError) setErr(e.message);
      else setErr("Connessione non riuscita. Riprova.");
    }
    setBusy(false);
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5 px-4 py-6 sm:px-6 sm:py-10">
      <div>
        <h1 className="font-display text-3xl font-semibold text-text">Il critico</h1>
        <p className="mt-1 text-sm text-text-muted">
          Conosce i tuoi {done.length} titoli visti e i voti che hai dato — usa la tua chiave API Anthropic personale.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {prompts.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setQuestion(p)}
            className="rounded-full border border-border-strong px-3 py-1.5 text-xs text-text-muted hover:bg-surface-hover"
          >
            {p}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && ask()}
          placeholder="Chiedi qualsiasi cosa…"
          aria-label="Chiedi al critico"
          className="flex-1 rounded-sm border border-border-strong bg-surface px-3 py-2.5 text-sm text-text placeholder:text-text-faint focus:border-accent"
        />
        <button
          type="button"
          onClick={() => ask()}
          disabled={busy || !question.trim()}
          className="min-w-14 rounded-sm px-4 text-lg font-bold disabled:opacity-50"
          style={{ background: "var(--accent)", color: "var(--accent-contrast)" }}
        >
          {busy ? "…" : "→"}
        </button>
      </div>

      {busy && (
        <div className="flex flex-col items-center gap-3 py-9 text-text-muted">
          <div className="spinner h-6 w-6 rounded-full border-2" style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }} />
          <span className="text-sm">Sto pensando…</span>
        </div>
      )}

      {missingKey && !busy && (
        <div className="flex flex-col items-center gap-3 rounded-md border border-dashed border-border-strong px-4 py-8 text-center">
          <p className="text-sm text-text-muted">
            Per parlare con il critico serve una chiave API Anthropic personale, salvata solo su questo dispositivo.
          </p>
          <button
            type="button"
            onClick={openSettingsSheet}
            className="rounded-sm border border-border-strong px-4 py-2 text-sm font-medium text-text hover:bg-surface-hover"
          >
            Aggiungi la tua chiave nelle Impostazioni
          </button>
        </div>
      )}

      {err && !busy && (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <p className="text-sm text-text-muted">{err}</p>
          <button
            type="button"
            onClick={() => ask()}
            className="rounded-sm border border-border-strong px-4 py-2 text-sm font-medium text-text hover:bg-surface-hover"
          >
            Riprova
          </button>
        </div>
      )}

      {answer && !busy && (
        <div className="rounded-md border border-border bg-surface-2 p-5">
          <div className="mb-3.5 h-0.5 w-6" style={{ background: "var(--accent)" }} />
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-text">{answer}</p>
        </div>
      )}

      <div className="rounded-md border border-border bg-surface p-4">
        <span className="mb-2 block text-xs font-medium uppercase tracking-wide text-text-faint">Su cosa si basa</span>
        {done.length === 0 ? (
          <p className="text-sm text-text-faint">Segna qualche titolo come "Visto" per consigli su misura.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {done.slice(0, 12).map((i) => (
              <span key={i.id} className="rounded-full bg-surface-hover px-2.5 py-1 text-xs text-text-muted">
                {i.title} <span style={{ color: voteColor(i.vote) }}>{i.vote}</span>
              </span>
            ))}
          </div>
        )}
      </div>

      <button type="button" onClick={() => navigate("/libreria")} className="text-xs text-text-faint underline-offset-2 hover:underline">
        ← Torna alla libreria
      </button>
    </div>
  );
}
