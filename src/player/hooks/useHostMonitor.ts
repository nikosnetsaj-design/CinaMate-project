import { useState, useEffect, useCallback, useRef } from 'react';
import type {
  StreamHost,
  HostCheckResult,
  HostStats,
  HostSwitchEvent,
  HostSwitchReason,
  MonitorIntervalMs,
  HostSpeedSample,
  HostSelectionMode,
} from '../types';
import {
  getHosts,
  addHost as addHostToStore,
  updateHost as updateHostInStore,
  removeHost as removeHostFromStore,
  reorderHosts as reorderHostsInStore,
  recordCheckResult,
  getLatestResult,
  computeHostStats,
  getActiveHostId,
  setActiveHostId as persistActiveHostId,
  logSwitch,
  getSwitchLog,
  recordSpeedSample,
  getSpeedSamples,
  getSelectionMode,
  setSelectionMode as persistSelectionMode,
} from '../services/hostStore';
import type { HostInput } from '../services/hostStore';
import { checkHost, checkAllHosts, DEFAULT_TIMEOUT_MS, DEFAULT_SLOW_THRESHOLD_MS } from '../services/hostHealthService';
import { measureThroughput, measureAllThroughput } from '../services/hostSpeedService';
import { useVisibleInterval } from '../../lib/useVisibleInterval';

type ResultMap = Record<string, HostCheckResult | null>;
type StatsMap = Record<string, HostStats>;

/**
 * Score difference required before automatic mode will move off the host it is
 * already using. Without it two hosts a point apart would trade places on every
 * check round, and a five-minute cadence would put a host switch in the middle
 * of every second film for no measurable gain.
 */
const AUTO_SWITCH_HYSTERESIS = 8;

function isHealthy(result: HostCheckResult | null | undefined): boolean {
  return result?.status === 'online' || result?.status === 'slow';
}

// Prefer the highest-priority (lowest priority number) fully-'online' host;
// fall back to the highest-priority merely-'slow' one rather than going
// fully offline if nothing better is available. Returns null only when
// every host is down, in which case the caller keeps the current host
// rather than switching to nothing.
function pickByPriority(hosts: StreamHost[], results: ResultMap): StreamHost | null {
  const ranked = [...hosts].sort((a, b) => a.priority - b.priority);
  return ranked.find(h => results[h.id]?.status === 'online') ?? ranked.find(h => results[h.id]?.status === 'slow') ?? null;
}

/** Same two-tier fallback as above, ranked by composite score instead of by hand. */
function pickByScore(hosts: StreamHost[], results: ResultMap, stats: StatsMap): StreamHost | null {
  const byScore = (a: StreamHost, b: StreamHost) => (stats[b.id]?.score ?? 0) - (stats[a.id]?.score ?? 0);
  const online = hosts.filter(h => results[h.id]?.status === 'online').sort(byScore);
  if (online.length) return online[0];
  const slow = hosts.filter(h => results[h.id]?.status === 'slow').sort(byScore);
  return slow[0] ?? null;
}

/**
 * Weighted random among the healthy hosts, with the incumbent's weight halved
 * so repeated calls genuinely spread rather than landing on the best host every
 * time. Weighted rather than round-robin because the mirrors are not equals:
 * sending a quarter of your viewing to a host that scores 30 is not balance,
 * it's a quarter of your viewing spent buffering.
 *
 * This is called when a *session* starts, never on the monitoring tick — see
 * evaluateFailover for why re-rolling every five minutes would be a bug.
 */
function pickBalanced(
  hosts: StreamHost[],
  results: ResultMap,
  stats: StatsMap,
  incumbentId: string | null
): StreamHost | null {
  const pool = hosts.filter(h => isHealthy(results[h.id]));
  if (pool.length <= 1) return pool[0] ?? null;

  const weights = pool.map(h => {
    const base = Math.max(1, stats[h.id]?.score ?? 50);
    return h.id === incumbentId ? base / 2 : base;
  });
  const total = weights.reduce((sum, w) => sum + w, 0);
  let roll = Math.random() * total;
  for (let i = 0; i < pool.length; i += 1) {
    roll -= weights[i];
    if (roll <= 0) return pool[i];
  }
  return pool[pool.length - 1];
}

function reasonForSwitch(fromHost: StreamHost | undefined, toHost: StreamHost, results: ResultMap): HostSwitchReason {
  if (toHost.role === 'primary' && fromHost && fromHost.role !== 'primary') return 'recovered_to_primary';
  const fromResult = fromHost ? results[fromHost.id] : null;
  if (fromResult?.error === 'timeout') return 'timeout';
  if (fromResult?.error === 'http_error') return 'http_error';
  if (fromResult?.status === 'slow') return 'high_ping';
  return 'offline';
}

export function useHostMonitor() {
  const [hosts, setHosts] = useState<StreamHost[]>(() => getHosts());
  const [results, setResults] = useState<ResultMap>({});
  const [stats, setStats] = useState<Record<string, HostStats>>({});
  const [activeHostId, setActiveHostIdState] = useState<string | null>(() => getActiveHostId());
  const [switchLog, setSwitchLog] = useState<HostSwitchEvent[]>(() => getSwitchLog());
  const [timeoutMs, setTimeoutMs] = useState(DEFAULT_TIMEOUT_MS);
  const [pingThresholdMs, setPingThresholdMs] = useState(DEFAULT_SLOW_THRESHOLD_MS);
  const [monitorIntervalMs, setMonitorIntervalMs] = useState<MonitorIntervalMs>(300_000);
  const [isTesting, setIsTesting] = useState(false);
  const [selectionMode, setSelectionModeState] = useState<HostSelectionMode>(() => getSelectionMode());
  const [speedSamples, setSpeedSamples] = useState<Record<string, HostSpeedSample | null>>({});
  const [speedTestingId, setSpeedTestingId] = useState<string | null>(null);

  // Refs let callbacks below read the latest values without needing to be
  // recreated (and without re-subscribing the interval/visibility effects)
  // every time hosts/results/activeHostId change.
  const hostsRef = useRef(hosts);
  hostsRef.current = hosts;
  const activeHostIdRef = useRef(activeHostId);
  activeHostIdRef.current = activeHostId;
  const resultsRef = useRef(results);
  resultsRef.current = results;
  const statsRef = useRef(stats);
  statsRef.current = stats;
  const selectionModeRef = useRef(selectionMode);
  selectionModeRef.current = selectionMode;

  const refreshStats = useCallback((hostList: StreamHost[]) => {
    const next: StatsMap = {};
    for (const h of hostList) next[h.id] = computeHostStats(h.id);
    statsRef.current = next;
    setStats(next);
    return next;
  }, []);

  const switchTo = useCallback((toId: string, reason: HostSwitchReason) => {
    const fromId = activeHostIdRef.current;
    if (fromId === toId) return;
    persistActiveHostId(toId);
    setActiveHostIdState(toId);
    logSwitch({ fromHostId: fromId, toHostId: toId, reason, at: Date.now() });
    setSwitchLog(getSwitchLog());
  }, []);

  /**
   * Runs after every check round, in whichever mode is selected.
   *
   * The three modes differ in *when* they are allowed to move, not only in how
   * they choose:
   *
   * - `priority` keeps the original behaviour — always sit on the best host the
   *   hand-written order allows, which is also what makes it climb back to the
   *   primary the moment that recovers.
   * - `auto` ranks by score but needs a clear margin before it moves, so two
   *   near-equal hosts don't trade places on every tick.
   * - `balanced` does not re-roll here at all. Spreading traffic is a decision
   *   for the start of a session; re-rolling on the monitoring cadence would
   *   put a host switch in the middle of a film every five minutes, which is
   *   the opposite of what a balanced pool is for. Here it only rescues a host
   *   that has actually gone unhealthy.
   */
  const evaluateFailover = useCallback(
    (hostList: StreamHost[], resultMap: ResultMap, statsMap: StatsMap) => {
      const currentId = activeHostIdRef.current;
      const current = hostList.find(h => h.id === currentId) ?? null;
      const currentHealthy = current ? isHealthy(resultMap[current.id]) : false;
      const mode = selectionModeRef.current;

      if (mode === 'balanced') {
        if (currentHealthy) return;
        const pick = pickBalanced(hostList, resultMap, statsMap, currentId);
        if (pick && pick.id !== currentId) {
          switchTo(pick.id, reasonForSwitch(current ?? undefined, pick, resultMap));
        }
        return;
      }

      if (mode === 'auto') {
        const best = pickByScore(hostList, resultMap, statsMap);
        if (!best || best.id === currentId) return;
        if (currentHealthy) {
          const gain = (statsMap[best.id]?.score ?? 0) - (statsMap[currentId ?? '']?.score ?? 0);
          if (gain < AUTO_SWITCH_HYSTERESIS) return;
          switchTo(best.id, 'auto_ranked');
          return;
        }
        switchTo(best.id, reasonForSwitch(current ?? undefined, best, resultMap));
        return;
      }

      const best = pickByPriority(hostList, resultMap);
      if (!best || best.id === currentId) return;
      switchTo(best.id, reasonForSwitch(current ?? undefined, best, resultMap));
    },
    [switchTo]
  );

  // Note on why the side effects below sit outside setResults rather than
  // inside an updater function: writing the check to history, recomputing
  // stats and evaluating failover are all effects, and React may invoke a
  // state updater more than once for the same update (StrictMode does it on
  // every render in development). Done inside the updater, a single failover
  // was recorded twice in the switch log and twice in the host history.
  // `resultsRef` gives the same "latest results" the updater would have seen.
  const testHost = useCallback(
    async (hostId: string) => {
      const host = hostsRef.current.find(h => h.id === hostId);
      if (!host) return;
      const result = await checkHost(host, { timeoutMs, slowThresholdMs: pingThresholdMs });
      recordCheckResult(result);
      const next = { ...resultsRef.current, [hostId]: result };
      resultsRef.current = next;
      setResults(next);
      const nextStats = refreshStats(hostsRef.current);
      evaluateFailover(hostsRef.current, next, nextStats);
    },
    [timeoutMs, pingThresholdMs, refreshStats, evaluateFailover]
  );

  const testAll = useCallback(
    async (parallel = true) => {
      setIsTesting(true);
      try {
        const list = hostsRef.current;
        const checkResults = await checkAllHosts(list, { timeoutMs, slowThresholdMs: pingThresholdMs }, parallel);
        const next = { ...resultsRef.current };
        for (const r of checkResults) {
          recordCheckResult(r);
          next[r.hostId] = r;
        }
        resultsRef.current = next;
        setResults(next);
        const nextStats = refreshStats(list);
        evaluateFailover(list, next, nextStats);
      } finally {
        setIsTesting(false);
      }
    },
    [timeoutMs, pingThresholdMs, refreshStats, evaluateFailover]
  );

  const testAllRef = useRef(testAll);
  testAllRef.current = testAll;

  // --- Speed tests ---------------------------------------------------------
  // Kept off the monitoring tick on purpose: a ping probe is a few hundred
  // bytes, a throughput probe is megabytes. Running it every five minutes
  // would spend more of the user's data measuring the connection than the
  // measurement could ever save them.

  const applySample = useCallback(
    (sample: HostSpeedSample) => {
      recordSpeedSample(sample);
      setSpeedSamples(current => ({ ...current, [sample.hostId]: sample }));
      refreshStats(hostsRef.current);
    },
    [refreshStats]
  );

  const runSpeedTest = useCallback(
    async (hostId: string) => {
      const host = hostsRef.current.find(h => h.id === hostId);
      if (!host) return;
      setSpeedTestingId(hostId);
      try {
        applySample(await measureThroughput(host));
      } finally {
        setSpeedTestingId(null);
      }
    },
    [applySample]
  );

  const runAllSpeedTests = useCallback(async () => {
    const list = hostsRef.current;
    setSpeedTestingId('*');
    try {
      // Sequential inside the service — see hostSpeedService for why parallel
      // throughput probes measure each other rather than the hosts.
      for (const sample of await measureAllThroughput(list)) applySample(sample);
    } finally {
      setSpeedTestingId(null);
    }
  }, [applySample]);

  /**
   * Re-spread the load. Called when a new title starts playing, which is the
   * only moment a host change costs nothing: mid-stream it would mean a
   * switch nobody asked for, and between titles it means the next film simply
   * comes from a different mirror.
   */
  const rebalance = useCallback(() => {
    if (selectionModeRef.current !== 'balanced') return;
    const pick = pickBalanced(hostsRef.current, resultsRef.current, statsRef.current, activeHostIdRef.current);
    if (pick && pick.id !== activeHostIdRef.current) switchTo(pick.id, 'load_balanced');
  }, [switchTo]);

  const setSelectionMode = useCallback(
    (mode: HostSelectionMode) => {
      persistSelectionMode(mode);
      selectionModeRef.current = mode;
      setSelectionModeState(mode);
      // Apply immediately rather than waiting for the next check round, so
      // choosing a mode visibly does something.
      evaluateFailover(hostsRef.current, resultsRef.current, statsRef.current);
      if (mode === 'balanced') {
        const pick = pickBalanced(hostsRef.current, resultsRef.current, statsRef.current, activeHostIdRef.current);
        if (pick && pick.id !== activeHostIdRef.current) switchTo(pick.id, 'load_balanced');
      }
    },
    [evaluateFailover, switchTo]
  );

  // Startup: seed results/stats from persisted history, pick a default
  // active host if none is set yet, then run a real check right away.
  useEffect(() => {
    const initial: ResultMap = {};
    const initialSpeeds: Record<string, HostSpeedSample | null> = {};
    for (const h of hostsRef.current) {
      initial[h.id] = getLatestResult(h.id);
      initialSpeeds[h.id] = getSpeedSamples(h.id, 1)[0] ?? null;
    }
    resultsRef.current = initial;
    setResults(initial);
    setSpeedSamples(initialSpeeds);
    refreshStats(hostsRef.current);
    if (!activeHostIdRef.current) {
      const primary = hostsRef.current.find(h => h.role === 'primary') ?? hostsRef.current[0];
      if (primary) {
        persistActiveHostId(primary.id);
        setActiveHostIdState(primary.id);
      }
    }
    testAllRef.current(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // "Controllo ogni" — periodic monitoring on the configured interval, paused
  // while the page is hidden and re-run the moment it comes back. That
  // subsumes the separate visibility listener this used to keep: the hook does
  // both, and running them side by side fired two checks on every return to
  // the foreground.
  useVisibleInterval(() => testAllRef.current(true), monitorIntervalMs);

  const addHost = useCallback((input: HostInput) => {
    addHostToStore(input);
    setHosts(getHosts());
  }, []);

  const updateHost = useCallback((id: string, patch: Partial<Omit<StreamHost, 'id'>>) => {
    updateHostInStore(id, patch);
    setHosts(getHosts());
  }, []);

  const removeHost = useCallback((id: string) => {
    removeHostFromStore(id);
    setHosts(getHosts());
    const next = { ...resultsRef.current };
    delete next[id];
    resultsRef.current = next;
    setResults(next);
  }, []);

  const reorderHosts = useCallback((orderedIds: string[]) => {
    reorderHostsInStore(orderedIds);
    setHosts(getHosts());
  }, []);

  const switchManually = useCallback((id: string) => switchTo(id, 'manual'), [switchTo]);

  const activeHost = hosts.find(h => h.id === activeHostId) ?? null;

  // The order automatic mode would use, exposed so the panel can show the
  // ranking next to the hand-written one instead of leaving "automatica" an
  // unexplained checkbox. The stored `priority` is never rewritten from this:
  // the manual order is something the user typed, and an automatic mode that
  // silently overwrote it would leave no way back to it.
  const rankedHosts = [...hosts].sort((a, b) => (stats[b.id]?.score ?? 0) - (stats[a.id]?.score ?? 0));

  return {
    hosts,
    rankedHosts,
    results,
    stats,
    speedSamples,
    activeHostId,
    activeHost,
    switchLog,
    timeoutMs,
    setTimeoutMs,
    pingThresholdMs,
    setPingThresholdMs,
    monitorIntervalMs,
    setMonitorIntervalMs,
    selectionMode,
    setSelectionMode,
    isTesting,
    speedTestingId,
    testHost,
    testAll,
    runSpeedTest,
    runAllSpeedTests,
    rebalance,
    addHost,
    updateHost,
    removeHost,
    reorderHosts,
    switchManually,
  };
}
