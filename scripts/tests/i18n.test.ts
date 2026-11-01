// Le lingue: chiavi complete, segnaposto, stati dei titoli.
const { default: it } = await import("../../src/locales/it.ts");
const { default: en } = await import("../../src/locales/en.ts");
const { t, statusLabel, intlLocale, lang } = await import("../../src/lib/i18n.ts");

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

console.log(failures === 0 ? "\nTutti i controlli passati." : `\n${failures} controlli falliti.`);
process.exit(failures === 0 ? 0 : 1);
