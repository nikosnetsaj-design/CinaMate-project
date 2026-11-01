import { durable } from "./durable";
import { searchTitles } from "./tmdb";
import { getHosts } from "../player/services/hostStore";
import { checkHost } from "../player/services/hostHealthService";
import { enabledLinkHosts } from "../store/useLinkHosts";
import { effectiveUrl } from "./linkHost";
import { probeRedirect } from "./hostRedirect";
import type { RedirectStatus } from "./hostRedirect";
import { t } from "./i18n";

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
  const base = { id: "storage", label: t("selfTest.memoria_del_browser") };
  try {
    const probe = "cinemate:__probe";
    localStorage.setItem(probe, "1");
    localStorage.removeItem(probe);
  } catch {
    return {
      ...base,
      status: "fail",
      detail: t("selfTest.non_riesco_a_scrivere"),
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
        ? t("selfTest.kb_usati_vicino_al", { v0: kb })
        : t("selfTest.kb_usati", { v0: kb }),
  };
}

/**
 * Dove stanno libreria e diario, e se questo avvio li ha letti dal posto
 * giusto. «localStorage» non è un errore — è la strada di prima, e funziona —
 * ma ha un tetto di circa 5 MB che una libreria lunga raggiunge.
 */
function testLibraryStore(): TestResult {
  const base = { id: "library-store", label: t("selfTest.archivio_della_libreria") };
  const s = durable.status();
  if (s.backend === "unavailable") {
    return { ...base, status: "fail", detail: s.reason ?? t("selfTest.il_database_dei_tuoi") };
  }
  if (s.backend === "local") {
    return { ...base, status: "warn", detail: s.reason ?? t("selfTest.in_localstorage_funziona_ma") };
  }
  return {
    ...base,
    status: "pass",
    detail: s.backups.length
      ? t("selfTest.su_indexeddb_la_copia")
      : "Su IndexedDB.",
  };
}

async function testIndexedDb(): Promise<TestResult> {
  const base = { id: "indexeddb", label: t("selfTest.archivio_dei_download") };
  if (!("indexedDB" in window)) {
    return { ...base, status: "warn", detail: t("selfTest.indexeddb_non_disponibile_i") };
  }
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open("cinemate:__probe", 1);
      request.onerror = () =>
        resolve({ ...base, status: "warn", detail: t("selfTest.indexeddb_rifiuta_di_aprirsi") });
      request.onsuccess = () => {
        request.result.close();
        indexedDB.deleteDatabase("cinemate:__probe");
        resolve({ ...base, status: "pass", detail: t("selfTest.disponibile") });
      };
    } catch {
      resolve({ ...base, status: "warn", detail: t("selfTest.indexeddb_non_accessibile") });
    }
  });
}

async function testTmdb(apiKey: string): Promise<TestResult> {
  const base = { id: "tmdb", label: t("selfTest.chiave_tmdb") };
  if (!apiKey) return { ...base, status: "skip", detail: t("selfTest.non_configurata_copertine_e") };
  try {
    await searchTitles("matrix", apiKey);
    return { ...base, status: "pass", detail: t("selfTest.valida_tmdb_risponde") };
  } catch (e) {
    return { ...base, status: "fail", detail: e instanceof Error ? e.message : t("selfTest.tmdb_non_risponde") };
  }
}

function testAnthropic(apiKey: string): TestResult {
  const base = { id: "anthropic", label: t("selfTest.chiave_anthropic") };
  if (!apiKey) return { ...base, status: "skip", detail: t("selfTest.non_configurata_critico_ricerca") };
  // Deliberately not verified with a live call: the cheapest possible request
  // still costs the user money, and running it on every diagnostics press
  // would make this page an expense. Shape is all we check here.
  return apiKey.startsWith("sk-ant-")
    ? { ...base, status: "pass", detail: t("selfTest.presente_si_verifica_davvero") }
    : { ...base, status: "warn", detail: t("selfTest.non_sembra_una_chiave") };
}

async function testHosts(): Promise<TestResult> {
  const base = { id: "hosts", label: t("selfTest.host_configurati") };
  const hosts = getHosts();
  if (hosts.length === 0) return { ...base, status: "skip", detail: t("selfTest.nessun_host_il_player") };

  const results = await Promise.all(hosts.map((h) => checkHost(h)));
  const down = results.filter((r) => !r.httpOk);
  if (down.length === 0) return { ...base, status: "pass", detail: t("selfTest.host_tutti_raggiungibili", { v0: hosts.length }) };
  if (down.length === hosts.length) {
    return { ...base, status: "fail", detail: t("selfTest.nessun_host_risponde_niente") };
  }
  return {
    ...base,
    status: "warn",
    detail: t("selfTest.di_non_rispondono_il", { v0: down.length, v1: hosts.length }),
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
    return { ...base, status: "skip", detail: t("selfTest.nessuno_configurato_la_ricerca") };
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
        ? t("selfTest.nessuno_dei_risponde_e", { v0: hosts.length, v1: noName, v2: noName === 1 ? t("selfTest.ha_un_nome_che_non") : t("selfTest.hanno_nomi_che_non") })
        : t("selfTest.nessuno_dei_risponde_i", { v0: hosts.length }),
    };
  }
  const notes = [
    moved ? t("selfTest.ha_traslocato_l_aggiornamento", { v0: moved }) : "",
    opaque ? t("selfTest.risponde_ma_non_si", { v0: opaque }) : "",
    noName ? t("selfTest.ha_un_nome_che", { v0: noName }) : "",
    mute ? t("selfTest.risolve_ma_il_server", { v0: mute }) : "",
  ].filter(Boolean);
  return {
    ...base,
    status: notes.length ? "warn" : "pass",
    detail: notes.length ? t("selfTest.configurati", { v0: hosts.length, v1: notes.join("; ") }) : t("selfTest.configurati_tutti_raggiungibili_e", { v0: hosts.length }),
  };
}

function testNotifications(): TestResult {
  const base = { id: "notifiche", label: t("selfTest.notifiche_dei_promemoria") };
  if (!("Notification" in window)) return { ...base, status: "skip", detail: t("selfTest.il_browser_non_le") };
  if (Notification.permission === "granted") return { ...base, status: "pass", detail: "Consentite." };
  if (Notification.permission === "denied") {
    return { ...base, status: "warn", detail: t("selfTest.bloccate_i_promemoria_delle") };
  }
  return { ...base, status: "skip", detail: t("selfTest.non_ancora_richieste") };
}

function testOnline(): TestResult {
  const base = { id: "rete", label: t("selfTest.connessione") };
  return navigator.onLine
    ? { ...base, status: "pass", detail: "Online." }
    : { ...base, status: "warn", detail: t("selfTest.offline_la_libreria_funziona") };
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
    testLibraryStore(),
    storage,
    indexeddb,
    tmdb,
    testAnthropic(keys.anthropic),
    hosts,
    linkHosts,
    testNotifications(),
  ];
}
