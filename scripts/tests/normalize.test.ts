process.env.TZ = "Europe/Rome";

const { normalizeItem, normalizeHistoryEntry, salvage } = await import("../../src/lib/normalize.ts");
const { parseBackup, BackupParseError } = await import("../../src/lib/backup.ts");

let failures = 0;
function check(name: string, cond: boolean, detail = "") {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!cond) failures++;
}

// 1. Un record minimo diventa un titolo completo, senza campi che rompono la scheda.
{
  const item = normalizeItem({ id: "a1", title: "  Alien " });
  check("titolo minimo accettato", item !== null);
  check("spazi tolti dal titolo", item?.title === "Alien", item?.title);
  check("cast è un elenco", Array.isArray(item?.cast) && item!.cast.length === 0);
  check("links e similar sono elenchi", Array.isArray(item?.links) && Array.isArray(item?.similar));
  check("stato predefinito", item?.status === "Da vedere", item?.status);
  check("piattaforma sconosciuta → Altro", item?.platform === "Altro", item?.platform);
  check("tipo predefinito film", item?.kind === "film");
  check("data di aggiunta presente", /^\d{4}-\d{2}-\d{2}$/.test(item?.added ?? ""), item?.added);
}

// 2. Valori fuori misura riportati dentro.
{
  const item = normalizeItem({ id: "a2", title: "Serie", kind: "serie", vote: 14, episodes: 10, seen: 40, rewatch: -3, year: "1999" });
  check("voto oltre 10 → 10", item?.vote === 10, String(item?.vote));
  check("episodi visti oltre il totale → totale", item?.seen === 10, String(item?.seen));
  check("riviste negative → 0", item?.rewatch === 0);
  check("anno non numerico → 0 (sconosciuto)", item?.year === 0, String(item?.year));
  const low = normalizeItem({ id: "a3", title: "x", vote: 0.2 });
  check("voto sotto 1 → 1", low?.vote === 1, String(low?.vote));
  const none = normalizeItem({ id: "a4", title: "x", vote: "8" });
  check("voto non numerico → nessun voto", none?.vote === null);
}

// 3. Quello che questa versione non conosce resta; quello del tipo sbagliato no.
{
  const item = normalizeItem({ id: "a5", title: "Dune", campoFuturo: { x: 1 }, countries: "US", audioLangs: ["en"], quality: "8K", imdbId: "tt1160419" }) as any;
  check("campo sconosciuto conservato", item?.campoFuturo?.x === 1);
  check("countries non elenco → tolto", !("countries" in item));
  check("audioLangs valido → resta", item?.audioLangs?.[0] === "en");
  check("qualità inventata → tolta", !("quality" in item));
  check("id IMDb valido → resta", item?.imdbId === "tt1160419");
  const bad = normalizeItem({ id: "a6", title: "x", imdbId: "1160419" }) as any;
  check("id IMDb malformato → tolto", !("imdbId" in bad));
}

// 4. Senza titolo non è un titolo; senza id ne riceve uno.
{
  check("senza titolo → scartato", normalizeItem({ id: "x" }) === null);
  check("titolo vuoto → scartato", normalizeItem({ id: "x", title: "   " }) === null);
  check("non oggetto → scartato", normalizeItem("Alien") === null && normalizeItem(null) === null && normalizeItem([1]) === null);
  const noId = normalizeItem({ title: "Senza id" });
  check("senza id → id nuovo", typeof noId?.id === "string" && noId!.id.length > 5, noId?.id);
}

// 5. Il diario.
{
  check("voce senza titolo di riferimento → scartata", normalizeHistoryEntry({ id: "h", date: "2026-01-01" }) === null);
  check("voce senza data → scartata", normalizeHistoryEntry({ id: "h", itemId: "a" }) === null);
  const e = normalizeHistoryEntry({ id: "h", itemId: "a", date: "2026-01-02T10:00:00Z", action: "boh", count: 0 }) as any;
  check("data con l'ora → solo il giorno", e?.date === "2026-01-02", e?.date);
  check("azione sconosciuta → watched", e?.action === "watched");
  check("conteggio illeggibile → assente (cioè 1)", !("count" in e));
  const ts = Date.UTC(2026, 9, 28, 23, 30); // 00:30 del 29 a Roma (ora solare)
  const fixed = normalizeHistoryEntry({ id: `${ts}-abcdef`, itemId: "a", date: "2026-10-28", action: "episode", count: 3 });
  check("data UTC di mezzanotte corretta al giorno locale", fixed?.date === "2026-10-29", fixed?.date);
  check("conteggio valido conservato", fixed?.count === 3);
}

// 6. Un record storto non porta via gli altri.
{
  const { records, skipped } = salvage([{ id: "1", title: "A" }, { id: "2" }, "x", { id: "3", title: "C" }], normalizeItem);
  check("salvati i validi", records.length === 2, String(records.length));
  check("contati gli scartati", skipped === 2, String(skipped));
}

// 7. Il backup passa dalla stessa normalizzazione.
{
  const file = JSON.stringify({
    app: "cinemate",
    version: 5,
    items: [{ id: "i1", title: "Matrix" }, { nope: true }],
    history: [{ id: "h1", itemId: "i1", date: "2024-05-01", action: "watched" }, { id: "h2", itemId: "fantasma", date: "2024-05-02" }],
  });
  const backup = parseBackup(file);
  check("backup: titolo senza campi accettato e completato", backup.items.length === 1 && Array.isArray(backup.items[0].cast));
  check("backup: voce di un titolo assente scartata", backup.history.length === 1, String(backup.history.length));
  let threw = false;
  try {
    parseBackup(JSON.stringify({ items: [{ nope: 1 }] }));
  } catch (e) {
    threw = e instanceof BackupParseError;
  }
  check("backup senza titoli validi → errore leggibile", threw);
}

if (failures > 0) {
  console.log(`\n${failures} controlli falliti.`);
  process.exit(1);
}
console.log("\nTutti i controlli passati.");
