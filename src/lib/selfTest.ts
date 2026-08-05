import { searchTitles } from "./tmdb";
import { getHosts } from "../player/services/hostStore";
import { checkHost } from "../player/services/hostHealthService";
import { enabledLinkHosts } from "../store/useLinkHosts";
import { effectiveUrl } from "./linkHost";
import { probeRedirect } from "./hostRedirect";
import type { RedirectStatus } from "./hostRedirect";

export type TestStatus = "pass" | "warn" | "fail" | "skip";

export interface TestResult {
  id: string;
  label: string;
  status: TestStatus;
  detail: string;
}

/**
 * The checks the diagnostics page runs on demand.
 *
 * Every one of them tests something that has actually broken for someone: a
 * full storage quota, a revoked API key, a host that stopped answering, a
 * browser that quietly refuses IndexedDB in private mode. They are deliberately
 * *observations*, not repairs — a diagnostic that fixes things as it goes can't
 * tell you what was wrong.
 *
 * "skip" is a first-class outcome and is not a failure: a TMDB key that isn't
 * configured is a choice, and reporting it red would train people to ignore
 * the page.
 */

async function testLocalStorage(): Promise<TestResult> {
  const base = { id: "storage", label: "Memoria del browser" };
  try {
    const probe = "cinemate:__probe";
    localStorage.setItem(probe, "1");
    localStorage.removeItem(probe);
  } catch {
    return {
      ...base,
      status: "fail",
      detail: "Non riesco a scrivere. Spazio esaurito, o navigazione privata: i dati non verranno salvati.",
    };
  }

  // Rough but honest: measuring what this app stores, not the whole origin.
  let bytes = 0;
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (!key?.startsWith("cinemate:") && !key?.startsWith("ppv:")) continue;
    bytes += (localStorage.getItem(key)?.length ?? 0) + key.length;
  }
  const kb = Math.round(bytes / 1024);
  // Browsers give an origin roughly 5 MB of localStorage; past about 3.5 MB it
  // is worth saying so while there is still room to export.
  return {
    ...base,
    status: kb > 3500 ? "warn" : "pass",
    detail:
      kb > 3500
        ? `${kb} KB usati: vicino al limite del browser. Esporta un backup e valuta di svuotare la cronologia degli host.`
        : `${kb} KB usati.`,
  };
}

async function testIndexedDb(): Promise<TestResult> {
  const base = { id: "indexeddb", label: "Archivio dei download" };
  if (!("indexedDB" in window)) {
    return { ...base, status: "warn", detail: "IndexedDB non disponibile: i download offline non funzioneranno." };
  }
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open("cinemate:__probe", 1);
      request.onerror = () =>
        resolve({ ...base, status: "warn", detail: "IndexedDB rifiuta di aprirsi — spesso è la navigazione privata." });
      request.onsuccess = () => {
        request.result.close();
        indexedDB.deleteDatabase("cinemate:__probe");
        resolve({ ...base, status: "pass", detail: "Disponibile." });
      };
    } catch {
      resolve({ ...base, status: "warn", detail: "IndexedDB non accessibile." });
    }
  });
}

async function testTmdb(apiKey: string): Promise<TestResult> {
  const base = { id: "tmdb", label: "Chiave TMDB" };
  if (!apiKey) return { ...base, status: "skip", detail: "Non configurata. Copertine e catalogo restano spenti." };
  try {
    await searchTitles("matrix", apiKey);
    return { ...base, status: "pass", detail: "Valida, TMDB risponde." };
  } catch (e) {
    return { ...base, status: "fail", detail: e instanceof Error ? e.message : "TMDB non risponde." };
  }
}

function testAnthropic(apiKey: string): TestResult {
  const base = { id: "anthropic", label: "Chiave Anthropic" };
  if (!apiKey) return { ...base, status: "skip", detail: "Non configurata. Critico, ricerca a parole e riassunti restano spenti." };
  // Deliberately not verified with a live call: the cheapest possible request
  // still costs the user money, and running it on every diagnostics press
  // would make this page an expense. Shape is all we check here.
  return apiKey.startsWith("sk-ant-")
    ? { ...base, status: "pass", detail: "Presente. Si verifica davvero al primo uso." }
    : { ...base, status: "warn", detail: "Non sembra una chiave Anthropic: di solito iniziano con sk-ant-." };
}

async function testHosts(): Promise<TestResult> {
  const base = { id: "hosts", label: "Host configurati" };
  const hosts = getHosts();
  if (hosts.length === 0) return { ...base, status: "skip", detail: "Nessun host. Il player usa gli indirizzi in Impostazioni." };

  const results = await Promise.all(hosts.map((h) => checkHost(h)));
  const down = results.filter((r) => !r.httpOk);
  if (down.length === 0) return { ...base, status: "pass", detail: `${hosts.length} host, tutti raggiungibili.` };
  if (down.length === hosts.length) {
    return { ...base, status: "fail", detail: "Nessun host risponde. Niente da riprodurre finché non torna almeno uno." };
  }
  return {
    ...base,
    status: "warn",
    detail: `${down.length} di ${hosts.length} non rispondono. Il failover coprirà, ma senza margine.`,
  };
}

/**
 * I Link Host, controllati per quello che il browser lascia sapere: se
 * rispondono, se hanno traslocato, e — la parte che conta di più qui — se si
 * lasciano leggere. Un sito che risponde ma non manda gli header CORS non è
 * rotto: è la condizione normale, e la ricerca automatica lì non arriverà mai.
 * Dirlo in diagnostica evita di scoprirlo un titolo alla volta.
 */
async function testLinkHosts(): Promise<TestResult> {
  const base = { id: "link-host", label: "Link Host" };
  const hosts = enabledLinkHosts();
  if (hosts.length === 0) {
    return { ...base, status: "skip", detail: "Nessuno configurato. La ricerca automatica sui siti è spenta." };
  }

  const probes = await Promise.all(hosts.map((h) => probeRedirect(effectiveUrl(h))));
  const count = (status: RedirectStatus) => probes.filter((p) => p.status === status).length;
  const moved = count("traslocato");
  const opaque = count("raggiungibile-ma-opaco");
  const noName = count("nome-non-risolto");
  const mute = count("risolve-ma-muto");
  const dead = count("non-raggiungibile") + noName + mute;

  if (dead === hosts.length) {
    return {
      ...base,
      status: "fail",
      // Il DoH ha già separato i due casi: dirlo qui invece di rimandare
      // l'utente a indagare è tutto il punto di averlo interrogato.
      detail: noName
        ? `Nessuno dei ${hosts.length} risponde, e ${noName} ${noName === 1 ? "ha un nome che non esiste" : "hanno nomi che non esistono"} nemmeno per un resolver pubblico: non è il tuo DNS.`
        : `Nessuno dei ${hosts.length} risponde. I nomi si risolvono, i server dietro no.`,
    };
  }
  const notes = [
    moved ? `${moved} ha traslocato (l'aggiornamento va accettato in Impostazioni)` : "",
    opaque ? `${opaque} risponde ma non si lascia leggere: lì resta il Web Viewer` : "",
    noName ? `${noName} ha un nome che non esiste più` : "",
    mute ? `${mute} risolve ma il server non risponde` : "",
  ].filter(Boolean);
  return {
    ...base,
    status: notes.length ? "warn" : "pass",
    detail: notes.length ? `${hosts.length} configurati — ${notes.join("; ")}.` : `${hosts.length} configurati, tutti raggiungibili e leggibili.`,
  };
}

function testNotifications(): TestResult {
  const base = { id: "notifiche", label: "Notifiche dei promemoria" };
  if (!("Notification" in window)) return { ...base, status: "skip", detail: "Il browser non le supporta." };
  if (Notification.permission === "granted") return { ...base, status: "pass", detail: "Consentite." };
  if (Notification.permission === "denied") {
    return { ...base, status: "warn", detail: "Bloccate: i promemoria delle uscite non arriveranno." };
  }
  return { ...base, status: "skip", detail: "Non ancora richieste." };
}

function testOnline(): TestResult {
  const base = { id: "rete", label: "Connessione" };
  return navigator.onLine
    ? { ...base, status: "pass", detail: "Online." }
    : { ...base, status: "warn", detail: "Offline. La libreria funziona; catalogo e player in rete no." };
}

/** Runs everything and returns the results in a stable order. */
export async function runSelfTests(keys: { tmdb: string; anthropic: string }): Promise<TestResult[]> {
  const [storage, indexeddb, tmdb, hosts, linkHosts] = await Promise.all([
    testLocalStorage(),
    testIndexedDb(),
    testTmdb(keys.tmdb),
    testHosts(),
    testLinkHosts(),
  ]);
  return [
    testOnline(),
    storage,
    indexeddb,
    tmdb,
    testAnthropic(keys.anthropic),
    hosts,
    linkHosts,
    testNotifications(),
  ];
}
