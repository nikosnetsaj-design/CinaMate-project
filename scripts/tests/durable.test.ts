// La migrazione da localStorage a IndexedDB: è la parte che non si può
// sbagliare, perché i dati che sposta non esistono da nessun'altra parte.
import { IDBFactory } from "fake-indexeddb";

const { createDurable, LEGACY_KEYS, BACKUP_PREFIX, MARKER_KEY, CONFIRM_AFTER_LAUNCHES } = await import(
  "../../src/lib/durable.ts"
);

let failures = 0;
function check(name: string, cond: boolean, detail = "") {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!cond) failures++;
}

/** Una localStorage in memoria, con un tetto opzionale per simulare la quota piena. */
function memoryStorage(limit = Infinity): Storage {
  const map = new Map<string, string>();
  const size = () => [...map].reduce((n, [k, v]) => n + k.length + v.length, 0);
  return {
    get length() {
      return map.size;
    },
    key: (i: number) => [...map.keys()][i] ?? null,
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => {
      const before = map.get(k);
      map.set(k, String(v));
      if (size() > limit) {
        if (before === undefined) map.delete(k);
        else map.set(k, before);
        throw new Error("QuotaExceededError");
      }
    },
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
  };
}

const library = [{ id: "a", title: "Dune" }, { id: "b", title: "Dark" }];
const history = [{ id: "h1", itemId: "a", title: "Dune", kind: "film", date: "2026-10-01", action: "watched" }];
const playback = { a: { contentId: "a", positionSec: 600, status: "in_progress", updatedAt: 1 } };
const daily = { "2026-10-01": 3600 };

function seeded(limit = Infinity) {
  const ls = memoryStorage(limit);
  ls.setItem(LEGACY_KEYS.library, JSON.stringify(library));
  ls.setItem(LEGACY_KEYS.history, JSON.stringify(history));
  ls.setItem(LEGACY_KEYS.playback, JSON.stringify(playback));
  ls.setItem(LEGACY_KEYS.daily, JSON.stringify(daily));
  return ls;
}

const t0 = new Date("2026-10-30T10:00:00Z");

// 1. Installazione nuova: niente da spostare, niente copia, subito confermata.
{
  const ls = memoryStorage();
  const d = createDurable({ indexedDB: new IDBFactory(), localStorage: ls, now: () => t0 });
  const s = await d.hydrate();
  check("nuova: finisce su IndexedDB", s.backend === "idb", s.backend);
  check("nuova: nessuna copia da tenere", s.backups.length === 0);
  check("nuova: registro già confermato", !!s.meta?.confirmedAt);
  check("nuova: libreria assente, non vuota a caso", d.read("library") === undefined);
  check("nuova: segno scritto", ls.getItem(MARKER_KEY) === "idb");
}

// 2. Migrazione con dati: copia, verifica, copia di sicurezza, originali via.
const idb = new IDBFactory();
const ls = seeded();
{
  const d = createDurable({ indexedDB: idb, localStorage: ls, now: () => t0 });
  const s = await d.hydrate();
  check("migrazione: su IndexedDB", s.backend === "idb", `${s.backend} ${s.reason ?? ""}`);
  check("migrazione: libreria identica", JSON.stringify(d.read("library")?.value) === JSON.stringify(library));
  check("migrazione: diario identico", JSON.stringify(d.read("history")?.value) === JSON.stringify(history));
  check("migrazione: posizioni del lettore", JSON.stringify(d.read("playback")?.value) === JSON.stringify(playback));
  check("migrazione: minuti per giorno", JSON.stringify(d.read("daily")?.value) === JSON.stringify(daily));
  check("migrazione: originali tolti", ls.getItem(LEGACY_KEYS.library) === null && ls.getItem(LEGACY_KEYS.daily) === null);
  check(
    "migrazione: copia di sicurezza sotto pre-idb",
    ls.getItem(BACKUP_PREFIX + LEGACY_KEYS.library) === JSON.stringify(library),
  );
  check("migrazione: quattro copie elencate", s.backups.length === 4, s.backups.join(","));
  check("migrazione: non confermata", s.meta?.confirmedAt === null && s.meta?.launches === 0);

  // Le scritture arrivano sul disco.
  d.write("library", [...library, { id: "c", title: "Matrix" }]);
  await d.flush();
}

// 3. Riavvio: idempotente, i dati scritti dopo ci sono, l'avvio conta.
{
  const d = createDurable({ indexedDB: idb, localStorage: ls, now: () => t0 });
  const s = await d.hydrate();
  const lib = d.read("library")?.value as { id: string }[];
  check("riavvio: la scrittura è rimasta", lib.length === 3, String(lib.length));
  check("riavvio: un avvio contato", s.meta?.launches === 1, String(s.meta?.launches));
  check("riavvio: la copia è ancora la vecchia", ls.getItem(BACKUP_PREFIX + LEGACY_KEYS.library) === JSON.stringify(library));
}

// 4. Cinque avvii ma un giorno solo: non basta per confermare.
{
  for (let i = 0; i < CONFIRM_AFTER_LAUNCHES; i++) {
    await createDurable({ indexedDB: idb, localStorage: ls, now: () => t0 }).hydrate();
  }
  const d = createDurable({ indexedDB: idb, localStorage: ls, now: () => t0 });
  const s = await d.hydrate();
  check("conferma: servono anche i giorni", s.meta?.confirmedAt === null && s.backups.length === 4);
}

// 5. Ripristino della copia: torna la libreria del giorno della migrazione.
{
  const d = createDurable({ indexedDB: idb, localStorage: ls, now: () => t0 });
  await d.hydrate();
  const ok = await d.restoreBackup();
  check("ripristino: riuscito", ok);
  check("ripristino: libreria di prima", ((d.read("library")?.value ?? []) as unknown[]).length === 2);
  const again = createDurable({ indexedDB: idb, localStorage: ls, now: () => t0 });
  await again.hydrate();
  check("ripristino: resta dopo un riavvio", ((again.read("library")?.value ?? []) as unknown[]).length === 2);
}

// 6. Dopo sette giorni e cinque avvii la copia si cancella da sola.
{
  const later = new Date(t0.getTime() + 8 * 86_400_000);
  const d = createDurable({ indexedDB: idb, localStorage: ls, now: () => later });
  const s = await d.hydrate();
  check("conferma: arrivata", !!s.meta?.confirmedAt, String(s.meta?.confirmedAt));
  check("conferma: copia cancellata", ls.getItem(BACKUP_PREFIX + LEGACY_KEYS.library) === null && s.backups.length === 0);
  check("conferma: i dati restano", ((d.read("library")?.value ?? []) as unknown[]).length === 2);
}

// 7. Un testo illeggibile non si migra: si resta su localStorage, intatti.
{
  const bad = memoryStorage();
  bad.setItem(LEGACY_KEYS.library, "{non è json");
  const d = createDurable({ indexedDB: new IDBFactory(), localStorage: bad, now: () => t0 });
  const s = await d.hydrate();
  check("illeggibile: resta su localStorage", s.backend === "local", s.backend);
  check("illeggibile: segnalato come tale", d.read("library")?.corrupt === true);
  check("illeggibile: originale intatto", bad.getItem(LEGACY_KEYS.library) === "{non è json");
}

// 8. Quota piena: la copia di sicurezza resta sotto la chiave originale.
{
  const libText = JSON.stringify(library);
  const tight = seeded(
    LEGACY_KEYS.library.length + libText.length + LEGACY_KEYS.history.length + JSON.stringify(history).length +
      LEGACY_KEYS.playback.length + JSON.stringify(playback).length + LEGACY_KEYS.daily.length + JSON.stringify(daily).length + 40,
  );
  const d = createDurable({ indexedDB: new IDBFactory(), localStorage: tight, now: () => t0 });
  const s = await d.hydrate();
  check("quota piena: migrazione riuscita lo stesso", s.backend === "idb", s.reason ?? "");
  check("quota piena: l'originale fa da copia", tight.getItem(LEGACY_KEYS.library) === libText);
  check("quota piena: il registro lo sa", s.meta?.backupKeys.library === LEGACY_KEYS.library);
}

// 9. Senza IndexedDB: si resta su localStorage come prima.
{
  const plain = seeded();
  const d = createDurable({ indexedDB: null, localStorage: plain, now: () => t0 });
  const s = await d.hydrate();
  check("senza IndexedDB: localStorage", s.backend === "local");
  check("senza IndexedDB: legge i dati", ((d.read("library")?.value ?? []) as unknown[]).length === 2);
  d.write("library", []);
  check("senza IndexedDB: scrive su localStorage", plain.getItem(LEGACY_KEYS.library) === "[]");
}

// 10. I dati stavano su IndexedDB e oggi non si apre: niente libreria vuota
// scritta sopra, niente scritture.
{
  const marked = memoryStorage();
  marked.setItem(MARKER_KEY, "idb");
  const broken = { open: () => { throw new Error("rotto"); } } as unknown as IDBFactory;
  const d = createDurable({ indexedDB: broken, localStorage: marked, now: () => t0 });
  const s = await d.hydrate();
  check("non si apre: stato non raggiungibile", s.backend === "unavailable", s.backend);
  check("non si apre: nessuna scrittura", d.write("library", []) === false && marked.getItem(LEGACY_KEYS.library) === null);
}

// 11. Le letture sono copie: modificare ciò che si legge non tocca la memoria.
{
  const d = createDurable({ indexedDB: new IDBFactory(), localStorage: seeded(), now: () => t0 });
  await d.hydrate();
  const first = d.read("playback")?.value as Record<string, unknown>;
  delete first.a;
  const second = d.read("playback")?.value as Record<string, unknown>;
  check("letture: copie indipendenti", "a" in second);
}

// 12. Pagina chiusa a metà: dati su IndexedDB ma registro mai scritto.
// All'avvio dopo si ricomincia dagli originali, che sono ancora lì.
{
  const half = new IDBFactory();
  const ls12 = seeded();
  await new Promise<void>((resolve) => {
    const req = half.open("cinemate:data", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("kv");
    req.onsuccess = () => {
      const t = req.result.transaction("kv", "readwrite");
      t.objectStore("kv").put([{ id: "vecchio", title: "Copia a metà" }], "library");
      t.oncomplete = () => {
        req.result.close();
        resolve();
      };
    };
  });
  const d = createDurable({ indexedDB: half, localStorage: ls12, now: () => t0 });
  const s = await d.hydrate();
  check("a metà: migrazione rifatta", s.backend === "idb" && s.meta?.migratedAt !== null);
  check("a metà: vince l'originale", JSON.stringify(d.read("library")?.value) === JSON.stringify(library));
}

console.log(failures === 0 ? "\nTutti i controlli passati." : `\n${failures} controlli falliti.`);
process.exit(failures === 0 ? 0 : 1);
