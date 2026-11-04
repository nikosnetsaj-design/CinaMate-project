// Il calendario .ics: un file che i calendari accettano, e che reimportato aggiorna invece di doppiare.
const { buildIcs, escapeText, foldLine, eventUid } = await import("../../src/lib/ics.ts");

let failures = 0;
function check(name: string, cond: boolean, detail = "") {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!cond) failures++;
}

const item = (over: any) => ({ id: "x", title: "Titolo", tmdbId: 1, tmdbMediaType: "tv", ...over });
const entries: any[] = [
  { item: item({ id: "dark", title: "Dark", tmdbId: 70523 }), date: "2026-12-31", type: "episodio", season: 3, episode: 1 },
  { item: item({ id: "dune", title: "Dune; Parte Tre, il ritorno", tmdbId: 9, tmdbMediaType: "movie" }), date: "2027-03-01", type: "film", season: null, episode: null },
];
const ics = buildIcs(entries, new Set(["dark"]), new Date("2026-10-31T08:00:00Z"));
const lines = ics.split("\r\n");

check("ics: righe chiuse da CRLF", ics.endsWith("\r\n") && !/[^\r]\n/.test(ics));
check("ics: un calendario con due eventi", lines[0] === "BEGIN:VCALENDAR" && lines.filter((l: string) => l === "BEGIN:VEVENT").length === 2);
check("ics: giorno intero, fine al giorno dopo, anche a capodanno", ics.includes("DTSTART;VALUE=DATE:20261231") && ics.includes("DTEND;VALUE=DATE:20270101"));
check("ics: la puntata nel titolo", ics.includes("SUMMARY:Dark · S3E1"));
check("ics: punto e virgola e virgole protetti", ics.includes("SUMMARY:Dune\\; Parte Tre\\, il ritorno — esce"));
check("ics: l'avviso solo dove c'è la campanella", lines.filter((l: string) => l === "BEGIN:VALARM").length === 1 && ics.indexOf("BEGIN:VALARM") < ics.indexOf("Dune"));
check("ics: UID stabile per titolo, puntata e data", eventUid(entries[0]) === "tv-70523-s3e1-20261231@cinemate" && buildIcs(entries, new Set()).includes(`UID:${eventUid(entries[0])}`));
check("ics: DTSTAMP in UTC", ics.includes("DTSTAMP:20261031T080000Z"));
check("ics: nessuna riga oltre 75 byte", lines.every((l: string) => new TextEncoder().encode(l).length <= 75), String(Math.max(...lines.map((l: string) => new TextEncoder().encode(l).length))));

check("testo: a capo e barre", escapeText("a\\b\nc") === "a\\\\b\\nc");
const long = "DESCRIPTION:" + "è".repeat(80);
const folded = foldLine(long);
check("piegatura: continua con uno spazio e non spezza i caratteri", folded.split("\r\n ").join("") === long && folded.split("\r\n").every((p: string) => new TextEncoder().encode(p).length <= 75));

console.log(failures === 0 ? "\nTutti i controlli passati." : `\n${failures} controlli falliti.`);
process.exit(failures === 0 ? 0 : 1);
