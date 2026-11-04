import { useMemo, useRef, useState } from "react";
import { Sheet } from "./Sheet";
import { CheckIcon, ChevronDownIcon, UploadIcon, WarningIcon } from "./icons";
import { useLibrary } from "../store/useLibrary";
import { useSettings } from "../store/useSettings";
import { posterUrl, type TmdbSearchResult } from "../lib/tmdb";
import { ImportFormatError, mergeEntries, parseImportFile, SOURCE_LABEL, type ImportedEntry, type ImportSource } from "../lib/importers";
import { matchAll, type Match } from "../lib/importMatch";
import { findExisting, type Accepted } from "../lib/importApply";
import { isZip, unzip } from "../lib/unzip";
import { plural } from "../lib/format";
import { intlLocale, statusLabel, t } from "../lib/i18n";

/**
 * Portare dentro la storia tenuta altrove: Letterboxd, Trakt, IMDb, TV Time.
 *
 * Cinque passi, ognuno con una cosa sola da fare: scegliere i file, vedere
 * cosa c'è dentro, aspettare l'abbinamento, decidere i casi dubbi, leggere il
 * resoconto. I file si leggono qui, nel browser: escono solo i titoli che si
 * cercano su TMDB, con la tua chiave, come per ogni altra ricerca.
 */

type Step =
  | { kind: "pick" }
  | { kind: "summary"; entries: ImportedEntry[]; files: FileReport[] }
  | { kind: "matching"; total: number; done: number }
  | { kind: "review"; matches: Match[] }
  | { kind: "done"; added: number; updated: number; unchanged: number; left: ImportedEntry[]; chosen: number };

interface FileReport {
  name: string;
  source: ImportSource | null;
  count: number;
  error?: string;
}

const HOW_TO: { source: ImportSource; text: string }[] = [
  { source: "letterboxd", text: t("ImportSheet.settings_data_export_your") },
  { source: "trakt", text: t("ImportSheet.settings_your_data_export") },
  { source: "imdb", text: t("ImportSheet.la_pagina_dei_tuoi") },
  { source: "tvtime", text: t("ImportSheet.la_richiesta_dei_tuoi") },
];

const ACCEPT_IN_ZIP = (name: string) => /\.(csv|json)$/i.test(name) && !/(^|\/)(deleted|orphaned)\//i.test(name);

async function readFiles(files: File[]): Promise<{ entries: ImportedEntry[]; reports: FileReport[] }> {
  const all: ImportedEntry[] = [];
  const reports: FileReport[] = [];
  const parse = (name: string, text: string) => {
    try {
      const { source, entries } = parseImportFile(name, text);
      all.push(...entries);
      reports.push({ name, source, count: entries.length });
    } catch (e) {
      reports.push({ name, source: null, count: 0, error: e instanceof ImportFormatError ? e.message : t("ImportSheet.non_si_legge", { v0: name }) });
    }
  };
  for (const file of files) {
    const buffer = await file.arrayBuffer();
    if (isZip(buffer)) {
      try {
        for (const inner of await unzip(buffer, ACCEPT_IN_ZIP)) parse(inner.name, inner.text);
      } catch {
        reports.push({ name: file.name, source: null, count: 0, error: t("ImportSheet.lo_zip_non_si", { v0: file.name }) });
      }
    } else parse(file.name, new TextDecoder("utf-8").decode(buffer));
  }
  return { entries: mergeEntries(all), reports };
}

function entryLine(e: ImportedEntry) {
  const kind = e.mediaType === "tv" ? "serie" : "film";
  return [e.year, kind, e.sources.map((s) => SOURCE_LABEL[s]).join(" + ")].filter(Boolean).join(" · ");
}

export default function ImportSheet({ onClose }: { onClose: () => void }) {
  const tmdbApiKey = useSettings((s) => s.tmdbApiKey);
  const importEntries = useLibrary((s) => s.importEntries);
  const [step, setStep] = useState<Step>({ kind: "pick" });
  const [reading, setReading] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const abort = useRef<AbortController | null>(null);
  const titleId = "import-sheet-title";

  async function onFiles(list: FileList | null) {
    const files = [...(list ?? [])];
    if (files.length === 0) return;
    setReading(true);
    try {
      const { entries, reports } = await readFiles(files);
      setStep({ kind: "summary", entries, files: reports });
    } finally {
      setReading(false);
    }
  }

  async function match(entries: ImportedEntry[]) {
    const controller = new AbortController();
    abort.current = controller;
    setStep({ kind: "matching", total: entries.length, done: 0 });
    const matches = await matchAll(entries, tmdbApiKey, (done) => setStep({ kind: "matching", total: entries.length, done }), controller.signal);
    if (controller.signal.aborted) return;
    setStep({ kind: "review", matches });
  }

  function cancelMatching() {
    abort.current?.abort();
    setStep({ kind: "pick" });
  }

  function commit(accepted: Accepted[], left: ImportedEntry[], chosen: number) {
    const counts = importEntries(accepted);
    setStep({ kind: "done", ...counts, left, chosen });
  }

  function close() {
    abort.current?.abort();
    onClose();
  }

  return (
    <Sheet onClose={close} titleId={titleId} maxWidthClass="max-w-lg">
      <div className="flex flex-col gap-5 p-5 pt-8 sm:p-6">
        <div>
          <h2 id={titleId} className="t-title text-text">
            {t("ImportSheet.importa_da_un_altra")}
          </h2>
          <p className="mt-1 text-sm text-text-muted">
            {step.kind === "pick" && t("ImportSheet.letterboxd_trakt_imdb_tv")}
            {step.kind === "summary" && t("ImportSheet.ecco_cosa_c_e")}
            {step.kind === "matching" && t("ImportSheet.cerco_ogni_titolo_sul")}
            {step.kind === "review" && t("ImportSheet.controlla_i_casi_in")}
            {step.kind === "done" && t("ImportSheet.ecco_com_e_andata")}
          </p>
        </div>

        {step.kind === "pick" && (
          <>
            <ul className="list-group bg-surface-2 shadow-none" style={{ "--row-inset": "16px" } as React.CSSProperties}>
              {HOW_TO.map(({ source, text }) => (
                <li key={source} className="list-row flex-col items-start gap-0.5 py-3">
                  <span className="text-sm font-medium text-text">{SOURCE_LABEL[source]}</span>
                  <span className="text-xs text-text-muted">{text}</span>
                </li>
              ))}
            </ul>
            {!tmdbApiKey && (
              <p className="flex gap-2 text-sm text-text-muted">
                <span className="mt-0.5 shrink-0">
                  <WarningIcon size={16} />
                </span>
                <span>
                  {t("ImportSheet.senza_la_chiave_tmdb")}
                </span>
              </p>
            )}
            <button type="button" className="btn btn-primary self-start" disabled={reading} onClick={() => input.current?.click()}>
              <UploadIcon size={16} />
              {reading ? t("ImportSheet.leggo_i_file") : t("ImportSheet.scegli_i_file")}
            </button>
            <input
              ref={input}
              type="file"
              multiple
              accept=".csv,.json,.zip,text/csv,application/json,application/zip"
              className="sr-only"
              aria-label={t("ImportSheet.scegli_i_file_esportati")}
              onChange={(e) => {
                void onFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </>
        )}

        {step.kind === "summary" && (
          <Summary
            entries={step.entries}
            files={step.files}
            hasKey={!!tmdbApiKey}
            onBack={() => setStep({ kind: "pick" })}
            onMatch={() => void match(step.entries)}
            onPlain={() => commit(step.entries.map((entry) => ({ entry, pick: null })), [], 0)}
          />
        )}

        {step.kind === "matching" && (
          <div>
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-text">{t("ImportSheet.abbinamento")}</span>
              <span className="tabular text-text-muted" aria-live="polite">
                {step.done.toLocaleString(intlLocale())} {t("ImportSheet.di")} {step.total.toLocaleString(intlLocale())}
              </span>
            </div>
            <div
              className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-hover"
              role="progressbar"
              aria-label={t("ImportSheet.titoli_cercati_sul_catalogo")}
              aria-valuemin={0}
              aria-valuemax={step.total}
              aria-valuenow={step.done}
            >
              <div
                className="h-full rounded-full transition-[width] duration-300"
                style={{ width: `${step.total ? (step.done / step.total) * 100 : 0}%`, background: "var(--accent)" }}
              />
            </div>
            <button type="button" className="btn btn-plain btn-sm -ml-3 mt-3" onClick={cancelMatching}>
              {t("ImportSheet.annulla")}
            </button>
          </div>
        )}

        {step.kind === "review" && <Review matches={step.matches} onCommit={commit} />}

        {step.kind === "done" && <Report {...step} onClose={close} />}
      </div>
    </Sheet>
  );
}

function Summary({
  entries,
  files,
  hasKey,
  onBack,
  onMatch,
  onPlain,
}: {
  entries: ImportedEntry[];
  files: FileReport[];
  hasKey: boolean;
  onBack: () => void;
  onMatch: () => void;
  onPlain: () => void;
}) {
  const films = entries.filter((e) => e.mediaType !== "tv").length;
  const series = entries.length - films;
  const toWatch = entries.filter((e) => e.status === "Da vedere").length;
  const voted = entries.filter((e) => e.vote !== null).length;
  const episodes = entries.reduce((n, e) => n + e.episodes.length, 0);
  const read = files.filter((f) => !f.error);
  const skipped = files.filter((f) => f.error);

  return (
    <>
      {entries.length > 0 ? (
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {[
            [t("ImportSheet.film_2"), films],
            [t("ImportSheet.serie_2"), series],
            [statusLabel("Da vedere"), toWatch],
            [t("ImportSheet.con_il_voto"), voted],
            [t("ImportSheet.episodi"), episodes],
          ].map(([label, value]) => (
            <div key={label} className="rounded-md bg-surface-2 px-3 py-2.5">
              <dt className="text-xs text-text-muted">{label}</dt>
              <dd className="t-figure tabular text-text">{(value as number).toLocaleString(intlLocale())}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="text-sm text-text">{t("ImportSheet.in_questi_file_non")}</p>
      )}

      {read.length > 0 && (
        <p className="text-xs text-text-muted">
          {t("ImportSheet.letti")} {read.map((f) => `${f.name} (${f.source ? SOURCE_LABEL[f.source] : ""}, ${f.count})`).join(" · ")}
        </p>
      )}
      {skipped.length > 0 && (
        <details className="text-xs text-text-muted">
          <summary className="cursor-pointer">{plural(skipped.length, t("ImportSheet.file_lasciato_fuori"), t("ImportSheet.file_lasciati_fuori"))}</summary>
          <ul className="mt-1.5 flex flex-col gap-1">
            {skipped.map((f) => (
              <li key={f.name}>{f.error}</li>
            ))}
          </ul>
        </details>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {entries.length > 0 &&
          (hasKey ? (
            <button type="button" className="btn btn-primary" onClick={onMatch}>
              {t("ImportSheet.cerca")} {plural(entries.length, t("ImportSheet.titolo"), t("ImportSheet.titoli"))} {t("ImportSheet.sul_catalogo")}
            </button>
          ) : (
            <button type="button" className="btn btn-primary" onClick={onPlain}>
              {t("ImportSheet.importa_senza_abbinare")}
            </button>
          ))}
        <button type="button" className="btn btn-plain" onClick={onBack}>
          {t("ImportSheet.altri_file")}
        </button>
      </div>
    </>
  );
}

const PAGE = 40;

function Review({ matches, onCommit }: { matches: Match[]; onCommit: (accepted: Accepted[], left: ImportedEntry[], chosen: number) => void }) {
  const items = useLibrary((s) => s.items);
  const doubts = useMemo(() => matches.filter((m) => m.state === "doubt"), [matches]);
  const missing = useMemo(() => matches.filter((m) => m.state === "missing"), [matches]);
  const sure = matches.length - doubts.length - missing.length;
  // La scelta per ogni caso dubbio: un candidato, o `null` per «nessuno».
  const [choice, setChoice] = useState<Map<string, TmdbSearchResult | null>>(() => new Map(doubts.map((m) => [m.entry.key, m.pick])));
  const [addMissing, setAddMissing] = useState(false);
  const [shown, setShown] = useState(PAGE);

  const present = useMemo(
    () => matches.filter((m) => m.state === "sure" && findExisting(items, m.entry, m.pick)).length,
    [matches, items],
  );

  function confirm() {
    const accepted: Accepted[] = [];
    const left: ImportedEntry[] = [];
    let chosen = 0;
    for (const m of matches) {
      if (m.state === "sure") accepted.push({ entry: m.entry, pick: m.pick });
      else if (m.state === "doubt") {
        const pick = choice.get(m.entry.key) ?? null;
        if (pick) {
          accepted.push({ entry: m.entry, pick });
          chosen++;
        } else left.push(m.entry);
      } else if (addMissing) accepted.push({ entry: m.entry, pick: null });
      else left.push(m.entry);
    }
    onCommit(accepted, left, chosen);
  }

  const total = matches.length - (addMissing ? 0 : missing.length) - doubts.filter((m) => !choice.get(m.entry.key)).length;

  return (
    <>
      <dl className="grid grid-cols-3 gap-3">
        {[
          ["Sicuri", sure],
          [t("ImportSheet.da_verificare"), doubts.length],
          [t("ImportSheet.non_trovati"), missing.length],
        ].map(([label, value]) => (
          <div key={label} className="rounded-md bg-surface-2 px-3 py-2.5">
            <dt className="text-xs text-text-muted">{label}</dt>
            <dd className="t-figure tabular text-text">{(value as number).toLocaleString(intlLocale())}</dd>
          </div>
        ))}
      </dl>
      {present > 0 && (
        <p className="text-xs text-text-muted">
          {plural(present, t("ImportSheet.titolo_e_gia"), t("ImportSheet.titoli_sono_gia"))} {t("ImportSheet.in_libreria_non_entrano")}
        </p>
      )}

      {doubts.length > 0 && (
        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-medium text-text">{t("ImportSheet.da_verificare")}</h3>
          {doubts.slice(0, shown).map((m) => (
            <fieldset key={m.entry.key} className="rounded-md bg-surface-2 p-3">
              <legend className="sr-only">{m.entry.title}</legend>
              <p className="text-sm font-medium text-text">{m.entry.title}</p>
              <p className="text-xs text-text-muted">{t("ImportSheet.nel_file")} {entryLine(m.entry)}</p>
              <div className="mt-2 flex flex-col gap-1" role="radiogroup" aria-label={t("ImportSheet.quale_e", { v0: m.entry.title })}>
                {m.candidates.map((c) => (
                  <Candidate
                    key={`${c.mediaType}:${c.tmdbId}`}
                    candidate={c}
                    selected={choice.get(m.entry.key)?.tmdbId === c.tmdbId && choice.get(m.entry.key)?.mediaType === c.mediaType}
                    onSelect={() => setChoice(new Map(choice).set(m.entry.key, c))}
                  />
                ))}
                <button
                  type="button"
                  role="radio"
                  aria-checked={choice.get(m.entry.key) === null}
                  onClick={() => setChoice(new Map(choice).set(m.entry.key, null))}
                  className="flex min-h-11 items-center gap-3 rounded-sm px-2 text-left text-sm text-text-muted hover:bg-surface-hover"
                >
                  <Radio on={choice.get(m.entry.key) === null} />
                  {t("ImportSheet.nessuno_di_questi_lascialo")}
                </button>
              </div>
            </fieldset>
          ))}
          {doubts.length > shown && (
            <button type="button" className="btn btn-plain btn-sm -ml-3 self-start" onClick={() => setShown(shown + PAGE)}>
              <ChevronDownIcon size={16} />
              {t("ImportSheet.altri")} {Math.min(PAGE, doubts.length - shown)}
            </button>
          )}
        </section>
      )}

      {missing.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-medium text-text">{t("ImportSheet.non_trovati")}</h3>
          <p className="text-xs text-text-muted">
            {missing.some((m) => m.failed) && t("ImportSheet.per_alcuni_la_ricerca")}
            {missing
              .slice(0, 12)
              .map((m) => m.entry.title)
              .join(", ")}
            {missing.length > 12 && t("ImportSheet.e_altri", { v0: missing.length - 12 })}.
          </p>
          <button
            type="button"
            role="switch"
            aria-checked={addMissing}
            onClick={() => setAddMissing(!addMissing)}
            className="flex min-h-11 items-center justify-between gap-3 text-left text-sm text-text"
          >
            {t("ImportSheet.aggiungili_comunque_con_il")}
            <span aria-hidden="true" className="switch shrink-0" data-on={addMissing} />
          </button>
        </section>
      )}

      <button type="button" className="btn btn-primary self-start" disabled={total === 0} onClick={confirm}>
        {t("ImportSheet.importa")} {plural(total, t("ImportSheet.titolo"), t("ImportSheet.titoli"))}
      </button>
    </>
  );
}

function Radio({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden="true"
      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2"
      style={on ? { borderColor: "var(--accent)", background: "var(--accent)", color: "var(--accent-contrast)" } : { borderColor: "var(--border-strong)" }}
    >
      {on && <CheckIcon size={12} />}
    </span>
  );
}

function Candidate({ candidate, selected, onSelect }: { candidate: TmdbSearchResult; selected: boolean; onSelect: () => void }) {
  const poster = posterUrl(candidate.posterPath, "w92");
  const original = candidate.originalTitle && candidate.originalTitle !== candidate.title ? candidate.originalTitle : null;
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className="flex min-h-11 items-center gap-3 rounded-sm px-2 py-1.5 text-left hover:bg-surface-hover"
    >
      <Radio on={selected} />
      <span className="h-12 w-8 shrink-0 overflow-hidden rounded-xs bg-surface-hover">
        {poster && <img src={poster} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm text-text">{candidate.title}</span>
        <span className="block truncate text-xs text-text-muted">
          {[candidate.year, candidate.mediaType === "tv" ? t("ImportSheet.serie") : t("ImportSheet.film"), original].filter(Boolean).join(" · ")}
        </span>
      </span>
    </button>
  );
}

function Report({
  added,
  updated,
  unchanged,
  left,
  chosen,
  onClose,
}: {
  added: number;
  updated: number;
  unchanged: number;
  left: ImportedEntry[];
  chosen: number;
  onClose: () => void;
}) {
  const hasKey = useSettings((s) => !!s.tmdbApiKey);
  const rows: [string, number, string?][] = [
    [t("ImportSheet.aggiunti_alla_libreria"), added, chosen > 0 ? t("ImportSheet.di_cui_da_te", { v0: chosen, v1: chosen === 1 ? t("ImportSheet.scelto") : t("ImportSheet.scelti") }) : undefined],
    [t("ImportSheet.gia_presenti_completati"), updated],
    [t("ImportSheet.gia_presenti_niente_da"), unchanged],
    [t("ImportSheet.lasciati_fuori"), left.length, t("ImportSheet.non_trovati_o_scartati")],
  ];
  // Le righe a zero non dicono niente, tranne la prima: «0 aggiunti» è una risposta.
  const shown = rows.filter(([, value], i) => i === 0 || value > 0);
  return (
    <>
      <ul className="list-group bg-surface-2 shadow-none" style={{ "--row-inset": "16px" } as React.CSSProperties}>
        {shown.map(([label, value, note]) => (
          <li key={label} className="list-row min-h-12 justify-between py-2.5">
            <span>
              <span className="block text-sm text-text">{label}</span>
              {note && <span className="block text-xs text-text-muted">{note}</span>}
            </span>
            <span className="t-figure tabular text-text">{value.toLocaleString(intlLocale())}</span>
          </li>
        ))}
      </ul>
      {left.length > 0 && (
        <details className="text-xs text-text-muted">
          <summary className="cursor-pointer">{t("ImportSheet.quali_sono_rimasti_fuori")}</summary>
          <p className="mt-1.5">{left.map((e) => (e.year ? `${e.title} (${e.year})` : e.title)).join(", ")}.</p>
        </details>
      )}
      {added > 0 && hasKey && (
        <p className="text-xs text-text-muted">
          {t("ImportSheet.copertine_trame_e_durate")}
        </p>
      )}
      <button type="button" className="btn btn-primary self-start" onClick={onClose}>
        <CheckIcon size={16} />
        {t("ImportSheet.fatto")}
      </button>
    </>
  );
}
