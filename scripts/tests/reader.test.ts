/**
 * Il lettore di pagine: come si costruisce l'indirizzo da chiedergli.
 *
 * È una funzione di testo, ma sbagliarla non si vede a occhio — si vede come
 * «il sito non risponde», che è la stessa faccia di dieci altri problemi. Da
 * qui si controlla che le tre forme in cui i lettori del mondo si presentano
 * diano tutte e tre l'indirizzo giusto, e che quello che indirizzo non è venga
 * rifiutato invece di finire in una `fetch`.
 */
const store = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};

const { readerAddress, readableDocument, readerTemplateFor } = await import(
  "../../src/lib/pageReader.ts"
);

let failures = 0;
function check(name: string, cond: boolean, detail = "") {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!cond) failures++;
}

const PAGE = "https://sito.tld/film/esempio?x=1&y=2";

// 1. Il segnaposto in un parametro: l'indirizzo ci va codificato, altrimenti il
//    suo `?x=1` diventa un parametro del lettore invece che della pagina.
{
  const got = readerAddress("https://lettore.dev/?u={url}", PAGE);
  check(
    "{url} → codificato nel parametro",
    got === `https://lettore.dev/?u=${encodeURIComponent(PAGE)}`,
    String(got),
  );
  check("{url} → niente & sciolti nell'indirizzo finale", (got ?? "").split("&").length === 1, String(got));
}

// 2. Il segnaposto nudo: chi se lo aspetta come coda del percorso lo vuole
//    intero, non percentualizzato.
{
  const got = readerAddress("https://lettore.casa/leggi/{url-nudo}", PAGE);
  check("{url-nudo} → indirizzo intero", got === `https://lettore.casa/leggi/${PAGE}`, String(got));
}

// 3. Nessun segnaposto: si attacca in fondo, che è come funziona cors-anywhere.
{
  const got = readerAddress("https://lettore.casa/", PAGE);
  check("nessun segnaposto → attaccato in coda", got === `https://lettore.casa/${PAGE}`, String(got));
}

// 4. Il protocollo mancante si mette, come in ogni altra casella di indirizzo
//    dell'app: nessuno scrive «https://» a mano.
{
  const got = readerAddress("lettore.casa/?u={url}", PAGE);
  check("senza protocollo → https", (got ?? "").startsWith("https://lettore.casa/"), String(got));
}

// 5. Il segnaposto ripetuto vale ogni volta: alcuni lettori vogliono
//    l'indirizzo sia nel percorso sia in un parametro di firma.
{
  const got = readerAddress("https://lettore.dev/{url}?ref={url}", "https://a.tld/b");
  const times = (got ?? "").split(encodeURIComponent("https://a.tld/b")).length - 1;
  check("segnaposto ripetuto → sostituito ovunque", times === 2, `${times} volte`);
}

// 6. Quello che non è un lettore non diventa una richiesta.
{
  check("modello vuoto → niente", readerAddress("", PAGE) === null);
  check("solo spazi → niente", readerAddress("   ", PAGE) === null);
  check("indirizzo da leggere non http → niente", readerAddress("https://lettore.dev/?u={url}", "javascript:alert(1)") === null);
  check("indirizzo da leggere vuoto → niente", readerAddress("https://lettore.dev/?u={url}", "") === null);
  check(
    "modello che non è un indirizzo → niente",
    readerAddress("non un indirizzo", PAGE) === null,
    String(readerAddress("non un indirizzo", PAGE)),
  );
}

// 7. Un lettore che parla solo http resta http: è una scelta di chi lo ospita —
//    tipicamente in casa, dove il certificato non c'è — e non va riscritta.
{
  const got = readerAddress("http://192.168.1.9:8080/", PAGE);
  check("lettore in chiaro → lasciato in chiaro", got === `http://192.168.1.9:8080/${PAGE}`, String(got));
}

// ---------------------------------------------------------------------------
// La pagina letta, preparata per essere mostrata
// ---------------------------------------------------------------------------

// 8. Il `<base>` va dentro `<head>`, subito: senza, ogni immagine e ogni foglio
//    di stile relativo della pagina punterebbe nel vuoto.
{
  const doc = readableDocument("<html><head><title>x</title></head><body><p>ciao</p></body></html>", "https://sito.tld/film/x");
  const baseAt = doc.indexOf('<base href="https://sito.tld/film/x">');
  const titleAt = doc.indexOf("<title>");
  check("base inserito", baseAt > 0, String(baseAt));
  check("base prima del resto della testa", baseAt < titleAt, `${baseAt} < ${titleAt}`);
  check("corpo intatto", doc.includes("<p>ciao</p>"));
}

// 9. Un `<base>` già scritto nella pagina vincerebbe sul nostro: se ne va.
{
  const doc = readableDocument('<head><base href="https://altro.tld/"></head>', "https://sito.tld/");
  check("base della pagina rimosso", !doc.includes("altro.tld"), doc);
  check("base nostro presente", doc.includes('<base href="https://sito.tld/">'));
}

// 10. I clic sui collegamenti sono spenti: dentro la pagina letta porterebbero
//     il riquadro sul sito vero, cioè di nuovo contro il divieto di cornice.
{
  const doc = readableDocument("<html><body><a href='/altro'>vai</a></body></html>", "https://sito.tld/");
  check("collegamenti disattivati", /a,area\{pointer-events:none!important\}/.test(doc), "");
}

// 11. Il viewport si aggiunge solo se manca: quello della pagina, se c'è, sa
//     meglio del nostro come va guardata.
{
  const senza = readableDocument("<head></head>", "https://sito.tld/");
  check("viewport aggiunto quando manca", senza.includes("width=device-width"));
  const con = readableDocument('<head><meta name="viewport" content="width=1024"></head>', "https://sito.tld/");
  check("viewport della pagina rispettato", (con.match(/name="viewport"/g) ?? []).length === 1, con);
}

// 12. Senza `<head>` il documento si prepara lo stesso: il `<base>` deve valere
//     prima di tutto, e il browser sistema l'albero da sé.
{
  const doc = readableDocument("<p>nudo</p>", "https://sito.tld/");
  check("senza head → base in testa", doc.startsWith('<base href="https://sito.tld/">'), doc.slice(0, 40));
}

// 13. Le virgolette nell'indirizzo non escono dall'attributo.
{
  const doc = readableDocument("<head></head>", 'https://sito.tld/?q="><script>alert(1)</script>');
  check("indirizzo con virgolette → attributo chiuso", !doc.includes('"><script>'), doc.slice(0, 120));
  check("virgolette codificate", doc.includes("&quot;"), doc.slice(0, 120));
}

// ---------------------------------------------------------------------------
// Dall'indirizzo del Worker al modello completo
// ---------------------------------------------------------------------------

// 14. Il caso normale: quello che Cloudflare restituisce, nudo.
{
  const t = readerTemplateFor("qualcosa.tuonome.workers.dev", "abc123");
  check(
    "indirizzo nudo → modello completo",
    t === "https://qualcosa.tuonome.workers.dev/?k=abc123&u={url}",
    String(t),
  );
  // E il modello che ne esce deve funzionare davvero: è il vero controllo.
  const finale = readerAddress(t ?? "", "https://sito.tld/x");
  check(
    "il modello costruito è utilizzabile",
    finale === `https://qualcosa.tuonome.workers.dev/?k=abc123&u=${encodeURIComponent("https://sito.tld/x")}`,
    String(finale),
  );
}

// 15. Le sbavature dell'incollare: barra finale, protocollo già scritto, spazi.
{
  check(
    "barra finale tolta",
    readerTemplateFor("https://x.workers.dev/", "k1") === "https://x.workers.dev/?k=k1&u={url}",
  );
  check(
    "spazi attorno tolti",
    readerTemplateFor("  x.workers.dev  ", "k1") === "https://x.workers.dev/?k=k1&u={url}",
  );
  check(
    "un percorso proprio resta",
    readerTemplateFor("https://x.dev/leggi", "k1") === "https://x.dev/leggi/?k=k1&u={url}",
    String(readerTemplateFor("https://x.dev/leggi", "k1")),
  );
}

// 16. Una parola segreta con caratteri da codificare non rompe l'indirizzo.
{
  const t = readerTemplateFor("x.workers.dev", "a b&c=d");
  check("segreto codificato", t === "https://x.workers.dev/?k=a%20b%26c%3Dd&u={url}", String(t));
}

// 17. Quello che non è un indirizzo non diventa un modello.
{
  check("vuoto → niente", readerTemplateFor("", "k") === null);
  check("senza segreto → niente", readerTemplateFor("x.workers.dev", "") === null);
  check("non un indirizzo → niente", readerTemplateFor("non un indirizzo", "k") === null);
}

console.log(failures === 0 ? "\nTutti i controlli passati." : `\n${failures} controlli falliti.`);
process.exit(failures === 0 ? 0 : 1);
