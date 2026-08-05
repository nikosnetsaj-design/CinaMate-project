import { create } from "zustand";
import { isRecord, readJson, writeJson } from "../lib/localStore";
import type { LayoutFamily, LinkHost, QueryRecipe } from "../lib/linkHost";
import { LAYOUT_FAMILIES, QUERY_RECIPES } from "../lib/linkHost";

const KEY = "cinemate:link-hosts:v1";

/**
 * L'elenco dei Link Host. Parte vuoto e resta vuoto finché non ci scrivi
 * qualcosa: CineMate non conosce nessun indirizzo di terze parti, non ne
 * propone e non ne contiene: quello che c'è dentro l'hai messo tu, e sta su
 * questo dispositivo.
 *
 * Quanti ne servono: uno è il caso normale, ma un sito che non risponde è la
 * ragione stessa per cui esiste il campo, quindi la lista non ha un tetto e
 * l'ordine è quello di prova.
 */

const MAX_HOSTS = 8;

interface LinkHostState {
  hosts: LinkHost[];
  add: (input: { name: string; url: string; searchPattern?: string; recipe?: QueryRecipe }) => LinkHost | null;
  update: (id: string, patch: Partial<Omit<LinkHost, "id">>) => void;
  remove: (id: string) => void;
  move: (id: string, direction: -1 | 1) => void;
  toggle: (id: string) => void;
  /** Accetta il trasloco proposto da `lib/hostRedirect.ts`. */
  acceptMove: (id: string) => void;
  /** Rifiuta il trasloco e non lo ripropone finché non ricompare. */
  dismissMove: (id: string) => void;
  restore: (value: unknown) => void;
}

function isRecipe(value: unknown): value is QueryRecipe {
  return QUERY_RECIPES.some((r) => r.id === value);
}

function isLayout(value: unknown): value is LayoutFamily {
  return LAYOUT_FAMILIES.some((l) => l.id === value);
}

function isHost(value: unknown): value is LinkHost {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.url === "string"
  );
}

/**
 * Un record salvato da una versione precedente può non avere i campi
 * aggiunti dopo. Si completano leggendo, non migrando: una migrazione che
 * riscrive lo storage all'avvio è una cosa che può fallire a metà, questo no.
 */
function normalize(value: LinkHost): LinkHost {
  return {
    ...value,
    searchPattern: typeof value.searchPattern === "string" ? value.searchPattern : "",
    recipe: isRecipe(value.recipe) ? value.recipe : "titolo-anno",
    layout: isLayout(value.layout) ? value.layout : "entrambi",
    enabled: typeof value.enabled === "boolean" ? value.enabled : true,
    addedAt: typeof value.addedAt === "number" ? value.addedAt : Date.now(),
  };
}

function isHostList(value: unknown): value is LinkHost[] {
  return Array.isArray(value) && value.every(isHost);
}

function load(): LinkHost[] {
  return readJson<LinkHost[]>(KEY, isHostList, []).map(normalize);
}

function persist(hosts: LinkHost[]): LinkHost[] {
  writeJson(KEY, hosts);
  return hosts;
}

export const useLinkHosts = create<LinkHostState>((set, get) => ({
  hosts: load(),

  add: (input) => {
    const url = input.url.trim();
    const hosts = get().hosts;
    if (!url || hosts.length >= MAX_HOSTS) return null;
    const host: LinkHost = {
      id: `lh-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      name: input.name.trim() || url,
      url,
      searchPattern: input.searchPattern?.trim() ?? "",
      recipe: input.recipe ?? "titolo-anno",
      layout: "entrambi",
      enabled: true,
      addedAt: Date.now(),
    };
    set({ hosts: persist([...hosts, host]) });
    return host;
  },

  update: (id, patch) => {
    set({ hosts: persist(get().hosts.map((h) => (h.id === id ? { ...h, ...patch } : h))) });
  },

  remove: (id) => {
    set({ hosts: persist(get().hosts.filter((h) => h.id !== id)) });
  },

  move: (id, direction) => {
    const hosts = [...get().hosts];
    const from = hosts.findIndex((h) => h.id === id);
    const to = from + direction;
    if (from < 0 || to < 0 || to >= hosts.length) return;
    [hosts[from], hosts[to]] = [hosts[to], hosts[from]];
    set({ hosts: persist(hosts) });
  },

  toggle: (id) => {
    set({ hosts: persist(get().hosts.map((h) => (h.id === id ? { ...h, enabled: !h.enabled } : h))) });
  },

  acceptMove: (id) => {
    set({
      hosts: persist(
        get().hosts.map((h) => {
          if (h.id !== id || !h.movedTo) return h;
          // Il vecchio indirizzo sparisce invece di restare come riserva: è
          // proprio quello che ha smesso di rispondere, e tenerlo in lista
          // vorrebbe dire riprovarlo per primo a ogni ricerca.
          const { movedTo, ...rest } = h;
          return { ...rest, url: movedTo };
        }),
      ),
    });
  },

  dismissMove: (id) => {
    set({
      hosts: persist(
        get().hosts.map((h) => {
          if (h.id !== id) return h;
          const { movedTo: _dropped, ...rest } = h;
          return rest;
        }),
      ),
    });
  },

  restore: (value) => {
    set({ hosts: persist(isHostList(value) ? value.map(normalize) : []) });
  },
}));

/** La lista attiva, nell'ordine di prova. Fuori da React. */
export function enabledLinkHosts(): LinkHost[] {
  return useLinkHosts.getState().hosts.filter((h) => h.enabled && h.url.trim());
}
