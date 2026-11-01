// Le lingue: chiavi complete, segnaposto, stati dei titoli.
const { default: it } = await import("../../src/locales/it.ts");
const { default: en } = await import("../../src/locales/en.ts");
const { t, statusLabel, intlLocale, lang, registerMessages, replyLanguage } = await import("../../src/lib/i18n.ts");
const { loadMessages } = await import("../vite-i18n.ts");

let failures = 0;
function check(name: string, cond: boolean, detail = "") {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!cond) failures++;
}

const missing = Object.keys(it).filter((k) => !(k in en));
const extra = Object.keys(en).filter((k) => !(k in it));
check("inglese: tutte le chiavi dell'italiano, nessuna in più", missing.length === 0 && extra.length === 0, [...missing, ...extra].join(", "));
const placeholders = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join();
const mismatched = Object.keys(it).filter((k) => placeholders((it as any)[k]) !== placeholders((en as any)[k]));
check("inglese: gli stessi segnaposto", mismatched.length === 0, mismatched.join(", "));
check("inglese: nessuna frase vuota", Object.values(en).every((v) => String(v).trim().length > 0));

check("predefinita: italiano", lang === "it" && intlLocale() === "it-IT");
check("segnaposto riempiti", t("page.library.count", { n: 24 }) === "24 titoli in totale");
check("segnaposto mancante resta visibile", t("page.library.count") === "{n} titoli in totale");
check("stati dei titoli", statusLabel("Da vedere") === "Da vedere" && statusLabel("In visione") === "In visione");
check("frasi dei componenti: italiano invariato", t("Duo.confronta") === "Confronta" && t("format.tra_giorni", { v0: 3 }) === "tra 3 giorni");
check("risposte dell'IA in italiano", replyLanguage() === "italiano");

// Il plugin di Vite legge gli stessi dizionari, con l'inglese accanto.
const pairs = loadMessages();
check("plugin: tutte le chiavi, in due lingue", pairs.size === Object.keys(it).length && pairs.get("Duo.confronta")?.[1] === "Compare");
check("plugin: nessun inglese uguale alla chiave", [...pairs].every(([k, [, e]]) => e !== k));

// Il benvenuto statico di index.html dice le stesse frasi del componente vero.
const { readFileSync } = await import("node:fs");
const html = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
const welcomeKeys = ["Onboarding.questa_e_cinemate_con", "Onboarding.tiene_il_diario_di", "Onboarding.comincia", "Onboarding.guardo_da_solo"] as const;
const jsString = (s: string) => JSON.stringify(s).slice(1, -1);
const missingInShell = welcomeKeys.filter((k) => !html.includes(it[k]) || !html.includes(jsString(en[k])));
check("index.html: benvenuto statico allineato al dizionario", missingInShell.length === 0, missingInShell.join(", "));

// Una frase che nessun modulo ha registrato si vede come chiave, non come testo sbagliato.
registerMessages({ "prova.chiave": ["Ciao", "Hello"] });
check("registrazione: la frase arriva", t("prova.chiave" as never) === "Ciao");
check("chiave sconosciuta: si vede la chiave", t("prova.inesistente" as never) === "prova.inesistente");

console.log(failures === 0 ? "\nTutti i controlli passati." : `\n${failures} controlli falliti.`);
process.exit(failures === 0 ? 0 : 1);
