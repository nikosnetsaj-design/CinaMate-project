const { itemsForMood, moodCounts, MOODS } = await import("../../src/lib/moods.ts");

let failures = 0;
function check(name: string, cond: boolean, detail = "") {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!cond) failures++;
}

let n = 0;
function make(over: Partial<any> = {}): any {
  n++;
  return {
    id: `i${n}`, title: over.title ?? `Titolo ${n}`, kind: "film", year: 2000,
    genre: "", status: "Da vedere", vote: null, platform: "Altro", runtime: 120,
    episodes: null, seen: 0, seasons: null, fav: false, rewatch: 0,
    overview: "", director: "", cast: [], similar: [], notes: "", added: "2024-01-01",
    tmdbId: null, tmdbMediaType: null, posterPath: null, tmdbRating: null,
    ...over,
  };
}

const commedia = make({ title: "Commedia breve", genre: "Commedia", runtime: 95 });
const horror = make({ title: "Horror", genre: "Horror", runtime: 100 });
const azione = make({ title: "Azione", genre: "Azione", runtime: 120 });
const mistero = make({ title: "Mistero lungo", genre: "Mistero", runtime: 145, tmdbRating: 8.1 });
const doc = make({ title: "Documentario", genre: "Documentario", tmdbRating: 8.0 });
const all = [commedia, horror, azione, mistero, doc];

function titles(mood: string) {
  return itemsForMood(all, mood as any).map((m: any) => m.item.title);
}

// 1. Ogni umore pesca la cosa giusta.
check("rilassante → la commedia breve in testa", titles("rilassante")[0] === "Commedia breve", titles("rilassante").join(", "));
check("adrenalinico → l'azione in testa", titles("adrenalinico")[0] === "Azione", titles("adrenalinico").join(", "));
check("cervellotico → il mistero lungo in testa", titles("cervellotico")[0] === "Mistero lungo", titles("cervellotico").join(", "));
check("ispirazionale → il documentario in testa", titles("ispirazionale")[0] === "Documentario", titles("ispirazionale").join(", "));

// 2. I pesi negativi funzionano: l'horror non è una serata rilassante.
check("rilassante esclude l'horror", !titles("rilassante").includes("Horror"), titles("rilassante").join(", "));
check("cervellotico esclude la commedia", !titles("cervellotico").includes("Commedia breve"), titles("cervellotico").join(", "));

// 3. Ogni risultato porta con sé una ragione non vuota.
{
  const withReasons = MOODS.every((m: any) =>
    itemsForMood(all, m.id).every((r: any) => typeof r.reason === "string" && r.reason.length > 0),
  );
  check("ogni risultato ha una ragione", withReasons);
}

// 4. La durata sposta davvero: stesso genere, durata diversa, ordine diverso.
{
  const breve = make({ title: "Breve", genre: "Commedia", runtime: 90 });
  const lunga = make({ title: "Lunga", genre: "Commedia", runtime: 165 });
  const out = itemsForMood([lunga, breve], "rilassante").map((m: any) => m.item.title);
  check("a parità di genere la più breve viene prima", out[0] === "Breve", out.join(", "));
}

// 5. Un titolo già visto non si ripropone, a meno che non sia un preferito.
{
  const visto = make({ title: "Visto", genre: "Commedia", runtime: 95, status: "Visto" });
  const vistoAmato = make({ title: "Visto amato", genre: "Commedia", runtime: 95, status: "Visto", fav: true });
  const out = itemsForMood([visto, vistoAmato], "rilassante").map((m: any) => m.item.title);
  check("i visti sono esclusi, i preferiti no", out.length === 1 && out[0] === "Visto amato", out.join(", "));
}

// 6. Un abbandonato non torna mai.
{
  const mollato = make({ title: "Mollato", genre: "Azione", status: "Abbandonato" });
  check("gli abbandonati restano fuori", itemsForMood([mollato], "adrenalinico").length === 0);
}

// 7. moodCounts concorda con itemsForMood.
{
  const counts = moodCounts(all);
  const consistent = MOODS.every((m: any) => counts[m.id] === itemsForMood(all, m.id, Number.MAX_SAFE_INTEGER).length);
  check("moodCounts coerente con itemsForMood", consistent, JSON.stringify(counts));
}

// 8. Libreria vuota → nessun umore, nessun errore.
{
  const counts = moodCounts([]);
  check("libreria vuota → tutti i conteggi a zero", MOODS.every((m: any) => counts[m.id] === 0));
}

// 9. Il limite è rispettato.
{
  const many = Array.from({ length: 50 }, () => make({ genre: "Azione" }));
  check("limite rispettato", itemsForMood(many, "adrenalinico", 5).length === 5);
}

console.log(failures === 0 ? "\nTutti i controlli passati." : `\n${failures} controlli falliti.`);
process.exit(failures === 0 ? 0 : 1);
