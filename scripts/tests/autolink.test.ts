// La passata di collegamento: quale scheda di TMDB è un titolo scritto a mano o importato.
const store = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};

const { resolveTarget, fillGaps } = await import("../../src/lib/useAutoLinkTmdb.ts");

let failures = 0;
function check(name: string, cond: boolean, detail = "") {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!cond) failures++;
}

const calls: string[] = [];
(globalThis as any).fetch = async (input: string) => {
  const url = new URL(input);
  const p = url.pathname;
  const q = url.searchParams;
  calls.push(`${p}?${q.get("query") ?? ""}|${q.get("primary_release_year") ?? ""}`);
  const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
  if (p.endsWith("/search/multi") && q.get("query") === "Dune")
    return json({
      results: [
        { id: 438631, media_type: "movie", title: "Dune", release_date: "2021-09-15", poster_path: "/a.jpg", popularity: 90 },
        { id: 841, media_type: "movie", title: "Dune", release_date: "1984-12-14", poster_path: "/b.jpg", popularity: 20 },
        { id: 1, media_type: "tv", name: "Dune", first_air_date: "2000-12-03", poster_path: "/c.jpg", popularity: 5 },
      ],
    });
  if (p.endsWith("/search/multi") && q.get("query") === "Il padrino")
    return json({ results: [{ id: 238, media_type: "movie", title: "Il padrino", release_date: "1972-03-14", poster_path: "/p.jpg", popularity: 50 }] });
  if (p.endsWith("/search/multi") && q.get("query") === "Psycho")
    return json({ results: [{ id: 11252, media_type: "movie", title: "Psycho", release_date: "1998-12-04", poster_path: "/p98.jpg", popularity: 9 }] });
  if (p.endsWith("/search/movie") && q.get("query") === "Psycho" && q.get("primary_release_year") === "1960")
    return json({ results: [{ id: 539, title: "Psyco", original_title: "Psycho", release_date: "1960-06-22", poster_path: "/p60.jpg" }] });
  if (p.endsWith("/find/tt0068646")) return json({ movie_results: [{ id: 238, title: "Il padrino", release_date: "1972-03-14" }], tv_results: [] });
  return json({ results: [] });
};

const item = (over: Record<string, unknown>) =>
  ({ id: "x", title: "x", kind: "film", year: 0, status: "Da vedere", episodes: null, seen: 0, tmdbId: null, tmdbMediaType: null, cast: [], similar: [], ...over }) as any;
const thisYear = new Date().getFullYear();

check("Dune del 1984 scritto a mano → il Dune del 1984", (await resolveTarget(item({ title: "Dune", year: 1984 }), "k"))?.tmdbId === 841);
check("Dune del 2021 → quello del 2021",(await resolveTarget(item({ title: "Dune", year: 2021 }), "k"))?.tmdbId === 438631);
check("una serie cerca fra le serie", (await resolveTarget(item({ title: "Dune", year: 2000, kind: "serie" }), "k"))?.mediaType === "tv");
check(
  "anno predefinito (quello corrente): resta il primo risultato",
  (await resolveTarget(item({ title: "Il padrino", year: thisYear }), "k"))?.tmdbId === 238,
);
calls.length = 0;
check("anno passato fuori dagli otto risultati: seconda domanda, in quell'anno", (await resolveTarget(item({ title: "Psycho", year: 1960 }), "k"))?.tmdbId === 539, calls.join(" · "));
check("anno passato e nessun candidato: nessun collegamento", (await resolveTarget(item({ title: "Dune", year: 1950 }), "k")) === null);
calls.length = 0;
check("id IMDb: risposta esatta, senza ricerca per nome", (await resolveTarget(item({ title: "The Godfather", year: 1972, imdbId: "tt0068646" }), "k"))?.tmdbId === 238 && !calls.some((c) => c.includes("/search/")));
check("già collegato: nessuna richiesta", (await resolveTarget(item({ tmdbId: 5, tmdbMediaType: "movie" }), "k"))?.tmdbId === 5);

const details = { tmdbId: 1, episodes: 62, seasons: 5, cast: [], similar: [], genre: "", runtime: 47, overview: "", director: "", studio: "", countries: [], tmdbRating: null, audioLangs: [], certification: "", collectionId: null, collectionName: null, posterPath: null, backdropPath: null, trailerUrl: null } as any;
check("serie «Vista» senza totale: il totale arriva e la rende vista tutta", fillGaps(item({ kind: "serie", status: "Visto" }), details, "tv").seen === 62);
check("serie in corso: gli episodi visti restano i tuoi", fillGaps(item({ kind: "serie", status: "In visione", seen: 7 }), details, "tv").seen === 7);
check("serie «Vista» con il totale già noto: niente da toccare", fillGaps(item({ kind: "serie", status: "Visto", episodes: 40, seen: 38 }), details, "tv").seen === 38);

console.log(failures === 0 ? "\nTutti i controlli passati." : `\n${failures} controlli falliti.`);
process.exit(failures === 0 ? 0 : 1);
