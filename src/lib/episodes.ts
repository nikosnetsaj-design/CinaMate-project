import type { HistoryEntry, Item, WatchedEpisode } from "../types";

/**
 * Il registro degli episodi: quali, non quanti.
 *
 * La libreria contava gli episodi visti con un numero solo, `seen`. Da «visti:
 * 27» non si ricava se sei a S02E03 o a S03E01, e quella domanda la fanno in
 * molti: il «prossimo episodio» della Home, la ricerca sui siti, il lettore che
 * deve sapere quale puntata ha appena finito, il riassunto che non deve
 * anticipare niente. Ora ogni titolo a puntate tiene `watched`, un elenco di
 * `{ stagione, episodio, data }`, e `seen` resta come valore derivato — la sua
 * lunghezza — per tutto il codice che chiede solo «quanti».
 *
 * La divisione in stagioni (`seasonEpisodes`, quante puntate ha ciascuna)
 * arriva da TMDB. Senza, gli episodi stanno tutti nella stagione 1 e sono
 * segnati `provisional`: quando la divisione arriva si ridistribuiscono da
 * soli, nello stesso ordine e con le stesse date.
 */

export const SERIES_KINDS = new Set<Item["kind"]>(["serie", "anime"]);

export function isEpisodic(item: Pick<Item, "kind">): boolean {
  return SERIES_KINDS.has(item.kind);
}

export interface EpisodeRef {
  season: number;
  episode: number;
}

export function sameEpisode(a: EpisodeRef, b: EpisodeRef): boolean {
  return a.season === b.season && a.episode === b.episode;
}

export function compareEpisodes(a: EpisodeRef, b: EpisodeRef): number {
  return a.season - b.season || a.episode - b.episode;
}

/** `S2 · E5`, come lo leggono le schede. */
export function episodeLabel(ref: EpisodeRef): string {
  return `S${ref.season} · E${ref.episode}`;
}

/**
 * La divisione in stagioni che si conosce, o `null`.
 *
 * Una serie senza `seasonEpisodes` ma con una stagione sola e il totale noto
 * è divisa per forza in quel modo: non serve TMDB per sapere che i sei
 * episodi di una miniserie stanno tutti nella stagione 1.
 */
export function seasonLayout(item: Pick<Item, "seasonEpisodes" | "seasons" | "episodes">): number[] | null {
  if (item.seasonEpisodes && item.seasonEpisodes.length > 0) return item.seasonEpisodes;
  if ((item.seasons ?? 1) <= 1 && item.episodes) return [item.episodes];
  return null;
}

/**
 * Le prime `count` posizioni in ordine di visione: S1E1, S1E2… e alla fine
 * della stagione la successiva. Senza divisione tutto resta nella stagione 1.
 */
export function positions(layout: number[] | null, count: number): EpisodeRef[] {
  const out: EpisodeRef[] = [];
  if (!layout) {
    for (let e = 1; e <= count; e++) out.push({ season: 1, episode: e });
    return out;
  }
  for (let s = 0; s < layout.length && out.length < count; s++) {
    for (let e = 1; e <= layout[s] && out.length < count; e++) out.push({ season: s + 1, episode: e });
  }
  // Più episodi di quanti TMDB ne elenchi: succede con gli anime numerati in
  // assoluto. Si prosegue nell'ultima stagione invece di perderli.
  const lastSeason = Math.max(1, layout.length);
  let e = layout[lastSeason - 1] ?? 0;
  while (out.length < count) out.push({ season: lastSeason, episode: ++e });
  return out;
}

/** Il registro di un titolo, in ordine e senza doppioni. */
export function watchedList(item: Pick<Item, "watched">): WatchedEpisode[] {
  const seen = new Set<string>();
  return (item.watched ?? [])
    .filter((w) => {
      const k = `${w.season}:${w.episode}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return w.season >= 1 && w.episode >= 1;
    })
    .sort(compareEpisodes);
}

export function isWatched(item: Pick<Item, "watched">, ref: EpisodeRef): boolean {
  return (item.watched ?? []).some((w) => sameEpisode(w, ref));
}

/**
 * Il prossimo episodio da guardare: il primo, in ordine, che non è nel
 * registro. Senza divisione in stagioni, quello dopo l'ultimo visto. `null`
 * quando non ne resta nessuno.
 */
export function nextEpisode(item: Pick<Item, "watched" | "seasonEpisodes" | "seasons" | "episodes" | "kind">): EpisodeRef | null {
  if (!isEpisodic(item)) return null;
  const list = watchedList(item);
  const layout = seasonLayout(item);
  if (layout) {
    const total = layout.reduce((a, b) => a + b, 0);
    for (const ref of positions(layout, total)) if (!list.some((w) => sameEpisode(w, ref))) return ref;
    return null;
  }
  if (item.episodes && list.length >= item.episodes) return null;
  const last = list[list.length - 1];
  return last ? { season: last.season, episode: last.episode + 1 } : { season: 1, episode: 1 };
}

/** L'ultimo episodio visto in ordine di storia, non di data. */
export function lastWatched(item: Pick<Item, "watched">): WatchedEpisode | null {
  const list = watchedList(item);
  return list[list.length - 1] ?? null;
}

/**
 * Le date delle visioni ricostruite dal diario, una per episodio, dalla più
 * vecchia. Ogni voce «episodio» del diario vale `count` episodi in quel giorno.
 */
export function diaryDates(history: HistoryEntry[], itemId: string): string[] {
  return history
    .filter((h) => h.itemId === itemId && h.action === "episode")
    .sort((a, b) => a.date.localeCompare(b.date))
    .flatMap((h) => Array.from({ length: Math.max(1, h.count ?? 1) }, () => h.date));
}

/**
 * Dal vecchio contatore al registro.
 *
 * I primi `seen` episodi in ordine. Le date vengono dal diario; quelli che il
 * diario non copre — tipicamente il punto di partenza scritto a mano quando si
 * è aggiunta la serie — sono i primi in ordine, prendono la data di aggiunta e
 * sono segnati `estimated`. Senza divisione in stagioni sono `provisional`.
 */
export function migrateWatched(item: Item, history: HistoryEntry[]): WatchedEpisode[] {
  const count = Math.max(0, Math.floor(item.seen || 0));
  if (count === 0) return [];
  const layout = seasonLayout(item);
  const refs = positions(layout, count);
  const dates = diaryDates(history, item.id).slice(0, count);
  const unlogged = count - dates.length;
  return refs.map((ref, i) => {
    const entry: WatchedEpisode = { ...ref, date: i < unlogged ? item.added : dates[i - unlogged] };
    if (i < unlogged) entry.estimated = true;
    if (!layout) entry.provisional = true;
    return entry;
  });
}

/**
 * La divisione in stagioni è arrivata: gli episodi messi provvisoriamente
 * nella stagione 1 prendono il loro posto vero, nello stesso ordine e con le
 * stesse date. Quelli segnati a mano su una stagione precisa non si toccano.
 */
export function remapProvisional(watched: WatchedEpisode[], layout: number[]): WatchedEpisode[] {
  const provisional = watched.filter((w) => w.provisional).sort(compareEpisodes);
  if (provisional.length === 0) return watched;
  const fixed = watched.filter((w) => !w.provisional);
  const free = positions(layout, layout.reduce((a, b) => a + b, 0) + provisional.length).filter(
    (ref) => !fixed.some((w) => sameEpisode(w, ref)),
  );
  const moved = provisional.map((w, i) => {
    const { provisional: _drop, ...rest } = w;
    return { ...rest, ...free[i] };
  });
  return [...fixed, ...moved].sort(compareEpisodes);
}

/** Aggiunge un episodio al registro, se non c'è già. */
export function withEpisode(watched: WatchedEpisode[], ref: EpisodeRef, date: string): WatchedEpisode[] {
  if (watched.some((w) => sameEpisode(w, ref))) return watched;
  return [...watched, { season: ref.season, episode: ref.episode, date }].sort(compareEpisodes);
}

export function withoutEpisode(watched: WatchedEpisode[], ref: EpisodeRef): WatchedEpisode[] {
  return watched.filter((w) => !sameEpisode(w, ref));
}

/**
 * «Visto fino a qui»: tutti gli episodi fino a `ref` compreso. Con la
 * divisione in stagioni vale anche per le stagioni prima; senza, solo per la
 * stagione di `ref`, perché di quelle prima non si sa quante puntate abbiano.
 */
export function upTo(item: Pick<Item, "seasonEpisodes" | "seasons" | "episodes">, ref: EpisodeRef): EpisodeRef[] {
  const layout = seasonLayout(item);
  if (layout) {
    const total = layout.reduce((a, b) => a + b, 0);
    const all = positions(layout, Math.max(total, 0));
    const idx = all.findIndex((r) => sameEpisode(r, ref));
    if (idx >= 0) return all.slice(0, idx + 1);
  }
  return Array.from({ length: ref.episode }, (_, i) => ({ season: ref.season, episode: i + 1 }));
}

/**
 * Il registro portato a `count` episodi, per chi parla ancora in totali (la
 * casella «Ep. visti» del modulo, il contatore ±). Si tengono i primi in
 * ordine; quelli nuovi prendono la data passata.
 */
export function resizeWatched(
  item: Pick<Item, "watched" | "seasonEpisodes" | "seasons" | "episodes">,
  count: number,
  date: string,
): WatchedEpisode[] {
  const current = watchedList(item);
  const target = Math.max(0, Math.floor(count));
  if (target <= current.length) return current.slice(0, target);
  const layout = seasonLayout(item);
  let next = [...current];
  for (const ref of positions(layout, target + current.length)) {
    if (next.length >= target) break;
    if (!next.some((w) => sameEpisode(w, ref))) {
      const entry: WatchedEpisode = { ...ref, date };
      if (!layout) entry.provisional = true;
      next = [...next, entry];
    }
  }
  return next.sort(compareEpisodes);
}
