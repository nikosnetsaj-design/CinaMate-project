import { Fragment, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLibrary } from "../store/useLibrary";
import { useSettings } from "../store/useSettings";
import { useSettingsSheet } from "../store/useSettingsSheet";
import { useCriticDraft } from "../store/useCriticDraft";
import { askCritic, ClaudeApiError, MissingApiKeyError } from "../lib/anthropic";
import type { Item } from "../types";
import { ArrowRightIcon, BackIcon } from "../components/icons";

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
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-[var(--gutter)] py-6 sm:py-10">
      <div>
        <h1 className="t-display text-text">Il critico</h1>
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
            className="chip chip-wrap"
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
          className="field flex-1"
        />
        <button
          type="button"
          onClick={() => ask()}
          disabled={busy || !question.trim()}
          aria-label="Chiedi"
          className="btn btn-primary min-w-12 px-3.5"
        >
          {busy ? "…" : <ArrowRightIcon />}
        </button>
      </div>

      {/* L'attesa ha la forma della risposta che arriva: righe di testo,
          non una rotella. */}
      {busy && (
        <div className="rounded-lg bg-surface p-5 shadow-[var(--shadow-sm)]" role="status">
          <span className="sr-only">Sto pensando…</span>
          <div aria-hidden="true" className="flex flex-col gap-2.5">
            <div className="skeleton h-4 w-11/12 rounded-xs" />
            <div className="skeleton h-4 w-full rounded-xs" />
            <div className="skeleton h-4 w-4/5 rounded-xs" />
            <div className="skeleton h-4 w-2/3 rounded-xs" />
          </div>
          <p className="mt-4 text-xs text-text-faint" aria-hidden="true">Sto pensando…</p>
        </div>
      )}

      {missingKey && !busy && (
        <div className="flex flex-col items-center gap-4 rounded-lg bg-surface px-5 py-8 text-center shadow-[var(--shadow-sm)]">
          <p className="text-sm text-text-muted">
            Per parlare con il critico serve una chiave API Anthropic personale, salvata solo su questo dispositivo.
          </p>
          <button
            type="button"
            onClick={() => openSettingsSheet()}
            className="btn btn-secondary"
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
            className="btn btn-secondary"
          >
            Riprova
          </button>
        </div>
      )}

      {answer && !busy && (
        <div className="rounded-lg bg-surface p-5 shadow-[var(--shadow-sm)]">
          <p className="whitespace-pre-wrap text-base leading-relaxed text-text">{answer}</p>
        </div>
      )}

      <section>
        <h2 className="mb-3 text-sm font-medium text-text-muted">Su cosa si basa</h2>
        {done.length === 0 ? (
          <p className="text-sm text-text-faint">Segna qualche titolo come "Visto" per consigli su misura.</p>
        ) : (
          // Testo, non pastiglie: le pastiglie qui sopra si toccano, questi
          // titoli no. La stessa forma prometteva un'azione che non c'era.
          <p className="text-sm leading-relaxed text-text-muted">
            {done.slice(0, 12).map((i, idx) => (
              // Il separatore sta fuori dal blocco che non va a capo, con i
              // suoi spazi: è lì che la riga può spezzarsi.
              <Fragment key={i.id}>
                {idx > 0 && <span aria-hidden="true" className="text-text-faint"> · </span>}
                <span className="whitespace-nowrap">
                  <span className="text-text">{i.title}</span> <span className="tabular">{i.vote}</span>
                </span>
              </Fragment>
            ))}
          </p>
        )}
      </section>

      <button type="button" onClick={() => navigate("/libreria")} className="btn btn-plain btn-sm -ml-3 self-start text-text-muted">
        <BackIcon size={16} />
        Torna alla libreria
      </button>
    </div>
  );
}
