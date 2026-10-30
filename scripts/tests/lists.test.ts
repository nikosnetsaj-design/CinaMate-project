process.env.TZ = "Europe/Rome";

const data = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => data.get(k) ?? null,
  setItem: (k: string, v: string) => void data.set(k, v),
  removeItem: (k: string) => void data.delete(k),
};

const { readLists, listItems, moveId, matchSharedEntries, cleanListName } = await import("../../src/lib/lists.ts");
const { useLists } = await import("../../src/store/useLists.ts");
const { buildBackup, parseBackup } = await import("../../src/lib/backup.ts");
const { describeFilters } = await import("../../src/lib/filters.ts");

let failures = 0;
function check(name: string, cond: boolean, detail = "") {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!cond) failures++;
}

const item = (id: string, title: string, over: Record<string, unknown> = {}) =>
  ({ id, title, year: 2000, kind: "film", status: "Da vedere", tmdbId: null, tmdbMediaType: null, ...over }) as any;

// 1. Nomi.
check("spazi ripetuti ridotti", cleanListName("  Da   vedere  insieme ") === "Da vedere insieme");
check("nome troncato a 60", cleanListName("x".repeat(80)).length === 60);

// 2. Lettura tollerante.
{
  const lists = readLists([
    { id: "a", name: "Horror", itemIds: ["1", "2", "1"] },
    { id: "b", name: "   ", itemIds: [] },
    { id: "a", name: "Doppione", itemIds: [] },
    { nome: "rotta" },
    { id: "c", name: "Ok", itemIds: ["3", 4] },
  ]);
  check("liste valide lette", lists.length === 1 && lists[0].id === "a", JSON.stringify(lists.map((l: any) => l.id)));
  check("id ripetuti nella lista contati una volta", lists[0].itemIds.length === 2);
  check("non un elenco → nessuna lista", readLists({ x: 1 }).length === 0);
}

// 3. I titoli che non ci sono più si saltano, l'ordine resta.
{
  const byId = new Map([["1", item("1", "Alien")], ["3", item("3", "Heat")]]);
  const got = listItems({ id: "l", name: "x", itemIds: ["3", "2", "1"], createdAt: "", updatedAt: "" }, byId);
  check("ordine della lista, assenti saltati", got.map((i: any) => i.title).join(",") === "Heat,Alien");
}

// 4. Spostamenti.
check("su di uno", moveId(["a", "b", "c"], "c", -1).join("") === "acb");
check("oltre il bordo si ferma", moveId(["a", "b", "c"], "a", -1).join("") === "abc");
check("id assente: niente", moveId(["a", "b"], "z", 1).join("") === "ab");

// 5. Riconoscere i titoli di una lista arrivata da un link.
{
  const mine = [
    item("d84", "Dune", { year: 1984 }),
    item("d21", "Dune", { year: 2021, tmdbId: 438631, tmdbMediaType: "movie" }),
    item("al", "Alien", { year: 1979 }),
    item("ar", "Arrival", { year: 0 }),
  ];
  const matched = matchSharedEntries(
    [
      { t: "Dune", y: 2021, i: 438631, m: "movie" },
      { t: "dune", y: 1984 },
      { t: "Dune" },
      { t: "Alien" },
      { t: "Alien", y: 1986 },
      { t: "Arrival", y: 2016 },
      { t: "Heat", y: 1995 },
    ],
    mine,
  );
  check("per id TMDB", matched[0]?.id === "d21");
  check("per titolo e anno, senza accenti e maiuscole", matched[1]?.id === "d84");
  check("due omonimi senza anno → nessuno", matched[2] === null);
  check("un solo omonimo senza anno → lui", matched[3]?.id === "al");
  check("anno diverso → non è lui", matched[4] === null);
  check("anno sconosciuto sullo scaffale → si accetta", matched[5]?.id === "ar");
  check("non posseduto → null", matched[6] === null);
}

// 6. Lo store.
{
  const s = useLists.getState();
  check("nome vuoto → nessuna lista", s.create("   ") === null && useLists.getState().lists.length === 0);
  const id = s.create("Da vedere insieme", ["1", "2", "2"])!;
  let list = useLists.getState().lists[0];
  check("creata in cima, senza doppioni", list.id === id && list.itemIds.join(",") === "1,2");
  check("data di creazione locale", /^\d{4}-\d{2}-\d{2}$/.test(list.createdAt));
  useLists.getState().toggleItem(id, "3");
  useLists.getState().toggleItem(id, "1");
  list = useLists.getState().lists[0];
  check("toggle aggiunge e toglie", list.itemIds.join(",") === "2,3", list.itemIds.join(","));
  useLists.getState().move(id, "3", -1);
  check("riordino", useLists.getState().lists[0].itemIds.join(",") === "3,2");
  useLists.getState().rename(id, "  Sabato  sera ");
  check("rinomina pulita", useLists.getState().lists[0].name === "Sabato sera");
  useLists.getState().rename(id, "   ");
  check("rinomina vuota ignorata", useLists.getState().lists[0].name === "Sabato sera");
  check("persistita", JSON.parse(data.get("cinemate:lists:v1")!)[0].name === "Sabato sera");

  // 7. Il giro completo nel backup.
  const file = buildBackup([item("2", "Alien"), item("3", "Heat")] as any, [], undefined, undefined, undefined, useLists.getState().lists);
  const back = parseBackup(file);
  check("il backup porta le liste", Array.isArray(back.lists) && (back.lists as any[])[0].name === "Sabato sera");
  useLists.getState().clearAll();
  check("svuota", useLists.getState().lists.length === 0);
  useLists.getState().restore(back.lists);
  check("ripristino dal backup", useLists.getState().lists[0]?.itemIds.join(",") === "3,2");
  const old = parseBackup(JSON.stringify({ items: [{ id: "x", title: "Vecchio" }] }));
  check("un backup senza liste non le nomina", old.lists === undefined);
  useLists.getState().remove(id);
  check("elimina", useLists.getState().lists.length === 0);
}

// 8. Il nome di una selezione.
check("nome dai filtri", describeFilters({ kind: "film", genre: "Horror", status: "Visto" } as any) === "Film · Horror · Visto");
check("anni", describeFilters({ yearFrom: 1990, yearTo: 1999 } as any) === "1990–1999");
check("voto minimo", describeFilters({ voteMin: 8 } as any) === "voto 8+");
check("senza filtri dicibili → vuoto", describeFilters({ hasSubtitles: true } as any) === "");

console.log(failures === 0 ? "\nTutti i controlli passati." : `\n${failures} controlli falliti.`);
process.exit(failures === 0 ? 0 : 1);
