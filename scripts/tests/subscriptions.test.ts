// Gli abbonamenti: cosa si legge, a quale piattaforma corrisponde, quanto costa ogni ora.
process.env.TZ = "Europe/Rome";
const data = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => data.get(k) ?? null,
  setItem: (k: string, v: string) => void data.set(k, v),
  removeItem: (k: string) => void data.delete(k),
};

const { readSubscriptions, parsePrice, platformOfProvider, subscriptionValues } = await import("../../src/lib/subscriptions.ts");
const { useSubscriptions } = await import("../../src/store/useSubscriptions.ts");
const { buildBackup, parseBackup } = await import("../../src/lib/backup.ts");

let failures = 0;
function check(name: string, cond: boolean, detail = "") {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!cond) failures++;
}

// Lettura tollerante.
{
  const subs = readSubscriptions([
    { providerId: 8, name: "Netflix", logoPath: "/n.jpg", monthly: 13.49 },
    { providerId: 8, name: "Doppione", monthly: 1 },
    { providerId: "x", name: "Rotto" },
    { providerId: 337, name: "  Disney Plus ", monthly: -3 },
    null,
  ]);
  check("letti i validi, senza doppioni", subs.length === 2 && subs[0].providerId === 8 && subs[1].name === "Disney Plus");
  check("prezzo negativo → nessun prezzo", subs[1].monthly === null);
  check("non un elenco → niente", readSubscriptions({ a: 1 }).length === 0);
}

// Prezzi scritti a mano.
check("9,99", parsePrice("9,99") === 9.99);
check("9.99", parsePrice("9.99") === 9.99);
check("€ 13,49", parsePrice("€ 13,49") === 13.49);
check("vuoto → nessun prezzo", parsePrice("  ") === null);
check("parole → nessun prezzo", parsePrice("gratis") === null);
check("cifre assurde → nessun prezzo", parsePrice("1.299,00") === null);

// Servizi di TMDB → piattaforme della libreria.
const cases: [string, string | null][] = [
  ["Netflix", "Netflix"],
  ["Netflix Standard with Ads", "Netflix"],
  ["Amazon Prime Video", "Prime Video"],
  ["Amazon Prime Video with Ads", "Prime Video"],
  ["Disney Plus", "Disney+"],
  ["Apple TV Plus", "Apple TV+"],
  ["NOW", "Sky / NOW"],
  ["Max", "HBO Max"],
  ["Paramount Plus", "Paramount+"],
  ["MUBI", "MUBI"],
  ["Rai Play", "RaiPlay"],
  ["Nowness", null],
  ["Infinity", null],
];
for (const [name, want] of cases) check(`«${name}» → ${want ?? "nessuna"}`, platformOfProvider(name) === want, String(platformOfProvider(name)));

// Il conto.
{
  const item = (id: string, platform: string, kind: string, runtime: number) => ({ id, title: id, platform, kind, runtime }) as any;
  const items = [item("film", "Netflix", "film", 120), item("serie", "Netflix", "serie", 50), item("old", "Prime Video", "film", 100)];
  const h = (itemId: string, date: string, action: string, count?: number) => ({ id: date + itemId, itemId, title: itemId, kind: "film", date, action, count }) as any;
  const history = [
    h("film", "2026-10-20", "watched"),
    h("serie", "2026-10-25", "episode", 3),
    h("film", "2026-09-01", "rewatch"),
    h("old", "2026-09-10", "watched"),
  ];
  const subs = [
    { providerId: 8, name: "Netflix", logoPath: null, monthly: 9.99 },
    { providerId: 119, name: "Amazon Prime Video", logoPath: null, monthly: null },
    { providerId: 337, name: "Disney Plus", logoPath: null, monthly: 8.99 },
  ];
  const [netflix, prime, disney] = subscriptionValues(subs, items, history, "2026-10-30");
  check("visioni in 30 giorni: un film e tre episodi", netflix.views === 4, String(netflix.views));
  check("minuti dalla durata dei titoli", netflix.minutes === 120 + 150, String(netflix.minutes));
  check("euro per ora", Math.abs((netflix.perHour ?? 0) - 9.99 / 4.5) < 1e-9, String(netflix.perHour));
  check("la visione di 59 giorni fa resta fuori dal conto", netflix.lastSeen === "2026-10-25");
  check("servizio non usato da un mese: l'ultima volta", prime.views === 0 && prime.lastSeen === "2026-09-10");
  check("senza prezzo: nessun costo inventato", prime.perHour === null);
  check("servizio mai usato", disney.views === 0 && disney.lastSeen === null && disney.perHour === null);
}

// Store e backup.
{
  const on = useSubscriptions.getState().toggle({ id: 8, name: "Netflix", logoPath: null });
  useSubscriptions.getState().setPrice(8, 13.49);
  check("acceso, col prezzo", on && useSubscriptions.getState().subs[0].monthly === 13.49);
  check("salvato su disco", JSON.parse(data.get("cinemate:subscriptions:v1") ?? "[]")[0]?.monthly === 13.49);
  const file = buildBackup([{ id: "a", title: "Dune" } as any], [], undefined, undefined, undefined, undefined, useSubscriptions.getState().subs);
  const back = parseBackup(file);
  check("nel backup, e indietro", readSubscriptions(back.subscriptions)[0]?.name === "Netflix");
  const off = useSubscriptions.getState().toggle({ id: 8, name: "Netflix", logoPath: null });
  check("spento", !off && useSubscriptions.getState().subs.length === 0);
  useSubscriptions.getState().restore("rotto");
  check("un backup illeggibile non porta niente", useSubscriptions.getState().subs.length === 0);
}

console.log(failures === 0 ? "\nTutti i controlli passati." : `\n${failures} controlli falliti.`);
process.exit(failures === 0 ? 0 : 1);
