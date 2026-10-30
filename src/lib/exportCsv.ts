import type { HistoryEntry, Item, Kind } from "../types";
import { toCsv } from "./csv";

/**
 * La libreria in due forme che si aprono fuori di qui.
 *
 * Il backup JSON resta la copia completa — saghe, sorgenti, obiettivi — ed è
 * quello che serve per cambiare telefono. Questi due file rispondono ad altre
 * domande: «voglio la mia libreria in un foglio di calcolo» e «voglio portare
 * il mio diario su Letterboxd». È la regola 4 del prodotto presa alla
 * lettera: i dati sono tuoi, esportabili in un file leggibile *da altri
 * programmi*, non solo da questo.
 */

const KIND_LABEL: Record<Kind, string> = { film: "Film", serie: "Serie", anime: "Anime", doc: "Documentario" };

function viewsByItem(history: HistoryEntry[]) {
  const map = new Map<string, { last: string | null; views: number; entries: HistoryEntry[] }>();
  for (const h of history) {
    const v = map.get(h.itemId) ?? { last: null, views: 0, entries: [] };
    if (!v.last || h.date > v.last) v.last = h.date;
    if (h.action === "watched" || h.action === "rewatch") v.views++;
    v.entries.push(h);
    map.set(h.itemId, v);
  }
  return map;
}

export const LIBRARY_CSV_HEADER = [
  "Titolo",
  "Anno",
  "Tipo",
  "Stato",
  "Voto",
  "Preferito",
  "Episodi visti",
  "Episodi totali",
  "Piattaforma",
  "Genere",
  "Regia",
  "Aggiunto",
  "Ultima visione",
  "Visioni",
  "Note",
  "TMDB",
  "Tipo TMDB",
  "IMDb",
];

/**
 * Un titolo per riga, con le intestazioni in italiano e il punto e virgola
 * come separatore (vedi `toCsv`). Il BOM in testa fa leggere a Excel le
 * lettere accentate come UTF-8: senza, «Città» diventa «CittÃ ».
 *
 * Le colonne sono le stesse che `importers.ts` sa rileggere, quindi lo stesso
 * file torna indietro: «Ultima visione» diventa una voce del diario, che è
 * meno del diario intero — per quello c'è il backup — ma è vero.
 */
export function libraryCsv(items: Item[], history: HistoryEntry[]): string {
  const views = viewsByItem(history);
  const rows = items
    .slice()
    .sort((a, b) => a.title.localeCompare(b.title, "it") || a.year - b.year)
    .map((i) => {
      const v = views.get(i.id);
      const isSeries = i.kind === "serie" || i.kind === "anime";
      return [
        i.title,
        i.year || "",
        KIND_LABEL[i.kind],
        i.status,
        i.vote ?? "",
        i.fav ? "sì" : "",
        isSeries ? i.seen : "",
        isSeries ? (i.episodes ?? "") : "",
        i.platform,
        i.genre,
        i.director,
        i.added,
        v?.last ?? "",
        v?.views || (i.status === "Visto" && !isSeries ? 1 + (i.rewatch || 0) : ""),
        i.notes,
        i.tmdbId ?? "",
        i.tmdbMediaType ?? "",
        i.imdbId ?? "",
      ];
    });
  return `﻿${toCsv([LIBRARY_CSV_HEADER, ...rows], ";")}`;
}

/* ------------------------------------------------------------------ */
/* Letterboxd                                                           */
/* ------------------------------------------------------------------ */

/**
 * Il dialetto dell'import di Letterboxd: virgole, UTF-8, e le virgolette
 * dentro un campo fra virgolette *precedute da una barra* invece che
 * raddoppiate — è quello che chiede la loro pagina sull'importazione, che
 * differisce dalla RFC proprio qui. Gli a capo diventano spazi: una nota su
 * tre righe resta leggibile, e una riga del file resta una riga.
 */
function lbCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const text = String(value).replace(/\r?\n+/g, " ").trim();
  return /[",]/.test(text) ? `"${text.replace(/"/g, '\\"')}"` : text;
}

function lbCsv(rows: (string | number | null | undefined)[][]): string {
  return rows.map((r) => r.map(lbCell).join(",")).join("\n") + "\n";
}

/** Letterboxd rifiuta i file oltre un megabyte: si spezzano, con l'intestazione in ogni parte. */
const LETTERBOXD_MAX_BYTES = 1_000_000;

function splitParts(header: string[], rows: (string | number | null | undefined)[][], name: string): { name: string; content: string }[] {
  const encoder = new TextEncoder();
  const head = lbCsv([header]);
  const parts: string[][] = [];
  let current: string[] = [];
  let size = encoder.encode(head).length;
  for (const row of rows) {
    const line = lbCsv([row]);
    const bytes = encoder.encode(line).length;
    if (current.length && size + bytes > LETTERBOXD_MAX_BYTES * 0.95) {
      parts.push(current);
      current = [];
      size = encoder.encode(head).length;
    }
    current.push(line);
    size += bytes;
  }
  if (current.length) parts.push(current);
  return parts.map((lines, i) => ({
    name: parts.length === 1 ? `${name}.csv` : `${name}-parte-${i + 1}.csv`,
    content: head + lines.join(""),
  }));
}

export interface LetterboxdExport {
  /** Diario e voti: si caricano da «Import your data». */
  diary: { name: string; content: string }[];
  /** La watchlist: si carica da «Import to watchlist». */
  watchlist: { name: string; content: string }[];
  films: number;
  entries: number;
  wanted: number;
  /** Le serie restano fuori: Letterboxd tiene il cinema. */
  skippedSeries: number;
}

function isFilm(i: Item): boolean {
  return (i.kind === "film" || i.kind === "doc") && i.tmdbMediaType !== "tv";
}

export function letterboxdExport(items: Item[], history: HistoryEntry[], day: string): LetterboxdExport {
  const views = viewsByItem(history);
  const header = ["Title", "Year", "tmdbID", "imdbID", "WatchedDate", "Rating10", "Rewatch", "Review"];
  const rows: (string | number | null | undefined)[][] = [];
  const wantedRows: (string | number | null | undefined)[][] = [];
  let films = 0;
  let skippedSeries = 0;

  for (const i of items) {
    if (!isFilm(i)) {
      if (i.status !== "Da vedere" || (views.get(i.id)?.entries.length ?? 0) > 0) skippedSeries++;
      continue;
    }
    const base = [i.title, i.year || "", i.tmdbId ?? "", i.imdbId ?? ""];
    const entries = (views.get(i.id)?.entries ?? [])
      .filter((h) => h.action === "watched" || h.action === "rewatch")
      .sort((a, b) => a.date.localeCompare(b.date));

    if (entries.length) {
      films++;
      entries.forEach((h, n) => {
        // La nota va sull'ultima visione sola: ripetuta su ogni voce del
        // diario diventerebbe tre recensioni uguali.
        const review = n === entries.length - 1 ? i.notes : "";
        rows.push([...base, h.date, i.vote ?? "", h.action === "rewatch" ? "true" : "false", review]);
      });
    } else if (i.status === "Visto") {
      films++;
      // Visto senza una data: Letterboxd lo segna come visto, col voto, e la
      // nota diventa una recensione senza data.
      rows.push([...base, "", i.vote ?? "", "", i.notes]);
    } else if (i.status === "Da vedere") {
      wantedRows.push(base);
    }
  }

  return {
    diary: rows.length ? splitParts(header, rows, `cinemate-letterboxd-${day}`) : [],
    watchlist: wantedRows.length
      ? splitParts(["Title", "Year", "tmdbID", "imdbID"], wantedRows, `cinemate-letterboxd-watchlist-${day}`)
      : [],
    films,
    entries: rows.length,
    wanted: wantedRows.length,
    skippedSeries,
  };
}
