process.env.TZ = "Europe/Rome";

/**
 * La lettura della libreria all'avvio, in quattro situazioni. Ogni caso
 * importa lo store con una query diversa, così Node lo valuta da capo come
 * farebbe un ricaricamento della pagina sullo stesso `localStorage`.
 */

const data = new Map<string, string>();
let refuse: (key: string) => boolean = () => false;
(globalThis as any).localStorage = {
  getItem: (k: string) => data.get(k) ?? null,
  setItem: (k: string, v: string) => {
    if (refuse(k)) throw new DOMException("quota", "QuotaExceededError");
    data.set(k, v);
  },
  removeItem: (k: string) => void data.delete(k),
};

let failures = 0;
function check(name: string, cond: boolean, detail = "") {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!cond) failures++;
}

const LIB = "cinemate:v2";
const HIS = "cinemate:history:v1";
const RESCUE = "cinemate:v2:rescue";
let round = 0;
async function boot() {
  round++;
  return import(`../../src/store/useLibrary.ts?avvio=${round}`);
}
function reset() {
  data.clear();
  refuse = () => false;
}

const draft = {
  title: "Nuovo", kind: "film", year: 2020, genre: "", status: "Da vedere", vote: null, platform: "Altro",
  runtime: 100, episodes: null, seen: 0, seasons: null, fav: false, rewatch: 0, overview: "", director: "",
  cast: [], similar: [], notes: "", tmdbId: null, tmdbMediaType: null, posterPath: null, trailerUrl: null, links: [],
};

// 1. Un record storto su tre: gli altri due restano, e l'originale è messo da parte.
{
  reset();
  const raw = JSON.stringify([{ id: "a", title: "Alien" }, { id: "b" }, { id: "c", title: "Blade Runner", cast: ["Ford"] }]);
  data.set(LIB, raw);
  const { useLibrary, readOriginalLibrary } = await boot();
  const s = useLibrary.getState();
  check("in parte: i titoli leggibili ci sono", s.items.length === 2, String(s.items.length));
  check("in parte: problema segnalato con il conto", s.loadIssue?.kind === "partial" && s.loadIssue.skipped === 1, JSON.stringify(s.loadIssue));
  check("in parte: copia messa da parte", s.loadIssue?.rescued === true && data.has(RESCUE));
  check("in parte: la copia è l'originale esatto", readOriginalLibrary() === raw);
  check("in parte: nessun errore di scrittura", s.storageError === false);
  s.addItem(draft);
  check("in parte: si può continuare a usare l'app", JSON.parse(data.get(LIB)!).length === 3);
  check("in parte: la copia sopravvive alla scrittura", readOriginalLibrary() === raw);
  useLibrary.getState().dismissLoadIssue();
  check("in parte: «elimina la copia» la toglie davvero", !data.has(RESCUE) && useLibrary.getState().loadIssue === null);
}

// 2. Valore illeggibile, ma c'è posto per la copia: si può ripartire senza perdere nulla.
{
  reset();
  data.set(LIB, '[{"id":"a","title":"Alien"'); // troncato
  const { useLibrary, readOriginalLibrary } = await boot();
  const s = useLibrary.getState();
  check("illeggibile: libreria vuota", s.items.length === 0);
  check("illeggibile: segnalato", s.loadIssue?.kind === "unreadable" && s.loadIssue.rescued === true, JSON.stringify(s.loadIssue));
  s.addItem(draft);
  check("illeggibile con copia: le scritture riprendono", JSON.parse(data.get(LIB)!).length === 1);
  check("illeggibile con copia: l'originale si scarica ancora", readOriginalLibrary() === '[{"id":"a","title":"Alien"');
}

// 3. Illeggibile e senza posto per la copia: la chiave originale non si tocca.
{
  reset();
  const raw = "non è json";
  data.set(LIB, raw);
  refuse = (k) => k === RESCUE;
  const { useLibrary, readOriginalLibrary } = await boot();
  const s = useLibrary.getState();
  check("protetto: segnalato senza copia", s.loadIssue?.kind === "unreadable" && s.loadIssue.rescued === false);
  s.addItem(draft);
  check("protetto: la scrittura non sovrascrive l'originale", data.get(LIB) === raw, data.get(LIB));
  check("protetto: non è scambiato per memoria piena", useLibrary.getState().storageError === false);
  check("protetto: l'originale resta scaricabile", readOriginalLibrary() === raw);
  useLibrary.getState().resetCorruptedData();
  useLibrary.getState().addItem(draft);
  check("protetto: dopo «ricomincia» si scrive di nuovo", JSON.parse(data.get(LIB)!).length === 1);
}

// 4. Memoria piena: è un errore di scrittura, non una libreria rotta.
{
  reset();
  data.set(LIB, JSON.stringify([{ id: "a", title: "Alien" }]));
  const { useLibrary } = await boot();
  refuse = (k) => k === LIB;
  useLibrary.getState().addItem(draft);
  const s = useLibrary.getState();
  check("piena: segnalata come errore di scrittura", s.storageError === true);
  check("piena: nessun problema di lettura inventato", s.loadIssue === null);
}

// 5. Le date del diario scritte in UTC prima di questa versione tornano locali.
{
  reset();
  const ts = Date.UTC(2026, 9, 28, 23, 30); // 00:30 del 29 a Roma
  data.set(LIB, JSON.stringify([{ id: `${ts}-abcdef`, title: "Alien", added: "2026-10-28" }]));
  data.set(HIS, JSON.stringify([
    { id: `${ts}-ghijkl`, itemId: `${ts}-abcdef`, title: "Alien", kind: "film", date: "2026-10-28", action: "watched" },
    { id: "senza-orologio", itemId: `${ts}-abcdef`, title: "Alien", kind: "film", date: "2026-10-28", action: "rewatch" },
    { rotta: true },
  ]));
  const { useLibrary } = await boot();
  const s = useLibrary.getState();
  check("diario: data di mezzanotte corretta", s.history[0].date === "2026-10-29", s.history[0].date);
  check("diario: data senza istante lasciata", s.history[1].date === "2026-10-28");
  check("diario: voce rotta scartata, il resto resta", s.history.length === 2, String(s.history.length));
  check("libreria: data di aggiunta corretta", s.items[0].added === "2026-10-29", s.items[0].added);
}

// 6. L'unione di un import: titoli nuovi, aggiornamenti, voci di diario datate.
{
  reset();
  data.set(LIB, JSON.stringify([{ id: "esistente", title: "Alien", status: "Da vedere" }]));
  const { useLibrary } = await boot();
  const result = useLibrary.getState().mergeImported(
    [{ ...draft, title: "Heat", status: "Visto", vote: 9 }],
    [{ id: "esistente", patch: { status: "Visto", vote: 8 } }],
    [
      { index: 0, date: "2019-05-03", action: "watched" },
      { itemId: "esistente", date: "2018-01-10", action: "watched" },
      { index: 7, date: "2018-01-11", action: "watched" }, // indice inesistente: ignorato
    ],
    ["2019-05-01"],
  );
  const s = useLibrary.getState();
  check("unione: un titolo aggiunto, uno aggiornato", result.added === 1 && result.updated === 1, JSON.stringify(result));
  check("unione: la libreria non è sostituita", s.items.length === 2);
  check("unione: aggiornamento applicato", s.items.find((i: any) => i.id === "esistente")?.vote === 8);
  check("unione: data di aggiunta presa dal file", s.items.find((i: any) => i.title === "Heat")?.added === "2019-05-01");
  check("unione: due voci di diario, in ordine di data", s.history.length === 2 && s.history[0].date === "2018-01-10", s.history.map((h: any) => h.date).join(", "));
  check("unione: le date importate non vengono «corrette»", s.history[1].date === "2019-05-03");
}

console.log(failures === 0 ? "\nTutti i controlli passati." : `\n${failures} controlli falliti.`);
process.exit(failures === 0 ? 0 : 1);
