/**
 * Dove vivono i dati che crescono con l'uso: la libreria, il diario, i punti
 * di ripresa del lettore e i minuti guardati giorno per giorno.
 *
 * Stavano in `localStorage`, che ha due difetti per questo lavoro: un tetto di
 * circa 5 MB condiviso con tutto il resto dell'origine, e la serializzazione
 * dell'intero array a ogni scrittura sul thread che disegna. IndexedDB non ha
 * nessuno dei due problemi, ma è asincrono — e l'app intera è scritta su
 * letture sincrone: lo store della libreria si inizializza quando il modulo
 * viene importato, il lettore legge e scrive la posizione ogni pochi secondi.
 *
 * Quindi la forma è questa: **una copia in memoria, caricata prima che l'app
 * parta**, letta in modo sincrono come prima, e scritta su IndexedDB alle
 * spalle. `main.tsx` aspetta `hydrate()` e solo dopo importa l'app; da lì in
 * avanti nessun componente si accorge che il disco è cambiato.
 *
 * La migrazione è la parte che non si può sbagliare, perché sono dati che non
 * esistono da nessun'altra parte:
 *
 * 1. si copiano i valori di `localStorage` su IndexedDB, in una transazione;
 * 2. si rileggono e si confrontano con l'originale;
 * 3. solo se coincidono si sposta l'originale sotto `cinemate:pre-idb:*` — la
 *    copia di sicurezza — e si scrive il registro della migrazione;
 * 4. la copia resta finché la migrazione non è *confermata*: cinque avvii in
 *    cui IndexedDB si è letto senza errori, e almeno sette giorni.
 *
 * Ogni passo è ripetibile: se la pagina si chiude a metà, all'avvio dopo il
 * registro non c'è e la migrazione ricomincia da capo sugli originali, che
 * sono ancora al loro posto.
 */

export type DurableKey = "library" | "history" | "playback" | "daily";

export const DURABLE_KEYS: readonly DurableKey[] = ["library", "history", "playback", "daily"];

/** Le chiavi di `localStorage` da cui arrivano, e dove tornano se IndexedDB manca. */
export const LEGACY_KEYS: Record<DurableKey, string> = {
  library: "cinemate:v2",
  history: "cinemate:history:v1",
  playback: "ppv:watch-history",
  daily: "ppv:daily-seconds",
};

export const BACKUP_PREFIX = "cinemate:pre-idb:";
/**
 * Il segno, in `localStorage`, che i dati stanno su IndexedDB. Serve per il
 * caso peggiore: un avvio in cui il database non si apre. Senza questo segno
 * l'app leggerebbe la `localStorage` ormai vuota e ripartirebbe da una
 * libreria vuota, scrivendoci sopra.
 */
export const MARKER_KEY = "cinemate:storage";

export const CONFIRM_AFTER_LAUNCHES = 5;
export const CONFIRM_AFTER_DAYS = 7;

const DB_NAME = "cinemate:data";
const DB_VERSION = 1;
const STORE = "kv";
const META_KEY = "meta";

/** Il registro della migrazione, salvato accanto ai dati. */
export interface MigrationMeta {
  schema: 1;
  /** ISO. `null` per un'installazione nuova, che non aveva niente da spostare. */
  migratedAt: string | null;
  /** Avvii in cui IndexedDB si è letto senza errori, dopo la migrazione. */
  launches: number;
  /** ISO; da qui la copia di sicurezza non c'è più. */
  confirmedAt: string | null;
  /** Le chiavi di `localStorage` che tengono la copia, per ogni raccolta spostata. */
  backupKeys: Partial<Record<DurableKey, string>>;
}

export type Backend = "idb" | "local" | "unavailable";

export interface StorageStatus {
  backend: Backend;
  meta: MigrationMeta | null;
  /** Le raccolte di cui esiste ancora la copia di prima della migrazione. */
  backups: DurableKey[];
  /** Perché si è finiti su `local` o `unavailable`, se non è il caso normale. */
  reason: string | null;
}

/** Il risultato di una lettura: il valore, o il segno che il testo salvato è illeggibile. */
export type DurableRead = { value: unknown; corrupt: false } | { value: undefined; corrupt: true } | undefined;

export interface DurableEnv {
  indexedDB?: IDBFactory | null;
  localStorage?: Storage | null;
  now?: () => Date;
  /**
   * Per avvisare le altre schede di una scrittura. Una funzione, chiamata solo
   * quando i dati stanno davvero su IndexedDB: un canale aperto all'import
   * terrebbe vivo per sempre un processo di test.
   */
  broadcast?: () => Channel | null;
}

type Listener = (key: DurableKey) => void;

interface Channel {
  postMessage: (m: unknown) => void;
  onmessage: ((e: MessageEvent) => void) | null;
}

function sameJson(a: unknown, b: unknown): boolean {
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

function openDb(factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let request: IDBOpenDBRequest;
    try {
      request = factory.open(DB_NAME, DB_VERSION);
    } catch (e) {
      reject(e);
      return;
    }
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("apertura di IndexedDB non riuscita"));
    // Un'altra scheda con una versione vecchia aperta: meglio ripiegare che
    // restare appesi per sempre.
    request.onblocked = () => reject(new Error("IndexedDB bloccato da un'altra scheda"));
  });
}

function tx<T>(db: IDBDatabase, mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    let result: T | undefined;
    let t: IDBTransaction;
    try {
      t = db.transaction(STORE, mode);
    } catch (e) {
      reject(e);
      return;
    }
    const req = run(t.objectStore(STORE));
    if (req) req.onsuccess = () => (result = req.result);
    t.oncomplete = () => resolve(result);
    t.onerror = () => reject(t.error ?? new Error("transazione non riuscita"));
    t.onabort = () => reject(t.error ?? new Error("transazione interrotta"));
  });
}

export function createDurable(env: DurableEnv = {}) {
  const now = env.now ?? (() => new Date());
  const ls = env.localStorage === undefined ? (typeof localStorage === "undefined" ? null : localStorage) : env.localStorage;
  const factory = env.indexedDB === undefined ? (typeof indexedDB === "undefined" ? null : indexedDB) : env.indexedDB;

  const memory = new Map<DurableKey, unknown>();
  const listeners = new Set<Listener>();
  const errorListeners = new Set<(message: string) => void>();
  let hydrated = false;
  let db: IDBDatabase | null = null;
  let channel: Channel | null = null;
  let status: StorageStatus = { backend: "local", meta: null, backups: [], reason: null };

  // --- localStorage, la strada di prima ------------------------------------

  function readLegacy(key: DurableKey): DurableRead {
    if (!ls) return undefined;
    let raw: string | null;
    try {
      raw = ls.getItem(LEGACY_KEYS[key]);
    } catch {
      return undefined;
    }
    if (raw === null) return undefined;
    try {
      return { value: JSON.parse(raw), corrupt: false };
    } catch {
      return { value: undefined, corrupt: true };
    }
  }

  function writeLegacy(key: DurableKey, value: unknown): boolean {
    if (!ls) return false;
    try {
      ls.setItem(LEGACY_KEYS[key], JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }

  function lsGet(k: string): string | null {
    try {
      return ls?.getItem(k) ?? null;
    } catch {
      return null;
    }
  }
  function lsSet(k: string, v: string): boolean {
    try {
      if (!ls) return false;
      ls.setItem(k, v);
      return true;
    } catch {
      return false;
    }
  }
  function lsRemove(k: string) {
    try {
      ls?.removeItem(k);
    } catch {
      // niente da fare: resterà una chiave in più
    }
  }

  // --- scritture su IndexedDB, una alla volta per chiave -------------------

  const inFlight = new Set<DurableKey>();
  const dirty = new Set<DurableKey>();
  const pendingDone: Array<() => void> = [];

  function settleIfIdle() {
    if (inFlight.size === 0 && dirty.size === 0) {
      while (pendingDone.length) pendingDone.shift()?.();
    }
  }

  function persist(key: DurableKey) {
    if (!db) return;
    if (inFlight.has(key)) {
      // Una scrittura è già in corso: quando finisce si scrive il valore più
      // recente. Il lettore può chiedere dieci scritture al minuto; al disco
      // ne arriva una alla volta, sempre l'ultima.
      dirty.add(key);
      return;
    }
    inFlight.add(key);
    const value = memory.get(key);
    tx(db, "readwrite", (s) => s.put(value, key))
      .catch((e: unknown) => {
        const message = e instanceof Error ? e.message : String(e);
        errorListeners.forEach((l) => l(message));
      })
      .finally(() => {
        inFlight.delete(key);
        if (dirty.delete(key)) persist(key);
        else settleIfIdle();
      });
    channel?.postMessage({ key });
  }

  // --- avvio ---------------------------------------------------------------

  async function readAllFromDb(database: IDBDatabase): Promise<{ meta: MigrationMeta | undefined; values: Partial<Record<DurableKey, unknown>> }> {
    const values: Partial<Record<DurableKey, unknown>> = {};
    let meta: MigrationMeta | undefined;
    await new Promise<void>((resolve, reject) => {
      const t = database.transaction(STORE, "readonly");
      const store = t.objectStore(STORE);
      const metaReq = store.get(META_KEY);
      metaReq.onsuccess = () => (meta = metaReq.result as MigrationMeta | undefined);
      for (const key of DURABLE_KEYS) {
        const r = store.get(key);
        r.onsuccess = () => {
          if (r.result !== undefined) values[key] = r.result;
        };
      }
      t.oncomplete = () => resolve();
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    });
    return { meta, values };
  }

  function fallBackToLocal(reason: string | null, backend: Backend = "local") {
    status = { backend, meta: null, backups: [], reason };
    db = null;
  }

  /**
   * Sposta i dati di `localStorage` su IndexedDB, se ce ne sono.
   * Ritorna il registro scritto, o `null` se la migrazione non si è potuta fare
   * — e allora questa sessione resta su `localStorage`, come prima.
   */
  async function migrate(database: IDBDatabase): Promise<MigrationMeta | null> {
    const legacy: Partial<Record<DurableKey, { raw: string; value: unknown }>> = {};
    for (const key of DURABLE_KEYS) {
      const raw = lsGet(LEGACY_KEYS[key]);
      if (raw === null) continue;
      try {
        legacy[key] = { raw, value: JSON.parse(raw) };
      } catch {
        // Un testo illeggibile non si sposta: resta dov'è, e l'app lo segnala
        // con il suo avviso di sempre. Si migrerà quando sarà stato sistemato.
        return null;
      }
    }

    const keys = Object.keys(legacy) as DurableKey[];
    const stamp = now().toISOString();

    if (keys.length === 0) {
      // Installazione nuova: niente da spostare e niente da tenere da parte.
      const meta: MigrationMeta = { schema: 1, migratedAt: null, launches: 0, confirmedAt: stamp, backupKeys: {} };
      await tx(database, "readwrite", (s) => s.put(meta, META_KEY));
      return meta;
    }

    // 1. La copia, in una transazione sola: o tutto o niente.
    await tx(database, "readwrite", (s) => {
      for (const key of keys) s.put(legacy[key]!.value, key);
    });

    // 2. La verifica: si rilegge e si confronta con l'originale.
    const back = await readAllFromDb(database);
    for (const key of keys) {
      if (!sameJson(back.values[key], legacy[key]!.value)) {
        throw new Error(`la copia di «${key}» su IndexedDB non coincide con l'originale`);
      }
    }

    // 3. La copia di sicurezza: l'originale passa sotto `cinemate:pre-idb:*`.
    // Se la quota non basta per due copie, l'originale resta dov'è e fa lui da
    // copia — il registro dice quale chiave guardare.
    const backupKeys: Partial<Record<DurableKey, string>> = {};
    for (const key of keys) {
      const backupKey = BACKUP_PREFIX + LEGACY_KEYS[key];
      backupKeys[key] = lsSet(backupKey, legacy[key]!.raw) ? backupKey : LEGACY_KEYS[key];
    }

    const meta: MigrationMeta = { schema: 1, migratedAt: stamp, launches: 0, confirmedAt: null, backupKeys };
    await tx(database, "readwrite", (s) => s.put(meta, META_KEY));

    // 4. Solo ora, con il registro scritto, si tolgono gli originali.
    for (const key of keys) {
      if (backupKeys[key] !== LEGACY_KEYS[key]) lsRemove(LEGACY_KEYS[key]);
    }
    return meta;
  }

  function dropBackups(meta: MigrationMeta) {
    for (const k of Object.values(meta.backupKeys)) if (k) lsRemove(k);
  }

  function presentBackups(meta: MigrationMeta | null): DurableKey[] {
    if (!meta || meta.confirmedAt) return [];
    return (Object.keys(meta.backupKeys) as DurableKey[]).filter((k) => lsGet(meta.backupKeys[k]!) !== null);
  }

  async function hydrate(): Promise<StorageStatus> {
    if (hydrated) return status;
    hydrated = true;

    const marker = lsGet(MARKER_KEY);

    if (!factory) {
      if (marker === "idb") {
        fallBackToLocal("Questo browser non apre più il database in cui stanno i tuoi dati.", "unavailable");
      } else {
        fallBackToLocal("IndexedDB non c'è in questo browser: i dati restano in localStorage.");
        for (const key of DURABLE_KEYS) {
          const r = readLegacy(key);
          if (r && !r.corrupt) memory.set(key, r.value);
        }
      }
      return status;
    }

    let database: IDBDatabase;
    try {
      database = await openDb(factory);
    } catch (e) {
      const why = e instanceof Error ? e.message : String(e);
      if (marker === "idb") {
        // I dati stanno lì dentro e oggi non si apre: meglio non mostrare
        // niente che mostrare una libreria vuota e poi scriverci sopra.
        fallBackToLocal(`Il database dei tuoi dati non si apre (${why}).`, "unavailable");
      } else {
        fallBackToLocal(`IndexedDB non si apre (${why}): i dati restano in localStorage.`);
        for (const key of DURABLE_KEYS) {
          const r = readLegacy(key);
          if (r && !r.corrupt) memory.set(key, r.value);
        }
      }
      return status;
    }

    try {
      let { meta, values } = await readAllFromDb(database);

      if (!meta) {
        const migrated = await migrate(database);
        if (!migrated) {
          database.close();
          fallBackToLocal("Un dato salvato è illeggibile: la migrazione aspetta che venga sistemato.");
          for (const key of DURABLE_KEYS) {
            const r = readLegacy(key);
            if (r && !r.corrupt) memory.set(key, r.value);
          }
          return status;
        }
        meta = migrated;
        ({ values } = await readAllFromDb(database));
      } else if (!meta.confirmedAt) {
        // Un avvio letto senza errori conta verso la conferma.
        const launches = meta.launches + 1;
        const days = meta.migratedAt ? (now().getTime() - Date.parse(meta.migratedAt)) / 86_400_000 : Infinity;
        const confirm = launches >= CONFIRM_AFTER_LAUNCHES && days >= CONFIRM_AFTER_DAYS;
        meta = { ...meta, launches, confirmedAt: confirm ? now().toISOString() : null };
        await tx(database, "readwrite", (s) => s.put(meta, META_KEY));
        if (confirm) dropBackups(meta);
      }

      for (const key of DURABLE_KEYS) if (key in values) memory.set(key, values[key]);
      db = database;
      lsSet(MARKER_KEY, "idb");
      status = { backend: "idb", meta, backups: presentBackups(meta), reason: null };

      // Chiedere al browser di non sfrattare questi dati quando lo spazio
      // stringe. È una richiesta, non una garanzia, e può essere rifiutata.
      try {
        void navigator.storage?.persist?.();
      } catch {
        // niente
      }

      channel = env.broadcast?.() ?? null;
      if (channel) {
        channel.onmessage = (e: MessageEvent) => {
          const key = (e.data as { key?: DurableKey } | null)?.key;
          if (!key || !DURABLE_KEYS.includes(key) || !db) return;
          void tx(db, "readonly", (s) => s.get(key)).then((value) => {
            memory.set(key, value);
            listeners.forEach((l) => l(key));
          });
        };
      }
    } catch (e) {
      database.close();
      const why = e instanceof Error ? e.message : String(e);
      if (marker === "idb") {
        fallBackToLocal(`Il database dei tuoi dati non si legge (${why}).`, "unavailable");
      } else {
        fallBackToLocal(`Migrazione non riuscita (${why}): i dati restano in localStorage, intatti.`);
        for (const key of DURABLE_KEYS) {
          const r = readLegacy(key);
          if (r && !r.corrupt) memory.set(key, r.value);
        }
      }
    }
    return status;
  }

  // --- lettura e scrittura --------------------------------------------------

  /**
   * Il valore di una raccolta. Prima di `hydrate()` — nei test, o se qualcosa
   * lo importa prima del tempo — legge da `localStorage` come faceva l'app.
   */
  function read(key: DurableKey): DurableRead {
    if (!hydrated) return readLegacy(key);
    if (status.backend === "local") {
      // Su localStorage si rilegge sempre il disco: è ciò che segnala un testo
      // illeggibile allo store della libreria, come prima.
      return readLegacy(key);
    }
    if (!memory.has(key)) return undefined;
    // Una copia, come la dava JSON.parse: chi legge può modificare ciò che
    // riceve — il lettore lo fa con la mappa delle posizioni — senza cambiare
    // in silenzio la memoria, e uno store che confronta i riferimenti vede
    // davvero un valore nuovo.
    return { value: structuredClone(memory.get(key)), corrupt: false };
  }

  /**
   * Scrive una raccolta. Su IndexedDB la memoria è aggiornata subito e il disco
   * subito dopo; un errore del disco arriva a chi ascolta `onError`. Torna
   * `false` solo quando si sa già che non è stato salvato.
   */
  function write(key: DurableKey, value: unknown): boolean {
    if (status.backend === "unavailable") return false;
    if (!hydrated || status.backend === "local") return writeLegacy(key, value);
    memory.set(key, value);
    persist(key);
    return true;
  }

  /** Aspetta che le scritture in corso arrivino sul disco. */
  function flush(): Promise<void> {
    return new Promise((resolve) => {
      pendingDone.push(resolve);
      settleIfIdle();
    });
  }

  /**
   * Rimette su IndexedDB il contenuto della copia di prima della migrazione.
   * Ciò che è stato scritto dopo si perde: è il punto del ripristino, e chi lo
   * chiama deve dirlo prima.
   */
  async function restoreBackup(): Promise<boolean> {
    const meta = status.meta;
    if (!db || !meta) return false;
    const restored: Partial<Record<DurableKey, unknown>> = {};
    for (const key of Object.keys(meta.backupKeys) as DurableKey[]) {
      const raw = lsGet(meta.backupKeys[key]!);
      if (raw === null) continue;
      try {
        restored[key] = JSON.parse(raw);
      } catch {
        return false;
      }
    }
    await tx(db, "readwrite", (s) => {
      for (const key of Object.keys(restored) as DurableKey[]) s.put(restored[key], key);
    });
    for (const key of Object.keys(restored) as DurableKey[]) {
      memory.set(key, restored[key]);
      listeners.forEach((l) => l(key));
    }
    return true;
  }

  /** Conferma la migrazione adesso, senza aspettare: la copia vecchia sparisce. */
  async function confirmNow(): Promise<void> {
    const meta = status.meta;
    if (!db || !meta || meta.confirmedAt) return;
    const next: MigrationMeta = { ...meta, confirmedAt: now().toISOString() };
    await tx(db, "readwrite", (s) => s.put(next, META_KEY));
    dropBackups(next);
    status = { ...status, meta: next, backups: [] };
  }

  return {
    hydrate,
    read,
    write,
    flush,
    restoreBackup,
    confirmNow,
    status: () => status,
    /** Una scrittura arrivata da un'altra scheda. */
    subscribe(listener: Listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    onError(listener: (message: string) => void) {
      errorListeners.add(listener);
      return () => errorListeners.delete(listener);
    },
  };
}

export type Durable = ReturnType<typeof createDurable>;

function openChannel(): Channel | null {
  try {
    return typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel("cinemate:durable");
  } catch {
    return null;
  }
}

/** L'istanza dell'app. I test ne creano di proprie con `createDurable`. */
export const durable = createDurable({ broadcast: openChannel });
