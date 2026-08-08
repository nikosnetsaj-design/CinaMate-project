import "fake-indexeddb/auto";

const store = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};

const { TieredCache, TTL, purgeExpired, clearCache } = await import(
  "../../src/lib/persistentCache.ts"
);

let failures = 0;
function check(name: string, cond: boolean, detail = "") {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!cond) failures++;
}
const settle = () => new Promise((r) => setTimeout(r, 60));

// 1. Scrittura e rilettura dalla stessa istanza.
{
  const c = new TieredCache<{ t: string }>("prova", TTL.metadata);
  c.set("603", { t: "Matrix" });
  const got = await c.get("603");
  check("set poi get → stesso valore", got?.t === "Matrix", JSON.stringify(got));
}

// 2. IL PUNTO DI TUTTO: un'istanza nuova (cioè un ricaricamento di pagina)
//    ritrova il dato scritto da quella vecchia.
{
  const first = new TieredCache<{ t: string }>("ricarica", TTL.metadata);
  first.set("1", { t: "Heat" });
  await settle(); // la scrittura su disco non si aspetta, qui sì
  const afterReload = new TieredCache<{ t: string }>("ricarica", TTL.metadata);
  const got = await afterReload.get("1");
  check("sopravvive al ricaricamento", got?.t === "Heat", JSON.stringify(got));
}

// 3. Scaduto = assente.
{
  const c = new TieredCache<number>("scadenza", 30); // 30ms
  c.set("x", 42);
  check("prima della scadenza c'è", (await c.get("x")) === 42);
  await new Promise((r) => setTimeout(r, 60));
  const fresh = new TieredCache<number>("scadenza", 30);
  check("dopo la scadenza non c'è", (await fresh.get("x")) === undefined);
}

// 4. I namespace non si calpestano.
{
  const a = new TieredCache<string>("dettagli", TTL.metadata);
  const b = new TieredCache<string>("stagione", TTL.metadata);
  a.set("603", "scheda");
  b.set("603", "episodi");
  await settle();
  check("namespace separati", (await a.get("603")) === "scheda" && (await b.get("603")) === "episodi");
}

// 5. clear() arriva fino al disco: è «Aggiorna contenuti».
{
  const c = new TieredCache<string>("svuota", TTL.static);
  c.set("k1", "v1");
  c.set("k2", "v2");
  await settle();
  c.clear();
  await settle();
  const fresh = new TieredCache<string>("svuota", TTL.static);
  const k1 = await fresh.get("k1");
  const k2 = await fresh.get("k2");
  check("clear() svuota anche IndexedDB", k1 === undefined && k2 === undefined, `k1=${k1} k2=${k2}`);
}

// 6. clear() di un namespace non tocca gli altri — il bug classico del prefisso.
{
  const keep = new TieredCache<string>("tieni", TTL.static);
  const drop = new TieredCache<string>("tienix", TTL.static); // prefisso simile di proposito
  keep.set("a", "resto");
  drop.set("a", "vado");
  await settle();
  drop.clear();
  await settle();
  const fresh = new TieredCache<string>("tieni", TTL.static);
  check("clear() non sconfina in namespace col prefisso simile", (await fresh.get("a")) === "resto");
}

// 7. purgeExpired toglie le voci morte e lascia le vive.
{
  const shortLived = new TieredCache<string>("pulizia", 20);
  const longLived = new TieredCache<string>("pulizia-viva", TTL.static);
  shortLived.set("morto", "x");
  longLived.set("vivo", "y");
  await new Promise((r) => setTimeout(r, 60));
  const removed = await purgeExpired();
  check("purgeExpired rimuove le scadute", removed >= 1, `${removed} rimosse`);
  const fresh = new TieredCache<string>("pulizia-viva", TTL.static);
  check("purgeExpired non tocca le valide", (await fresh.get("vivo")) === "y");
}

// 8. I valori strutturati sopravvivono al giro su disco.
{
  const c = new TieredCache<any>("strutturato", TTL.metadata);
  const payload = { cast: ["a", "b"], nested: { n: 1, list: [1, 2, 3] }, nullo: null };
  c.set("k", payload);
  await settle();
  const fresh = new TieredCache<any>("strutturato", TTL.metadata);
  const got = await fresh.get("k");
  check("oggetti annidati intatti", JSON.stringify(got) === JSON.stringify(payload), JSON.stringify(got));
}

await clearCache();
console.log(failures === 0 ? "\nTutti i controlli passati." : `\n${failures} controlli falliti.`);
process.exit(failures === 0 ? 0 : 1);
