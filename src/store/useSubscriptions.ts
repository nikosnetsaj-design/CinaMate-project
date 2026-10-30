import { create } from "zustand";
import { readJson, writeJson } from "../lib/localStore";
import { readSubscriptions, type Subscription } from "../lib/subscriptions";

const KEY = "cinemate:subscriptions:v1";

interface SubscriptionsState {
  subs: Subscription[];
  /** Accende o spegne un servizio. Torna vero se adesso è acceso. */
  toggle: (provider: { id: number; name: string; logoPath: string | null }) => boolean;
  setPrice: (providerId: number, monthly: number | null) => void;
  /** Da un backup: quello che non si legge si scarta, il resto entra. */
  restore: (value: unknown) => void;
}

function persist(subs: Subscription[]): Subscription[] {
  writeJson(KEY, subs);
  return subs;
}

export const useSubscriptions = create<SubscriptionsState>((set, get) => ({
  subs: readSubscriptions(readJson<unknown>(KEY, (v): v is unknown => v !== undefined, [])),

  toggle: (provider) => {
    const on = get().subs.some((s) => s.providerId === provider.id);
    const next = on
      ? get().subs.filter((s) => s.providerId !== provider.id)
      : [...get().subs, { providerId: provider.id, name: provider.name, logoPath: provider.logoPath, monthly: null }];
    set({ subs: persist(next) });
    return !on;
  },

  setPrice: (providerId, monthly) =>
    set({ subs: persist(get().subs.map((s) => (s.providerId === providerId ? { ...s, monthly } : s))) }),

  restore: (value) => set({ subs: persist(readSubscriptions(value)) }),
}));
