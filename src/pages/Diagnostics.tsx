import { useState, useSyncExternalStore } from "react";
import { useLibrary } from "../store/useLibrary";
import { useSettings } from "../store/useSettings";
import { useSettingsSheet } from "../store/useSettingsSheet";
import { usePlayerSources } from "../store/usePlayerSources";
import { FigureBand } from "../components/Figures";
import { EmptyState } from "../components/EmptyState";
import { clearErrorLog, getErrorLog, subscribeErrorLog, type LoggedError, type ErrorScope } from "../lib/errorLog";
import { runSelfTests, type TestResult, type TestStatus } from "../lib/selfTest";
import { getHosts, computeHostStats, getSwitchLog } from "../player/services/hostStore";
import { CONFIRM_AFTER_DAYS, CONFIRM_AFTER_LAUNCHES, durable, type Backend, type StorageStatus } from "../lib/durable";
import { intlLocale, t } from "../lib/i18n";

const STATUS_COLOUR: Record<TestStatus, string> = {
  pass: "var(--success)",
  warn: "var(--warning)",
  fail: "var(--danger)",
  skip: "var(--text-faint)",
};

const STATUS_LABEL: Record<TestStatus, string> = {
  pass: "OK",
  warn: t("Diagnostics.attenzione"),
  fail: t("Diagnostics.errore"),
  skip: t("Diagnostics.non_attivo"),
};

const SCOPE_LABEL: Record<ErrorScope, string> = {
  app: "App",
  tmdb: "TMDB",
  claude: "Claude",
  player: "Player",
  storage: t("Diagnostics.memoria"),
  rete: t("Diagnostics.rete"),
};

function when(ts: number): string {
  return new Date(ts).toLocaleString(intlLocale(), { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="t-title text-text">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function TestRow({ result }: { result: TestResult }) {
  return (
    <li className="list-row items-start">
      <span
        aria-hidden
        className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
        style={{ background: STATUS_COLOUR[result.status] }}
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-text">{result.label}</p>
        <p className="mt-0.5 text-xs text-text-muted">{result.detail}</p>
      </div>
      <span className="shrink-0 text-xs font-medium" style={{ color: STATUS_COLOUR[result.status] }}>
        {STATUS_LABEL[result.status]}
      </span>
    </li>
  );
}

function HostSummary() {
  const hosts = getHosts();
  const switches = getSwitchLog(5);
  if (hosts.length === 0) return <p className="text-sm text-text-muted">{t("Diagnostics.nessun_host_configurato")}</p>;

  return (
    <div className="flex flex-col gap-3">
      <ul className="list-group" style={{ "--row-inset": "16px" } as React.CSSProperties}>
      {[...hosts]
        .sort((a, b) => a.priority - b.priority)
        .map((host) => {
          const stats = computeHostStats(host.id);
          return (
            <li key={host.id} className="list-row justify-between">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-text">{host.name}</p>
                <p className="truncate font-mono text-xs text-text-muted">{host.url}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="tabular text-sm font-semibold text-text">{stats.score}/100</p>
                <p className="tabular text-xs text-text-muted">
                  {stats.reliability30d}% · {stats.avgPingMs ?? "—"} {t("Diagnostics.ms")}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
      {switches.length > 0 && (
        <p className="text-xs text-text-muted">
          {t("Diagnostics.ultimo_cambio_host")} {when(switches[0].at)} ({switches.length} {t("Diagnostics.negli_ultimi_giorni")}
        </p>
      )}
    </div>
  );
}

const BACKEND_LABEL: Record<Backend, string> = {
  idb: "IndexedDB",
  local: "localStorage",
  unavailable: t("Diagnostics.non_raggiungibile"),
};

const DAY_MS = 86_400_000;

/**
 * Dove stanno i dati, e la copia di sicurezza della migrazione.
 *
 * La copia di prima del passaggio a IndexedDB resta finché la migrazione non è
 * confermata da sola (cinque avvii senza errori e una settimana). Qui si vede a
 * che punto è, e si può tornare indietro — dicendo prima cosa si perde.
 */
function StorageSection() {
  const [status, setStatus] = useState<StorageStatus>(() => durable.status());
  const [confirming, setConfirming] = useState<"restore" | null>(null);
  const [busy, setBusy] = useState(false);
  const meta = status.meta;
  const daysLeft = meta?.migratedAt
    ? Math.max(0, Math.ceil(CONFIRM_AFTER_DAYS - (Date.now() - Date.parse(meta.migratedAt)) / DAY_MS))
    : 0;
  const launchesLeft = meta ? Math.max(0, CONFIRM_AFTER_LAUNCHES - meta.launches) : 0;

  async function restore() {
    setBusy(true);
    const ok = await durable.restoreBackup();
    setBusy(false);
    setConfirming(null);
    // Gli store hanno letto i dati all'avvio: ricaricare è il modo pulito di
    // ripartire da quelli ripristinati.
    if (ok) location.reload();
  }

  async function confirmNow() {
    setBusy(true);
    await durable.confirmNow();
    setStatus(durable.status());
    setBusy(false);
  }

  return (
    <Section title={t("Diagnostics.archivio")}>
      <ul className="list-group" style={{ "--row-inset": "16px" } as React.CSSProperties}>
        <li className="list-row justify-between">
          <span className="text-sm text-text">{t("Diagnostics.dove_stanno_libreria_e")}</span>
          <span className="text-sm font-medium text-text">{BACKEND_LABEL[status.backend]}</span>
        </li>
        {meta?.migratedAt && (
          <li className="list-row justify-between">
            <span className="text-sm text-text">{t("Diagnostics.spostati_da_localstorage")}</span>
            <span className="tabular text-sm text-text-muted">{when(Date.parse(meta.migratedAt))}</span>
          </li>
        )}
        {status.backups.length > 0 && (
          <li className="list-row flex-col items-stretch gap-1">
            <span className="text-sm text-text">{t("Diagnostics.copia_di_prima_della")}</span>
            <span className="text-xs text-text-muted">
              {t("Diagnostics.si_cancella_da_sola")} {launchesLeft} {launchesLeft === 1 ? t("Diagnostics.avvio") : t("Diagnostics.avvii")}
              {daysLeft > 0 ? t("Diagnostics.e_almeno", { v0: daysLeft, v1: daysLeft === 1 ? t("Diagnostics.giorno") : t("Diagnostics.giorni") }) : ""}{t("Diagnostics.se_tutto_va_bene")}
            </span>
          </li>
        )}
      </ul>
      {status.reason && <p className="text-sm text-text-muted">{status.reason}</p>}

      {status.backups.length > 0 &&
        (confirming === "restore" ? (
          <div role="alert" aria-labelledby="restore-confirm" className="rounded-md bg-surface p-4 shadow-[var(--shadow-sm)]">
            <p id="restore-confirm" className="text-sm text-text">
              {t("Diagnostics.torno_ai_dati_com")}
            </p>
            <div className="mt-3 flex justify-end gap-2">
              <button type="button" onClick={() => setConfirming(null)} className="btn btn-secondary btn-sm">
                {t("Diagnostics.annulla")}
              </button>
              <button type="button" disabled={busy} onClick={() => void restore()} className="btn btn-danger-fill btn-sm">
                {t("Diagnostics.ripristina_la_copia")}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setConfirming("restore")} className="btn btn-secondary btn-sm">
              {t("Diagnostics.ripristina_la_copia")}
            </button>
            <button type="button" disabled={busy} onClick={() => void confirmNow()} className="btn btn-plain btn-sm">
              {t("Diagnostics.va_tutto_bene_eliminala")}
            </button>
          </div>
        ))}
    </Section>
  );
}

export function Diagnostics() {
  const items = useLibrary((s) => s.items);
  const history = useLibrary((s) => s.history);
  const sources = usePlayerSources((s) => s.sources);
  const tmdbApiKey = useSettings((s) => s.tmdbApiKey);
  const apiKey = useSettings((s) => s.apiKey);
  const openSettings = useSettingsSheet((s) => s.open);

  const errors = useSyncExternalStore(subscribeErrorLog, getErrorLog, getErrorLog);
  const [tests, setTests] = useState<TestResult[] | null>(null);
  const [running, setRunning] = useState(false);

  const run = async () => {
    setRunning(true);
    try {
      setTests(await runSelfTests({ tmdb: tmdbApiKey, anthropic: apiKey }));
    } finally {
      setRunning(false);
    }
  };

  const failures = tests?.filter((t) => t.status === "fail").length ?? 0;
  const warnings = tests?.filter((t) => t.status === "warn").length ?? 0;
  const withSources = Object.values(sources).filter((s) => s.manifestUrl || s.subtitles.length || s.markers.length).length;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-10 px-[var(--gutter)] py-6 sm:py-10">
      <div>
        <h1 className="t-display text-text">{t("page.diagnostics")}</h1>
        <p className="mt-1 text-sm text-text-muted">
          {t("Diagnostics.cosa_c_e_sul")}
        </p>
      </div>

      <FigureBand
        label={t("Diagnostics.riepilogo")}
        cols={2}
        smCols={4}
        figures={[
          { value: items.length, label: t("Diagnostics.titoli") },
          { value: history.length, label: t("Diagnostics.voci_di_diario") },
          { value: withSources, label: t("Diagnostics.con_sorgente") },
          { value: errors.length, label: t("Diagnostics.errori_registrati") },
        ]}
      />

      <Section
        title={t("Diagnostics.test_automatici")}
        action={
          <button
            type="button"
            onClick={run}
            disabled={running}
            className="btn btn-primary shrink-0"
          >
            {running ? t("Diagnostics.eseguo") : tests ? t("Diagnostics.riesegui") : t("Diagnostics.esegui_i_test")}
          </button>
        }
      >
        {tests === null ? (
          <p className="text-sm text-text-muted">
            {t("Diagnostics.controlla_memoria_chiavi_api")}
          </p>
        ) : (
          <>
            <p className="text-sm text-text-muted">
              {failures > 0
                ? t("Diagnostics.da_sistemare", { v0: failures, v1: failures === 1 ? t("Diagnostics.problema") : t("Diagnostics.problemi") })
                : warnings > 0
                  ? t("Diagnostics.tutto_funziona_con", { v0: warnings, v1: warnings === 1 ? t("Diagnostics.avviso") : t("Diagnostics.avvisi") })
                  : t("Diagnostics.tutto_a_posto")}
            </p>
            <ul className="list-group" style={{ "--row-inset": "36px" } as React.CSSProperties}>
              {tests.map((t) => (
                <TestRow key={t.id} result={t} />
              ))}
            </ul>
          </>
        )}
      </Section>

      <Section title={t("Diagnostics.host")}>
        <HostSummary />
      </Section>

      <Section
        title={t("Diagnostics.log_errori")}
        action={
          errors.length > 0 ? (
            <button
              type="button"
              onClick={clearErrorLog}
              className="btn btn-secondary btn-sm shrink-0"
            >
              {t("Diagnostics.svuota")}
            </button>
          ) : undefined
        }
      >
        {errors.length === 0 ? (
          <EmptyState
            title={t("Diagnostics.nessun_errore_registrato")}
            description={t("Diagnostics.quando_qualcosa_va_storto")}
          />
        ) : (
          <ul className="list-group" style={{ "--row-inset": "16px" } as React.CSSProperties}>
            {[...errors].reverse().map((error: LoggedError) => (
              <li key={error.id} className="list-row flex-col items-stretch gap-0">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-xs font-medium" style={{ color: "var(--danger)" }}>
                    {SCOPE_LABEL[error.scope]}
                  </span>
                  <span className="shrink-0 tabular text-xs text-text-muted">{when(error.at)}</span>
                </div>
                <p className="mt-1 break-words text-sm text-text">{error.message}</p>
                {error.source && <p className="mt-0.5 break-all font-mono text-xs text-text-muted">{error.source}</p>}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <StorageSection />

      <Section title={t("Diagnostics.backup")}>
        <p className="text-sm text-text-muted">
          {t("Diagnostics.esporta_e_importa_vivono")}
        </p>
        <button
          type="button"
          onClick={() => openSettings("dati")}
          className="btn btn-secondary self-start"
        >
          {t("Diagnostics.apri_dati_e_backup")}
        </button>
      </Section>
    </div>
  );
}
