import { useMemo, useSyncExternalStore } from "react";
import { usePlayerPrefs } from "../store/usePlayerPrefs";
import { getHosts, subscribeHosts } from "./services/hostStore";
import type { StreamHost } from "./types";

/**
 * Every place your videos might live, in the order they get tried.
 *
 * There are two lists in the app that both mean "my server", and keeping them
 * apart was the bug: the three fields in Settings, and the hosts in the
 * player's Host panel. The panel's hosts were only ever *monitored* — pinged,
 * ranked, shown green or red — and never used to find anything, so adding one
 * there and pressing Guarda did nothing at all.
 *
 * Here they become one list. Settings first, because that is where you were
 * told to write an address; then the hosts, by priority, which is the order the
 * panel already promises. Either can be a bare address — see lib/sourceTemplate.
 */
export function mergeAddresses(templates: string[], hosts: StreamHost[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (value: string) => {
    const address = value.trim();
    if (!address || seen.has(address)) return;
    seen.add(address);
    out.push(address);
  };
  for (const template of templates) push(template);
  for (const host of [...hosts].sort((a, b) => a.priority - b.priority)) push(host.url);
  return out;
}

function hostsSnapshot(): StreamHost[] {
  return getHosts();
}

/** The merged list, re-read when either half changes. */
export function useSourceAddresses(): string[] {
  const templates = usePlayerPrefs((s) => s.sourceTemplates);
  const hosts = useSyncExternalStore(subscribeHosts, hostsSnapshot, hostsSnapshot);
  return useMemo(() => mergeAddresses(templates, hosts), [templates, hosts]);
}

/** The same list outside React, for code that runs once rather than renders. */
export function sourceAddresses(): string[] {
  return mergeAddresses(usePlayerPrefs.getState().sourceTemplates, getHosts());
}
