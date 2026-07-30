import type { StreamHost, HostRole, HostCheckResult, HostStats, HostSwitchEvent } from '../types';

const HOSTS_KEY = 'ppv:hosts';
const HISTORY_KEY_PREFIX = 'ppv:host-history:';
const ACTIVE_HOST_KEY = 'ppv:active-host';
const SWITCH_LOG_KEY = 'ppv:host-switch-log';

const HISTORY_MAX_ENTRIES = 300; // safety cap regardless of age
const HISTORY_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days, matches "reliability 30d"
const SWITCH_LOG_MAX_ENTRIES = 50;

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage full or unavailable — fail silently, this is best-effort persistence
  }
}

// ---------- Hosts CRUD ----------

// Starts genuinely empty. The standalone version of this player seeded three
// demo hosts (one live, two on the reserved `.invalid` TLD, to show offline
// detection); inside CineMate those would be three hosts the user never
// configured, permanently reading offline, which looks like a fault rather
// than a demo. The panel's empty state explains what to add instead.
export function getHosts(): StreamHost[] {
  return (snapshot ??= readJson<StreamHost[]>(HOSTS_KEY, []));
}

export function saveHosts(hosts: StreamHost[]) {
  writeJson(HOSTS_KEY, hosts);
  snapshot = hosts;
  for (const listener of listeners) listener();
}

// The host list is read outside the player too — a host you added here is one
// of the addresses "Guarda" tries for any title (see player/sourceAddresses.ts)
// — so it has to be observable, not just readable. The cached snapshot is what
// makes it usable from `useSyncExternalStore`, which needs the same array
// identity back until something actually changes.
let snapshot: StreamHost[] | null = null;
const listeners = new Set<() => void>();

export function subscribeHosts(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const ROLES: HostRole[] = ['primary', 'secondary', 'backup'];

function isHost(value: unknown): value is StreamHost {
  if (!value || typeof value !== 'object') return false;
  const h = value as StreamHost;
  return (
    typeof h.id === 'string' &&
    typeof h.name === 'string' &&
    typeof h.url === 'string' &&
    typeof h.priority === 'number' &&
    ROLES.includes(h.role)
  );
}

/**
 * Applies a host list from a backup. The check history is deliberately not
 * restored: it is measurements taken from *this* device's connection, and
 * carrying another device's ping times over would make the uptime and
 * reliability figures describe a network the user isn't on.
 */
export function restoreHosts(value: unknown): void {
  const hosts = Array.isArray(value) ? value.filter(isHost) : [];
  saveHosts(hosts);
  setActiveHostId(hosts.find(h => h.role === 'primary')?.id ?? hosts[0]?.id ?? null);
}

export function addHost(input: { name: string; url: string; role: StreamHost['role'] }): StreamHost {
  const hosts = getHosts();
  const host: StreamHost = {
    id: `host-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    name: input.name,
    url: input.url,
    role: input.role,
    priority: hosts.length,
  };
  saveHosts([...hosts, host]);
  return host;
}

export function updateHost(id: string, patch: Partial<Omit<StreamHost, 'id'>>) {
  saveHosts(getHosts().map(h => (h.id === id ? { ...h, ...patch } : h)));
}

export function removeHost(id: string) {
  saveHosts(getHosts().filter(h => h.id !== id));
  try {
    localStorage.removeItem(HISTORY_KEY_PREFIX + id);
  } catch {
    // best-effort cleanup
  }
}

// Applies a new drag-and-drop order: `orderedIds` is the full host id list in
// its new top-to-bottom order, and priority is recomputed to match (lower
// index = lower priority number = tried first).
export function reorderHosts(orderedIds: string[]) {
  const byId = new Map(getHosts().map(h => [h.id, h]));
  const reordered = orderedIds
    .map((id, index) => {
      const host = byId.get(id);
      return host ? { ...host, priority: index } : null;
    })
    .filter((h): h is StreamHost => h !== null);
  saveHosts(reordered);
}

// ---------- Check history + stats ----------

export function recordCheckResult(result: HostCheckResult) {
  const key = HISTORY_KEY_PREFIX + result.hostId;
  const cutoff = Date.now() - HISTORY_MAX_AGE_MS;
  const history = readJson<HostCheckResult[]>(key, []).filter(r => r.checkedAt >= cutoff);
  history.push(result);
  if (history.length > HISTORY_MAX_ENTRIES) history.splice(0, history.length - HISTORY_MAX_ENTRIES);
  writeJson(key, history);
}

export function getHostHistory(hostId: string, limit = 50): HostCheckResult[] {
  const history = readJson<HostCheckResult[]>(HISTORY_KEY_PREFIX + hostId, []);
  return history.slice(-limit).reverse(); // most recent first
}

export function getLatestResult(hostId: string): HostCheckResult | null {
  const history = readJson<HostCheckResult[]>(HISTORY_KEY_PREFIX + hostId, []);
  return history.length ? history[history.length - 1] : null;
}

export function computeHostStats(hostId: string): HostStats {
  const history = readJson<HostCheckResult[]>(HISTORY_KEY_PREFIX + hostId, []);
  const pings = history.map(r => r.pingMs).filter((p): p is number => p !== null);
  const thirtyDaysAgo = Date.now() - HISTORY_MAX_AGE_MS;
  const recent = history.filter(r => r.checkedAt >= thirtyDaysAgo);
  const recentOk = recent.filter(r => r.httpOk).length;
  const allOk = history.filter(r => r.httpOk).length;
  const lastDowntime = [...history].reverse().find(r => !r.httpOk);

  // "Tempo online" — a running duration, distinct from the uptime
  // percentage: how long since the last recorded failure (or since the
  // very first check, if it's never failed).
  let currentUptimeMs: number | null = null;
  if (history.length) {
    const since = lastDowntime ? lastDowntime.checkedAt : history[0].checkedAt;
    currentUptimeMs = Math.max(0, Date.now() - since);
  }

  return {
    hostId,
    avgPingMs: pings.length ? Math.round(pings.reduce((s, p) => s + p, 0) / pings.length) : null,
    minPingMs: pings.length ? Math.min(...pings) : null,
    maxPingMs: pings.length ? Math.max(...pings) : null,
    uptimePercent: history.length ? Math.round((allOk / history.length) * 1000) / 10 : 0,
    reliability30d: recent.length ? Math.round((recentOk / recent.length) * 1000) / 10 : 0,
    errorCount: history.filter(r => !r.httpOk).length,
    checksCount: history.length,
    lastDowntimeAt: lastDowntime?.checkedAt ?? null,
    currentUptimeMs,
  };
}

// ---------- Active host + switch log ----------

export function getActiveHostId(): string | null {
  return readJson<string | null>(ACTIVE_HOST_KEY, null);
}

export function setActiveHostId(id: string | null) {
  writeJson(ACTIVE_HOST_KEY, id);
}

export function logSwitch(event: Omit<HostSwitchEvent, 'id'>) {
  const log = readJson<HostSwitchEvent[]>(SWITCH_LOG_KEY, []);
  log.push({ ...event, id: `sw-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}` });
  if (log.length > SWITCH_LOG_MAX_ENTRIES) log.splice(0, log.length - SWITCH_LOG_MAX_ENTRIES);
  writeJson(SWITCH_LOG_KEY, log);
}

export function getSwitchLog(limit = 30): HostSwitchEvent[] {
  const log = readJson<HostSwitchEvent[]>(SWITCH_LOG_KEY, []);
  return log.slice(-limit).reverse();
}
