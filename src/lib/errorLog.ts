const KEY = "cinemate:error-log:v1";
const MAX_ENTRIES = 60;

export type ErrorScope = "app" | "tmdb" | "claude" | "player" | "storage" | "rete";

export interface LoggedError {
  id: string;
  at: number;
  scope: ErrorScope;
  message: string;
  /** Where it happened, when the browser tells us. */
  source?: string;
}

/**
 * A ring buffer of what went wrong, kept on the device.
 *
 * There is no server to send crash reports to and deliberately no telemetry,
 * which normally means a failure leaves nothing behind but a toast the user
 * has already dismissed. This is the substitute: enough to answer "why did the
 * covers stop loading yesterday" without anything leaving the browser.
 *
 * Bounded on purpose. An error log that grows without limit eventually fills
 * the same storage quota the library lives in — and the library is the thing
 * worth keeping.
 */
function read(): LoggedError[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as LoggedError[]) : [];
  } catch {
    return [];
  }
}

function write(entries: LoggedError[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(entries));
  } catch {
    // If even the log can't be written, storage is the problem being logged.
    // Failing silently is the only option that doesn't recurse.
  }
}

const listeners = new Set<() => void>();

export function subscribeErrorLog(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

let snapshot: LoggedError[] | null = null;

export function getErrorLog(): LoggedError[] {
  return (snapshot ??= read());
}

export function logError(scope: ErrorScope, message: string, source?: string) {
  const entries = getErrorLog();
  const last = entries[entries.length - 1];
  // Collapse an identical error repeating within a minute. A failing poll can
  // otherwise write the same line sixty times and push everything useful out
  // of the buffer.
  if (last && last.scope === scope && last.message === message && Date.now() - last.at < 60_000) return;

  const next = [
    ...entries,
    {
      id: `err-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      at: Date.now(),
      scope,
      message: message.slice(0, 400),
      ...(source ? { source: source.slice(0, 200) } : {}),
    },
  ];
  if (next.length > MAX_ENTRIES) next.splice(0, next.length - MAX_ENTRIES);
  snapshot = next;
  write(next);
  for (const listener of listeners) listener();
}

export function clearErrorLog() {
  snapshot = [];
  write([]);
  for (const listener of listeners) listener();
}

/**
 * Catches what nothing else does: an exception that escaped a component, and a
 * promise rejection nobody handled. Both are exactly the failures that
 * otherwise leave no trace at all — a caught error at least produced a toast.
 */
export function installGlobalErrorCapture() {
  window.addEventListener("error", (event) => {
    logError("app", event.message || "Errore sconosciuto", event.filename ? `${event.filename}:${event.lineno}` : undefined);
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    const message =
      reason instanceof Error ? `${reason.name}: ${reason.message}` : String(reason ?? "Promise rifiutata");
    logError("app", message);
  });
}
