/**
 * Le uscite in arrivo come file di calendario (iCalendar, RFC 5545).
 *
 * Le notifiche di una pagina web arrivano solo se il browser le concede, e su
 * iPhone solo con l'app aggiunta alla schermata Home; il calendario del
 * telefono invece ricorda per conto suo, ad app chiusa, e mette l'episodio di
 * giovedì accanto alla cena di giovedì — che è dove si decide se guardarlo.
 * Un file `.ics` è il modo più semplice di arrivarci senza un server: si apre,
 * e il telefono propone di aggiungere gli eventi.
 *
 * Eventi di un giorno intero e «liberi» (`TRANSP:TRANSPARENT`): un episodio
 * non occupa la giornata, e un calendario che lo segnasse come impegno
 * risponderebbe «occupato» a chi ti propone un caffè. L'`UID` è stabile — lo
 * stesso titolo nello stesso giorno ha sempre lo stesso — così importare di
 * nuovo il file aggiorna gli eventi invece di duplicarli, nei calendari che
 * lo rispettano.
 */

export interface CalendarEvent {
  /** Unico e stabile fra un'esportazione e l'altra. */
  uid: string;
  /** Il giorno, `yyyy-mm-dd`. */
  date: string;
  summary: string;
  description?: string;
}

/** Il testo nel formato TEXT di iCalendar: barre, punti e virgola, virgole e a capo protetti. */
export function escapeText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

const encoder = new TextEncoder();

/**
 * Le righe si piegano a 75 ottetti, con la continuazione che comincia con uno
 * spazio. Ottetti e non caratteri: una «è» ne vale due, e tagliarla a metà
 * produrrebbe un carattere rotto in ogni calendario che legge il file.
 */
export function foldLine(line: string): string {
  if (encoder.encode(line).length <= 75) return line;
  const parts: string[] = [];
  let current = "";
  let bytes = 0;
  for (const char of line) {
    const size = encoder.encode(char).length;
    // La prima riga può arrivare a 75; le altre a 74 più lo spazio iniziale.
    const limit = parts.length === 0 ? 75 : 74;
    if (bytes + size > limit) {
      parts.push(current);
      current = "";
      bytes = 0;
    }
    current += char;
    bytes += size;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

function compactDay(date: string): string {
  return date.replace(/-/g, "");
}

function nextDay(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function stamp(now: Date): string {
  return now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

export function buildCalendar(events: CalendarEvent[], { name, now = new Date() }: { name: string; now?: Date }): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//CineMate//Uscite in arrivo//IT",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(name)}`,
  ];
  for (const e of events) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${e.uid}`,
      `DTSTAMP:${stamp(now)}`,
      `DTSTART;VALUE=DATE:${compactDay(e.date)}`,
      `DTEND;VALUE=DATE:${compactDay(nextDay(e.date))}`,
      `SUMMARY:${escapeText(e.summary)}`,
      ...(e.description ? [`DESCRIPTION:${escapeText(e.description)}`] : []),
      "TRANSP:TRANSPARENT",
      // Un promemoria alle nove del giorno stesso: per un evento di un giorno
      // intero l'inizio è la mezzanotte locale, quindi nove ore dopo.
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      "TRIGGER:PT9H",
      `DESCRIPTION:${escapeText(e.summary)}`,
      "END:VALARM",
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  // CRLF, come chiede la RFC: alcuni calendari rifiutano il file altrimenti.
  return lines.map(foldLine).join("\r\n") + "\r\n";
}
