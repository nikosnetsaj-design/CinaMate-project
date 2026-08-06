import { useState, useSyncExternalStore } from "react";
import { useLibrary } from "../store/useLibrary";
import { useSettings } from "../store/useSettings";
import { useSettingsSheet } from "../store/useSettingsSheet";
import { usePlayerSources } from "../store/usePlayerSources";
import { StatCard } from "../components/StatCard";
import { EmptyState } from "../components/EmptyState";
import { clearErrorLog, getErrorLog, subscribeErrorLog, type LoggedError, type ErrorScope } from "../lib/errorLog";
import { runSelfTests, type TestResult, type TestStatus } from "../lib/selfTest";
import { getHosts, computeHostStats, getSwitchLog } from "../player/services/hostStore";

const STATUS_COLOUR: Record<TestStatus, string> = {
  pass: "var(--status-done)",
  warn: "var(--yellow)",
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
        <h2 className="font-display text-xl font-semibold text-text">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function TestRow({ result }: { result: TestResult }) {
  return (
    <div className="flex items-start gap-3 rounded-md border border-border bg-surface-2 p-3.5">
      <span
        aria-hidden
        className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
        style={{ background: STATUS_COLOUR[result.status] }}
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-text">{result.label}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-text-faint">{result.detail}</p>
      </div>
      <span className="shrink-0 text-xs font-medium" style={{ color: STATUS_COLOUR[result.status] }}>
        {STATUS_LABEL[result.status]}
      </span>
    </div>
  );
}

function HostSummary() {
  const hosts = getHosts();
  const switches = getSwitchLog(5);
  if (hosts.length === 0) return <p className="text-sm text-text-faint">Nessun host configurato.</p>;

  return (
    <div className="flex flex-col gap-2">
      {[...hosts]
        .sort((a, b) => a.priority - b.priority)
        .map((host) => {
          const stats = computeHostStats(host.id);
          return (
            <div key={host.id} className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface-2 px-3.5 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm text-text">{host.name}</p>
                <p className="truncate font-mono text-[11px] text-text-faint">{host.url}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-mono tabular text-sm" style={{ color: "var(--accent-text)" }}>
                  {stats.score}/100
                </p>
                <p className="font-mono text-[11px] text-text-faint">
                  {stats.reliability30d}% · {stats.avgPingMs ?? "—"}ms
                </p>
              </div>
            </div>
          );
        })}
      {switches.length > 0 && (
        <p className="text-xs text-text-faint">
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
    <div className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-6 sm:px-6 sm:py-10">
      <div>
        <h1 className="font-display text-3xl font-semibold text-text">Diagnostica</h1>
        <p className="mt-1 text-sm text-text-muted">
          Cosa c'è sul dispositivo e cosa sta funzionando. Nessuno di questi dati esce di qui:
          non c'è nessun server a cui mandarli.
        </p>
      </div>

      <section aria-label="Riepilogo" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="titoli" value={String(items.length)} />
        <StatCard label="voci di diario" value={String(history.length)} />
        <StatCard label="con sorgente" value={String(withSources)} />
        <StatCard label="errori registrati" value={String(errors.length)} />
      </section>

      <Section
        title="Test automatici"
        action={
          <button
            type="button"
            onClick={run}
            disabled={running}
            className="shrink-0 rounded-sm px-3.5 py-2 text-sm font-semibold disabled:opacity-50"
            style={{ background: "var(--accent)", color: "var(--accent-contrast)" }}
          >
            {running ? "Eseguo…" : tests ? "Riesegui" : "Esegui i test"}
          </button>
        }
      >
        {tests === null ? (
          <p className="text-sm text-text-faint">
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
            <div className="flex flex-col gap-2">
              {tests.map((t) => (
                <TestRow key={t.id} result={t} />
              ))}
            </div>
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
              className="shrink-0 rounded-sm border border-border-strong px-3 py-1.5 text-xs text-text-muted hover:bg-surface-hover"
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
          <ul className="flex flex-col gap-1.5">
            {[...errors].reverse().map((error: LoggedError) => (
              <li key={error.id} className="rounded-md border border-border bg-surface-2 px-3.5 py-2.5">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-xs font-medium" style={{ color: "var(--danger)" }}>
                    {SCOPE_LABEL[error.scope]}
                  </span>
                  <span className="shrink-0 font-mono text-[11px] text-text-faint">{when(error.at)}</span>
                </div>
                <p className="mt-1 break-words text-sm text-text">{error.message}</p>
                {error.source && <p className="mt-0.5 break-all font-mono text-[11px] text-text-faint">{error.source}</p>}
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
          onClick={() => openSettings()}
          className="self-start rounded-sm border border-border-strong px-3.5 py-2.5 text-sm text-text hover:bg-surface-hover"
        >
          Apri Impostazioni
        </button>
      </Section>
    </div>
  );
}
