// Il registro degli episodi: dal contatore a «quali e quando», e ritorno.
const ep = await import("../../src/lib/episodes.ts");
const { buildBackup, parseBackup, CURRENT_VERSION } = await import("../../src/lib/backup.ts");
const { migrateEpisodes } = await import("../../src/store/useLibrary.ts");

let failures = 0;
function check(name: string, cond: boolean, detail = "") {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!cond) failures++;
}
const fmt = (list: { season: number; episode: number }[]) => list.map((r) => `S${r.season}E${r.episode}`).join(" ");

function serie(over: Record<string, unknown> = {}): any {
  return {
    id: "s1", title: "Dark", kind: "serie", year: 2017, genre: "", status: "In visione", vote: null,
    platform: "Netflix", runtime: 55, episodes: 26, seen: 0, seasons: 3, fav: false, rewatch: 0,
    overview: "", director: "", cast: [], similar: [], notes: "", added: "2026-01-10",
    tmdbId: 70523, tmdbMediaType: "tv", posterPath: null, trailerUrl: null, links: [],
    ...over,
  };
}

// 1. Le posizioni seguono la divisione in stagioni.
check("posizioni con divisione", fmt(ep.positions([2, 3], 4)) === "S1E1 S1E2 S2E1 S2E2", fmt(ep.positions([2, 3], 4)));
check("posizioni senza divisione", fmt(ep.positions(null, 3)) === "S1E1 S1E2 S1E3");
check("oltre l'ultima stagione si prosegue", fmt(ep.positions([2], 4)) === "S1E1 S1E2 S1E3 S1E4");

// 2. Migrazione: date dal diario, il resto stimato all'aggiunta, prima in ordine.
const history = [
  { id: "a", itemId: "s1", title: "Dark", kind: "serie", date: "2026-02-01", action: "episode", count: 2 },
  { id: "b", itemId: "s1", title: "Dark", kind: "serie", date: "2026-02-03", action: "episode" },
  { id: "c", itemId: "altro", title: "X", kind: "serie", date: "2026-02-02", action: "episode", count: 5 },
];
const dark = serie({ seen: 5, seasonEpisodes: [10, 8, 8] });
const migrated = ep.migrateWatched(dark, history as any);
check("migrazione: cinque episodi", migrated.length === 5);
check("migrazione: posti in ordine", fmt(migrated) === "S1E1 S1E2 S1E3 S1E4 S1E5");
check("migrazione: i due senza diario sono i primi, stimati", migrated[0].estimated === true && migrated[1].estimated === true && migrated[0].date === "2026-01-10");
check("migrazione: poi le date del diario", migrated[2].date === "2026-02-01" && migrated[3].date === "2026-02-01" && migrated[4].date === "2026-02-03");
check("migrazione: con la divisione non sono provvisori", migrated.every((w) => !w.provisional));
check("migrazione: il diario di un altro titolo non conta", !migrated.some((w) => w.date === "2026-02-02"));

// 3. Senza divisione: tutti in S1, provvisori; poi la divisione arriva.
const blind = ep.migrateWatched(serie({ seen: 12, seasonEpisodes: undefined }), []);
check("senza divisione: in S1", blind.every((w) => w.season === 1 && w.provisional));
const remapped = ep.remapProvisional(blind, [10, 8, 8]);
check("ridistribuiti fra le stagioni", fmt(remapped).endsWith("S1E10 S2E1 S2E2"), fmt(remapped));
check("ridistribuiti: non più provvisori", remapped.every((w) => !w.provisional));
check("ridistribuiti: stesse date", remapped.every((w) => w.date === "2026-01-10"));

// 4. Il prossimo episodio scavalca la fine della stagione.
const atEnd = serie({ seasonEpisodes: [2, 2], episodes: 4, watched: ep.positions([2, 2], 2).map((r: any) => ({ ...r, date: "x" })) });
check("prossimo: inizio della stagione 2", fmt([ep.nextEpisode(atEnd)!]) === "S2E1");
const finished = serie({ seasonEpisodes: [2, 2], episodes: 4, watched: ep.positions([2, 2], 4).map((r: any) => ({ ...r, date: "x" })) });
check("prossimo: nessuno a serie finita", ep.nextEpisode(finished) === null);
const gap = serie({ seasonEpisodes: [3], watched: [{ season: 1, episode: 1, date: "x" }, { season: 1, episode: 3, date: "x" }] });
check("prossimo: il primo buco, non dopo l'ultimo", fmt([ep.nextEpisode(gap)!]) === "S1E2");
check("prossimo: un film non ne ha", ep.nextEpisode({ ...serie(), kind: "film" }) === null);

// 5. «Visto fino a qui» attraversa le stagioni quando la divisione c'è.
check("fino a S2E2", fmt(ep.upTo(serie({ seasonEpisodes: [3, 3] }), { season: 2, episode: 2 })) === "S1E1 S1E2 S1E3 S2E1 S2E2");
check("fino a S2E2 senza divisione: solo la stagione 2", fmt(ep.upTo(serie({ seasonEpisodes: undefined }), { season: 2, episode: 2 })) === "S2E1 S2E2");

// 6. Il contatore ± e la casella «Ep. visti» parlano ancora in totali.
const grown = ep.resizeWatched(serie({ seasonEpisodes: [3, 3], watched: [{ season: 1, episode: 1, date: "a" }] }), 4, "b");
check("allungato a 4", fmt(grown) === "S1E1 S1E2 S1E3 S2E1" && grown[0].date === "a" && grown[3].date === "b", fmt(grown));
check("accorciato a 2", fmt(ep.resizeWatched(serie({ watched: grown }), 2, "c")) === "S1E1 S1E2");

// 7. La migrazione della libreria è idempotente.
const lib = [serie({ seen: 3, seasonEpisodes: [10] }), { ...serie({ id: "f" }), kind: "film", seen: 0 }];
const first = migrateEpisodes(lib, []);
const second = migrateEpisodes(first.items, []);
check("libreria: migrata una volta", first.changed && first.items[0].watched.length === 3);
check("libreria: la seconda passata non fa niente", !second.changed);
check("libreria: i film restano senza registro", first.items[1].watched === undefined);

// 8. Backup andata e ritorno, versione dello schema.
const withRegistry = first.items;
const file = buildBackup(withRegistry, history.slice(0, 2) as any);
const parsedFile = JSON.parse(file);
check("backup: versione dello schema", parsedFile.version === CURRENT_VERSION && CURRENT_VERSION === 6, String(parsedFile.version));
const back = parseBackup(file);
check("backup: titoli identici", JSON.stringify(back.items) === JSON.stringify(withRegistry));
check("backup: diario identico", back.history.length === 2 && back.history[0].count === 2);

// Un file della versione 5, senza registro: la migrazione lo ricostruisce.
const v5 = JSON.stringify({ app: "cinemate", version: 5, items: [serie({ seen: 3 })], history: history.slice(0, 2) });
const old = parseBackup(v5);
const rebuilt = migrateEpisodes(old.items, old.history).items[0];
check("backup v5: registro ricostruito", rebuilt.watched.length === 3 && rebuilt.watched[2].date === "2026-02-03", JSON.stringify(rebuilt.watched));

// Un registro sporco si pulisce; uno che non è un elenco si toglie.
const dirty = JSON.stringify({ app: "cinemate", version: 6, items: [serie({ watched: [{ season: 1, episode: 1, date: "a" }, { season: 0, episode: 1, date: "b" }, "x"] }), serie({ id: "s2", watched: "rotto", seen: 2 })], history: [] });
const cleaned = parseBackup(dirty).items;
check("backup sporco: tenute solo le voci valide", cleaned[0].watched?.length === 1 && cleaned[0].seen === 1);
check("backup sporco: registro non valido tolto", cleaned[1].watched === undefined && cleaned[1].seen === 2);

console.log(failures === 0 ? "\nTutti i controlli passati." : `\n${failures} controlli falliti.`);
process.exit(failures === 0 ? 0 : 1);
