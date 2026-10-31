import type { UpcomingEntry } from "./upcoming";
import { downloadFile } from "./format";

/**
 * Le uscite di «Prossimamente» come file .ics, il formato che ogni calendario
 * sa importare (RFC 5545).
 *
 * Le promesse del formato che contano qui:
 *
 * - **eventi di un giorno intero** (`VALUE=DATE`): TMDB dà il giorno, non
 *   l'ora, e un evento alle 00:00 sarebbe un orario inventato;
 * - **UID stabile** per titolo, puntata e data: importare di nuovo il file
 *   aggiorna gli eventi invece di duplicarli;
 * - **avviso solo dove l'hai chiesto**: le uscite con la campanella accesa
 *   portano un promemoria alle 9 del giorno; le altre stanno in calendario
 *   in silenzio;
 * - **righe piegate a 75 byte** e testo con i caratteri speciali protetti,
 *   perché alcuni calendari rifiutano il file intero per una riga lunga.
 */

const CRLF = "\r\n";

export function escapeText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Piega una riga a 75 byte UTF-8, senza spezzare un carattere. */
export function foldLine(line: string): string {
  const encoder = new TextEncoder();
  const parts: string[] = [];
  let current = "";
  let bytes = 0;
  for (const char of line) {
    const size = encoder.encode(char).length;
    const limit = parts.length === 0 ? 75 : 74; // le continuazioni iniziano con uno spazio
    if (bytes + size > limit) {
      parts.push(current);
      current = "";
      bytes = 0;
    }
    current += char;
    bytes += size;
  }
  parts.push(current);
  return parts.join(`${CRLF} `);
}

function dateValue(iso: string): string {
  return iso.replace(/-/g, "");
}

function nextDay(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

function stamp(now: Date): string {
  return now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

export function eventUid(entry: UpcomingEntry): string {
  const who = entry.item.tmdbId ? `${entry.item.tmdbMediaType}-${entry.item.tmdbId}` : entry.item.id;
  const which = entry.type === "episodio" ? `s${entry.season ?? 0}e${entry.episode ?? 0}` : "film";
  return `${who}-${which}-${dateValue(entry.date)}@cinemate`;
}

export function eventSummary(entry: UpcomingEntry): string {
  if (entry.type === "film") return `${entry.item.title} — esce`;
  return entry.season != null && entry.episode != null
    ? `${entry.item.title} · S${entry.season}E${entry.episode}`
    : `${entry.item.title} · nuovo episodio`;
}

export function buildIcs(entries: UpcomingEntry[], reminders: Set<string>, now: Date = new Date()): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//CineMate//Prossimamente//IT",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:CineMate · Prossimamente",
  ];
  for (const entry of entries) {
    const description =
      entry.type === "film"
        ? `Uscita di «${entry.item.title}», dalla tua lista «Da vedere» su CineMate.`
        : `Nuovo episodio di «${entry.item.title}», una serie che segui su CineMate.`;
    lines.push(
      "BEGIN:VEVENT",
      `UID:${eventUid(entry)}`,
      `DTSTAMP:${stamp(now)}`,
      `DTSTART;VALUE=DATE:${dateValue(entry.date)}`,
      `DTEND;VALUE=DATE:${nextDay(entry.date)}`,
      `SUMMARY:${escapeText(eventSummary(entry))}`,
      `DESCRIPTION:${escapeText(description)}`,
      "TRANSP:TRANSPARENT",
    );
    if (reminders.has(entry.item.id)) {
      lines.push("BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${escapeText(eventSummary(entry))}`, "TRIGGER:PT9H", "END:VALARM");
    }
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join(CRLF) + CRLF;
}

/**
 * Consegna il file: sul telefono, dove c'è, il foglio di condivisione (che
 * offre «Aggiungi al calendario»); altrove lo scarica. Restituisce cosa è
 * successo, perché il messaggio dica il vero.
 */
export async function deliverIcs(text: string, fileName = "cinemate-prossimamente.ics"): Promise<"shared" | "downloaded" | "cancelled"> {
  const file = new File([text], fileName, { type: "text/calendar" });
  const coarse = typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;
  if (coarse && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: "CineMate · Prossimamente" });
      return "shared";
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return "cancelled";
    }
  }
  downloadFile(file, fileName);
  return "downloaded";
}
