// Import da Letterboxd, IMDb, Netflix e CSV; abbinamento; piano di unione; export.
process.env.TZ = "Europe/Rome";

const data = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => data.get(k) ?? null,
  setItem: (k: string, v: string) => void data.set(k, v),
  removeItem: (k: string) => void data.delete(k),
};

const { parseCsv, rowsAsRecords } = await import("../../src/lib/csv.ts");
const { readImportFiles, planImport, parseNetflixTitle, detectDayOrder, parseDay, DEFAULT_IMPORT_OPTIONS } = await import(
  "../../src/lib/importers.ts"
);
const { pickCandidate, titleSimilarity, foldTitle } = await import("../../src/lib/titleMatch.ts");
const { libraryCsv, letterboxdExport } = await import("../../src/lib/exportCsv.ts");
const { matchImported, matchAll } = await import("../../src/lib/importMatch.ts");
const { useLibrary } = await import("../../src/store/useLibrary.ts");

let failures = 0;
function check(name: string, cond: boolean, detail = "") {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!cond) failures++;
}

const byTitle = (bundle: any, title: string, year?: number) =>
  bundle.titles.find((t: any) => t.title === title && (year === undefined || t.year === year));

// ---------------------------------------------------------------- CSV
{
  const rows = parseCsv('﻿Name,Year,Review\r\n"Dottor Stranamore, ovvero…",1964,"Riga uno\nriga ""due"""\r\n');
  check("BOM tolto dalla prima intestazione", rows[0][0] === "Name", JSON.stringify(rows[0][0]));
  check("virgola dentro le virgolette", rows[1][0] === "Dottor Stranamore, ovvero…");
  check("a capo e virgolette raddoppiate", rows[1][2] === 'Riga uno\nriga "due"', JSON.stringify(rows[1][2]));
  const semi = rowsAsRecords(parseCsv("Titolo;Anno;Voto\nIl sorpasso;1962;9\n"));
  check("punto e virgola indovinato", semi.records[0].titolo === "Il sorpasso" && semi.records[0].voto === "9");
}

// ---------------------------------------------------------------- Date
check("ordine italiano riconosciuto", detectDayOrder(["03/04/26", "28/10/26"]) === "dmy");
check("ordine americano riconosciuto", detectDayOrder(["03/04/26", "10/28/26"]) === "mdy");
check("ordine ambiguo → italiano", detectDayOrder(["03/04/26", "05/06/26"]) === "dmy");
check("data italiana", parseDay("28/10/26", "dmy") === "2026-10-28");
check("data americana", parseDay("10/28/2026", "mdy") === "2026-10-28");
check("data ISO", parseDay("2024-02-29") === "2024-02-29");
check("31 aprile rifiutato", parseDay("31/04/26", "dmy") === null);

// ---------------------------------------------------------------- Letterboxd
const LB = [
  {
    name: "watched.csv",
    text: [
      "Date,Name,Year,Letterboxd URI",
      "2019-03-01,Dune,1984,https://boxd.it/aaa",
      "2021-10-20,Dune,2021,https://boxd.it/bbb",
      '2019-03-01,"Crouching Tiger, Hidden Dragon",2000,https://boxd.it/ccc',
      "2019-03-01,The Great Beauty,2013,https://boxd.it/ddd",
    ].join("\n"),
  },
  {
    name: "ratings.csv",
    text: ["Date,Name,Year,Letterboxd URI,Rating", "2021-10-21,Dune,2021,https://boxd.it/bbb,4.5", "2019-03-01,Dune,1984,https://boxd.it/aaa,2"].join("\n"),
  },
  {
    name: "diary.csv",
    text: [
      "Date,Name,Year,Letterboxd URI,Rating,Rewatch,Tags,Watched Date",
      "2021-10-21,Dune,2021,https://boxd.it/x1,3,,imax,2021-10-20",
      "2024-03-02,Dune,2021,https://boxd.it/x2,4,Yes,,2024-03-01",
      "2020-01-05,The Thing,1982,https://boxd.it/x3,5,Yes,,2020-01-04",
    ].join("\n"),
  },
  {
    name: "reviews.csv",
    text: [
      "Date,Name,Year,Letterboxd URI,Rating,Rewatch,Review,Tags,Watched Date",
      '2021-10-21,Dune,2021,https://boxd.it/x1,3,,"Sabbia, <i>tanta</i> sabbia.",imax,2021-10-20',
    ].join("\n"),
  },
  { name: "watchlist.csv", text: ["Date,Name,Year,Letterboxd URI", "2022-01-01,Heat,1995,https://boxd.it/eee", "2022-01-01,Dune,2021,https://boxd.it/bbb"].join("\n") },
  { name: "likes/films.csv", text: ["Date,Name,Year,Letterboxd URI", "2022-02-02,The Thing,1982,https://boxd.it/fff"].join("\n") },
  {
    name: "lists/horror-di-ottobre.csv",
    text: [
      "Letterboxd list export v7",
      "Date,Name,Tags,URL,Description",
      "2024-10-01,Horror di ottobre,,https://letterboxd.com/me/list/horror/,Solo <b>notte</b>",
      "",
      "Position,Name,Year,URL,Description",
      "1,The Thing,1982,https://boxd.it/fff,",
      "2,Halloween,1978,https://boxd.it/ggg,",
    ].join("\n"),
  },
  { name: "profile.csv", text: "Date Joined,Username\n2019-01-01,io\n" },
  { name: "deleted/diary.csv", text: "Date,Name,Year,Letterboxd URI,Rating,Rewatch,Tags,Watched Date\n2019-01-01,Cats,2019,x,,,,2019-01-01\n" },
];
const lb = readImportFiles(LB);
{
  const dune84 = byTitle(lb, "Dune", 1984);
  const dune21 = byTitle(lb, "Dune", 2021);
  check("Dune 1984 e 2021 restano due titoli", !!dune84 && !!dune21 && dune84 !== dune21);
  check("il voto di ratings.csv vince sul diario", dune21.vote === 9, String(dune21.vote));
  check("mezza stella → voto su dieci", dune84.vote === 4, String(dune84.vote));
  check("due visioni dal diario, la seconda dichiarata rivisione", dune21.watches.length === 2 && dune21.watches[1].rewatch === true, JSON.stringify(dune21.watches));
  check("la recensione doppia il diario senza raddoppiare la visione", dune21.watches.length === 2);
  check("recensione senza HTML", dune21.notes.includes("Sabbia, tanta sabbia."), dune21.notes);
  check("etichette nelle note", dune21.notes.includes("Etichette: imax"));
  check("visto vince sulla watchlist", dune21.status === "Visto");
  check("film visto senza diario: nessuna visione inventata", dune84.watches.length === 0 && dune84.status === "Visto");
  check("data d'ingresso = la prima registrazione", dune84.addedDate === "2019-03-01");
  const heat = byTitle(lb, "Heat");
  check("solo in watchlist → Da vedere", heat.status === "Da vedere" && !heat.listOnly);
  const thing = byTitle(lb, "The Thing");
  check("un cuore vuol dire preferito e visto", thing.fav === true && thing.status === "Visto");
  const halloween = byTitle(lb, "Halloween");
  check("titolo che è solo in una lista → segnato come tale", halloween.listOnly === true);
  check("lista letta con nome e ordine", lb.lists.length === 1 && lb.lists[0].name === "Horror di ottobre" && lb.lists[0].keys.length === 2);
  check("descrizione della lista senza HTML", lb.lists[0].description === "Solo notte", lb.lists[0].description);
  check("titolo con la virgola letto intero", !!byTitle(lb, "Crouching Tiger, Hidden Dragon"));
  check("profile.csv e deleted/ ignorati", !byTitle(lb, "Cats") && !lb.files.some((f: any) => f.name === "profile.csv"));
}

// ---------------------------------------------------------------- IMDb
const IMDB_RATINGS = {
  name: "ratings.csv",
  text: [
    "Const,Your Rating,Date Rated,Title,Original Title,URL,Title Type,IMDb Rating,Runtime (mins),Year,Genres,Num Votes,Release Date,Directors",
    "tt0133093,9,2020-05-01,The Matrix,The Matrix,https://www.imdb.com/title/tt0133093/,Movie,8.7,136,1999,\"Action, Sci-Fi\",2000000,1999-03-31,\"Lana Wachowski, Lilly Wachowski\"",
    "tt0903747,10,2021-01-01,Breaking Bad,Breaking Bad,https://www.imdb.com/title/tt0903747/,TV Series,9.5,49,2008,\"Crime, Drama\",2000000,2008-01-20,",
    "tt0959621,8,2021-01-02,Pilot,Pilot,https://www.imdb.com/title/tt0959621/,TV Episode,9.0,58,2008,Drama,1000,2008-01-20,Vince Gilligan",
    "tt2140553,7,2021-01-03,Some Game,Some Game,https://www.imdb.com/title/tt2140553/,Video Game,8.0,,2013,Action,1000,2013-01-01,",
    "tt2085059,8,2022-06-06,Free Solo,Free Solo,https://www.imdb.com/title/tt2085059/,Movie,8.1,100,2018,\"Documentary, Sport\",1000,2018-09-28,Jimmy Chin",
  ].join("\n"),
};
const IMDB_WATCHLIST = {
  name: "WATCHLIST.csv",
  text: [
    "Position,Const,Created,Modified,Description,Title,Original Title,URL,Title Type,IMDb Rating,Runtime (mins),Year,Genres,Num Votes,Release Date,Directors,Your Rating,Date Rated",
    "1,tt0113277,2023-01-01,2023-01-01,,Heat,Heat,https://www.imdb.com/title/tt0113277/,movie,8.3,170,1995,Crime,700000,1995-12-15,Michael Mann,,",
  ].join("\n"),
};
const imdb = readImportFiles([IMDB_RATINGS, IMDB_WATCHLIST]);
{
  const matrix = imdb.titles.find((t: any) => t.imdbId === "tt0133093");
  check("IMDb: voto, durata, regia", matrix.vote === 9 && matrix.runtime === 136 && matrix.director === "Lana Wachowski", JSON.stringify([matrix.vote, matrix.runtime, matrix.director]));
  check("IMDb: nessuna visione dalla data del voto", matrix.watches.length === 0 && matrix.addedDate === "2020-05-01");
  const bb = imdb.titles.find((t: any) => t.imdbId === "tt0903747");
  check("IMDb: TV Series → serie", bb.mediaType === "tv" && bb.kind === "serie");
  check("IMDb: episodi e videogiochi lasciati fuori", imdb.titles.length === 4, String(imdb.titles.length));
  check("IMDb: il perché degli scarti", imdb.skipped.some((s: any) => s.reason.startsWith("episodi") && s.count === 1));
  check("IMDb: documentario riconosciuto", imdb.titles.find((t: any) => t.imdbId === "tt2085059").kind === "doc");
  const heat = imdb.titles.find((t: any) => t.imdbId === "tt0113277");
  check("IMDb: watchlist (formato vecchio, «movie») → Da vedere", heat.status === "Da vedere" && heat.addedDate === "2023-01-01");
}

// ---------------------------------------------------------------- Netflix
{
  const t = parseNetflixTitle("Stranger Things: Stagione 1: Capitolo uno: La scomparsa di Will Byers");
  check("Netflix: serie con stagione", t.show === "Stranger Things" && t.episode === "Stagione 1: Capitolo uno: La scomparsa di Will Byers");
  check("Netflix: «Kill Bill: Volume 1» è un film", parseNetflixTitle("Kill Bill: Volume 1").episode === null);
  check("Netflix: film coi due punti", parseNetflixTitle("Glass Onion: A Knives Out Mystery").episode === null);
  check("Netflix: «Parte» con la puntata dopo è una serie", parseNetflixTitle("La casa di carta: Parte 1: Episodio 1").show === "La casa di carta");
  check("Netflix: miniserie", parseNetflixTitle("La regina degli scacchi: Miniserie: Aperture").show === "La regina degli scacchi");
  check("Netflix: puntata senza stagione", parseNetflixTitle("Baby Reindeer: Episodio 3").show === "Baby Reindeer");
}
const NETFLIX = {
  name: "NetflixViewingHistory.csv",
  text: [
    "Title,Date",
    '"Stranger Things: Stagione 1: Capitolo due: La strana di Maple Street","13/10/26"',
    '"Stranger Things: Stagione 1: Capitolo uno: La scomparsa di Will Byers","13/10/26"',
    '"Stranger Things: Stagione 1: Capitolo uno: La scomparsa di Will Byers","12/10/26"',
    '"Glass Onion: A Knives Out Mystery","02/01/23"',
    '"Glass Onion: A Knives Out Mystery","01/01/23"',
    '"Glass Onion: A Knives Out Mystery","20/06/24"',
    '"Senza data",""',
  ].join("\n"),
};
const nf = readImportFiles([NETFLIX]);
{
  const st = byTitle(nf, "Stranger Things");
  check("Netflix: episodi diversi contati una volta", st.episodesSeen === 2, String(st.episodesSeen));
  check("Netflix: una voce per giorno con il conto", st.watches.length === 2 && st.watches[1].episodes === 2, JSON.stringify(st.watches));
  check("Netflix: serie In visione, piattaforma Netflix", st.status === "In visione" && st.platform === "Netflix");
  const go = byTitle(nf, "Glass Onion: A Knives Out Mystery");
  check("Netflix: due giorni di fila = una visione, poi una seconda", go.watches.length === 2 && go.watches[0].date === "2023-01-02", JSON.stringify(go.watches));
  check("Netflix: riga senza data scartata col perché", nf.skipped.some((s: any) => s.count === 1));
}

// ---------------------------------------------------------------- Abbinamento
{
  const cands = [
    { title: "Dune", originalTitle: "Dune", year: 2021 },
    { title: "Dune", originalTitle: "Dune", year: 1984 },
  ];
  check("abbinamento: l'anno sceglie Dune 1984", pickCandidate(cands, { title: "Dune", year: 1984 })?.year === 1984);
  check("abbinamento: entro un anno", pickCandidate([{ title: "Roma", year: 2018 }], { title: "Roma", year: 2019 })?.year === 2018);
  check("abbinamento stretto: anno lontano → nessuno", pickCandidate([{ title: "Dune", year: 2021 }], { title: "Dune", year: 1984 }, { strictYear: true }) === null);
  check("abbinamento largo: anno lontano → il primo", pickCandidate([{ title: "Dune", year: 2021 }], { title: "Dune", year: 1984 })?.year === 2021);
  check(
    "titolo alternativo: l'anno giusto basta",
    pickCandidate([{ title: "La grande bellezza", originalTitle: "La grande bellezza", year: 2013 }], { title: "The Great Beauty", year: 2013 }, { strictYear: true })?.year === 2013,
  );
  check(
    "a parità d'anno vince chi somiglia",
    pickCandidate([{ title: "Altro", year: 1999 }, { title: "Matrix", originalTitle: "The Matrix", year: 1999 }], { title: "The Matrix", year: 1999 })?.title === "Matrix",
  );
  check("articolo ignorato", titleSimilarity("The Thing", "Thing") === 0.95);
  check("alfabeti non latini non si svuotano", foldTitle("千と千尋の神隠し").length > 0);
}

// TMDB finto: risponde secondo il percorso.
const calls: string[] = [];
(globalThis as any).fetch = async (input: string) => {
  const url = new URL(input);
  calls.push(url.pathname + url.search.replace(/api_key=[^&]*&?/, ""));
  const p = url.pathname;
  const q = url.searchParams;
  const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
  if (p.endsWith("/find/tt0133093")) return json({ movie_results: [{ id: 603, title: "Matrix", original_title: "The Matrix", release_date: "1999-03-30", poster_path: "/m.jpg", genre_ids: [28] }], tv_results: [] });
  if (p.endsWith("/search/movie") && q.get("query") === "Dune" && q.get("primary_release_year") === "1984")
    return json({ results: [{ id: 841, title: "Dune", original_title: "Dune", release_date: "1984-12-14", poster_path: "/d84.jpg" }] });
  if (p.endsWith("/search/movie") && q.get("query") === "Remake" ) return json({ results: [{ id: 9, title: "Remake", release_date: "2020-01-01" }] });
  if (p.endsWith("/search/tv") && q.get("query") === "Stranger Things")
    return json({ results: [{ id: 66732, name: "Stranger Things", original_name: "Stranger Things", first_air_date: "2016-07-15", poster_path: "/st.jpg", origin_country: ["US"] }] });
  return json({ results: [] });
};
{
  const m1 = await matchImported({ key: "imdb:tt0133093", title: "The Matrix", year: 1999, imdbId: "tt0133093", tmdbId: null, mediaType: "movie" } as any, "k");
  check("abbinamento IMDb esatto via /find", m1?.tmdbId === 603 && m1?.title === "Matrix");
  const m2 = await matchImported({ key: "lb:dune|1984", title: "Dune", year: 1984, imdbId: null, tmdbId: null, mediaType: "movie" } as any, "k");
  check("abbinamento per anno al primo colpo", m2?.tmdbId === 841, JSON.stringify(m2));
  calls.length = 0;
  const m3 = await matchImported({ key: "lb:remake|1960", title: "Remake", year: 1960, imdbId: null, tmdbId: null, mediaType: "movie" } as any, "k");
  check("remake di un altro anno: nessun abbinamento", m3 === null);
  check("…dopo aver provato film e serie, con e senza anno", calls.length === 4, calls.join(" | "));
  const m4 = await matchImported({ key: "nf:stranger things", title: "Stranger Things", year: null, imdbId: null, tmdbId: null, mediaType: "tv" } as any, "k");
  check("serie di Netflix: cercata fra le serie", m4?.tmdbId === 66732 && m4?.mediaType === "tv");
  const progress: number[] = [];
  const all = await matchAll(nf.titles, "k", { onProgress: (p: any) => progress.push(p.done) });
  check("matchAll: un risultato per titolo, avanzamento fino in fondo", all.size === nf.titles.length && progress[progress.length - 1] === nf.titles.length);
}

// ---------------------------------------------------------------- Piano di unione
const item = (over: Record<string, unknown>) =>
  ({
    id: String(Math.random()),
    title: "x",
    kind: "film",
    year: 2000,
    genre: "",
    status: "Da vedere",
    vote: null,
    platform: "Altro",
    runtime: 0,
    episodes: null,
    seen: 0,
    seasons: null,
    fav: false,
    rewatch: 0,
    overview: "",
    director: "",
    cast: [],
    similar: [],
    notes: "",
    added: "2026-01-01",
    tmdbId: null,
    tmdbMediaType: null,
    posterPath: null,
    trailerUrl: null,
    links: [],
    ...over,
  }) as any;
{
  const library = [
    item({ id: "dune21", title: "Dune", year: 2021, tmdbId: 438631, tmdbMediaType: "movie", status: "Da vedere", vote: 6 }),
    item({ id: "thing", title: "La cosa", year: 1982, status: "Abbandonato" }),
  ];
  const history = [{ id: "h1", itemId: "dune21", title: "Dune", kind: "film", date: "2021-10-20", action: "watched" }];
  const matches = new Map<string, any>();
  for (const t of lb.titles) {
    if (t.title === "Dune" && t.year === 2021) matches.set(t.key, { tmdbId: 438631, mediaType: "movie", title: "Dune", year: 2021, posterPath: "/d.jpg", kind: "film" });
    else if (t.title === "The Thing") matches.set(t.key, { tmdbId: 1091, mediaType: "movie", title: "La cosa", year: 1982, posterPath: "/t.jpg", kind: "film" });
    else if (t.title === "Dune") matches.set(t.key, { tmdbId: 841, mediaType: "movie", title: "Dune", year: 1984, posterPath: "/d84.jpg", kind: "film" });
    else matches.set(t.key, null);
  }
  const plan = planImport(lb, library, history, matches, DEFAULT_IMPORT_OPTIONS);
  const duneUpdate = plan.updates.find((u: any) => u.id === "dune21");
  check("piano: Dune riconosciuto per id TMDB, non doppione", !plan.incoming.some((i: any) => i.tmdbId === 438631));
  check("piano: Da vedere → Visto", duneUpdate?.patch.status === "Visto");
  check("piano: il tuo voto non si tocca", duneUpdate?.patch.vote === undefined);
  check(
    "piano: il giorno già nel diario non si ripete",
    plan.diary.filter((d: any) => d.itemId === "dune21").map((d: any) => `${d.date}:${d.action}`).join() === "2024-03-01:rewatch",
    JSON.stringify(plan.diary.filter((d: any) => d.itemId === "dune21")),
  );
  check("piano: rivisione contata", duneUpdate?.patch.rewatch === 1);
  const thingUpdate = plan.updates.find((u: any) => u.id === "thing");
  check("piano: «Abbandonato» resta una scelta tua", !thingUpdate || thingUpdate.patch.status === undefined);
  check("piano: «La cosa» trovata per titolo e anno di TMDB", !!thingUpdate && thingUpdate.patch.fav === true && thingUpdate.patch.tmdbId === 1091);
  const dune84 = plan.incoming.find((i: any) => i.tmdbId === 841);
  check("piano: Dune 1984 nuovo, col titolo e la copertina di TMDB", !!dune84 && dune84.posterPath === "/d84.jpg" && dune84.status === "Visto");
  check("piano: i non riconosciuti contati", plan.summary.unmatched === 4, String(plan.summary.unmatched));
  const list = plan.lists[0];
  check("piano: la lista punta al titolo che c'era e a quello nuovo", list && list.members.length === 2 && "itemId" in list.members[0] && "index" in list.members[1], JSON.stringify(list));

  const noWatchlist = planImport(lb, library, history, matches, { ...DEFAULT_IMPORT_OPTIONS, watchlist: false, lists: false, unmatched: false });
  check("opzioni: senza watchlist, liste e non riconosciuti", !noWatchlist.incoming.some((i: any) => i.status === "Da vedere") && noWatchlist.lists.length === 0);
}

// ---------------------------------------------------------------- Scrittura e secondo import
{
  useLibrary.setState({ items: [], history: [] });
  const matches = new Map<string, any>([...lb.titles.map((t: any) => [t.key, null] as const)]);
  const first = planImport(lb, [], [], matches);
  const result = useLibrary.getState().mergeImported(first.incoming, first.updates, first.diary, first.addedDates);
  check("scrittura: salvata, con gli id nuovi in ordine", result.saved && result.createdIds.length === first.incoming.length);
  check("scrittura: id d'import, che la correzione UTC non tocca", result.createdIds.every((id: string) => id.startsWith("imp-")));
  const { items, history } = useLibrary.getState();
  check("scrittura: diario in ordine di data", history.every((h: any, i: number) => i === 0 || history[i - 1].date <= h.date));
  check("scrittura: data d'ingresso dal file", items.find((i: any) => i.title === "Dune" && i.year === 1984)?.added === "2019-03-01");
  const second = planImport(lb, items, history, matches);
  check("secondo import dello stesso file: niente di nuovo", second.incoming.length === 0 && second.diary.length === 0, JSON.stringify(second.summary));
}

// ---------------------------------------------------------------- Export
{
  const library = [
    item({ id: "a", title: 'Il "sorpasso", di Risi', year: 1962, status: "Visto", vote: 9, notes: "Una nota\nsu due righe", tmdbId: 10, tmdbMediaType: "movie" }),
    item({ id: "b", title: "Città aperta", year: 1945, status: "Da vedere" }),
    item({ id: "c", title: "Dark", kind: "serie", year: 2017, status: "In visione", seen: 5, episodes: 26, tmdbMediaType: "tv", tmdbId: 70523 }),
  ];
  const history = [
    { id: "1", itemId: "a", title: "x", kind: "film", date: "2020-01-01", action: "watched" },
    { id: "2", itemId: "a", title: "x", kind: "film", date: "2024-01-01", action: "rewatch" },
    { id: "3", itemId: "c", title: "x", kind: "serie", date: "2024-02-01", action: "episode", count: 5 },
  ];
  const csv = libraryCsv(library, history);
  check("foglio: BOM e punto e virgola", csv.startsWith("﻿Titolo;Anno;Tipo"));
  check("foglio: accenti intatti", csv.includes("Città aperta"));
  const back = readImportFiles([{ name: "cinemate.csv", text: csv }]);
  const sorpasso = back.titles.find((t: any) => t.tmdbId === 10);
  check("foglio: si rilegge (titolo con virgolette, voto, stato)", sorpasso?.title === 'Il "sorpasso", di Risi' && sorpasso.vote === 9 && sorpasso.status === "Visto", JSON.stringify(sorpasso));
  check("foglio: la serie torna serie, con gli episodi", back.titles.find((t: any) => t.title === "Dark")?.episodesSeen === 5);

  const lbx = letterboxdExport(library, history, "2026-10-30");
  const lines = lbx.diary[0].content.trim().split("\n");
  check("Letterboxd: intestazione dell'import", lines[0] === "Title,Year,tmdbID,imdbID,WatchedDate,Rating10,Rewatch,Review");
  check("Letterboxd: una riga per visione", lines.length === 3 && lines[2].includes("2024-01-01") && lines[2].includes(",true,"));
  check("Letterboxd: virgolette con la barra, come chiede il loro import", lines[1].startsWith('"Il \\"sorpasso\\", di Risi"'), lines[1]);
  check("Letterboxd: la nota solo sull'ultima visione, senza a capo", !lines[1].includes("Una nota") && lines[2].endsWith("Una nota su due righe"));
  check("Letterboxd: watchlist a parte", lbx.watchlist[0].content.includes("Città aperta") && lbx.wanted === 1);
  check("Letterboxd: le serie restano fuori, e si dice", lbx.skippedSeries === 1 && !lbx.diary[0].content.includes("Dark"));

  const many = Array.from({ length: 12_000 }, (_, i) => item({ id: `m${i}`, title: `Film numero ${i} con un titolo lungo abbastanza`, year: 2000, status: "Visto", vote: 7, notes: "x".repeat(60) }));
  const big = letterboxdExport(many, [], "2026-10-30");
  check(
    "Letterboxd: oltre un mega si spezza, intestazione in ogni parte",
    big.diary.length > 1 && big.diary.every((p: any) => p.content.startsWith("Title,Year") && new TextEncoder().encode(p.content).length <= 1_000_000),
    `${big.diary.length} parti`,
  );
}

console.log(failures === 0 ? "\nTutti i controlli passati." : `\n${failures} controlli falliti.`);
process.exit(failures === 0 ? 0 : 1);
