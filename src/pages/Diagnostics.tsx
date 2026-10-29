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

const STATUS_COLOUR: Record<TestStatus, string> = {
  pass: "var(--success)",
  warn: "var(--warning)",
  fail: "var(--danger)",
  skip: "var(--text-faint)",
};

const STATUS_LABEL: Record<TestStatus, string> = {
  pass: "OK",
  warn: "Attenzione",
  fail: "Errore",
  skip: "Non attivo",
};

const SCOPE_LABEL: Record<ErrorScope, string> = {
  app: "App",
  tmdb: "TMDB",
  claude: "Claude",
  player: "Player",
  storage: "Memoria",
  rete: "Rete",
};

function when(ts: number): string {
  return new Date(ts).toLocaleString("it-IT", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
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
  if (hosts.length === 0) return <p className="text-sm text-text-muted">Nessun host configurato.</p>;

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
                  {stats.reliability30d}% · {stats.avgPingMs ?? "—"} ms
                </p>
              </div>
            </li>
          );
        })}
      </ul>
      {switches.length > 0 && (
        <p className="text-xs text-text-muted">
          Ultimo cambio host: {when(switches[0].at)} ({switches.length} negli ultimi giorni).
        </p>
      )}
    </div>
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
        <h1 className="t-display text-text">Diagnostica</h1>
        <p className="mt-1 text-sm text-text-muted">
          Cosa c'è sul dispositivo e cosa sta funzionando. Nessuno di questi dati esce di qui:
          non c'è nessun server a cui mandarli.
        </p>
      </div>

      <FigureBand
        label="Riepilogo"
        cols={2}
        smCols={4}
        figures={[
          { value: items.length, label: "titoli" },
          { value: history.length, label: "voci di diario" },
          { value: withSources, label: "con sorgente" },
          { value: errors.length, label: "errori registrati" },
        ]}
      />

      <Section
        title="Test automatici"
        action={
          <button
            type="button"
            onClick={run}
            disabled={running}
            className="btn btn-primary shrink-0"
          >
            {running ? "Eseguo…" : tests ? "Riesegui" : "Esegui i test"}
          </button>
        }
      >
        {tests === null ? (
          <p className="text-sm text-text-muted">
            Controlla memoria, chiavi API, host e notifiche. Alcuni test fanno una richiesta di rete
            vera, quindi partono solo quando li chiedi tu.
          </p>
        ) : (
          <>
            <p className="text-sm text-text-muted">
              {failures > 0
                ? `${failures} ${failures === 1 ? "problema" : "problemi"} da sistemare.`
                : warnings > 0
                  ? `Tutto funziona, con ${warnings} ${warnings === 1 ? "avviso" : "avvisi"}.`
                  : "Tutto a posto."}
            </p>
            <ul className="list-group" style={{ "--row-inset": "36px" } as React.CSSProperties}>
              {tests.map((t) => (
                <TestRow key={t.id} result={t} />
              ))}
            </ul>
          </>
        )}
      </Section>

      <Section title="Host">
        <HostSummary />
      </Section>

      <Section
        title="Log errori"
        action={
          errors.length > 0 ? (
            <button
              type="button"
              onClick={clearErrorLog}
              className="btn btn-secondary btn-sm shrink-0"
            >
              Svuota
            </button>
          ) : undefined
        }
      >
        {errors.length === 0 ? (
          <EmptyState
            title="Nessun errore registrato"
            description="Quando qualcosa va storto — una chiamata a TMDB rifiutata, un host che non risponde — finisce qui invece di sparire con il messaggio a schermo."
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

      <Section title="Backup">
        <p className="text-sm text-text-muted">
          Esporta e importa vivono in Impostazioni, dove stanno accanto al resto dei dati locali.
          Il file comprende libreria, diario, saghe, obiettivi, sorgenti del player e host.
        </p>
        <button
          type="button"
          onClick={() => openSettings("dati")}
          className="btn btn-secondary self-start"
        >
          Apri Dati e backup
        </button>
      </Section>
    </div>
  );
}
