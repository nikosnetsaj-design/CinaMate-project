const {
  belongsByTitle,
  buildFranchise,
  fold,
  franchiseProgress,
  franchiseRoot,
  isFranchiseKeyword,
  mergeFranchise,
} = await import("../../src/lib/franchise.ts");

/**
 * La collezione è fatta di regole che decidono chi *entra*, e sbagliare da
 * quella parte non si vede: una griglia sbagliata sembra una griglia. Qui si
 * provano i due casi che contano davvero — «Berlino» che deve entrare nella
 * casa di carta passando dalla parola chiave, e «Berlinale» che non deve
 * entrarci passando dal nome.
 */

let failures = 0;
function check(name: string, cond: boolean, detail = "") {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!cond) failures++;
}

let n = 0;
function item(over: Partial<any> = {}): any {
  n++;
  return {
    id: `i${n}`, title: `Titolo ${n}`, kind: "serie", year: 2020, genre: "", status: "Da vedere",
    vote: null, platform: "Altro", runtime: 50, episodes: null, seen: 0, seasons: null, fav: false,
    rewatch: 0, overview: "", director: "", cast: [], similar: [], notes: "", added: "2024-01-01",
    tmdbId: null, tmdbMediaType: null, posterPath: null, trailerUrl: null, links: [],
    ...over,
  };
}

let e = 0;
function part(over: Partial<any> = {}): any {
  e++;
  return {
    tmdbId: over.tmdbId ?? e, mediaType: "tv", kind: "serie", title: `Parte ${e}`,
    releaseDate: "2020-01-01", year: 2020, overview: "", posterPath: "/p.jpg", popularity: 1,
    ...over,
  };
}

// 1. `fold` — il confronto fra due nomi ignora accenti e punteggiatura.
check("fold toglie accenti e punteggiatura", fold("La Casa di Carta: Corea") === "la casa di carta corea", fold("La Casa di Carta: Corea"));

// 2. La radice: il sottotitolo e il numero del capitolo non fanno parte del nome.
check("radice · sottotitolo via", franchiseRoot("Captain America - Il primo vendicatore") === "captain america", String(franchiseRoot("Captain America - Il primo vendicatore")));
check("radice · due punti via", franchiseRoot("La casa di carta: Corea") === "la casa di carta", String(franchiseRoot("La casa di carta: Corea")));
check("radice · numero arabo via", franchiseRoot("Iron Man 3") === "iron man", String(franchiseRoot("Iron Man 3")));
check("radice · numero romano via", franchiseRoot("Guerre stellari IV") === "guerre stellari", String(franchiseRoot("Guerre stellari IV")));
check("radice · titolo intero quando non c'è altro", franchiseRoot("La casa di carta") === "la casa di carta", String(franchiseRoot("La casa di carta")));

// 3. I nomi troppo corti non danno una radice: cercarli restituisce omonimi.
check("radice · una parola corta è nessuna radice", franchiseRoot("Loki") === null, String(franchiseRoot("Loki")));
// «Rocky» cercato per nome porterebbe dentro «The Rocky Horror Picture Show»:
// una parola sola e corta non è un nome di famiglia, nemmeno dopo il numero.
check("radice · una parola corta resta nessuna radice anche dopo il numero", franchiseRoot("Rocky IV") === null, String(franchiseRoot("Rocky IV")));
check("radice · una parola lunga vale", franchiseRoot("Yellowstone") === "yellowstone", String(franchiseRoot("Yellowstone")));

// 4. La parola chiave della famiglia contro quella del tema.
{
  const aliases = ["La casa di carta", "La casa de papel"];
  check("keyword · il titolo originale è la famiglia", isFranchiseKeyword("la casa de papel", aliases));
  check("keyword · il tema non lo è", !isFranchiseKeyword("bank robbery", aliases));
  check("keyword · corta rifiutata", !isFranchiseKeyword("heist", aliases));
  check("keyword · la keyword più lunga del titolo entra", isFranchiseKeyword("captain america film series", ["Captain America"]));
}

// 5. Il nome che comincia uguale — e quello che comincia *quasi* uguale.
check("nome · il seguito entra", belongsByTitle("La casa di carta: Corea", "la casa di carta"));
check("nome · lo stesso nome entra", belongsByTitle("La casa di carta", "la casa di carta"));
check("nome · Berlinale non è Berlino", !belongsByTitle("Berlinale 2024", "berlino"));
check("nome · parola intera, non prefisso", !belongsByTitle("Itaca", "it"));

// 6. L'unione: niente doppioni, ordine di uscita, vince la fonte migliore.
{
  const collection = [part({ tmdbId: 1, mediaType: "movie", title: "Primo", releaseDate: "2011-05-01", year: 2011 })];
  const keyword = [
    part({ tmdbId: 1, mediaType: "movie", title: "Primo (doppione)", releaseDate: "2011-05-01" }),
    part({ tmdbId: 2, mediaType: "tv", title: "Spin-off", releaseDate: "2023-01-01", year: 2023 }),
  ];
  const merged = mergeFranchise([collection, keyword], { tmdbId: 1, mediaType: "movie", title: "Primo" });
  check("unione · niente doppioni", merged.length === 2, merged.map((m: any) => m.title).join(", "));
  check("unione · vince la fonte migliore", merged[0].title === "Primo", merged[0].title);
  check("unione · ordine di uscita", merged[1].title === "Spin-off", merged.map((m: any) => m.year).join(", "));
}

// 7. Le schede senza locandina restano fuori, tranne quella aperta.
{
  const merged = mergeFranchise(
    [[part({ tmdbId: 7, title: "Abbozzo", posterPath: null }), part({ tmdbId: 8, title: "Aperto", posterPath: null })]],
    { tmdbId: 8, mediaType: "tv", title: "Aperto" },
  );
  check("unione · abbozzi fuori, il titolo aperto dentro", merged.length === 1 && merged[0].tmdbId === 8, merged.map((m: any) => m.title).join(", "));
}

// 8. Il limite non butta via il titolo aperto.
{
  const many = Array.from({ length: 40 }, (_, i) =>
    part({ tmdbId: 100 + i, title: `Capitolo ${i}`, releaseDate: `20${String(10 + i).padStart(2, "0")}-01-01` }),
  );
  const merged = mergeFranchise([many], { tmdbId: 139, mediaType: "tv", title: "Capitolo 39" }, 10);
  check("limite · rispettato", merged.length === 10, String(merged.length));
  check("limite · il titolo aperto resta", merged.some((m: any) => m.tmdbId === 139), merged.map((m: any) => m.tmdbId).join(","));
}

// 9. Lo stato di ogni voce viene dalla libreria, per id o per nome.
{
  const parts = [
    part({ tmdbId: 11, mediaType: "tv", title: "Vista", releaseDate: "2017-01-01" }),
    part({ tmdbId: 12, mediaType: "tv", title: "In corso", releaseDate: "2019-01-01" }),
    part({ tmdbId: 13, mediaType: "tv", title: "Non ce l'hai", releaseDate: "2021-01-01" }),
    part({ tmdbId: 14, mediaType: "tv", title: "Scritta a mano", releaseDate: "2023-01-01" }),
  ];
  const library = [
    item({ title: "Vista", tmdbId: 11, tmdbMediaType: "tv", status: "Visto" }),
    item({ title: "In corso", tmdbId: 12, tmdbMediaType: "tv", status: "In visione", episodes: 10, seen: 5 }),
    item({ title: "Scritta a mano", status: "Da vedere" }),
  ];
  const entries = buildFranchise(parts, library, { tmdbId: 12, mediaType: "tv", title: "In corso" });
  check("stato · vista", entries[0].state === "visto", entries[0].state);
  check("stato · in visione con percentuale", entries[1].state === "in-visione" && entries[1].pct === 50, `${entries[1].state} ${entries[1].pct}`);
  check("stato · assente", entries[2].state === "assente", entries[2].state);
  check("stato · trovata per nome senza id", entries[3].state === "in-libreria", entries[3].state);
  check("sei qui · una sola voce", entries.filter((x: any) => x.current).length === 1 && entries[1].current);

  // 10. «Continua con» è il primo non visto *dopo* quello aperto.
  const progress = franchiseProgress(entries);
  check("avanzamento · conta i visti sul totale", progress.watched === 1 && progress.total === 4 && progress.pct === 25, JSON.stringify(progress.pct));
  check("continua · il primo dopo quello aperto", progress.next?.part.title === "Non ce l'hai", String(progress.next?.part.title));
}

// 11. Il making of non è il seguito: «continua con» salta i documentari.
{
  const parts = [
    part({ tmdbId: 31, title: "Stagione aperta", releaseDate: "2017-01-01" }),
    part({ tmdbId: 32, title: "Il fenomeno", kind: "doc", releaseDate: "2020-01-01" }),
    part({ tmdbId: 33, title: "Lo spin-off", releaseDate: "2023-01-01" }),
  ];
  const entries = buildFranchise(parts, [], { tmdbId: 31, mediaType: "tv", title: "Stagione aperta" });
  const next = franchiseProgress(entries).next;
  check("continua · la storia prima del making of", next?.part.title === "Lo spin-off", String(next?.part.title));
}

// 12. Se però non c'è altro, il documentario è meglio di niente.
{
  const parts = [
    part({ tmdbId: 41, title: "Stagione aperta", releaseDate: "2017-01-01" }),
    part({ tmdbId: 42, title: "Il fenomeno", kind: "doc", releaseDate: "2020-01-01" }),
  ];
  const entries = buildFranchise(parts, [], { tmdbId: 41, mediaType: "tv", title: "Stagione aperta" });
  check("continua · il documentario quando è l'unico", franchiseProgress(entries).next?.part.title === "Il fenomeno");
}

// 13. Finita la collezione dopo di te, si torna indietro a tappare i buchi.
{
  const parts = [part({ tmdbId: 21, title: "Buco", releaseDate: "2015-01-01" }), part({ tmdbId: 22, title: "Aperto", releaseDate: "2020-01-01" })];
  const entries = buildFranchise(parts, [], { tmdbId: 22, mediaType: "tv", title: "Aperto" });
  check("continua · torna indietro quando è l'ultimo", franchiseProgress(entries).next?.part.title === "Buco");
}

console.log(failures === 0 ? "\nTutti i controlli passati." : `\n${failures} controlli falliti.`);
process.exit(failures === 0 ? 0 : 1);
