import type it from "../locales/it";

/**
 * Le lingue dell'app: l'italiano, che è quella in cui è scritta, e l'inglese.
 *
 * I testi stanno in `src/locales/`, uno per lingua; l'inglese è tipizzato
 * sulle chiavi dell'italiano, quindi una frase dimenticata è un errore di
 * compilazione e non un buco sullo schermo. La lingua si sceglie nelle
 * Impostazioni e vale per la sessione: cambiarla ricarica l'app, perché un
 * testo cambiato a metà schermata (metà già disegnato, metà no) è peggio di
 * un secondo di attesa per una scelta che si fa una volta.
 *
 * I dizionari non entrano interi nel bundle: il plugin `scripts/vite-i18n.ts`
 * fa registrare a ogni modulo le frasi che nomina (`registerMessages`), così
 * ogni pagina porta solo i suoi testi.
 *
 * Date, mesi e numeri seguono la stessa scelta (`intlLocale`).
 */
export type Lang = "it" | "en";
export type MessageKey = keyof typeof it;

const STORAGE_KEY = "cinemate:lang";

function storedLang(): Lang {
  try {
    return localStorage.getItem(STORAGE_KEY) === "en" ? "en" : "it";
  } catch {
    return "it";
  }
}

export const lang: Lang = storedLang();
const messages: Record<string, readonly [it: string, en: string]> = Object.create(null);

/** Le frasi di un modulo, nelle due lingue. La chiama il plugin, non il codice a mano. */
export function registerMessages(entries: Record<string, readonly [it: string, en: string]>): void {
  Object.assign(messages, entries);
}

/** Il testo nella lingua scelta; `{nome}` si riempie con `vars`. */
export function t(key: MessageKey, vars?: Record<string, string | number>): string {
  const pair = messages[key];
  // Senza la frase registrata si vede la chiave: un buco evidente, non un testo sbagliato.
  const text = pair ? pair[lang === "en" ? 1 : 0] : key;
  return vars ? text.replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? `{${name}}`)) : text;
}

/**
 * La lingua in cui il modello deve rispondere. I prompt restano scritti in
 * italiano — il modello li capisce uguale — ma quello che l'utente legge esce
 * nella lingua dell'app.
 */
export function replyLanguage(): string {
  return lang === "en" ? "inglese (English)" : "italiano";
}

/** Il locale per `Intl`: mesi, giorni e migliaia scritti come nella lingua scelta. */
export function intlLocale(): string {
  return lang === "en" ? "en-GB" : "it-IT";
}

/**
 * La lingua delle risposte di TMDB — titoli, trame, generi. `en-US` e non
 * `en-GB`: è l'inglese in cui il catalogo è davvero compilato.
 */
export function tmdbLanguage(): string {
  return lang === "en" ? "en-US" : "it-IT";
}

/**
 * Cambia lingua e ricarica. `beforeReload` serve a chi deve buttare via
 * quello che dipende dalla lingua (le risposte di TMDB in cache).
 */
export async function setLang(next: Lang, beforeReload?: () => unknown): Promise<void> {
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // senza memoria la scelta vale fino al ricaricamento: niente da fare
  }
  try {
    await beforeReload?.();
  } finally {
    window.location.reload();
  }
}

export const LANGS: { id: Lang; label: string }[] = [
  { id: "it", label: "Italiano" },
  { id: "en", label: "English" },
];

const STATUS_KEY = {
  "In visione": "status.watching",
  Visto: "status.watched",
  "Da vedere": "status.toWatch",
  Abbandonato: "status.dropped",
  "In pausa": "status.paused",
} as const satisfies Record<string, MessageKey>;

/** Come si legge una piattaforma: «Altro» è un valore salvato, il resto sono nomi propri. */
export function platformLabel(platform: string): string {
  return platform === "Altro" ? t("platform.other") : platform;
}

/** Come si legge uno stato: il valore salvato resta in italiano, nei backup e nei filtri. */
export function statusLabel(status: keyof typeof STATUS_KEY): string {
  return t(STATUS_KEY[status]);
}
