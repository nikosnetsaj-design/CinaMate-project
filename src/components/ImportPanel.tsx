import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLibrary } from "../store/useLibrary";
import { useLists } from "../store/useLists";
import { useSettings } from "../store/useSettings";
import { useSettingsSheet } from "../store/useSettingsSheet";
import {
  DEFAULT_IMPORT_OPTIONS,
  planImport,
  readImportFiles,
  SOURCE_LABELS,
  type ImportBundle,
  type ImportMatch,
  type ImportOptions,
  type SourceFile,
} from "../lib/importers";
import { matchAll, type MatchProgress } from "../lib/importMatch";
import { readZipCsvs, zipSupported, ZipError } from "../lib/zip";
import { posterUrl, TmdbAbortError, TmdbApiError } from "../lib/tmdb";
import { resetAutoLinkAttempts } from "../lib/useAutoLinkTmdb";
import { CheckIcon, UploadIcon, WarningIcon } from "./icons";
import type { Status } from "../types";

/**
 * «Ho già tutto su Letterboxd»: il pannello che porta qui anni di diario.
 *
 * Quattro tempi, uno per schermata, e nessuno scrive niente prima
 * dell'ultimo: scegli i file → li riconosco su TMDB → ti dico cosa farò →
 * lo faccio. La terza schermata è il punto del pannello intero: un import
 * che scrive senza dire prima cosa scriverà è un import da cui non si torna
 * indietro, e qui una libreria di trecento titoli ne riceve duemila in un
 * colpo.
 */

const HOW_TO: { source: string; steps: string }[] = [
  {
    source: "Letterboxd",
    steps: "Sul sito: Settings → Data → Export your data. Arriva uno ZIP: sceglilo così com'è, senza aprirlo.",
  },
  {
    source: "IMDb",
    steps: "Dalla pagina dei tuoi voti, e da quella della watchlist: menu ⋯ → Export. Il CSV compare poco dopo fra i tuoi export.",
  },
  {
    source: "Netflix",
    steps: "Account → profilo → Attività di visione → Scarica tutto, in fondo alla pagina. Un profilo per volta.",
  },
  {
    source: "Altro",
    steps: "Qualunque CSV con una colonna Titolo (o Title, Name): Trakt e Plex esportati per Letterboxd, un foglio di calcolo, quello che esporta CineMate.",
  },
];

type Phase =
  | { step: "choose"; error?: string }
  | { step: "reading" }
  | { step: "matching"; bundle: ImportBundle; progress: MatchProgress }
  | { step: "review"; bundle: ImportBundle; matches: Map<string, ImportMatch | null>; note?: string; failed?: string }
  | {
      step: "done";
      added: number;
      updated: number;
      logged: number;
      lists: number;
      saved: boolean;
    };

/**
 * Un CSV salvato dall'Excel italiano è spesso in Windows-1252, non in UTF-8:
 * letto come UTF-8, «Città» diventerebbe «Citt�». Si prova UTF-8 in modo
 * rigoroso e, se non è UTF-8 valido, si rilegge nell'altra codifica.
 */
async function readText(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder("windows-1252").decode(buffer);
  }
}

async function readChosenFiles(list: FileList): Promise<SourceFile[]> {
  const out: SourceFile[] = [];
  for (const file of Array.from(list)) {
    const lower = file.name.toLowerCase();
    if (lower.endsWith(".zip") || file.type.includes("zip")) {
      if (!zipSupported()) throw new ZipError("Questo browser non sa aprire gli ZIP: estrai l'archivio e scegli i file CSV che contiene.");
      out.push(...(await readZipCsvs(await file.arrayBuffer())));
    } else {
      out.push({ name: file.name, text: await readText(file) });
    }
  }
  return out;
}

/** Gli stati come si dicono dopo un numero: «1 visto», «6 visti». */
const STATUS_WORDS: Record<Status, [string, string]> = {
  Visto: ["visto", "visti"],
  "In visione": ["in visione", "in visione"],
  "Da vedere": ["da vedere", "da vedere"],
  Abbandonato: ["abbandonato", "abbandonati"],
  "In pausa": ["in pausa", "in pausa"],
};

/** «Letterboxd, Netflix e IMDb», con la virgola e la «e» dove vanno. */
const listFormat = new Intl.ListFormat("it", { type: "conjunction" });

function plural(n: number, one: string, many: string): string {
  return `${n.toLocaleString("it-IT")} ${n === 1 ? one : many}`;
}

function minutesLeft(progress: MatchProgress, startedAt: number): string | null {
  const done = progress.done;
  if (done < 8) return null;
  const perTitle = (Date.now() - startedAt) / done;
  const seconds = Math.round(((progress.total - done) * perTitle) / 1000);
  if (seconds < 50) return "meno di un minuto";
  const minutes = Math.round(seconds / 60);
  return minutes === 1 ? "circa un minuto" : `circa ${minutes} minuti`;
}

/** Il tetto pratico di `localStorage`, in caratteri, con un margine per il resto dell'app. */
const STORAGE_BUDGET = 4_500_000;
/** Quanto pesa un titolo dopo che la passata in sottofondo gli ha dato trama, cast e il resto. */
const CHARS_PER_LINKED_ITEM = 1_400;

function Switch({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="list-row gap-3 py-2.5">
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-text">{label}</span>
        <span className="block text-xs text-text-muted">{hint}</span>
      </span>
      <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)} className="switch" />
    </div>
  );
}

export function ImportPanel({ onFinished }: { onFinished: () => void }) {
  const tmdbApiKey = useSettings((s) => s.tmdbApiKey);
  const items = useLibrary((s) => s.items);
  const history = useLibrary((s) => s.history);
  const closeSheet = useSettingsSheet((s) => s.close);
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>({ step: "choose" });
  const [options, setOptions] = useState<ImportOptions>(DEFAULT_IMPORT_OPTIONS);
  const fileRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const knownRef = useRef(new Map<string, ImportMatch | null>());
  const startedRef = useRef(0);

  // Chiudere il foglio a metà riconoscimento ferma le richieste: nessuno
  // aspetta più quella risposta.
  useEffect(() => () => abortRef.current?.abort(), []);

  async function runMatching(bundle: ImportBundle) {
    if (!tmdbApiKey) {
      setPhase({
        step: "review",
        bundle,
        matches: new Map(),
        note: "Senza la chiave TMDB i titoli entrano col nome del file e senza copertina. Quando la aggiungi, si collegano da soli.",
      });
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    startedRef.current = Date.now();
    setPhase({ step: "matching", bundle, progress: { done: 0, total: bundle.titles.length, matched: 0 } });
    try {
      const matches = await matchAll(bundle.titles, tmdbApiKey, {
        signal: controller.signal,
        known: knownRef.current,
        onProgress: (progress) => setPhase((p) => (p.step === "matching" ? { ...p, progress } : p)),
      });
      knownRef.current = matches;
      setPhase({ step: "review", bundle, matches });
    } catch (e) {
      const partial = new Map(knownRef.current);
      if (e instanceof TmdbAbortError) {
        // Interrotto da te: si va avanti con quello che c'è.
        if (controller.signal.aborted && abortRef.current === controller) {
          setPhase({
            step: "review",
            bundle,
            matches: partial,
            note: `Riconoscimento interrotto a ${partial.size} titoli su ${bundle.titles.length}. Gli altri entrano col nome del file, e la passata in sottofondo prova a collegarli più tardi.`,
          });
        }
        return;
      }
      setPhase({
        step: "review",
        bundle,
        matches: partial,
        failed: e instanceof TmdbApiError ? e.message : "TMDB non ha risposto.",
      });
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  }

  async function onFiles(list: FileList) {
    setPhase({ step: "reading" });
    knownRef.current = new Map();
    let files: SourceFile[];
    try {
      files = await readChosenFiles(list);
    } catch (e) {
      setPhase({ step: "choose", error: e instanceof ZipError ? e.message : "Non riesco a leggere questi file." });
      return;
    }
    const bundle = readImportFiles(files);
    if (bundle.titles.length === 0) {
      const names = bundle.files.map((f) => f.name).slice(0, 4).join(", ");
      setPhase({
        step: "choose",
        error: names
          ? `In ${names} non ho trovato titoli che so leggere. Servono i file di Letterboxd, IMDb o Netflix, o un CSV con una colonna Titolo.`
          : "Nessun file CSV fra quelli scelti.",
      });
      return;
    }
    await runMatching(bundle);
  }

  const plan = useMemo(
    () => (phase.step === "review" ? planImport(phase.bundle, items, history, phase.matches, options) : null),
    [phase, items, history, options],
  );

  function apply() {
    if (phase.step !== "review" || !plan) return;
    const result = useLibrary.getState().mergeImported(plan.incoming, plan.updates, plan.diary, plan.addedDates);
    const lists = useLists.getState();
    let listCount = 0;
    for (const list of plan.lists) {
      const ids = list.members.map((m) => ("index" in m ? result.createdIds[m.index] : m.itemId)).filter((id): id is string => !!id);
      if (!ids.length) continue;
      // Un secondo import della stessa lista la completa invece di duplicarla.
      const same = lists.lists.find((l) => l.name.toLocaleLowerCase("it") === list.name.toLocaleLowerCase("it"));
      if (same) lists.addItems(same.id, ids);
      else lists.create(list.name, ids);
      listCount++;
    }
    // I titoli che l'import ha collegato a TMDB vanno completati anche se in
    // questa sessione la passata li aveva già provati a vuoto.
    resetAutoLinkAttempts();
    setPhase({ step: "done", added: result.added, updated: plan.summary.updated, logged: result.logged, lists: listCount, saved: result.saved });
  }

  const input = (
    <input
      ref={fileRef}
      type="file"
      multiple
      accept=".zip,.csv,text/csv,application/zip,application/x-zip-compressed"
      className="sr-only"
      aria-label="Scegli i file da importare: ZIP o CSV"
      onChange={(e) => {
        const list = e.target.files;
        if (list && list.length) void onFiles(list);
        e.target.value = "";
      }}
    />
  );

  if (phase.step === "choose") {
    return (
      <div className="flex flex-col gap-5">
        <p className="text-sm text-text-muted">
          I titoli che hai visto, i voti, il diario con le date vere e le liste entrano nella libreria che hai già. Niente
          viene sostituito: quello che hai scritto qui vince, e prima di unire ti dico cosa farò.
        </p>
        <dl className="list-group bg-surface-2 shadow-none" style={{ "--row-inset": "16px" } as React.CSSProperties}>
          {HOW_TO.map((h) => (
            <div key={h.source} className="list-row flex-col items-start gap-0.5">
              <dt className="text-sm font-semibold text-text">{h.source}</dt>
              <dd className="text-xs text-text-muted">{h.steps}</dd>
            </div>
          ))}
        </dl>
        {phase.error && (
          <p role="alert" className="flex gap-2 rounded-md bg-surface-2 p-3 text-sm text-text">
            <span className="mt-0.5 shrink-0" style={{ color: "var(--warning)" }}>
              <WarningIcon size={16} />
            </span>
            {phase.error}
          </p>
        )}
        <button type="button" onClick={() => fileRef.current?.click()} className="btn btn-primary btn-block">
          <UploadIcon size={18} />
          Scegli i file
        </button>
        <p className="text-xs text-text-muted">
          Puoi sceglierne più d'uno insieme — i voti e la watchlist di IMDb, per esempio. I file restano su questo
          dispositivo: si leggono qui, e a TMDB arrivano solo i titoli da riconoscere.
        </p>
        {input}
      </div>
    );
  }

  if (phase.step === "reading") {
    return (
      <div className="flex items-center gap-3 py-6 text-sm text-text-muted" role="status">
        <span
          className="spinner h-4 w-4 rounded-full border-2"
          style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }}
          aria-hidden="true"
        />
        Leggo i file…
      </div>
    );
  }

  if (phase.step === "matching") {
    const { progress } = phase;
    const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;
    const eta = minutesLeft(progress, startedRef.current);
    return (
      <div className="flex flex-col gap-4">
        <div>
          <p className="text-base font-semibold text-text">Riconosco i titoli su TMDB</p>
          <p className="mt-1 text-sm text-text-muted" aria-live="polite">
            <span className="tabular">{progress.done.toLocaleString("it-IT")}</span> di{" "}
            <span className="tabular">{progress.total.toLocaleString("it-IT")}</span>
            {eta ? ` · ${eta}` : ""}
          </p>
        </div>
        <div
          className="h-1.5 overflow-hidden rounded-full bg-surface-2"
          role="progressbar"
          aria-label="Titoli riconosciuti"
          aria-valuemin={0}
          aria-valuemax={progress.total}
          aria-valuenow={progress.done}
        >
          <div className="h-full rounded-full bg-accent transition-[width] duration-300" style={{ width: `${pct}%` }} />
        </div>
        <p className="text-xs text-text-muted">
          Un titolo alla volta per nome e anno, o per id IMDb quando c'è: è quello che evita i doppioni in due lingue e il
          remake al posto dell'originale. Puoi lasciare il foglio aperto e fare altro.
        </p>
        <button type="button" onClick={() => abortRef.current?.abort()} className="btn btn-secondary btn-sm self-start">
          Interrompi e continua con questi
        </button>
      </div>
    );
  }

  if (phase.step === "done") {
    return (
      <div className="flex flex-col gap-4">
        <p className="flex items-center gap-2 text-base font-semibold text-text">
          <span style={{ color: phase.saved ? "var(--success)" : "var(--warning)" }}>
            {phase.saved ? <CheckIcon size={20} /> : <WarningIcon size={20} />}
          </span>
          {phase.saved ? "Fatto." : "Unito, ma non salvato."}
        </p>
        <ul className="flex flex-col gap-1 text-sm text-text">
          <li>{plural(phase.added, "titolo aggiunto", "titoli aggiunti")}</li>
          {phase.updated > 0 && <li>{plural(phase.updated, "titolo che avevi già, completato", "titoli che avevi già, completati")}</li>}
          {phase.logged > 0 && <li>{plural(phase.logged, "voce nel diario", "voci nel diario")}</li>}
          {phase.lists > 0 && <li>{plural(phase.lists, "lista", "liste")}</li>}
        </ul>
        <p className="text-sm text-text-muted">
          {!phase.saved
            ? "La memoria del browser è piena: i titoli si vedono finché non chiudi l'app. Esporta un backup adesso, poi prova a togliere qualcosa."
            : tmdbApiKey
              ? "Copertine, trama e cast arrivano da soli nei prossimi minuti, un titolo alla volta."
              : "Aggiungi la chiave TMDB in «Chiavi e modello»: le copertine arrivano da sole."}
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              closeSheet();
              navigate("/libreria");
            }}
            className="btn btn-primary btn-sm"
          >
            Apri la libreria
          </button>
          <button type="button" onClick={onFinished} className="btn btn-secondary btn-sm">
            Fatto
          </button>
        </div>
      </div>
    );
  }

  // Revisione.
  const { bundle, matches } = phase;
  const summary = plan!.summary;
  const unmatchedTitles = matches.size
    ? bundle.titles.filter((t) => matches.has(t.key) && matches.get(t.key) === null && !t.tmdbId && !t.listOnly).slice(0, 40)
    : [];
  const posters = plan!.incoming.filter((i) => i.posterPath).slice(0, 14);
  const sources = Array.from(new Set(bundle.files.map((f) => f.source).filter((s): s is NonNullable<typeof s> => !!s)));
  const estimatedChars = JSON.stringify(items).length + JSON.stringify(history).length + plan!.incoming.length * CHARS_PER_LINKED_ITEM;
  const tooBig = estimatedChars > STORAGE_BUDGET;
  const watchlistCount = bundle.titles.filter((t) => t.status === "Da vedere" && !t.listOnly).length;
  const statusLine = (Object.entries(summary.addedByStatus) as [Status, number][])
    .filter(([, n]) => n > 0)
    .map(([s, n]) => `${n.toLocaleString("it-IT")} ${STATUS_WORDS[s][n === 1 ? 0 : 1]}`)
    .join(" · ");

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-base font-semibold text-text">
          Da {sources.length ? listFormat.format(sources.map((s) => SOURCE_LABELS[s])) : "file"}:{" "}
          {plural(bundle.titles.length, "titolo", "titoli")}
        </p>
        <ul className="mt-2 flex flex-col gap-0.5 text-xs text-text-muted">
          {bundle.files.slice(0, 8).map((f) => (
            <li key={f.name} className="flex gap-2">
              <span className="min-w-0 flex-1 truncate">{f.name}</span>
              <span className="shrink-0">
                {f.label}
                {f.rows ? ` · ${f.rows.toLocaleString("it-IT")}` : ""}
              </span>
            </li>
          ))}
          {bundle.files.length > 8 && <li>e altri {bundle.files.length - 8} file</li>}
        </ul>
      </div>

      {phase.failed && (
        <div role="alert" className="rounded-md bg-surface-2 p-3 text-sm text-text">
          <p className="flex gap-2">
            <span className="mt-0.5 shrink-0" style={{ color: "var(--warning)" }}>
              <WarningIcon size={16} />
            </span>
            Il riconoscimento si è fermato: {phase.failed} {matches.size} titoli su {bundle.titles.length} sono già
            riconosciuti.
          </p>
          <button type="button" onClick={() => void runMatching(bundle)} className="btn btn-secondary btn-sm mt-3">
            Riprendi da dove si è fermato
          </button>
        </div>
      )}
      {phase.note && <p className="text-sm text-text-muted">{phase.note}</p>}

      {posters.length > 0 && (
        <div className="flex gap-1.5 overflow-hidden" aria-hidden="true">
          {posters.map((p, i) => (
            <img key={i} src={posterUrl(p.posterPath, "w92") ?? undefined} alt="" loading="lazy" className="h-[60px] w-10 shrink-0 rounded-xs object-cover" />
          ))}
        </div>
      )}

      <ul className="list-group bg-surface-2 shadow-none" style={{ "--row-inset": "16px" } as React.CSSProperties}>
        <li className="list-row flex-col items-start gap-0.5">
          <span className="text-sm font-medium text-text">{plural(summary.added, "titolo nuovo", "titoli nuovi")}</span>
          {statusLine && <span className="text-xs text-text-muted">{statusLine}</span>}
        </li>
        {summary.updated > 0 && (
          <li className="list-row flex-col items-start gap-0.5">
            <span className="text-sm font-medium text-text">{plural(summary.updated, "titolo che hai già", "titoli che hai già")}</span>
            <span className="text-xs text-text-muted">Si riempie solo ciò che è vuoto: i tuoi voti e i tuoi stati restano.</span>
          </li>
        )}
        <li className="list-row flex-col items-start gap-0.5">
          <span className="text-sm font-medium text-text">{plural(summary.diary, "voce nel diario", "voci nel diario")}</span>
          <span className="text-xs text-text-muted">
            Solo le visioni con una data vera.
            {summary.duplicateDiary > 0 ? ` ${plural(summary.duplicateDiary, "c'era già", "c'erano già")}, e restano una.` : ""}
          </span>
        </li>
        {summary.lists > 0 && (
          <li className="list-row">
            <span className="text-sm font-medium text-text">{plural(summary.lists, "lista", "liste")}</span>
          </li>
        )}
        {summary.unmatched > 0 && (
          <li className="list-row flex-col items-start gap-1">
            <span className="text-sm font-medium text-text">{plural(summary.unmatched, "titolo non riconosciuto", "titoli non riconosciuti")}</span>
            {unmatchedTitles.length > 0 && (
              <details className="w-full text-xs text-text-muted">
                <summary className="cursor-pointer">Quali</summary>
                <p className="mt-1">
                  {unmatchedTitles.map((t) => `${t.title}${t.year ? ` (${t.year})` : ""}`).join(" · ")}
                  {summary.unmatched > unmatchedTitles.length ? " · …" : ""}
                </p>
              </details>
            )}
          </li>
        )}
        {bundle.skipped.map((s) => (
          <li key={s.reason} className="list-row">
            <span className="text-xs text-text-muted">
              Lasciati fuori: {s.count.toLocaleString("it-IT")} {s.reason}
            </span>
          </li>
        ))}
      </ul>

      <div className="list-group bg-surface-2 shadow-none" style={{ "--row-inset": "16px" } as React.CSSProperties}>
        {watchlistCount > 0 && (
          <Switch
            label="La watchlist"
            hint={`${plural(watchlistCount, "titolo entra", "titoli entrano")} come «Da vedere».`}
            checked={options.watchlist}
            onChange={(watchlist) => setOptions((o) => ({ ...o, watchlist }))}
          />
        )}
        {bundle.lists.length > 0 && (
          <Switch
            label="Le liste"
            hint="Diventano liste di CineMate; i film che ci sono solo lì entrano come «Da vedere»."
            checked={options.lists}
            onChange={(lists) => setOptions((o) => ({ ...o, lists }))}
          />
        )}
        {summary.unmatched > 0 && (
          <Switch
            label="Anche i non riconosciuti"
            hint="Entrano col nome del file, senza copertina; puoi collegarli dalla loro scheda."
            checked={options.unmatched}
            onChange={(unmatched) => setOptions((o) => ({ ...o, unmatched }))}
          />
        )}
      </div>

      {tooBig && (
        <p role="note" className="flex gap-2 rounded-md bg-surface-2 p-3 text-sm text-text">
          <span className="mt-0.5 shrink-0" style={{ color: "var(--warning)" }}>
            <WarningIcon size={16} />
          </span>
          La libreria vive nella memoria del browser, che ha un tetto di pochi megabyte, e con questi titoli rischia di
          riempirsi quando arriveranno trame e cast. Se puoi, lascia fuori la watchlist.
        </p>
      )}

      <div className="flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={() => {
            abortRef.current?.abort();
            setPhase({ step: "choose" });
          }}
          className="btn btn-secondary btn-sm"
        >
          Annulla
        </button>
        <button type="button" onClick={apply} disabled={summary.added + summary.updated === 0 && summary.diary === 0} className="btn btn-primary btn-sm">
          Unisci alla libreria
        </button>
      </div>
    </div>
  );
}
