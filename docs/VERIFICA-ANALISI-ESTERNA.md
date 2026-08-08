# Verifica di un'analisi esterna

Documento ricevuto: *«Analisi Architetturale, Diagnosi di Piattaforma e Roadmap
di Sviluppo UI/UX per CinaMate»*.

Metodo: ogni affermazione è stata verificata contro il codice o contro il sito
pubblicato. Dove c'è un verdetto, sotto c'è il comando che lo produce.

---

## Il verdetto in tre righe

L'analisi descrive un'applicazione che non è questa. La **Fase 1 — l'intera
diagnosi infrastrutturale, da cui tutto il resto dipende — parte da un fatto
falso**: il sito non è irraggiungibile, risponde 200. Delle diciassette
prescrizioni, **una sola** indicava un difetto reale: l'assenza di gestione del
rate limiting su TMDB. Quella è stata corretta (vedi §4).

Due prescrizioni, se applicate alla lettera, sarebbero state **regressioni**.

---

## 1. La premessa: «inaccessibilità totale, HTTP 404»

> «Un'analisi infrastrutturale preliminare […] evidenzia un'inaccessibilità
> totale della risorsa al percorso specificato, la quale restituisce uno stato
> di errore HTTP 404.»

**Falso.** Il sito è online e serve i propri asset.

```
$ curl -o /dev/null -w "%{http_code}" https://nikosnetsaj-design.github.io/CinaMate-project/
200

$ # ogni asset referenziato dalla pagina
/CinaMate-project/assets/index-DJPtUC0Z.js    -> 200
/CinaMate-project/assets/jsx-runtime-*.js     -> 200
/CinaMate-project/assets/index-*.css          -> 200
```

Probabile origine dell'errore: l'URL è **maiuscolo-sensibile**.
`/cinamate-project/` (minuscolo) dà davvero 404, `/CinaMate-project/` no. Chi ha
scritto l'analisi ha quasi certamente provato la prima forma e costruito
duecento righe di diagnosi su quel 404.

Da qui discende che le quattro voci della tabella «Causa Primaria di
Inaccessibilità» diagnosticano un guasto che non c'è.

---

## 2. Le quattro cause infrastrutturali, una per una

| Prescrizione | Stato reale |
|---|---|
| «Dichiarare `base: '/CinaMate-project/'`» | Già configurato — **e l'hardcode proposto è una regressione già subita e già corretta** |
| «Generare un `404.html` identico a `index.html`» | Già fatto, in CI |
| «Aggiungere un `.nojekyll`» | Non applicabile: Jekyll non gira in questa pipeline |
| «Configurare una GitHub Action per il deploy» | Esiste da tempo |

### 2.1 Il base path — la prescrizione è un passo indietro

`vite.config.ts` già risolve il base path, e lo fa **leggendo il nome del
repository a runtime** invece di scriverlo a mano:

```ts
const repo = process.env.GITHUB_REPOSITORY?.split('/')[1]
const base = process.env.GITHUB_PAGES === 'true' && repo ? `/${repo}/` : '/'
```

Il commento sopra quelle righe racconta perché, ed è esattamente la prescrizione
dell'analisi:

> «hardcoding it meant that renaming the repository left every asset pointing at
> the old path, and the published site answered 200 with a blank page because
> the bundle 404'd.»

Scrivere `base: '/CinaMate-project/'` significherebbe **reintrodurre un bug già
pagato una volta**, e per giunta con la grafia sbagliata del nome del prodotto.

### 2.2 Il fallback SPA — già in CI

`.github/workflows/deploy.yml`:

```yaml
# Pages has no server-side routing, so every unknown path must fall back
# to the app shell or a refresh on /libreria would 404.
- run: cp dist/index.html dist/404.html
```

Verificato sul sito vivo: `/CinaMate-project/libreria` restituisce il guscio
dell'app, bundle incluso. Lo stato HTTP resta 404 — è il modo in cui GitHub
Pages serve il fallback, non un difetto: il browser esegue comunque l'app e il
router legge il percorso.

### 2.3 `.nojekyll` — la diagnosi giusta per la pipeline sbagliata

Il ragionamento («Jekyll ignora le cartelle con prefisso `_`») è corretto per un
deploy dal branch `gh-pages`. Questa pipeline usa
`actions/upload-pages-artifact` + `actions/deploy-pages`, che **pubblicano
l'artefatto direttamente, senza passare da Jekyll**. In più Vite emette
`assets/`, che non ha alcun trattino basso. Il file sarebbe inerte.

---

## 3. Le prescrizioni UI/UX già in vigore

| Prescrizione dell'analisi | Dove è già implementata |
|---|---|
| «L'intera superficie della scheda dev'essere cliccabile» (Legge di Fitts) | `PosterCard.tsx` — il `motion.div` ha `role="button"`, `tabIndex`, `aria-label` e `onKeyDown` |
| «Locandina in rapporto 2:3, bordi arrotondati» | `PosterArt.tsx` / `aspect-[2/3]` |
| «Metadati minimi: titolo, anno, punteggio» | `PosterCard.tsx` — titolo, `StatusChip`, `VoteBadge`, e nient'altro |
| «Azioni secondarie solo in hover / menu contestuale» | Già così: doppio tocco per il preferito, scheda per il resto |
| «Attributo `srcset` per non scaricare immagini inutilmente grandi» | `PosterArt`, `Billboard`, `ItemDetailSheet`, `CatalogSheet` |
| «Architettura REST integrata su TMDb API» | `src/lib/tmdb.ts`, 1507 righe, già in produzione |
| «Tracciamento unificato di film e serie TV» | Già il cuore del prodotto: stagioni, episodi, ripresa al secondo |
| «Eliminare il vincolo di lunghezza minima delle recensioni» | Non esiste alcun vincolo del genere da eliminare |

### 3.1 La griglia a 12 colonne — i numeri non tornano

L'analisi prescrive, per il desktop, «5 o 6 colonne di schede» dentro «un limite
massimo di larghezza per il contenitore primario pari a **840dp**».

Sei locandine in 840dp fanno **140dp l'una**, gutter esclusi: una locandina 2:3
alta 210dp, cioè più piccola di quella che l'analisi chiama «immagine di
copertina ad alta risoluzione». Nello stesso paragrafo si dice che oltre quella
soglia «i margini si espandono fino a 200dp» — margini più larghi del terzo del
contenuto. 840dp in Material è una **soglia di breakpoint**, non un tetto di
contenuto: la prescrizione confonde le due cose.

### 3.2 «48dp per WCAG 2.2 AA» — il riferimento normativo è sbagliato

L'analisi ripete, in tre punti, che WCAG 2.2 AA imponga bersagli da 48×48dp.
Non è così:

- **WCAG 2.2, SC 2.5.8 *Target Size (Minimum)*, livello AA → 24×24 px CSS.**
- **WCAG 2.2, SC 2.5.5 *Target Size (Enhanced)*, livello AAA → 44×44 px CSS.**
- 48dp è la raccomandazione di **Material Design**, non un requisito WCAG.

Il progetto usa già `.tap-target` con `max(100%, 44px)` (`index.css:401`):
**supera il requisito AA di quasi il doppio e centra il livello AAA.**

### 3.3 Il contrasto — già verificato da una macchina

L'analisi lo elenca come intervento di Fase 3. È verificato a ogni giro da
`scripts/contrast.mjs`, che compone le trasparenze sul fondo reale:

```
$ npm run contrast
Tema scuro  — 68 coppie, 0 sotto soglia
Tema chiaro — 68 coppie, 0 sotto soglia
136 coppie verificate, 0 sotto soglia.
```

---

## 4. L'unica diagnosi corretta: il rate limiting — **corretta in questo commit**

> «Il livello di servizio JavaScript deve integrare […] Exponential Backoff con
> Jitter […] in presenza di un errore di saturazione della banda (status 429).»

**Vera, e il difetto era reale.** `tmdbGet` è il collo di bottiglia unico di ogni
chiamata a TMDB, e un 429 finiva nel ramo generico:

```ts
throw new TmdbApiError(`Richiesta TMDB rifiutata (HTTP ${response.status}).`)
```

Nessun ritentativo, nessuna attesa. E siccome **ogni chiamante ingoia l'errore di
proposito** per non fermare la propria passata, il limite non si vedeva come
errore: si vedeva come **dato mancante**.

Tre punti dove il danno era silenzioso:

| Punto | Cosa perdeva l'utente |
|---|---|
| `useAutoLinkTmdb.ts` | Il titolo veniva segnato come «già tentato» *prima* della chiamata: un 429 passeggero gli costava la copertina **fino al ricaricamento della pagina** |
| `upcoming.ts:86` | Una `Promise.all` che manda una richiesta per titolo seguito — la raffica che *causa* il 429 — e scarta i falliti: la riga «In arrivo» usciva più corta del vero, senza dirlo |
| `EpisodeList.tsx:173` | Le stagioni precedenti caricate in parallelo: un 429 sballava il conteggio degli episodi visti |

### Cosa è cambiato

**`src/lib/tmdb.ts`** — ritentativi dentro `tmdbGet`, quindi validi per tutte e
trenta le funzioni esportate:

- ritenta **429 e 5xx**; non ritenta 401 (chiave sbagliata) né 404 (risposta
  ordinaria: «questo titolo non è su TMDB»);
- attesa crescente **500 → 1000 → 2000 ms**, con **jitter** — necessario proprio
  perché le richieste fermate insieme sono quelle partite insieme, e senza
  componente casuale ripartirebbero in raffica identica;
- **rispetta `Retry-After`** quando TMDB lo manda: è l'unico che conosce il
  proprio contatore. Con un tetto di 8 s, perché obbedire a un `Retry-After: 60`
  significherebbe lasciare una schermata a girare per un minuto;
- l'attesa è **annullabile**: una ricerca abbandonata a metà backoff non resta
  appesa;
- un errore di rete **non** si ritenta — quasi sempre è «sei offline», e tre
  tentativi silenziosi ritarderebbero una notizia già certa.

**`src/lib/useAutoLinkTmdb.ts`** — distingue «TMDB non conosce questo titolo»
(definitivo, resta segnato) da «ora non si può chiedere» (rinvio: il titolo
**torna in coda** e la passata si ferma, riprovando dopo un minuto, invece di
bruciare l'intera libreria contro un muro).

### Verifica

Banco di prova con `fetch` stubbato, 14 controlli, tutti passati:

```
PASS  429 poi 200 → risolve, 2 chiamate, ha atteso (429ms)
PASS  Retry-After: 1 → attende ~1s (1002ms)
PASS  429 permanente → si arrende dopo 4 tentativi, status 429, messaggio dedicato
PASS  500 poi 200 → risolve in 2 chiamate
PASS  401 → nessun ritentativo
PASS  abort durante il backoff → TmdbAbortError in 51ms, non aspetta il backoff
```

Il **Token Bucket** proposto dall'analisi non è stato implementato: le raffiche
qui sono piccole e limitate (`MAX_LOOKUPS`, due pagine), e TMDB non pubblica più
il limite fisso 40/10s su cui quella scelta avrebbe senso. Limitare
preventivamente rallenterebbe il caso normale per proteggere da un caso raro che
il backoff già copre. Se i log (`errorLog`, scope `tmdb`) dovessero mostrare 429
ricorrenti, è il momento di rimetterlo in discussione.

---

## 5. Le proposte di prodotto: cosa resta in piedi

Le funzionalità nuove non sono verificabili contro il codice — non sono difetti,
sono idee. Vanno pesate contro `docs/PRODUCT.md`, che descrive un **compagno di
visione personale**, non un concorrente di IMDb. Alcune sono già lì:

- **«Ricerca per stato d'animo»** — l'unica proposta davvero assente e davvero
  interessante. Va però riletta per *questa* app: qui la ricerca lavora sulla
  **libreria personale**, dove «Rilassante» può nascere dai dati che il prodotto
  già possiede (genere, durata, voto, ora del giorno) invece che da un
  vocabolario emotivo importato. Merita una voce in `PRODUCT.md`, non un
  commit al buio.
- **«Feed di attività fidata»** — presuppone account, amici e un server.
  Contraddice frontalmente la premessa del prodotto («resta tua e non ti vende
  niente», nessuna telemetria). Non è un miglioramento: è un altro prodotto.
- **«Notifiche di disponibilità streaming»** — già previsto e in parte presente:
  `getWatchProviders` e `useReleaseAlerts` esistono.
- **«Ricerca globale predittiva»** — esiste: `SearchBar`, `CommandPalette`,
  `tmdbSearch`, con annullamento a ogni battuta.

Sui numeri citati («82.4% sceglie in base all'umore», «80% preferisce fonti
fidate», «abbandono +5.8% per secondo», «API IMDb oltre $150.000») l'analisi non
porta fonti. Non li ho usati come base di alcuna decisione.

---

## In una riga

Un'analisi che diagnostica un guasto inesistente, prescrive due regressioni e
sbaglia il riferimento normativo su cui fonda la Fase 3 — ma che in mezzo aveva
ragione su una cosa vera e non banale, il 429. Quella è stata presa e sistemata.
