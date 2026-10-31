// L'importazione da Letterboxd, Trakt, IMDb e TV Time: lettura dei file,
// unione, abbinamento al catalogo, e l'ingresso in libreria senza doppioni.
import { deflateRawSync } from "node:zlib";

const { parseCsv, parseImportFile, mergeEntries, toTen, ImportFormatError } = await import("../../src/lib/importers.ts");
const { judge } = await import("../../src/lib/importMatch.ts");
const { applyImport } = await import("../../src/lib/importApply.ts");
const { unzip, isZip } = await import("../../src/lib/unzip.ts");

let failures = 0;
function check(name: string, cond: boolean, detail = "") {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!cond) failures++;
}

// --- CSV ------------------------------------------------------------------
{
  const rows = parseCsv('﻿Name,Note\r\n"Uno, due","dice ""ciao""\nsu due righe"\r\nTre,\n\n');
  check("csv: virgole e virgolette dentro le virgolette", rows[1][0] === "Uno, due" && rows[1][1] === 'dice "ciao"\nsu due righe', JSON.stringify(rows[1]));
  check("csv: il BOM non sporca la prima intestazione", rows[0][0] === "Name");
  check("csv: le righe vuote non contano", rows.length === 3, String(rows.length));
  check("voti: mezze stelle su 10", toTen(4.5, 5) === 9 && toTen(0.5, 5) === 1 && toTen(7, 10) === 7);
  check("voti: zero o assente non è un voto", toTen(0, 10) === null && toTen(Number.NaN, 5) === null);
}

// --- Letterboxd -------------------------------------------------------------
{
  const ratings = parseImportFile(
    "ratings.csv",
    "Date,Name,Year,Letterboxd URI,Rating\n2024-01-02,The Godfather,1972,https://boxd.it/a,4.5\n",
  );
  check("letterboxd: riconosciuto dalle intestazioni", ratings.source === "letterboxd");
  check("letterboxd: voto convertito", ratings.entries[0].vote === 9);

  const diary = parseImportFile(
    "diary.csv",
    "Date,Name,Year,Letterboxd URI,Rating,Rewatch,Tags,Watched Date\n" +
      "2024-01-02,The Godfather,1972,https://boxd.it/x,4.5,,,2024-01-01\n" +
      "2024-06-02,The Godfather,1972,https://boxd.it/y,5,Yes,,2024-06-01\n",
  );
  const watchlist = parseImportFile("watchlist.csv", "Date,Name,Year,Letterboxd URI\n2024-03-03,Dune: Part Two,2024,https://boxd.it/b\n");
  check("letterboxd: la watchlist è da vedere", watchlist.entries[0].status === "Da vedere");
  const likes = parseImportFile("likes/films.csv", "Date,Name,Year,Letterboxd URI\n2024-03-03,Paris Texas,1984,https://boxd.it/c\n");
  check("letterboxd: i like diventano preferiti", likes.entries[0].fav);

  const merged = mergeEntries([...ratings.entries, ...diary.entries, ...watchlist.entries]);
  const godfather = merged.find((e: any) => e.title === "The Godfather");
  check("unione: un titolo da tre file è una voce", merged.length === 2, String(merged.length));
  check("unione: le visioni del diario in ordine", godfather.watchedDates.join() === "2024-01-01,2024-06-01", godfather.watchedDates.join());
  check("unione: la seconda visione è una revisione", godfather.rewatch === 1);
  check("unione: vince l'ultimo voto letto", godfather.vote === 10);
}

// --- IMDb ---------------------------------------------------------------------
{
  const imdb = parseImportFile(
    "ratings.csv",
    "Const,Your Rating,Date Rated,Title,Original Title,URL,Title Type,IMDb Rating,Runtime (mins),Year\n" +
      "tt0816692,9,2023-05-01,Interstellar,Interstellar,u,Movie,8.7,169,2014\n" +
      "tt0903747,10,2023-05-02,Breaking Bad,Breaking Bad,u,TV Series,9.5,49,2008\n" +
      "tt0959621,8,2023-05-03,Pilot,Pilot,u,TV Episode,8.2,58,2008\n",
  );
  check("imdb: riconosciuto", imdb.source === "imdb");
  check("imdb: gli episodi votati non diventano titoli", imdb.entries.length === 2);
  check("imdb: l'id viaggia con il titolo", imdb.entries[0].ids.imdb === "tt0816692");
  check("imdb: le serie sono serie", imdb.entries[1].mediaType === "tv" && imdb.entries[1].vote === 10);
}

// --- TV Time ------------------------------------------------------------------
{
  const tv = parseImportFile(
    "seen_episode.csv",
    "tv_show_name,episode_season_number,episode_number,created_at,tv_show_id\n" +
      "Dark,1,1,2022-01-01 20:00:00,81189\nDark,1,2,2022-01-01 21:00:00,81189\nDark,2,1,2022-02-01 21:00:00,81189\n",
  );
  check("tv time: riconosciuto", tv.source === "tvtime");
  const [dark] = mergeEntries(tv.entries);
  check("tv time: gli episodi raccolti per serie", tv.entries.length === 1 && dark.episodes.length === 3);
  check("tv time: l'id TheTVDB", dark.ids.tvdb === "81189");
  check("tv time: una serie con episodi è in visione", dark.status === "In visione");
}

// --- Trakt ----------------------------------------------------------------------
{
  const shows = parseImportFile(
    "watched-shows.json",
    JSON.stringify([
      {
        plays: 3,
        last_watched_at: "2023-01-03T20:00:00.000Z",
        show: { title: "Severance", year: 2022, ids: { tmdb: 95396, imdb: "tt11280740", tvdb: 371980 } },
        seasons: [{ number: 1, episodes: [{ number: 1, last_watched_at: "2023-01-01T20:00:00.000Z" }, { number: 2 }] }],
      },
    ]),
  );
  check("trakt: riconosciuto", shows.source === "trakt");
  check("trakt: episodi con le loro date", shows.entries[0].episodes.length === 2 && shows.entries[0].episodes[0].date === "2023-01-01");
  check("trakt: l'id TMDB", shows.entries[0].ids.tmdb === 95396);

  const ratings = parseImportFile(
    "ratings-episodes.json",
    JSON.stringify([{ rated_at: "2023-01-01T00:00:00Z", rating: 6, type: "episode", episode: { season: 1, number: 1 }, show: { title: "Severance", ids: { tmdb: 95396 } } }]),
  );
  check("trakt: il voto di un episodio non è il voto della serie", ratings.entries.length === 0);

  const history = parseImportFile(
    "history-1.json",
    JSON.stringify([
      { watched_at: "2023-05-01T20:00:00Z", type: "movie", movie: { title: "Arrival", year: 2016, ids: { tmdb: 329865 } } },
      { watched_at: "2024-05-01T20:00:00Z", type: "movie", movie: { title: "Arrival", year: 2016, ids: { tmdb: 329865 } } },
    ]),
  );
  const [arrival] = mergeEntries(history.entries);
  check("trakt: due visioni dello stesso film, una revisione", arrival.watchedDates.length === 2 && arrival.rewatch === 1 && arrival.status === "Visto");

  let threw = false;
  try {
    parseImportFile("lists-preferiti.json", JSON.stringify([{ listed_at: "2023-01-01", type: "movie", movie: { title: "X" } }]));
  } catch (e) {
    threw = e instanceof ImportFormatError;
  }
  check("trakt: le liste personali restano fuori", threw);
}

{
  let threw = false;
  try {
    parseImportFile("spesa.csv", "prodotto,quantità\nlatte,2\n");
  } catch (e) {
    threw = e instanceof ImportFormatError;
  }
  check("formato sconosciuto: un errore che lo dice", threw);
}

// --- Abbinamento ------------------------------------------------------------------
{
  const entry = (over: any = {}) => ({
    key: "k", sources: ["letterboxd"], title: "The Godfather", year: 1972, mediaType: "movie", ids: {}, status: "Visto",
    vote: null, watchedDates: [], episodes: [], rewatch: 0, fav: false, ...over,
  });
  const result = (over: any = {}) => ({
    tmdbId: 238, mediaType: "movie", title: "Il padrino", originalTitle: "The Godfather", year: 1972, overview: "", posterPath: null,
    kind: "film", popularity: 1, ...over,
  });

  const sure = judge(entry() as any, [result(), result({ tmdbId: 9, title: "Il padrino: dietro le quinte", originalTitle: "Making of", year: 1972 })]);
  check("abbinamento: il titolo originale e l'anno bastano", sure.state === "sure" && sure.pick?.tmdbId === 238);

  const offByOne = judge(entry({ year: 1973 }) as any, [result()]);
  check("abbinamento: un anno di scarto è ancora lui", offByOne.state === "sure");

  const twins = judge(entry({ title: "Dune", year: 2021 }) as any, [
    result({ tmdbId: 1, title: "Dune", originalTitle: "Dune", year: 1984 }),
    result({ tmdbId: 2, title: "Dune", originalTitle: "Dune", year: 2021 }),
  ]);
  check("abbinamento: fra omonimi decide l'anno", twins.state === "sure" && twins.pick?.tmdbId === 2);

  const unsure = judge(entry({ title: "Parasite", year: 2019 }) as any, [
    result({ tmdbId: 3, title: "Parasite", originalTitle: "Parasite", year: 1982 }),
    result({ tmdbId: 4, title: "Parassiti", originalTitle: "기생충", year: 2019 }),
  ]);
  check("abbinamento: nessuno certo, si chiede", unsure.state === "doubt" && unsure.candidates.length === 2);
  check("abbinamento: il più probabile già indicato", unsure.pick?.tmdbId === 4, String(unsure.pick?.tmdbId));

  check("abbinamento: niente risultati, non trovato", judge(entry() as any, []).state === "missing");
}

// --- In libreria ------------------------------------------------------------------
{
  let n = 0;
  const ctx = { today: "2026-10-30", newId: () => `id${++n}` };
  const pick = (over: any = {}) => ({ tmdbId: 238, mediaType: "movie", title: "Il padrino", year: 1972, overview: "", posterPath: "/p.jpg", kind: "film", popularity: 1, ...over });
  const base = (over: any = {}) => ({
    key: "k", sources: ["letterboxd"], title: "The Godfather", year: 1972, mediaType: "movie", ids: {}, status: "Visto",
    vote: 9, watchedDates: ["2024-01-01", "2024-06-01"], episodes: [], rewatch: 1, fav: false, ...over,
  });

  const first = applyImport([], [], [{ entry: base() as any, pick: pick() as any }], ctx);
  const film = first.items[0];
  check("libreria: entra con il titolo del catalogo e il collegamento", first.added === 1 && film.title === "Il padrino" && film.tmdbId === 238);
  check("libreria: il voto e lo stato", film.vote === 9 && film.status === "Visto");
  check(
    "diario: prima visione e revisione con le date del file",
    first.history.map((h: any) => `${h.action}@${h.date}`).join() === "watched@2024-01-01,rewatch@2024-06-01",
    first.history.map((h: any) => `${h.action}@${h.date}`).join(),
  );

  const again = applyImport(first.items, first.history, [{ entry: base() as any, pick: pick() as any }], ctx);
  check("nessun doppione: lo stesso file due volte non aggiunge niente", again.added === 0 && again.unchanged === 1 && again.items.length === 1 && again.history.length === 2);

  // Due voci che il catalogo dice essere lo stesso film diventano una.
  const twice = applyImport([], [], [
    { entry: base({ key: "a", watchedDates: ["2024-01-01"] }) as any, pick: pick() as any },
    { entry: base({ key: "b", title: "Il padrino", sources: ["trakt"], watchedDates: ["2025-01-01"] }) as any, pick: pick() as any },
  ], ctx);
  check("nessun doppione: due file, un film", twice.items.length === 1 && twice.history.length === 2, `${twice.items.length} titoli, ${twice.history.length} voci`);

  // Un titolo già in libreria, scritto a mano e in pausa.
  const mine = {
    id: "mine", title: "The Godfather", kind: "film", year: 1972, genre: "", status: "In pausa", vote: null, platform: "Altro", runtime: 0,
    episodes: null, seen: 0, seasons: null, fav: false, rewatch: 0, overview: "", director: "", cast: [], similar: [], notes: "nota mia",
    added: "2020-01-01", tmdbId: null, tmdbMediaType: null, posterPath: null, trailerUrl: null, links: [],
  };
  const merged = applyImport([mine as any], [], [{ entry: base() as any, pick: pick() as any }], ctx);
  const kept = merged.items[0];
  check("già presente: riconosciuto per nome e anno", merged.items.length === 1 && merged.updated === 1);
  check("già presente: riceve voto e collegamento", kept.vote === 9 && kept.tmdbId === 238);
  check("già presente: «In pausa» è una tua decisione, resta", kept.status === "In pausa");
  check("già presente: le tue note restano", kept.notes === "nota mia");

  // Una serie: gli episodi si uniscono a quelli già segnati.
  const series = {
    ...mine, id: "dark", title: "Dark", kind: "serie", year: 2017, status: "In visione", tmdbId: 70523, tmdbMediaType: "tv",
    watched: [{ season: 1, episode: 1, date: "2021-01-01" }], seen: 1, notes: "",
  };
  const darkPick = pick({ tmdbId: 70523, mediaType: "tv", title: "Dark", year: 2017, kind: "serie" });
  const darkEntry = base({
    title: "Dark", year: 2017, mediaType: "tv", status: "In visione", vote: null, watchedDates: [], rewatch: 0,
    episodes: [{ season: 1, episode: 1, date: "2022-01-01" }, { season: 1, episode: 2, date: "2022-01-01" }, { season: 1, episode: 3, date: "" }],
  });
  const withDark = applyImport([series as any], [], [{ entry: darkEntry as any, pick: darkPick as any }], ctx);
  const dark = withDark.items[0];
  check("serie: gli episodi nuovi si aggiungono, quelli segnati restano come sono", dark.seen === 3 && dark.watched[0].date === "2021-01-01", JSON.stringify(dark.watched));
  check("serie: senza data, la data è stimata", dark.watched[2].estimated === true);
  check("serie: il diario ha solo gli episodi con una data", withDark.history.length === 1 && withDark.history[0].count === 1 && withDark.history[0].episode === 2, JSON.stringify(withDark.history));

  const plain = applyImport([], [], [{ entry: base({ title: "Film introvabile", year: null }) as any, pick: null }], ctx);
  check("senza catalogo: entra con il nome del file", plain.items[0].title === "Film introvabile" && plain.items[0].tmdbId === null);
}

// --- ZIP ----------------------------------------------------------------------------
{
  function zip(files: { name: string; text: string; deflate: boolean }[]): ArrayBuffer {
    const enc = new TextEncoder();
    const locals: Uint8Array[] = [];
    const centrals: Uint8Array[] = [];
    let offset = 0;
    for (const f of files) {
      const name = enc.encode(f.name);
      const raw = enc.encode(f.text);
      const data = f.deflate ? new Uint8Array(deflateRawSync(raw)) : raw;
      const local = new Uint8Array(30 + name.length + data.length);
      const lv = new DataView(local.buffer);
      lv.setUint32(0, 0x04034b50, true);
      lv.setUint16(8, f.deflate ? 8 : 0, true);
      lv.setUint32(18, data.length, true);
      lv.setUint32(22, raw.length, true);
      lv.setUint16(26, name.length, true);
      local.set(name, 30);
      local.set(data, 30 + name.length);
      const central = new Uint8Array(46 + name.length);
      const cv = new DataView(central.buffer);
      cv.setUint32(0, 0x02014b50, true);
      cv.setUint16(10, f.deflate ? 8 : 0, true);
      cv.setUint32(20, data.length, true);
      cv.setUint32(24, raw.length, true);
      cv.setUint16(28, name.length, true);
      cv.setUint32(42, offset, true);
      central.set(name, 46);
      locals.push(local);
      centrals.push(central);
      offset += local.length;
    }
    const centralSize = centrals.reduce((s, c) => s + c.length, 0);
    const end = new Uint8Array(22);
    const ev = new DataView(end.buffer);
    ev.setUint32(0, 0x06054b50, true);
    ev.setUint16(8, files.length, true);
    ev.setUint16(10, files.length, true);
    ev.setUint32(12, centralSize, true);
    ev.setUint32(16, offset, true);
    const parts = [...locals, ...centrals, end];
    const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0));
    let at = 0;
    for (const p of parts) {
      out.set(p, at);
      at += p.length;
    }
    return out.buffer;
  }

  const buffer = zip([
    { name: "watched.csv", text: "Date,Name,Year,Letterboxd URI\n2024-01-01,Arrival,2016,u\n", deflate: true },
    { name: "profile.csv", text: "Username\nio\n", deflate: false },
    { name: "deleted/diary.csv", text: "x", deflate: false },
  ]);
  check("zip: riconosciuto dalla firma", isZip(buffer));
  const files = await unzip(buffer, (n: string) => !n.startsWith("deleted/"));
  check("zip: voci compresse e non compresse, filtro rispettato", files.length === 2 && files[0].text.includes("Arrival") && files[1].name === "profile.csv", files.map((f: any) => f.name).join());
}

console.log(failures === 0 ? "\nTutti i controlli passati." : `\n${failures} controlli falliti.`);
process.exit(failures === 0 ? 0 : 1);
