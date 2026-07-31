import { useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Sheet } from "./Sheet";
import { useSettingsSheet } from "../store/useSettingsSheet";
import { useSettings, MODELS } from "../store/useSettings";
import { useLibrary } from "../store/useLibrary";
import { useSagas } from "../store/useSagas";
import { useMarathon } from "../store/useMarathon";
import { useReminders } from "../store/useReminders";
import { usePlayerSources } from "../store/usePlayerSources";
import { usePlayerPrefs } from "../store/usePlayerPrefs";
import { useGoals } from "../store/useGoals";
import { TEMPLATE_FIELDS, previewTemplate, previewCount } from "../lib/sourceTemplate";
import { getHosts, restoreHosts } from "../player/services/hostStore";
import { buildBackup, parseBackup, BackupParseError } from "../lib/backup";
import { resetAutoLinkAttempts } from "../lib/useAutoLinkTmdb";

/**
 * Where your own sources live, written once instead of pasted per title.
 *
 * Three slots because they double as a fallback chain: the player builds an
 * address for the title out of each one and tries them in order, so the second
 * and third are what it falls back to when the first host doesn't answer.
 *
 * The bare address is the important case. Asking for a pattern asks you to know
 * how your own server spells filenames; pasting the server on its own and
 * letting the app work the rest out is what most people actually want, so the
 * field takes either and the preview says what it will do with what you typed.
 */
function SourceTemplates() {
  const templates = usePlayerPrefs((s) => s.sourceTemplates);
  const setTemplate = usePlayerPrefs((s) => s.setTemplate);
  const [showHelp, setShowHelp] = useState(false);

  return (
    <div>
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-text-faint">
        Indirizzi delle tue sorgenti
      </span>
      <p className="mb-2.5 text-xs leading-relaxed text-text-faint">
        Se i tuoi video stanno tutti sullo stesso server, scrivilo qui una volta sola: da quel
        momento ogni titolo della libreria ha il suo pulsante{" "}
        <strong className="font-medium text-text-muted">Guarda</strong>, senza incollare più niente.
        Basta l'indirizzo nudo — <span className="font-mono">https://mio-server.com</span> — e il
        file lo cerca lui: prova i nomi soliti per quel titolo e, se non li trova, legge la cartella
        e cerca il nome che gli somiglia. Se invece sai già com'è fatto l'indirizzo, scrivilo con un
        segnaposto al posto del titolo ed è quello esatto. Le tre caselle si provano in ordine, e
        con loro gli host del pannello Host nel player.
      </p>

      <div className="flex flex-col gap-2">
        {templates.map((value, i) => {
          const preview = previewTemplate(value);
          const others = Math.max(previewCount(value) - 1, 0);
          return (
            <div key={i}>
              <input
                value={value}
                // Written through on every keystroke rather than on blur: a
                // field that only commits when it loses focus loses whatever
                // you typed last if you close the sheet straight after — which
                // is exactly what you do after filling in the last address.
                onChange={(e) => setTemplate(i, e.target.value)}
                inputMode="url"
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                aria-label={`Indirizzo ${i + 1}`}
                placeholder={i === 0 ? "https://mio-server.com" : `Indirizzo ${i + 1} (facoltativo)`}
                className="w-full rounded-sm border border-border-strong bg-surface px-3 py-2.5 font-mono text-xs text-text placeholder:text-text-faint focus:border-accent"
              />
              {preview && (
                <p className="mt-1 break-all px-1 font-mono text-[10px] leading-relaxed text-text-faint">
                  Per «Il Padrino» prova {preview}
                  {others > 0 && (
                    <span className="font-sans"> e altri {others} indirizzi, finché uno risponde</span>
                  )}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => setShowHelp((v) => !v)}
        aria-expanded={showHelp}
        className="mt-2 rounded-sm border border-border-strong px-2.5 py-1.5 text-xs text-text-muted"
      >
        {showHelp ? "Nascondi i segnaposto" : "Quali segnaposto posso usare?"}
      </button>

      {showHelp && (
        <dl className="mt-2 flex flex-col gap-1.5 rounded-sm border border-border bg-surface-2 p-3">
          {TEMPLATE_FIELDS.map((f) => (
            <div key={f.token} className="flex flex-wrap items-baseline gap-x-2">
              <dt className="font-mono text-xs text-accent-text">{f.token}</dt>
              <dd className="flex-1 text-xs text-text-faint">
                {f.label} <span className="font-mono">({f.example})</span>
              </dd>
            </div>
          ))}
          <p className="mt-1 text-xs leading-relaxed text-text-faint">
            I segnaposto vengono riempiti con i dati del titolo, e il player chiede quell'indirizzo
            sul server che hai indicato.
          </p>
        </dl>
      )}
    </div>
  );
}

function SettingsForm() {
  const close = useSettingsSheet((s) => s.close);
  const apiKey = useSettings((s) => s.apiKey);
  const model = useSettings((s) => s.model);
  const setApiKey = useSettings((s) => s.setApiKey);
  const setModel = useSettings((s) => s.setModel);
  const clearApiKey = useSettings((s) => s.clearApiKey);
  const tmdbApiKey = useSettings((s) => s.tmdbApiKey);
  const setTmdbApiKey = useSettings((s) => s.setTmdbApiKey);
  const clearTmdbApiKey = useSettings((s) => s.clearTmdbApiKey);
  const items = useLibrary((s) => s.items);
  const history = useLibrary((s) => s.history);
  const pushToast = useLibrary((s) => s.pushToast);
  const importData = useLibrary((s) => s.importData);
  const clearAll = useLibrary((s) => s.clearAll);

  const [draftKey, setDraftKey] = useState(apiKey);
  const [reveal, setReveal] = useState(false);
  const [draftTmdbKey, setDraftTmdbKey] = useState(tmdbApiKey);
  const [revealTmdb, setRevealTmdb] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const titleId = "settings-sheet-title";

  function exportData() {
    const sagas = useSagas.getState();
    const reminders = useReminders.getState();
    const playerPrefs = usePlayerPrefs.getState();
    const backup = buildBackup(
      items,
      history,
      {
        orders: sagas.orders,
        preferredOrder: sagas.prefs.order,
        hidden: sagas.prefs.hidden,
        marathon: useMarathon.getState().marathon,
        reminders: { enabled: reminders.enabled, notified: reminders.notified },
      },
      {
        sources: usePlayerSources.getState().sources,
        // Only the stored fields — the actions on the store are not data.
        prefs: {
          dataSaver: playerPrefs.dataSaver,
          watchPartyRelayUrl: playerPrefs.watchPartyRelayUrl,
          displayName: playerPrefs.displayName,
          sourceTemplates: playerPrefs.sourceTemplates,
        },
        hosts: getHosts(),
      },
      useGoals.getState().goals,
    );
    const blob = new Blob([backup], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cinemate-libreria-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    pushToast("success", "Libreria esportata.");
  }

  async function handleImportFile(file: File) {
    let backup;
    try {
      backup = parseBackup(await file.text());
    } catch (e) {
      pushToast("error", e instanceof BackupParseError ? e.message : "Impossibile leggere il file.");
      return;
    }
    const confirmed = window.confirm(
      `Importare ${backup.items.length} titoli? La libreria attuale (${items.length} titoli) verrà sostituita` +
        `${backup.player ? ", insieme alle sorgenti del player e agli host" : ""}.`,
    );
    if (!confirmed) return;
    importData(backup.items, backup.history);
    // Older files carry no saga section; leaving what is on the device alone is
    // safer than wiping orders the user may still want.
    if (backup.sagas) {
      useSagas.getState().restore({
        orders: backup.sagas.orders,
        preferredOrder: backup.sagas.preferredOrder,
        hidden: backup.sagas.hidden,
      });
      useMarathon.getState().restore(backup.sagas.marathon);
      useReminders.getState().restore(backup.sagas.reminders);
    }
    // Same rule as the saga section, applied one level deeper: a section the
    // file doesn't carry is one this device keeps. A file written before the
    // player existed, or a hand-edited one, can't wipe settings it says
    // nothing about.
    if (backup.player) {
      const { sources, prefs, hosts } = backup.player;
      if (sources !== undefined) usePlayerSources.getState().restore(sources);
      if (prefs !== undefined) usePlayerPrefs.getState().restore(prefs);
      if (hosts !== undefined) restoreHosts(hosts);
    }
    if (backup.goals !== undefined) useGoals.getState().restore(backup.goals);
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
          <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-text-faint">Chiave API TMDB</span>
          <p className="mb-2.5 text-xs leading-relaxed text-text-faint">
            Per copertine reali, trama, cast, trailer e disponibilità streaming legale. Gratuita — la ottieni in
            pochi minuti creando un account su themoviedb.org (Impostazioni → API). Resta anch'essa solo su questo
            dispositivo.
          </p>
          <div className="flex gap-2">
            <input
              type={revealTmdb ? "text" : "password"}
              value={draftTmdbKey}
              onChange={(e) => setDraftTmdbKey(e.target.value)}
              placeholder="Chiave API TMDB (v3)"
              autoComplete="off"
              className="flex-1 rounded-sm border border-border-strong bg-surface px-3 py-2.5 font-mono text-sm text-text placeholder:text-text-faint focus:border-accent"
            />
            <button
              type="button"
              onClick={() => setRevealTmdb((r) => !r)}
              aria-label={revealTmdb ? "Nascondi chiave" : "Mostra chiave"}
              className="rounded-sm border border-border-strong px-3 text-xs text-text-muted"
            >
              {revealTmdb ? "Nascondi" : "Mostra"}
            </button>
          </div>
          <div className="mt-2.5 flex gap-2">
            <button
              type="button"
              onClick={() => {
                setTmdbApiKey(draftTmdbKey);
                // A new key deserves a fresh go at titles that failed before.
                resetAutoLinkAttempts();
                pushToast("success", "Chiave TMDB salvata.");
              }}
              className="rounded-sm px-3.5 py-2 text-xs font-semibold"
              style={{ background: "var(--accent)", color: "var(--accent-contrast)" }}
            >
              Salva chiave
            </button>
            {tmdbApiKey && (
              <button
                type="button"
                onClick={() => {
                  clearTmdbApiKey();
                  setDraftTmdbKey("");
                  pushToast("info", "Chiave TMDB rimossa.");
                }}
                className="rounded-sm border border-border-strong px-3.5 py-2 text-xs text-text-muted"
              >
                Rimuovi
              </button>
            )}
          </div>
          <p className="mt-2.5 text-[11px] text-text-faint">
            Questo prodotto usa l'API TMDB ma non è approvato né certificato da TMDB. Dati streaming forniti da
            JustWatch.
          </p>
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

        <SourceTemplates />

        <div>
          <span className="mb-2 block text-xs font-medium uppercase tracking-wide text-text-faint">Dati locali</span>
          <p className="mb-2.5 text-xs leading-relaxed text-text-faint">
            Tutto vive solo in questo browser. Esporta ogni tanto un backup: è anche il modo per portare la libreria
            su un altro dispositivo.
          </p>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={exportData}
              disabled={items.length === 0}
              className="w-full rounded-sm border border-border-strong px-3.5 py-2.5 text-left text-sm text-text disabled:opacity-40"
            >
              Esporta libreria (JSON)
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full rounded-sm border border-border-strong px-3.5 py-2.5 text-left text-sm text-text"
            >
              Importa da backup…
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              className="sr-only"
              aria-label="Scegli un file di backup JSON"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) void handleImportFile(file);
              }}
            />
            <button
              type="button"
              disabled={items.length === 0}
              onClick={() => {
                if (window.confirm(`Svuotare la libreria? ${items.length} titoli e tutto il diario verranno eliminati da questo dispositivo.`)) {
                  clearAll();
                  // Saghe, maratona e promemoria descrivono la stessa libreria:
                  // lasciarli indietro significherebbe mostrare progressi di
                  // titoli che non esistono più.
                  useSagas.getState().clearAll();
                  useMarathon.getState().stop();
                  useReminders.getState().clearAll();
                }
              }}
              className="w-full rounded-sm border px-3.5 py-2.5 text-left text-sm disabled:opacity-40"
              style={{ borderColor: "color-mix(in srgb, var(--danger) 40%, transparent)", color: "var(--danger)" }}
            >
              Svuota la libreria
            </button>
          </div>
        </div>
      </div>
    </Sheet>
  );
}

export function SettingsSheetPortal() {
  const isOpen = useSettingsSheet((s) => s.isOpen);
  return <AnimatePresence>{isOpen && <SettingsForm />}</AnimatePresence>;
}
