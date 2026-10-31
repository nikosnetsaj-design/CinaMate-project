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

// --- Liste ----------------------------------------------------------------
{
  const { useLists, freeName } = await import("../../src/store/useLists.ts");
  const { useLibrary } = await import("../../src/store/useLibrary.ts");
  const { listItems } = await import("../../src/lib/useListItems.ts");
  const { describeQuery } = await import("../../src/lib/listing.ts");

  const shelf = [
    make({ id: "x1", title: "Uno", genre: "Horror", year: 2001 }),
    make({ id: "x2", title: "Due", genre: "Horror", year: 2010, runtime: 95 }),
    make({ id: "x3", title: "Tre", genre: "Commedia", year: 2020 }),
  ];
  useLibrary.setState({ items: shelf });
  const L = useLists.getState();
  const manual = L.createManual("Da vedere", ["x1"]);
  useLists.getState().toggleItem(manual, "x3");
  useLists.getState().toggleItem(manual, "x2");
  useLists.getState().moveItem(manual, "x2", -1);
  const m = useLists.getState().lists.find((l: any) => l.id === manual)!;
  check("liste: titoli nell'ordine scelto", listItems(m, shelf).map((i: any) => i.id).join() === "x1,x2,x3", (m as any).itemIds.join());
  useLists.getState().toggleItem(manual, "x1");
  check("liste: lo stesso gesto toglie", !(useLists.getState().lists.find((l: any) => l.id === manual) as any).itemIds.includes("x1"));
  check("liste: nomi senza doppioni", freeName(useLists.getState().lists, "da vedere") === "da vedere 2");

  const smart = useLists.getState().createSmart("Horror corti", { filters: { genre: "Horror", runtimeMax: 100 }, sort: "anno" });
  const sl = useLists.getState().lists.find((l: any) => l.id === smart)!;
  check("liste intelligenti: la ricerca salvata risponde", listItems(sl, shelf).map((i: any) => i.id).join() === "x2");
  check("liste intelligenti: dette a parole", describeQuery((sl as any).query).join(" · ") === "Horror · sotto 100 min");

  // Un titolo che esce dalla libreria esce anche dalle liste.
  useLibrary.setState({ items: shelf.filter((i: any) => i.id !== "x2") });
  check("liste: un titolo rimosso esce dalla lista", !(useLists.getState().lists.find((l: any) => l.id === manual) as any).itemIds.includes("x2"));

  useLists.getState().restore([{ id: "rotta", kind: "manual", name: 3 }]);
  check("liste: un backup non valido non sostituisce niente", useLists.getState().lists.length === 2);
}

// --- Palato ---------------------------------------------------------------
{
  const { buildPalate, loved, disliked, decadeLabel, runtimeBucket } = await import("../../src/lib/palate.ts");
  const lib = [
    make({ genre: "Fantascienza", year: 1995, vote: 9, runtime: 160, countries: ["JP"], tmdbRating: 7.5 }),
    make({ genre: "Fantascienza", year: 1998, vote: 10, runtime: 170, countries: ["JP"], tmdbRating: 8 }),
    make({ genre: "Horror", year: 2015, vote: 3, runtime: 95, countries: ["US"], tmdbRating: 6 }),
    make({ genre: "Horror", year: 2018, vote: 4, runtime: 100, countries: ["US"], tmdbRating: 6.5 }),
    make({ genre: "Commedia", year: 2016, vote: 6, runtime: 100, countries: ["US", "GB"] }),
    make({ genre: "Horror", status: "Da vedere", vote: null }),
  ];
  const palate = buildPalate(lib);
  check("palato: conta solo i titoli votati", palate.rated === 5);
  check("palato: premi il genere sopra la tua media", loved(palate.facets.genre)[0]?.key === "Fantascienza");
  check("palato: punisci quello sotto", disliked(palate.facets.genre)[0]?.key === "Horror");
  check("palato: il decennio in parole", loved(palate.facets.decade, 1)[0]?.label === "anni '90", decadeLabel("2010"));
  check("palato: la durata solo per i film", runtimeBucket({ kind: "serie", runtime: 50 } as any) === null && runtimeBucket({ kind: "film", runtime: 160 } as any) === "fiume");
  check("palato: il paese per nome", loved(palate.facets.country, 1)[0]?.label === "Giappone", loved(palate.facets.country, 1)[0]?.label);
  check("palato: una coproduzione non conta doppio", Math.abs((palate.weights.country.get("GB") ?? 0) * 2 - (6 - palate.average)) < 1e-9);
  check("palato: il confronto con TMDB", palate.vsCrowd !== null && palate.vsCrowd.count === 4);

  // La Home cita il motivo dal palato.
  const shelf = [...lib, make({ title: "Akira", genre: "Animazione", year: 1993, countries: ["JP"], runtime: 124, status: "Da vedere" })];
  const picks = forYou(shelf);
  const akira = picks.find((p: any) => p.item.title === "Akira");
  check("consigli: il palato porta un titolo senza genere in comune", !!akira, picks.map((p: any) => p.item.title).join());
  check("consigli: e lo dice", !!akira && /anni '90|Giappone/.test(akira.reason), akira?.reason);
}

// --- Stasera in due -------------------------------------------------------
{
  const { encodeDuo, decodeDuo, readDuo, intersect, spin, myDuoList } = await import("../../src/lib/duo.ts");
  const entries = [{ id: 238, media: "movie" }, { id: 1396, media: "tv" }, { id: 157336, media: "movie" }];
  const code = encodeDuo(entries as any);
  check("in due: il codice è corto e senza nomi", code === "1.m6m.t12s.m3deg" && !/[A-Z ]/.test(code), code);
  check("in due: andata e ritorno", JSON.stringify(decodeDuo(code)) === JSON.stringify(entries));
  check("in due: si legge dal link intero", readDuo(`https://x.io/app/stasera-in-due#due=${code}`)?.length === 3);
  check("in due: un codice rovinato non è una lista", decodeDuo("1.m6m.x!!") === null && decodeDuo("2.m6m") === null && readDuo("ciao") === null);

  const mine = [
    make({ id: "a", title: "A", tmdbId: 1, tmdbMediaType: "movie", status: "Da vedere" }),
    make({ id: "b", title: "B", tmdbId: 2, tmdbMediaType: "movie", status: "Da vedere" }),
    make({ id: "c", title: "C", tmdbId: 3, tmdbMediaType: "tv", status: "Da vedere" }),
    make({ id: "d", title: "D", tmdbId: 4, tmdbMediaType: "movie", status: "Da vedere" }),
    make({ id: "e", title: "E", status: "Da vedere" }),
    make({ id: "f", title: "F", tmdbId: 6, tmdbMediaType: "movie", status: "Visto" }),
  ];
  const list = myDuoList(mine);
  check("in due: solo i «Da vedere» collegati al catalogo", list.map((i: any) => i.id).sort().join() === "a,b,c,d");

  const theirs = [{ id: 1, media: "movie" }, { id: 3, media: "movie" }, { id: 4, media: "movie" }, { id: 9, media: "tv" }];
  const both = intersect(mine.slice(0, 4), theirs as any);
  check("in due: l'intersezione guarda anche il tipo", both.map((m: any) => m.item.id).join() === "a,d", both.map((m: any) => m.item.id).join());
  check("in due: primo per tutti e due, compatibilità piena", both[0].compat === 100 && both[0].reason === "In cima a tutte e due le liste");

  const spun = spin(both, () => 0.99);
  check("in due: la ruota sceglie fra i titoli in comune", both.some((m: any) => m.item.id === spun?.item.id));
  check("in due: «un altro» cambia davvero", spin(both, () => 0, "a")?.item.id === "d");
}

// --- Questo o quello ------------------------------------------------------
{
  const { play, expected, pickPair, ranking, recalibrations, START } = await import("../../src/lib/elo.ts");
  let r: any = play({}, "a", "b", 1);
  check("elo: chi vince sale, chi perde scende, del pari", r.a.elo > START && r.b.elo < START && Math.abs(r.a.elo - START - (START - r.b.elo)) < 1e-9);
  check("elo: un pari fra uguali non muove niente", play({}, "a", "b", 0.5).a.elo === START);
  check("elo: battere il favorito vale di più", play({ a: { elo: 1200, games: 10 }, b: { elo: 1000, games: 10 } }, "a", "b", 0).b.elo - 1000 > play({}, "a", "b", 1).a.elo - 1000);
  check("elo: la probabilità attesa è simmetrica", Math.abs(expected(1100, 1000) + expected(1000, 1100) - 1) < 1e-12);

  const seen = Array.from({ length: 8 }, (_, i) => make({ id: `s${i}`, title: `Visto ${i}`, status: "Visto", vote: 9 - i }));
  const series = make({ id: "tv", title: "Serie", kind: "serie", status: "Visto", vote: 7 });
  const pair = pickPair([...seen, series], {}, [], () => 0.1);
  check("coppie: due titoli diversi", !!pair && pair[0].id !== pair[1].id);
  check("coppie: film con film quando si può", !!pair && pair.every((i: any) => i.kind === "film"));
  const fresh = pickPair(seen, { s0: { elo: 1000, games: 5 }, s1: { elo: 1000, games: 5 } }, [], () => 0.1);
  check("coppie: prima chi ha meno confronti", !!fresh && fresh.every((i: any) => i.id !== "s0" && i.id !== "s1"), fresh?.map((i: any) => i.id).join());
  const avoid = pickPair([seen[0], seen[1], seen[2]], { s0: { elo: 1000, games: 0 }, s1: { elo: 1000, games: 3 }, s2: { elo: 1300, games: 3 } }, ["s0|s1"], () => 0);
  check("coppie: una coppia appena vista non torna subito", !!avoid && avoid.some((i: any) => i.id === "s2"), avoid?.map((i: any) => i.id).join());

  // I confronti dicono l'ordine inverso dei voti per due titoli.
  const ratings: any = {};
  seen.forEach((it: any, i: number) => (ratings[it.id] = { elo: 1400 - i * 50, games: 4 }));
  ratings.s7 = { elo: 1500, games: 4 }; // votato 2, ma vince tutto
  ratings.s0 = { elo: 900, games: 4 }; // votato 9, ma perde tutto
  const fixes = recalibrations(seen, ratings);
  const low = fixes.find((f: any) => f.item.id === "s7");
  check("ricalibrare: propone di alzare chi vince i confronti", !!low && low.suggested === 9 && low.vote === 2, JSON.stringify(fixes.map((f: any) => [f.item.id, f.vote, f.suggested])));
  check("ricalibrare: e di abbassare chi li perde", fixes.some((f: any) => f.item.id === "s0" && f.suggested < 9));
  check("ricalibrare: «lascia così» vale per quel voto", !recalibrations(seen, ratings, { s7: 2 }).some((f: any) => f.item.id === "s7"));
  check("ricalibrare: con pochi titoli non dice niente", recalibrations(seen.slice(0, 4), ratings).length === 0);
  check("classifica: solo chi ha abbastanza confronti", ranking(seen, { s0: { elo: 1100, games: 2 }, s1: { elo: 1200, games: 1 } }).map((x: any) => x.item.id).join() === "s0");
}

console.log(failures === 0 ? "\nTutti i controlli passati." : `\n${failures} controlli falliti.`);
process.exit(failures === 0 ? 0 : 1);
