// La logica della libreria che decide cosa vedi: consigli, saghe, filtri.
const { forYou, similarInLibrary } = await import("../../src/lib/recommend.ts");
const { findLibraryMatch, orderParts, buildEntries, sagaProgress, nextChapterAfter } = await import("../../src/lib/sagas.ts");
const { applyFilters, activeFilterCount, genreOptions } = await import("../../src/lib/filters.ts");

let failures = 0;
function check(name: string, cond: boolean, detail = "") {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!cond) failures++;
}

let n = 0;
function make(over: Record<string, unknown> = {}): any {
  n++;
  return {
    id: `i${n}`, title: `Titolo ${n}`, kind: "film", year: 2010, genre: "", status: "Da vedere", vote: null,
    platform: "Altro", runtime: 110, episodes: null, seen: 0, seasons: null, fav: false, rewatch: 0,
    overview: "", director: "", cast: [], similar: [], notes: "", added: "2026-01-01",
    tmdbId: null, tmdbMediaType: null, posterPath: null, trailerUrl: null, links: [],
    ...over,
  };
}

// --- Consigli -------------------------------------------------------------
{
  const lib = [
    make({ title: "Interstellar", genre: "Fantascienza", director: "Christopher Nolan", status: "Visto", vote: 10 }),
    make({ title: "Arrival", genre: "Fantascienza", director: "Denis Villeneuve", status: "Visto", vote: 9 }),
    make({ title: "Horror visto", genre: "Horror", status: "Visto", vote: 3 }),
    make({ title: "Tenet", genre: "Thriller", director: "Christopher Nolan" }),
    make({ title: "Dune", genre: "Fantascienza", director: "Denis Villeneuve" }),
    make({ title: "Altro horror", genre: "Horror" }),
    make({ title: "Saga parte 2", genre: "Avventura", collectionId: 7, collectionName: "La saga" }),
    make({ title: "Saga parte 1", genre: "Avventura", collectionId: 7, collectionName: "La saga", status: "Visto", vote: 6 }),
  ];
  const picks = forYou(lib);
  const titles = picks.map((p: any) => p.item.title);
  check("per te: ogni consiglio ha un perché", picks.every((p: any) => p.reason.length > 0), picks.map((p: any) => p.reason).join(" | "));
  check("per te: il capitolo di una saga iniziata va in testa", titles[0] === "Saga parte 2", titles.join(", "));
  check("per te: il regista amato porta Tenet", titles.includes("Tenet"));
  check("per te: un genere votato basso non viene proposto", !titles.includes("Altro horror"), titles.join(", "));
  check("per te: mai un titolo già visto", picks.every((p: any) => p.item.status !== "Visto"));

  const similar = similarInLibrary(lib[0], lib);
  check("simili: Tenet per lo stesso regista", similar.some((s: any) => s.item.title === "Tenet" && /Nolan/.test(s.reason)));
  check("simili: mai sé stesso", similar.every((s: any) => s.item.id !== lib[0].id));
  check("simili: ogni voce ha un perché", similar.every((s: any) => s.reason.length > 0));
}

// --- Saghe ----------------------------------------------------------------
{
  const parts = [
    { tmdbId: 1, title: "Il Padrino", releaseDate: "1972-03-14", year: 1972, overview: "", posterPath: null },
    { tmdbId: 2, title: "Il Padrino - Parte II", releaseDate: "1974-12-20", year: 1974, overview: "", posterPath: null },
    { tmdbId: 3, title: "Il Padrino - Parte III", releaseDate: "1990-12-25", year: 1990, overview: "", posterPath: null },
  ];
  const lib = [
    make({ title: "Il Padrino", tmdbId: 1, tmdbMediaType: "movie", status: "Visto" }),
    make({ title: "il padrino – parte iii", status: "Da vedere" }),
  ];
  check("saghe: abbinamento per id", findLibraryMatch(parts[0], lib)?.title === "Il Padrino");
  check("saghe: abbinamento per titolo senza id, ignorando maiuscole e segni", findLibraryMatch(parts[2], lib)?.title === "il padrino – parte iii");
  check("saghe: nessun abbinamento inventato", findLibraryMatch(parts[1], lib) === null);

  const orders = { chronological: [2, 1, 3], recommended: [1, 2, 3], note: "", computedAt: 0 };
  check("saghe: ordine cronologico", orderParts(parts, "cronologico", orders).map((p: any) => p.tmdbId).join() === "2,1,3");
  check("saghe: ordine d'uscita senza dati", orderParts(parts, "cronologico", undefined).map((p: any) => p.tmdbId).join() === "1,2,3");

  const entries = buildEntries(parts, lib);
  const progress = sagaProgress(entries);
  check("saghe: avanzamento sull'intera saga", progress.total === 3 && progress.watched === 1 && progress.pct === 33, JSON.stringify(progress));
  check("saghe: il prossimo è il primo non visto", progress.next?.part.tmdbId === 2);
  check("saghe: dopo il primo viene il secondo", nextChapterAfter(entries, 1, "Il Padrino")?.part.tmdbId === 2);
}

// --- Filtri ---------------------------------------------------------------
{
  const lib = [
    make({ title: "A", kind: "serie", genre: "Dramma", year: 1999, runtime: 50, vote: 8, audioLangs: ["it"], countries: ["IT"], studio: "Rai" }),
    make({ title: "B", kind: "film", genre: "Dramma", year: 2015, runtime: 150, vote: 6, audioLangs: ["en"], countries: ["US"], tmdbRating: 7.9 }),
    make({ title: "C", kind: "film", genre: "Commedia", year: 2020, runtime: 0, vote: null, quality: "4K" }),
  ];
  const titles = (f: any, lookup?: any) => applyFilters(lib, f, lookup).map((i: any) => i.title).join("");
  check("filtri: nessun filtro, tutti", titles({}) === "ABC");
  check("filtri: tipo", titles({ kind: "film" }) === "BC");
  check("filtri: genere", titles({ genre: "Dramma" }) === "AB");
  check("filtri: anni", titles({ yearFrom: 2000, yearTo: 2019 }) === "B");
  check("filtri: durata sconosciuta non passa per brevissima", titles({ runtimeMax: 90 }) === "A");
  check("filtri: voto minimo", titles({ voteMin: 7 }) === "A");
  check("filtri: voto TMDB", titles({ tmdbRatingMin: 7.5 }) === "B");
  check("filtri: lingua dell'audio", titles({ audioLang: "it" }) === "A");
  check("filtri: paese", titles({ country: "US" }) === "B");
  check("filtri: qualità", titles({ quality: "4K" }) === "C");
  const lookup = (id: string) => (id === lib[1].id ? { subtitles: [{ label: "it" }], markers: [] } : undefined);
  check("filtri: solo con sottotitoli", titles({ hasSubtitles: true }, lookup) === "B");
  check("filtri: conteggio dei filtri attivi", activeFilterCount({ kind: "film", genre: "", hasSubtitles: false, voteMin: 5 }) === 2);
  const genres = genreOptions(lib);
  check("filtri: opzioni dallo scaffale, le più frequenti prima", genres[0].value === "Dramma" && genres[0].count === 2);
}

console.log(failures === 0 ? "\nTutti i controlli passati." : `\n${failures} controlli falliti.`);
process.exit(failures === 0 ? 0 : 1);
