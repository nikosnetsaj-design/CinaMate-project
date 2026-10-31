import it from "../locales/it";
import en from "../locales/en";

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
const dict: Record<MessageKey, string> = lang === "en" ? en : it;

/** Il testo nella lingua scelta; `{nome}` si riempie con `vars`. */
export function t(key: MessageKey, vars?: Record<string, string | number>): string {
  const text = dict[key] ?? it[key];
  return vars ? text.replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? `{${name}}`)) : text;
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

/** Come si legge uno stato: il valore salvato resta in italiano, nei backup e nei filtri. */
export function statusLabel(status: keyof typeof STATUS_KEY): string {
  return t(STATUS_KEY[status]);
}
