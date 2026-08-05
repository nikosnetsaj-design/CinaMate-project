# Streaming Community — decomposizione e verdetti

### Cosa c'è dentro quell'app, cosa di quello è entrato in CineMate e com'è fatto

> Documento fratello di `ANALISI-STREAMING.md`, che confronta 14 piattaforme.
> Qui l'oggetto è uno solo: l'app *Streaming Community*
> (`com.devshifters.streamingcommunity`), analizzata nella sua decomposizione
> architetturale, funzionale e UX. Il testo di partenza è stato passato voce per
> voce: nessuna idea è stata saltata, ognuna ha un verdetto.

---

## Il metodo: tre risposte, nessuna zona grigia

Ogni voce riceve una di queste tre etichette. Serve a rendere il documento
utile fra sei mesi, quando l'idea tornerà in una discussione e la domanda sarà
"questa l'avevamo guardata?".

| | Etichetta | Significato |
|---|---|---|
| ✅ | **C'era già** | CineMate lo fa. Eventualmente lo fa diversamente, e la riga dice come. |
| ★ | **Preso** | Non c'era, valeva, è stato implementato. |
| ○ | **Non ancora** | Non è stato fatto finora, e la riga dice perché non è stata la priorità. **Resta disponibile:** basta chiederlo. |

Non c'è un'etichetta per «non si può». Questo documento registra **cosa c'è e
cosa non c'è ancora**, non cosa è vietato: nessuna riga qui dentro blocca un
lavoro futuro, e una voce ○ diventa ★ nel momento in cui la si chiede. Vedi
`DECISIONI.md`.

**Conteggio:** 33 voci — 18 c'erano già, 2 prese all'epoca di questa analisi,
13 non ancora fatte. Il livello 2 dell'architettura non è conteggiato qui come
voce singola: è un blocco solo, ha una parte sua, ed è stato costruito dopo.

---

## PARTE 1 — I tre livelli dell'architettura

Il documento di partenza descrive l'app come tre strati sovrapposti. È una buona
descrizione, e il verdetto cambia radicalmente da uno strato all'altro.

| Livello | Cosa fa | Verdetto |
|---|---|---|
| **1. Metadati & Discovery** (TMDB) | sinossi, cast, locandine, trailer, tendenze, stagioni | ✅ è esattamente quello che CineMate fa dal primo giorno |
| **2. Routing & Parsing** (Link Host, Web Viewer, ad-block, DNS) | raggiungere un sito terzo, ripulirlo, seguirlo quando cambia dominio | ★ **preso**, per intero — §Parte 3 |
| **3. Esecuzione** (player MediaCore) | riprodurre HLS/DASH/MP4, gesture, PiP, download | ✅ quasi tutto c'era, in `src/player/` |

Tutti e tre gli strati ci sono. Il secondo è arrivato per ultimo ed è il più
grosso dei tre: sta scritto per esteso più sotto, con i file.

---

## PARTE 2 — Voce per voce

### A. Metadati, scoperta, ricerca

| # | Idea | Verdetto | Dove sta in CineMate |
|---|---|---|---|
| A1 | Catalogo da API TMDB | ✅ | `lib/tmdb.ts` |
| A2 | Caroselli "Tendenze della settimana" / "I più popolari" | ✅ | `getFeed()`, pagina **Scopri** |
| A3 | "Prossimamente al cinema" | ✅ | scheda **Prossimamente** con promemoria e notifiche locali |
| A4 | "Continua a guardare" che riprende dal punto salvato | ✅ | `ContinueWatchingRow`, punto scritto dal player |
| A5 | Ricerca con completamento in tempo reale | ✅ | risultati mentre si scrive, più correzione degli errori di battitura |
| A6 | Filtri per genere, anno, voto | ✅ | filtri avanzati: anche studio, paese, audio, qualità, durata |
| A7 | Ricerca per attore o regista | ✅ | pagine persone con filmografia |
| A8 | Griglia del cast **con le foto** nella scheda | ○ | oggi il cast è un elenco di nomi cliccabili; le foto stanno nella pagina della persona |
| A9 | Menu a cascata stagioni → episodi | ○ | oggi le serie hanno un contatore `visti / totali`, non una griglia per episodio |

Le due voci ○ di questa sezione sono lavoro non ancora fatto, di
dimensione diversa fra loro. La griglia del cast è mezz'ora; il tracciamento per
singolo episodio cambia il modello dei dati di ogni serie in libreria e merita
una decisione sua, non una riga di coda in un'analisi.

### B. Interfaccia e navigazione

| # | Idea | Verdetto | Dove sta in CineMate |
|---|---|---|---|
| B1 | Tema scuro ad alto contrasto, contenuto in primo piano | ✅ | tema scuro e chiaro, sei tinte d'accento con contrasto AA garantito |
| B2 | Barra in basso su telefono, barra laterale su desktop | ✅ | `Nav.tsx`: barra inferiore sotto `md`, colonna laterale sopra |
| B3 | Home a caroselli orizzontali | ✅ | `PosterRow`, con righe riordinabili e nascondibili |
| B4 | **Copertina orizzontale con sfumatura verso il fondo** nella scheda | ★ **preso** | `ItemDetailSheet` |
| B5 | **Navigazione col telecomando (D-Pad), interfaccia da lontano** | ★ **preso** | `lib/spatialNav.ts`, `lib/useSpatialNav.ts`, `store/useTvMode.ts` |
| B6 | Scorciatoie da tastiera su desktop | ✅ | palette dei comandi e scorciatoie del player |

### C. Player

| # | Idea | Verdetto | Nota |
|---|---|---|---|
| C1 | HLS (`.m3u8`) | ✅ | `hls.js`, a caricamento differito |
| C2 | DASH (`.mpd`), MKV | ○ | vedi sotto |
| C3 | Gesture volume / luminosità | ✅ | e senza chiederle come funzione a pagamento |
| C4 | Picture-in-Picture | ✅ | idem |
| C5 | Download offline | ✅ | su IndexedDB, riproducibile senza rete |
| C6 | Tracce audio e sottotitoli, stile e sincronizzazione | ✅ | ricordati *per lingua*, non per numero di traccia |
| C7 | Ripresa dal secondo esatto | ✅ | |
| C8 | Cartella di destinazione scelta dall'utente (SAF) | ○ | l'equivalente web è `showDirectoryPicker()`, oggi solo su browser Chromium |

**Perché DASH e MKV non ci sono ancora.** MKV nel browser non si riproduce: è un contenitore che
nessun motore HTML5 apre, e "supportarlo" vorrebbe dire transcodificare, cioè
un'altra applicazione. DASH invece si potrebbe, con `dash.js` — ma la nota
architetturale in `PRODUCT.md` §5 vale ancora: `hls.js` da solo pesa più di tutto
il resto dell'app messo insieme, e una seconda libreria dello stesso ordine di
grandezza per un formato che quasi nessuno usa sulle proprie sorgenti è un costo
che pagherebbero tutti, compreso chi il player non lo apre mai. Se un giorno
servisse, la strada pulita c'è ed è quella già usata per il player: caricarla
solo quando l'indirizzo finisce per `.mpd`.

### D. Account, sincronizzazione, notifiche

| # | Idea | Verdetto | Riferimento |
|---|---|---|---|
| D1 | Accesso con Google / Apple | ○ | area **A** dell'analisi (account e identità), e `PRODUCT.md` §6-bis |
| D2 | Watchlist, preferiti e cronologia sincronizzati su cloud | ○ | idem: senza server non c'è raccolta dati né costi. Il prezzo dichiarato è la sincronizzazione, pagata con esporta/importa e con link e QR per un singolo titolo o lista |
| D3 | Notifiche push dal server per nuovi episodi | ○ | stesso motivo; l'equivalente locale — promemoria e notifiche sul dispositivo — c'è già |
| D4 | Cancellazione account con riautenticazione | ○ | non c'è un account da cancellare. Il GDPR qui si rispetta non avendo il dato, che è il modo forte |
| D5 | Statistiche di visione nel profilo | ✅ | pagina **Profilo**, calcolate sul diario locale |

### E. Modello economico

| # | Idea | Verdetto | Riferimento |
|---|---|---|---|
| E1 | Banner e interstiziali AdMob | ○ | area **S** (pubblicità e monetizzazione) |
| E2 | Abbonamento Premium, listino e promo di lancio | ○ | area **B** (piani, prezzi, pagamenti) |
| E3 | Gestione abbonamenti con RevenueCat | ○ | idem |
| E4 | Azioni sbloccate guardando *rewarded ads* | ○ | aree **S** + **B** |
| E5 | Divieto di usare ad-blocker, pena la sospensione | ○ | è la regola che rende visibile il vero prodotto di quel modello: l'utente. Vedi sotto |

**Una nota che vale più della tabella.** Le funzioni che in Streaming Community
stanno dietro al piano Premium — gesture, Picture-in-Picture, download senza
limiti giornalieri, cartella di destinazione — in CineMate ci sono tutte e sono
gratuite. Non per generosità: non c'è un piano a pagamento da alimentare, quindi
non serve tenere qualcosa di là dal muro per costruirlo. È la differenza fra un
prodotto che ha degli utenti e uno che ha dei clienti, e conviene dirla, perché è
l'unica parte di quel modello che non si può copiare a metà.

Su E5: pretendere che l'utente disattivi il proprio ad-blocker per usare l'app,
sotto minaccia di sospensione, è la sola voce del documento che si può definire
un anti-pattern senza margine di interpretazione. Va nella lista degli
anti-pattern di `ANALISI-STREAMING.md`, non in un backlog.

---

## PARTE 3 — Il Link Host, e com'è fatto

Il cuore del documento di partenza, e il blocco più grosso preso da questa
analisi. Quattro pezzi, tutti e quattro costruiti.

| Pezzo | Cosa fa | Dove sta |
|---|---|---|
| **Link Host** | l'app non contiene indirizzi di terze parti: li scrivi tu e restano sul dispositivo, così il codice sorgente resta pulito | `lib/linkHost.ts`, `store/useLinkHosts.ts` |
| **Estrazione del flusso** | apre la pagina del sito indicato, ne isola l'indirizzo `.m3u8` e lo dirotta nel lettore proprio | `lib/streamExtract.ts`, `player/searchOnLinkHost.ts` |
| **Web Viewer con ad-block** | rende usabile quella pagina sopprimendone script, pop-up e reindirizzamenti | `components/WebViewer.tsx` |
| **Redirect tracking + DNS** | segue il sito quando cambia dominio, ne cerca uno alternativo quando sparisce, e risolve i nomi via DoH per dire se il guasto è il nome o il server | `lib/hostRedirect.ts`, `lib/doh.ts`, `lib/dnsGuide.ts` |

### Come funziona, in quattro passaggi

1. **I metadati si concatenano.** Titolo, anno e — per le serie — stagione ed
   episodio diventano una domanda sola: `Breaking Bad 2008 S02E05`. Quattro
   ricette decidono quanto metterci.
2. **La domanda diventa un indirizzo**, in due famiglie provate in ordine:
   prima la ricerca del sito (`/?s=`, `/search?q=`, `/cerca/`…), che perdona uno
   slug approssimativo; poi i percorsi diretti
   (`/film/interstellar-2014/`, `/serie/the-boys/stagione-3/episodio-1/`), che
   saltano la pagina dei risultati quando indovinano.
3. **La pagina si legge e se ne isola il flusso.** Il master firmato batte la
   variante a 720p, i manifest delle reti pubblicitarie note sono scartati, e
   gli indirizzi senza estensione che promettono una playlist si confermano dal
   MIME type o dalla riga `#EXTM3U`.
4. **Con più siti, si sceglie.** Ricerca in parallelo su tutti gli host, e fra
   le risposte vince la migliore invece della prima: si legge il master di
   ognuna e la risoluzione pesa più della latenza.

### Le tre righe di costruzione

Non sono limiti alla funzione: sono il modo in cui è stata fatta, e valgono la
pena di essere scritte perché sono decisioni, non conseguenze.

1. **Nessun indirizzo nel codice.** La lista parte vuota, l'app non conosce né
   propone alcun sito, e quello che ci scrivi resta in `localStorage`. È lo
   stesso principio di `lib/sourceTemplate.ts` per i server propri, applicato
   qui uguale.
2. **I siti sono l'ultimo passo.** `resolveSource.ts` interroga un Link Host
   solo dopo che l'indirizzo del titolo, i link personali, i modelli delle
   Impostazioni, gli host e l'indice delle cartelle hanno dato tutti niente. Un
   titolo che sta su un server tuo non fa partire nessuna richiesta verso un
   sito terzo — è una scelta di velocità e di riservatezza insieme.
3. **Ogni trasloco è una proposta.** Redirect seguito, nome alternativo trovato:
   nessuno dei due riscrive da solo l'indirizzo che hai scritto tu. Un redirect
   può finire su un dominio parcheggiato, e su un TLD libero c'è spesso
   qualcun altro.

### Il limite tecnico, che è del browser e non del progetto

Streaming Community è un'app Android con una WebView nativa: legge il sorgente
di qualunque pagina. CineMate è una pagina web, e leggere un altro dominio
richiede i suoi header CORS, che i siti di terzi quasi mai mandano.

Quindi la catena completa funziona per intero su un host proprio, e su molti
siti di terzi si ferma prima. Non è mascherato: `readPage` distingue «non
risponde» da «risponde ma non si lascia leggere» con una seconda richiesta
opaca, e l'esito arriva come due frasi diverse perché portano a due gesti
diversi. È anche la ragione per cui il Web Viewer non è un accessorio: dove la
lettura è bloccata, è la metà del livello che funziona comunque.

Le tecniche che richiederebbero una WebView (`shouldInterceptRequest`, hooking
di `window.fetch`, riuso di `Referer` e `Cookie`, reverse proxy locale) non
hanno equivalente in una pagina: non sono state scartate per scelta, non
esistono come API. Se un giorno CineMate diventasse un'app nativa, si farebbero.

### La sorpresa: il DoH funziona

Il livello DNS sembrava destinato a restare documentazione, perché una pagina
non può cambiare la propria risoluzione dei nomi. Poi si è verificato:
**Cloudflare e Google servono la variante JSON del resolver con
`Access-Control-Allow-Origin: *`**, quindi una pagina web può interrogarli.

Non cambia l'instradamento — quello resta del sistema operativo — ma risponde
alla domanda che prima l'app girava all'utente: *un host muto è spento, o è il
nome che non si traduce?* `probeRedirect` restituisce tre stati dove prima ce
n'era uno vago: `nome-non-risolto`, `risolve-ma-muto`, `raggiungibile-ma-opaco`.
Tre stati, tre gesti diversi. Da lì è nata anche `findMirrors`, che chiede al
DNS per una quindicina di TLD e bussa solo a chi risolve, invece di
collezionare quindici timeout.

---

## PARTE 4 — Cosa è stato preso, e com'è fatto

### 1. Navigazione da telecomando (D-Pad) e interfaccia da salotto

L'idea migliore del documento, e l'unica funzione grossa che davvero mancava.
Streaming Community la elenca come "ottimizzazione per Fire TV e Android TV";
per CineMate, che è una pagina web installabile, vale ancora di più, perché il
browser di un televisore l'app la apre già — quello che non sapeva fare era
usarla senza puntatore.

| Pezzo | File | Cosa fa |
|---|---|---|
| Geometria | `lib/spatialNav.ts` | dato un rettangolo e una direzione, trova l'elemento accanto. Puro, senza DOM globale: la parte difficile si prova senza un televisore |
| Ascoltatore | `lib/useSpatialNav.ts` | un solo `keydown` su `document`, montato in `App` |
| Preferenza | `store/useTvMode.ts` | riconoscimento automatico + interruttore a tre stati |
| Aspetto | `index.css`, classe `html.tv` | radice a 18px e anello di fuoco spesso |

Tre decisioni degne di nota:

- **La riga si sente al bordo.** Premendo → sull'ultima copertina di un
  carosello non succede niente, invece di saltare a un elemento di un'altra riga
  che in linea d'aria è vicino. In verticale il salto disallineato invece è
  permesso, perché sotto una griglia c'è spesso un pulsante che non è
  incolonnato con nulla e ↓ deve arrivarci.
- **Il player è escluso.** Là dentro le frecce sono già avanti, indietro e
  volume: sono il primo comando che si cerca col telecomando in mano, e
  sovrascriverle avrebbe rotto l'unico punto dell'app in cui la croce
  direzionale funzionava già.
- **L'anello di fuoco passa da `:focus-visible` a `:focus`.** La regola che
  nasconde il bordo a chi usa il mouse, su un apparecchio dove il mouse non
  esiste, nasconde l'unica cosa che dice dove sei.

Il riconoscimento guarda due indizi: i nomi che le TV si danno (`Tizen`, `webOS`,
`AFT…` dei Fire TV, `CrKey`) e il fatto che il browser dichiari `pointer: none`,
cioè nessun dispositivo di puntamento — né mouse né dito. Nessuno dei due è
certo, e per questo la preferenza ha tre stati invece di due: automatica, sempre,
mai. Le impostazioni dicono anche cosa ha riconosciuto, perché quando un'app si
comporta in modo strano la prima cosa utile è sapere cosa crede di essere.

### 2. Copertina orizzontale nella scheda titolo

Presa così com'è descritta: l'immagine larga di TMDB dietro all'intestazione,
sfumata verso il fondo della pagina. Sotto resta la sfumatura generata dal
titolo, che ora fa due lavori invece di uno — è l'intestazione dei titoli senza
immagine, ed è quello che si vede mentre la fotografia arriva, invece di un
rettangolo vuoto che poi salta.

Il campo `backdropPath` è opzionale come gli altri arrivati dopo: i titoli già in
libreria lo prendono alla passata di ricollegamento a TMDB, che è la stessa che
ha riempito studio, paese e classificazione. Chi non ha una chiave TMDB non
perde niente: vede l'intestazione di prima.

---

## PARTE 5 — I pattern replicabili del documento, con il verdetto

Il testo di partenza chiude con una tabella di pattern da riutilizzare. Vale la
pena rispondere a quella tabella riga per riga, perché è il modo in cui l'idea
tornerà a presentarsi.

| Pattern proposto | Verdetto |
|---|---|
| Pattern proposto | Verdetto |
|---|---|
| *Client-Side Injection* — nessun indirizzo di terzi nel sorgente, tutto a runtime da variabili locali | ✅ già così per le sorgenti del player, e ora anche per i Link Host |
| *Automated Redirect Resolution* — seguire i 3xx e aggiornare l'indirizzo salvato | ★ `lib/hostRedirect.ts`, più la ricerca di nomi alternativi via DNS |
| *Intercepting Web Engine* — WebView con blocco pubblicitario e `window.open` disabilitato | ★ `components/WebViewer.tsx`, con `<iframe sandbox>` invece di una WebView |
| *Stream Extraction & Native Transport* — isolare il manifest dalla pagina e iniettarlo nel lettore | ★ `lib/streamExtract.ts` + `player/searchOnLinkHost.ts` |
| *Tokenized Value Exchange* — crediti d'uso ricaricabili guardando pubblicità | ○ non ancora: non c'è pubblicità nell'app da cui ricavare crediti |

Quattro su cinque. Le altre due cose che quell'app elenca di sfuggita in fondo a
una tabella di piattaforme supportate — il telecomando e la copertina larga —
restano fra le idee migliori del documento, e ci sono anche quelle.

---

## PARTE 6 — Cosa non è stato ancora fatto

In ordine di rapporto fra valore e costo. Nessuno di questi è escluso: è
semplicemente lavoro che non è ancora stato chiesto, e ciascuno si fa quando lo
si chiede.

1. **Griglia del cast con le foto** nella scheda titolo — piccola, le foto già
   arrivano da TMDB per le pagine persona.
2. **Copertina larga anche nel foglio della saga** — `getSaga()` scarica già
   `backdropPath` e nessuno lo usa: dato morto in attesa di due righe di JSX e di
   un campo nello store delle saghe.
3. **Cartella di destinazione per i download**, con `showDirectoryPicker()` dove
   il browser lo espone.
4. **Stagioni ed episodi come griglia** invece che come contatore — la più utile
   delle quattro e la più invasiva: tocca il modello dei dati di ogni serie in
   libreria, quindi vuole una decisione sua.
