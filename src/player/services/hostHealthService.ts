import type { StreamHost, HostCheckResult, HostCheckError, HostStatus } from '../types';

// ---------------------------------------------------------------------------
// What this actually measures — please read before trusting the numbers.
//
// - "Ping": browsers have no access to raw ICMP sockets, so there is no such
//   thing as a real ping from client-side JS. What we measure instead is
//   HTTP time-to-first-byte via the Resource Timing API, which is the same
//   thing most web-based uptime dashboards (UptimeRobot, Pingdom, etc.) show
//   as "response time". Precise sub-second breakdown (TTFB vs full download)
//   is only available when the target host sends a `Timing-Allow-Origin`
//   header — for cross-origin hosts that don't, we transparently fall back
//   to coarser wall-clock timing around the whole fetch.
// - "SSL valido/scaduto": browsers do not expose certificate details (issuer,
//   expiry date...) to JS at all, for any origin. The best a browser can do
//   is infer "the TLS handshake succeeded" from the fetch not throwing. A
//   failed fetch could be an SSL problem, a DNS problem, CORS, or the server
//   being down — JS cannot tell these apart (this is intentional browser
//   behavior, to stop sites fingerprinting each other's network errors). For
//   a real certificate-expiry check, see the README — it needs a small
//   backend endpoint using e.g. Node's `tls` module.
// - Reading an actual HTTP status code (to tell a 200 from a 404/500) and
//   the API-version probe both require the target host to send permissive
//   CORS headers for your app's origin. That's a given for infrastructure
//   you control (which is the realistic case for a multi-CDN failover
//   setup), but won't work against arbitrary third-party endpoints.
// ---------------------------------------------------------------------------

export const DEFAULT_TIMEOUT_MS = 5000;
export const DEFAULT_SLOW_THRESHOLD_MS = 300;
const VERSION_ENDPOINT_PATH = '/version'; // convention — adjust to match your real API

export type HostCheckOptions = {
  timeoutMs: number;
  slowThresholdMs: number;
};

export const DEFAULT_CHECK_OPTIONS: HostCheckOptions = {
  timeoutMs: DEFAULT_TIMEOUT_MS,
  slowThresholdMs: DEFAULT_SLOW_THRESHOLD_MS,
};

function withCacheBust(url: string, tag: number): string {
  const u = new URL(url);
  u.searchParams.set('_probe', String(tag));
  return u.toString();
}

// Reads real network timing for `url` from the Resource Timing API, then
// clears the buffer so a long monitoring session doesn't silently fill it up
// (browsers stop recording new entries once the buffer — ~250 by default —
// is full). This clears the *global* resource-timing buffer; fine for this
// self-contained app, but worth knowing if you add other code elsewhere that
// also reads `performance.getEntriesByType('resource')`.
function readTiming(url: string): { pingMs: number | null; responseTimeMs: number | null } {
  try {
    const entries = performance.getEntriesByName(url) as PerformanceResourceTiming[];
    const entry = entries[entries.length - 1];
    if (entry && entry.responseStart > 0) {
      const result = {
        pingMs: Math.max(0, Math.round(entry.responseStart - entry.requestStart)),
        responseTimeMs: Math.max(0, Math.round(entry.responseEnd - entry.requestStart)),
      };
      performance.clearResourceTimings();
      return result;
    }
    performance.clearResourceTimings();
  } catch {
    // Resource Timing unavailable — caller falls back to wall-clock timing.
  }
  return { pingMs: null, responseTimeMs: null };
}

function deriveStatus(httpOk: boolean, pingMs: number | null, slowThresholdMs: number): HostStatus {
  if (!httpOk) return 'offline';
  if (pingMs !== null && pingMs > slowThresholdMs) return 'slow';
  return 'online';
}

async function probeApiVersion(baseUrl: string, timeoutMs: number): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(new URL(VERSION_ENDPOINT_PATH, baseUrl).toString(), {
      method: 'GET',
      signal: controller.signal,
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const text = await res.text();
    try {
      const json = JSON.parse(text);
      return typeof json?.version === 'string' ? json.version : text.trim().slice(0, 40) || null;
    } catch {
      return text.trim().slice(0, 40) || null;
    }
  } catch {
    return null; // optional probe — absence doesn't fail the host check
  } finally {
    clearTimeout(timer);
  }
}

export async function checkHost(host: StreamHost, opts: HostCheckOptions = DEFAULT_CHECK_OPTIONS): Promise<HostCheckResult> {
  const checkedAt = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs);
  const probeUrl = withCacheBust(host.url, checkedAt);
  const isHttps = probeUrl.startsWith('https:');

  let httpOk = false;
  let httpStatus: number | null = null;
  let pingMs: number | null = null;
  let responseTimeMs: number | null = null;
  let error: HostCheckError | undefined;
  let sslOk: boolean | null = isHttps ? null : null; // stays null unless we can infer success below

  const wallStart = performance.now();
  try {
    const res = await fetch(probeUrl, { method: 'GET', signal: controller.signal, cache: 'no-store' });
    const wallEnd = performance.now();
    httpStatus = res.status;
    // Treat anything below 500 as "the host is reachable" — a 404 on an
    // arbitrary root probe path is normal and shouldn't by itself look like
    // an outage. Point the probe at a real health-check endpoint (e.g.
    // `/healthz` that your infra actually implements) for a stricter check.
    httpOk = res.status < 500;
    if (!httpOk) error = 'http_error';
    if (isHttps) sslOk = true; // the TLS handshake had to succeed to get here

    const timing = readTiming(probeUrl);
    pingMs = timing.pingMs;
    responseTimeMs = timing.responseTimeMs;
    if (pingMs === null) {
      // No Timing-Allow-Origin from the host (or an unsupported browser) —
      // fall back to coarser timing around the whole fetch call.
      responseTimeMs = Math.round(wallEnd - wallStart);
      pingMs = responseTimeMs;
    }
  } catch {
    // Fetch throws for timeout, DNS failure, connection refused, CORS
    // rejection, mixed content, etc. — the browser deliberately doesn't say
    // which, so we can only report "unreachable", not the exact cause.
    error = controller.signal.aborted ? 'timeout' : 'network_error';
    // sslOk stays null: an https fetch failure is *consistent* with a bad
    // certificate, but we cannot confirm that's actually what happened.
  } finally {
    clearTimeout(timer);
  }

  const apiVersion = httpOk ? await probeApiVersion(host.url, Math.min(opts.timeoutMs, 3000)) : null;

  return {
    hostId: host.id,
    status: deriveStatus(httpOk, pingMs, opts.slowThresholdMs),
    pingMs,
    responseTimeMs,
    checkedAt,
    httpOk,
    httpStatus,
    sslOk,
    apiVersion,
    error,
  };
}

export async function checkAllHosts(
  hosts: StreamHost[],
  opts: HostCheckOptions = DEFAULT_CHECK_OPTIONS,
  parallel = true
): Promise<HostCheckResult[]> {
  if (parallel) return Promise.all(hosts.map(h => checkHost(h, opts)));
  const results: HostCheckResult[] = [];
  for (const h of hosts) results.push(await checkHost(h, opts));
  return results;
}
