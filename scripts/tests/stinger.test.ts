// Scene durante e dopo i titoli di coda: le keyword di TMDB.
const store = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};

const { readCreditsScenes, getCreditsScenes } = await import("../../src/lib/tmdb.ts");

let failures = 0;
function check(name: string, cond: boolean, detail = "") {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!cond) failures++;
}

const s1 = readCreditsScenes([{ id: 179430, name: "aftercreditsstinger" }]);
check("dopo i titoli, per id e nome", s1.after && !s1.during);
const s2 = readCreditsScenes([{ id: 1, name: "duringcreditsstinger" }]);
check("durante i titoli, anche se l'id cambiasse", s2.during && !s2.after);
const s3 = readCreditsScenes([{ id: 179431 }, { id: 179430 }]);
check("tutte e due", s3.during && s3.after);
const s4 = readCreditsScenes(undefined);
check("nessuna keyword: niente da dire", !s4.during && !s4.after);

const paths: string[] = [];
(globalThis as any).fetch = async (input: string) => {
  const url = new URL(input);
  paths.push(url.pathname);
  const body = url.pathname.endsWith("/movie/299534/keywords")
    ? { id: 299534, keywords: [{ id: 179430, name: "aftercreditsstinger" }] }
    : { id: 1, results: [{ id: 179431, name: "duringcreditsstinger" }] };
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
};
const movie = await getCreditsScenes(299534, "movie", "k");
check("film: le keyword stanno sotto «keywords»", movie.after && !movie.during);
const tv = await getCreditsScenes(1, "tv", "k");
check("serie: le keyword stanno sotto «results»", tv.during && !tv.after);
await getCreditsScenes(299534, "movie", "k");
check("la seconda volta dalla cache", paths.filter((p) => p.endsWith("/movie/299534/keywords")).length === 1, paths.join(" "));

console.log(failures === 0 ? "\nTutti i controlli passati." : `\n${failures} controlli falliti.`);
process.exit(failures === 0 ? 0 : 1);
