import type { StreamHost, HostSpeedSample } from '../types';

// ---------------------------------------------------------------------------
// Throughput measurement — what it can and cannot tell you.
//
// A browser has no bandwidth API, so the only way to measure a host's speed is
// to download something from it and divide bytes by seconds. That makes the
// figure only as meaningful as the payload: timing a 400-byte directory index
// measures round-trip latency and calls it bandwidth, which is worse than
// reporting nothing. So a sample below MIN_SAMPLE_BYTES is returned as
// `mbps: null` with `note: 'sample_too_small'` and the panel says exactly that
// — the fix is pointing `speedTestPath` at a real file, which is a thing only
// the person running the server can know.
//
// The download is streamed and counted incrementally rather than awaited as
// one blob, for two reasons: it can stop at a budget instead of pulling a
// whole 4K segment over a phone connection, and the elapsed time then covers
// only bytes actually received.
// ---------------------------------------------------------------------------

/** Below this a sample measures latency, not bandwidth. 64 KB. */
export const MIN_SAMPLE_BYTES = 64 * 1024;
/** Never pull more than this for a measurement. 4 MB. */
const MAX_SAMPLE_BYTES = 4 * 1024 * 1024;
/** Nor spend longer than this on one. */
const MAX_SAMPLE_MS = 8000;

export type SpeedTestOptions = {
  maxBytes?: number;
  maxDurationMs?: number;
};

function probeUrl(host: StreamHost): string {
  const base = host.speedTestPath ? new URL(host.speedTestPath, host.url).toString() : host.url;
  const url = new URL(base);
  // Cache-busted, because a measurement served from the browser's own disk
  // cache reports the speed of the disk.
  url.searchParams.set('_speed', String(Date.now()));
  return url.toString();
}

export async function measureThroughput(
  host: StreamHost,
  opts: SpeedTestOptions = {}
): Promise<HostSpeedSample> {
  const maxBytes = opts.maxBytes ?? MAX_SAMPLE_BYTES;
  const maxDurationMs = opts.maxDurationMs ?? MAX_SAMPLE_MS;
  const measuredAt = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), maxDurationMs);

  const base = { hostId: host.id, measuredAt } as const;

  try {
    const res = await fetch(probeUrl(host), {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal,
    });
    if (!res.ok || !res.body) {
      return { ...base, mbps: null, sampleBytes: 0, durationMs: 0, note: res.body ? 'unreachable' : 'no_body' };
    }

    const reader = res.body.getReader();
    let bytes = 0;
    // Started after the response headers land, so connection setup and
    // server think-time land in the ping figure (where they belong) rather
    // than dragging the throughput figure down.
    const start = performance.now();
    let elapsed = 0;

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value?.byteLength ?? 0;
      elapsed = performance.now() - start;
      if (bytes >= maxBytes || elapsed >= maxDurationMs) {
        await reader.cancel();
        break;
      }
    }

    const durationMs = Math.max(1, Math.round(elapsed || performance.now() - start));
    if (bytes < MIN_SAMPLE_BYTES) {
      return { ...base, mbps: null, sampleBytes: bytes, durationMs, note: 'sample_too_small' };
    }
    const mbps = (bytes * 8) / (durationMs / 1000) / 1_000_000;
    return { ...base, mbps: Math.round(mbps * 100) / 100, sampleBytes: bytes, durationMs };
  } catch {
    // Timeout, DNS, CORS, connection refused — the browser deliberately
    // doesn't distinguish them, so neither do we.
    return { ...base, mbps: null, sampleBytes: 0, durationMs: 0, note: 'unreachable' };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Sequentially, never in parallel: two downloads racing over one connection
 * each measure half the bandwidth and both report it as the host's ceiling.
 * Ping tests can run together because latency is not a shared resource in the
 * way throughput is; this is the one host check that must queue.
 */
export async function measureAllThroughput(
  hosts: StreamHost[],
  opts: SpeedTestOptions = {}
): Promise<HostSpeedSample[]> {
  const samples: HostSpeedSample[] = [];
  for (const host of hosts) samples.push(await measureThroughput(host, opts));
  return samples;
}
