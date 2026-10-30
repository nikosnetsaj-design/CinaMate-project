// Le uscite come file di calendario (RFC 5545).
process.env.TZ = "Europe/Rome";
const { buildCalendar, escapeText, foldLine } = await import("../../src/lib/ics.ts");
const { upcomingEvents } = await import("../../src/lib/upcoming.ts");

let failures = 0;
function check(name: string, cond: boolean, detail = "") {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!cond) failures++;
}

const escaped = escapeText("a,b;c\\d\ne");
check("testo protetto", escaped === String.raw`a\,b\;c\\d\ne`, escaped);
const long = "DESCRIPTION:" + "è".repeat(60);
const folded = foldLine(long);
const bytes = folded.split("\r\n").map((l) => new TextEncoder().encode(l).length);
check("righe piegate entro 75 ottetti", bytes.every((b) => b <= 75), bytes.join(","));
check("le continuazioni cominciano con uno spazio", folded.split("\r\n").slice(1).every((l) => l.startsWith(" ")));
check("nessuna lettera tagliata a metà", folded.replace(/\r\n /g, "") === long);
check("riga corta intatta", foldLine("SUMMARY:Dune") === "SUMMARY:Dune");

const item = (over: Record<string, unknown>) => ({ id: "x", title: "x", year: 2024, tmdbId: 1, tmdbMediaType: "tv", ...over }) as any;
const events = upcomingEvents([
  { item: item({ title: "Stranger Things", tmdbId: 66732 }), date: "2026-11-20", type: "episodio", season: 5, episode: 1 },
  { item: item({ title: "Dune: Parte tre", tmdbId: 1170608, tmdbMediaType: "movie", year: 2026 }), date: "2026-12-18", type: "film", season: null, episode: null },
]);
check("episodio: titolo e codice", events[0].summary === "Stranger Things · S05E01");
check("UID senza data: se l'uscita si sposta, l'evento si sposta", events[0].uid === "tv-66732-s05e01@cinemate" && events[1].uid === "movie-1170608@cinemate");

const ics = buildCalendar(events, { name: "CineMate · uscite", now: new Date("2026-10-30T10:00:00Z") });
check("CRLF ovunque", !/[^\r]\n/.test(ics) && ics.endsWith("\r\n"));
check("busta del calendario", ics.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n") && ics.includes("END:VCALENDAR"));
check("giorno intero: fine esclusiva al giorno dopo", ics.includes("DTSTART;VALUE=DATE:20261120\r\nDTEND;VALUE=DATE:20261121"));
check("fine anno: il giorno dopo il 31 dicembre", buildCalendar([{ uid: "u", date: "2026-12-31", summary: "x" }], { name: "x" }).includes("DTEND;VALUE=DATE:20270101"));
check("non occupa la giornata", ics.includes("TRANSP:TRANSPARENT"));
check("promemoria alle nove", ics.includes("TRIGGER:PT9H"));
check("DTSTAMP in UTC", ics.includes("DTSTAMP:20261030T100000Z"));
check("due eventi", (ics.match(/BEGIN:VEVENT/g) ?? []).length === 2);

console.log(failures === 0 ? "\nTutti i controlli passati." : `\n${failures} controlli falliti.`);
process.exit(failures === 0 ? 0 : 1);
