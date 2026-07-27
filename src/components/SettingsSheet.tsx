import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Sheet } from "./Sheet";
import { useSettingsSheet } from "../store/useSettingsSheet";
import { useSettings, MODELS } from "../store/useSettings";
import { useLibrary } from "../store/useLibrary";

function SettingsForm() {
  const close = useSettingsSheet((s) => s.close);
  const apiKey = useSettings((s) => s.apiKey);
  const model = useSettings((s) => s.model);
  const setApiKey = useSettings((s) => s.setApiKey);
  const setModel = useSettings((s) => s.setModel);
  const clearApiKey = useSettings((s) => s.clearApiKey);
  const items = useLibrary((s) => s.items);
  const pushToast = useLibrary((s) => s.pushToast);

  const [draftKey, setDraftKey] = useState(apiKey);
  const [reveal, setReveal] = useState(false);
  const titleId = "settings-sheet-title";

  function exportData() {
    const blob = new Blob([JSON.stringify(items, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "cinemate-libreria.json";
    a.click();
    URL.revokeObjectURL(url);
    pushToast("success", "Libreria esportata.");
  }

  return (
    <Sheet onClose={close} titleId={titleId} maxWidthClass="max-w-md">
      <div className="flex flex-col gap-5 p-5 pt-8 sm:p-6">
        <h2 id={titleId} className="font-display text-xl font-semibold text-text">
          Impostazioni
        </h2>

        <div>
          <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-text-faint">
            Chiave API Anthropic
          </span>
          <p className="mb-2.5 text-xs leading-relaxed text-text-faint">
            Usata solo dal tuo browser per parlare direttamente con l'API di Anthropic — non viene mai inviata altrove
            e resta salvata solo su questo dispositivo. Ricordati che è una chiave personale: non condividere questo
            dispositivo con dati sensibili collegati.
          </p>
          <div className="flex gap-2">
            <input
              type={reveal ? "text" : "password"}
              value={draftKey}
              onChange={(e) => setDraftKey(e.target.value)}
              placeholder="sk-ant-…"
              autoComplete="off"
              className="flex-1 rounded-sm border border-border-strong bg-surface px-3 py-2.5 font-mono text-sm text-text placeholder:text-text-faint focus:border-accent"
            />
            <button
              type="button"
              onClick={() => setReveal((r) => !r)}
              aria-label={reveal ? "Nascondi chiave" : "Mostra chiave"}
              className="rounded-sm border border-border-strong px-3 text-xs text-text-muted"
            >
              {reveal ? "Nascondi" : "Mostra"}
            </button>
          </div>
          <div className="mt-2.5 flex gap-2">
            <button
              type="button"
              onClick={() => {
                setApiKey(draftKey);
                pushToast("success", "Chiave salvata.");
              }}
              className="rounded-sm px-3.5 py-2 text-xs font-semibold"
              style={{ background: "var(--accent)", color: "var(--accent-contrast)" }}
            >
              Salva chiave
            </button>
            {apiKey && (
              <button
                type="button"
                onClick={() => {
                  clearApiKey();
                  setDraftKey("");
                  pushToast("info", "Chiave rimossa.");
                }}
                className="rounded-sm border border-border-strong px-3.5 py-2 text-xs text-text-muted"
              >
                Rimuovi
              </button>
            )}
          </div>
        </div>

        <div>
          <span className="mb-2 block text-xs font-medium uppercase tracking-wide text-text-faint">Modello</span>
          <div className="flex flex-col gap-1.5" role="radiogroup" aria-label="Modello Claude">
            {MODELS.map((m) => (
              <button
                key={m.id}
                type="button"
                role="radio"
                aria-checked={model === m.id}
                onClick={() => setModel(m.id)}
                className="flex items-center justify-between rounded-sm border px-3 py-2.5 text-left text-sm transition-colors"
                style={
                  model === m.id
                    ? { borderColor: "color-mix(in srgb, var(--accent) 50%, transparent)", background: "color-mix(in srgb, var(--accent) 12%, transparent)" }
                    : { borderColor: "var(--border-strong)" }
                }
              >
                <span className="font-medium text-text">{m.label}</span>
                <span className="text-xs text-text-faint">{m.hint}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className="mb-2 block text-xs font-medium uppercase tracking-wide text-text-faint">Dati locali</span>
          <button
            type="button"
            onClick={exportData}
            disabled={items.length === 0}
            className="w-full rounded-sm border border-border-strong px-3.5 py-2.5 text-left text-sm text-text disabled:opacity-40"
          >
            Esporta libreria (JSON)
          </button>
        </div>
      </div>
    </Sheet>
  );
}

export function SettingsSheetPortal() {
  const isOpen = useSettingsSheet((s) => s.isOpen);
  return <AnimatePresence>{isOpen && <SettingsForm />}</AnimatePresence>;
}
