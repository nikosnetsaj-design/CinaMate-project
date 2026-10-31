// Quello che arriva da «Condividi» in un'altra app.
const { parseShared } = await import("../../src/lib/shareTarget.ts");

let failures = 0;
function check(name: string, cond: boolean, detail = "") {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!cond) failures++;
}

const base = "https://nikosnetsaj-design.github.io/CinaMate-project/";
const p = (o: any) => parseShared(o, base);

check("TMDB: la scheda esatta", JSON.stringify(p({ url: "https://www.themoviedb.org/tv/70523-dark?language=it" })) === JSON.stringify({ kind: "tmdb", tmdbId: 70523, mediaType: "tv", title: "" }));
check("IMDb: l'id, anche dalla versione mobile e dentro il testo", (p({ text: "Guarda questo https://m.imdb.com/title/tt0816692/?ref_=x" }) as any)?.imdbId === "tt0816692");
check("IMDb: il titolo senza « - IMDb»", (p({ title: "Interstellar (2014) - IMDb", url: "https://www.imdb.com/title/tt0816692/" }) as any)?.title === "Interstellar (2014)");
check("Letterboxd: il nome dal percorso", (p({ url: "https://letterboxd.com/film/past-lives/" }) as any)?.query === "Past lives");
check("Letterboxd: l'anno nel percorso si toglie", (p({ url: "https://letterboxd.com/film/dune-2021/" }) as any)?.query === "Dune");
check("JustWatch: il nome dal percorso", (p({ url: "https://www.justwatch.com/it/serie-tv/severance" }) as any)?.query === "Severance");
check("CineMate: un link dell'app si apre com'è", p({ url: `${base}stasera-in-due#due=1.m6m` })?.kind === "app");
check("testo semplice: si cerca", (p({ text: "Perfect Days di Wim Wenders" }) as any)?.query === "Perfect Days di Wim Wenders");
check("un indirizzo sconosciuto con un titolo: si cerca il titolo", (p({ title: "Oppenheimer", url: "https://example.com/x" }) as any)?.query === "Oppenheimer");
check("niente: niente", p({}) === null && p({ text: "https://example.com/solo-un-link" }) === null);

console.log(failures === 0 ? "\nTutti i controlli passati." : `\n${failures} controlli falliti.`);
process.exit(failures === 0 ? 0 : 1);
