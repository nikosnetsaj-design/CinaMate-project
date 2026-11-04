// «Nelle puntate precedenti»: il confine non si passa, nemmeno per sbaglio.
const { recapPrompt, withinBoundary, recapKey } = await import("../../src/lib/recap.ts");

let failures = 0;
function check(name: string, cond: boolean, detail = "") {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!cond) failures++;
}

const season = Array.from({ length: 10 }, (_, i) => ({
  season: 2,
  episode: i + 1,
  title: `Titolo ${i + 1}`,
  overview: `Trama dell'episodio ${i + 1}`,
}));
const last = { season: 2, episode: 4 };

const kept = withinBoundary(season, last);
check("confine: solo fino all'ultimo visto compreso", kept.length === 4 && kept[3].episode === 4, kept.map((e: any) => e.episode).join());
check("confine: la stagione prima passa, quella dopo no", withinBoundary([{ season: 1, episode: 9 }, { season: 3, episode: 1 }], last).length === 1);
check("confine: tetto alle più recenti", withinBoundary(season, { season: 2, episode: 10 }, 3).map((e: any) => e.episode).join() === "8,9,10");

const { system, prompt } = recapPrompt({
  title: "Dark",
  year: 2017,
  last,
  lastTitle: "Titolo 4",
  watchedCount: 14,
  synopses: season,
  detail: "breve",
});
check("prompt: il confine detto per stagione, episodio e titolo", prompt.includes("stagione 2, episodio 4 («Titolo 4»)"));
check("prompt: il vincolo ripetuto in fondo", /non rivelare nulla che accada dopo stagione 2, episodio 4/.test(prompt));
check("prompt: il sistema lo rende assoluto", /confine è assoluto/.test(system));
check("prompt: nessuna sinossi oltre il confine", !/episodio 5\b|Titolo 5|Trama dell'episodio [5-9]/.test(prompt));
check("prompt: le sinossi entro il confine ci sono", prompt.includes("Trama dell'episodio 4"));
check("prompt: il livello cambia la lunghezza", prompt.includes("60 parole"));
check(
  "prompt: senza TMDB nessun blocco di sinossi",
  !recapPrompt({ title: "X", year: null, last, lastTitle: null, watchedCount: 4, synopses: [], detail: "normale" }).prompt.includes("Sinossi"),
);
check("memoria: la chiave cambia con il confine", recapKey("a", last, "breve") !== recapKey("a", { season: 2, episode: 5 }, "breve"));

console.log(failures === 0 ? "\nTutti i controlli passati." : `\n${failures} controlli falliti.`);
process.exit(failures === 0 ? 0 : 1);
