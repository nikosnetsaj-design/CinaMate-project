import { useState, useEffect, useCallback, useRef } from 'react';
import type {
  StreamHost,
  HostCheckResult,
  HostStats,
  HostSwitchEvent,
  HostSwitchReason,
  MonitorIntervalMs,
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
} from '../services/hostStore';
import { checkHost, checkAllHosts, DEFAULT_TIMEOUT_MS, DEFAULT_SLOW_THRESHOLD_MS } from '../services/hostHealthService';

type ResultMap = Record<string, HostCheckResult | null>;

// Prefer the highest-priority (lowest priority number) fully-'online' host;
// fall back to the highest-priority merely-'slow' one rather than going
// fully offline if nothing better is available. Returns null only when
// every host is down, in which case the caller keeps the current host
// rather than switching to nothing.
function pickBestHost(hosts: StreamHost[], results: ResultMap): StreamHost | null {
  const ranked = [...hosts].sort((a, b) => a.priority - b.priority);
  return ranked.find(h => results[h.id]?.status === 'online') ?? ranked.find(h => results[h.id]?.status === 'slow') ?? null;
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

  // Refs let callbacks below read the latest values without needing to be
  // recreated (and without re-subscribing the interval/visibility effects)
  // every time hosts/results/activeHostId change.
  const hostsRef = useRef(hosts);
  hostsRef.current = hosts;
  const activeHostIdRef = useRef(activeHostId);
  activeHostIdRef.current = activeHostId;
  const resultsRef = useRef(results);
  resultsRef.current = results;

  const refreshStats = useCallback((hostList: StreamHost[]) => {
    const next: Record<string, HostStats> = {};
    for (const h of hostList) next[h.id] = computeHostStats(h.id);
    setStats(next);
  }, []);

  const switchTo = useCallback((toId: string, reason: HostSwitchReason) => {
    const fromId = activeHostIdRef.current;
    if (fromId === toId) return;
    persistActiveHostId(toId);
    setActiveHostIdState(toId);
    logSwitch({ fromHostId: fromId, toHostId: toId, reason, at: Date.now() });
    setSwitchLog(getSwitchLog());
  }, []);

  const evaluateFailover = useCallback(
    (hostList: StreamHost[], resultMap: ResultMap) => {
      const best = pickBestHost(hostList, resultMap);
      const currentId = activeHostIdRef.current;
      if (!best || best.id === currentId) return;
      const fromHost = hostList.find(h => h.id === currentId);
      switchTo(best.id, reasonForSwitch(fromHost, best, resultMap));
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
      refreshStats(hostsRef.current);
      evaluateFailover(hostsRef.current, next);
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
        refreshStats(list);
        evaluateFailover(list, next);
      } finally {
        setIsTesting(false);
      }
    },
    [timeoutMs, pingThresholdMs, refreshStats, evaluateFailover]
  );

  const testAllRef = useRef(testAll);
  testAllRef.current = testAll;

  // Startup: seed results/stats from persisted history, pick a default
  // active host if none is set yet, then run a real check right away.
  useEffect(() => {
    const initial: ResultMap = {};
    for (const h of hostsRef.current) initial[h.id] = getLatestResult(h.id);
    resultsRef.current = initial;
    setResults(initial);
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

  // "Controllo ogni" — periodic monitoring on the configured interval.
  useEffect(() => {
    const id = window.setInterval(() => testAllRef.current(true), monitorIntervalMs);
    return () => window.clearInterval(id);
  }, [monitorIntervalMs]);

  // "Controllo quando l'app torna in primo piano".
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'visible') testAllRef.current(true);
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  const addHost = useCallback((input: { name: string; url: string; role: StreamHost['role'] }) => {
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

  return {
    hosts,
    results,
    stats,
    activeHostId,
    activeHost,
    switchLog,
    timeoutMs,
    setTimeoutMs,
    pingThresholdMs,
    setPingThresholdMs,
    monitorIntervalMs,
    setMonitorIntervalMs,
    isTesting,
    testHost,
    testAll,
    addHost,
    updateHost,
    removeHost,
    reorderHosts,
    switchManually,
  };
}
