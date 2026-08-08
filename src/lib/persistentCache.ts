import { logError } from "./errorLog";

/**
 * La cache che sopravvive al ricaricamento.
 *
 * Prima di questo file ogni cache di `tmdb.ts` era una `Map` in memoria, il che
 * significa che duravano quanto la scheda del browser: chiudere e riaprire
 * l'app voleva dire riscaricare tutto, comprese cose che non cambiano mai —
 * il cast di un film del 1995, i capitoli di una saga conclusa. Su una
 * connessione lenta era il ricaricamento a costare, non l'uso.
 *
 * Due livelli, e servono entrambi: la memoria perché una lettura sincrona
 * dentro un render non può aspettare IndexedDB, IndexedDB perché la memoria
 * non sopravvive alla chiusura. Le configurazioni leggere restano invece su
 * `localStorage` (vedi `localStore.ts`): sono piccole, si leggono all'avvio e
 * lì costano meno.
 */

const DB_NAME = "cinemate:cache";
const DB_VERSION = 1;
const STORE = "entries";

/** Quanto vale un dato prima di essere richiesto di nuovo. */
export const TTL = {
  /**
   * Metadati di film e serie. Ventiquattro ore è il compromesso dichiarato:
   * abbastanza perché una giornata d'uso non tocchi la rete, abbastanza poco
   * perché un voto o una locandina aggiornata arrivino il giorno dopo.
   */
  metadata: 24 * 60 * 60 * 1000,
  /**
   * Strutture che per definizione non cambiano: l'elenco dei capitoli di una
   * saga, la scheda di una persona, le liste di generi. Sette giorni.
   */
  static: 7 * 24 * 60 * 60 * 1000,
  /** Cataloghi che si muovono davvero: tendenze, uscite, "al cinema ora". */
  feed: 3 * 60 * 60 * 1000,
} as const;

interface StoredEntry {
  key: string;
  value: unknown;
  /** Istante oltre il quale il dato non vale più. */
  expires: number;
}

let dbPromise: Promise<IDBDatabase | null> | null = null;

/**
 * Apre il database, una volta sola.
 *
 * Torna `null` invece di lanciare quando IndexedDB non c'è o si rifiuta di
 * aprirsi — succede davvero, in navigazione privata e con alcune impostazioni
 * di privacy (la pagina Diagnostica lo verifica apposta). In quel caso la
 * cache resta solo in memoria: si perde la persistenza, non la funzione.
 */
function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase | null>((resolve) => {
    if (typeof indexedDB === "undefined") {
      resolve(null);
      return;
    }
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION);
    } catch {
      resolve(null);
      return;
    }
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "key" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    // Un'apertura che non risponde non deve tenere appesa l'app per sempre:
    // meglio proseguire senza persistenza che restare in attesa.
    request.onblocked = () => resolve(null);
  });
  return dbPromise;
}

function idbRead(key: string): Promise<StoredEntry | undefined> {
  return openDb().then(
    (db) =>
      new Promise<StoredEntry | undefined>((resolve) => {
        if (!db) {
          resolve(undefined);
          return;
        }
        try {
          const request = db.transaction(STORE, "readonly").objectStore(STORE).get(key);
          request.onsuccess = () => resolve(request.result as StoredEntry | undefined);
          request.onerror = () => resolve(undefined);
        } catch {
          resolve(undefined);
        }
      }),
  );
}

function idbWrite(entry: StoredEntry): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise<void>((resolve) => {
        if (!db) {
          resolve();
          return;
        }
        try {
          const request = db.transaction(STORE, "readwrite").objectStore(STORE).put(entry);
          request.onsuccess = () => resolve();
          // Lo spazio esaurito è l'errore probabile qui, ed è innocuo: la
          // memoria ha già il dato, il prossimo avvio lo richiederà alla rete.
          request.onerror = () => resolve();
        } catch {
          resolve();
        }
      }),
  );
}

function idbDelete(key: string): void {
  void openDb().then((db) => {
    if (!db) return;
    try {
      db.transaction(STORE, "readwrite").objectStore(STORE).delete(key);
    } catch {
      /* niente da fare, e niente da dire */
    }
  });
}

/**
 * Una cache a due livelli per un tipo di dato.
 *
 * Il namespace tiene separati i dizionari — `dettagli:603` e `stagione:603`
 * sono cose diverse — dentro un unico object store, che è più economico di un
 * database per tipo.
 */
export class TieredCache<T> {
  private memory = new Map<string, { value: T; expires: number }>();
  private readonly namespace: string;
  private readonly ttlMs: number;

  constructor(namespace: string, ttlMs: number) {
    this.namespace = namespace;
    this.ttlMs = ttlMs;
  }

  private full(key: string): string {
    return `${this.namespace}:${key}`;
  }

  /** Il dato se c'è ed è ancora valido, altrimenti `undefined`. */
  async get(key: string): Promise<T | undefined> {
    const now = Date.now();
    const hot = this.memory.get(key);
    if (hot) {
      if (hot.expires > now) return hot.value;
      this.memory.delete(key);
    }

    const stored = await idbRead(this.full(key));
    if (!stored) return undefined;
    if (stored.expires <= now) {
      // Scaduto: si toglie di mezzo subito, così il database non diventa un
      // archivio di cose che nessuno leggerà più.
      idbDelete(this.full(key));
      return undefined;
    }
    const value = stored.value as T;
    // Risalito in memoria: la seconda lettura nella stessa sessione non deve
    // ripassare da IndexedDB.
    this.memory.set(key, { value, expires: stored.expires });
    return value;
  }

  /**
   * Scrive su entrambi i livelli. La scrittura su disco non si aspetta: chi
   * chiama ha già il dato in mano e non deve restare fermo per un archivio.
   */
  set(key: string, value: T): void {
    const expires = Date.now() + this.ttlMs;
    this.memory.set(key, { value, expires });
    void idbWrite({ key: this.full(key), value, expires }).catch(() => {
      /* già ingoiato dentro idbWrite */
    });
  }

  /** Dimentica una voce su entrambi i livelli. */
  delete(key: string): void {
    this.memory.delete(key);
    idbDelete(this.full(key));
  }

  /**
   * Svuota il dizionario, disco compreso.
   *
   * Deve arrivare fino a IndexedDB: «Aggiorna contenuti» esiste per dire
   * "quello che hai è vecchio, richiedilo", e svuotare la sola memoria
   * significherebbe ripescare dal disco esattamente il dato che l'utente ha
   * appena chiesto di buttare.
   */
  clear(): void {
    this.memory.clear();
    const prefix = `${this.namespace}:`;
    void openDb().then((db) => {
      if (!db) return;
      try {
        const tx = db.transaction(STORE, "readwrite");
        // `IDBKeyRange.bound` con il carattere successivo al separatore prende
        // tutte e sole le chiavi del namespace, senza leggerle una per una.
        const range = IDBKeyRange.bound(prefix, `${this.namespace};`, false, true);
        tx.objectStore(STORE).delete(range);
      } catch {
        /* la memoria è comunque pulita: il peggio è un dato vecchio al riavvio */
      }
    });
  }
}

/**
 * Toglie di mezzo tutto ciò che è scaduto.
 *
 * Senza, il database cresce con ogni titolo mai guardato una volta: le voci
 * scadute vengono già saltate in lettura, ma nessuno le cancella se non le si
 * rilegge, e proprio quelle che non si rileggono più sono quelle che restano.
 * Va chiamata quando l'app è ferma, non durante l'avvio.
 */
export async function purgeExpired(): Promise<number> {
  const db = await openDb();
  if (!db) return 0;
  return new Promise<number>((resolve) => {
    let removed = 0;
    try {
      const tx = db.transaction(STORE, "readwrite");
      const request = tx.objectStore(STORE).openCursor();
      const now = Date.now();
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) return;
        const entry = cursor.value as StoredEntry;
        if (entry.expires <= now) {
          cursor.delete();
          removed++;
        }
        cursor.continue();
      };
      tx.oncomplete = () => resolve(removed);
      tx.onerror = () => resolve(removed);
    } catch (e) {
      logError("storage", "Pulizia della cache non riuscita", String(e));
      resolve(0);
    }
  });
}

/** Svuota tutto. Serve al pulsante "libera spazio" delle Impostazioni. */
export async function clearCache(): Promise<void> {
  const db = await openDb();
  if (!db) return;
  return new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}
