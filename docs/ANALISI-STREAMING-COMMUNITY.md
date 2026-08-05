# Streaming Community — decomposizione e verdetti

### Cosa c'è dentro quell'app, cosa di quello vale per CineMate, cosa no e perché

> Documento fratello di `ANALISI-STREAMING.md`, che confronta 14 piattaforme.
> Qui l'oggetto è uno solo: l'app *Streaming Community*
> (`com.devshifters.streamingcommunity`), analizzata nella sua decomposizione
> architetturale, funzionale e UX. Il testo di partenza è stato passato voce per
> voce: nessuna idea è stata saltata, ognuna ha un verdetto.

---

## Il metodo: quattro risposte, nessuna zona grigia

Ogni voce riceve una di queste quattro etichette. Serve a rendere il documento
utile fra sei mesi, quando l'idea tornerà in una discussione e la domanda sarà
"questa l'avevamo guardata?".

| | Etichetta | Significato |
|---|---|---|
| ✅ | **C'era già** | CineMate lo fa. Eventualmente lo fa diversamente, e la riga dice come. |
| ★ | **Preso** | Non c'era, valeva, è stato implementato adesso. |
| ⛔️ | **Fuori ambito** | Escluso da una decisione di prodotto **già presa e scritta**, con il riferimento. Non si ridiscute qui. |
| ✂️ | **Non preso** | Nessuna decisione precedente lo copriva, quindi si decide qui: o è un no motivato, o è un candidato aperto che finisce in Parte 6. La riga dice quale dei due. |

**Conteggio finale:** 33 voci — 18 c'erano già, **6 prese**, 8 fuori ambito, 1
non presa (MKV, che il browser non sa aprire). L'unica riga bocciata per merito e
non per impossibilità è E5, il divieto di usare un ad-blocker. Il livello 2 dell'architettura
non è conteggiato qui come voce singola: è un blocco solo e ha una parte sua.

---

## PARTE 1 — I tre livelli dell'architettura

Il documento di partenza descrive l'app come tre strati sovrapposti. È una buona
descrizione, e il verdetto cambia radicalmente da uno strato all'altro.

| Livello | Cosa fa | Verdetto |
|---|---|---|
| **1. Metadati & Discovery** (TMDB) | sinossi, cast, locandine, trailer, tendenze, stagioni | ✅ è esattamente quello che CineMate fa dal primo giorno |
| **2. Routing & Parsing** (Link Host, Web Viewer, ad-block, DNS) | raggiungere un sito terzo, ripulirlo, seguirlo quando cambia dominio | ✂️ **non si fa**, per intero — §Parte 3 |
| **3. Esecuzione** (player MediaCore) | riprodurre HLS/DASH/MP4, gesture, PiP, download | ✅ quasi tutto c'era, in `src/player/` |

Il primo e il terzo strato sono un'app di intrattenimento fatta bene. Il secondo
è un'altra cosa, e va guardato per quello che è invece che per come è
presentato: sta scritto per esteso più sotto.

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
| A8 | Griglia del cast **con le foto** nella scheda | ★ **preso** | `CastGrid.tsx`, con i nomi come ripiego senza chiave TMDB |
| A9 | Menu a cascata stagioni → episodi | ★ **preso** | `SeasonEpisodes.tsx` + `watchedEpisodes` sul titolo |

**Il costo vero di A9.** La griglia del cast era mezz'ora; il tracciamento per
singolo episodio tocca il modello dei dati di ogni serie in libreria, ed è il
motivo per cui vale la pena dire come è stato risolto invece di dichiararlo
fatto: `seen` — il numero che leggono statistiche, diario, percentuali e
"continua a guardare" — **resta la fonte**, e la nuova lista `watchedEpisodes` è
ciò che gli dà un dettaglio. Si toccano in un punto solo, `setWatchedEpisodes`,
che ricalcola il contatore dalla lista invece di tenerne aggiornati due. Chi
arriva dal vecchio contatore trova le spunte dedotte dai suoi episodi visti,
contati di seguito dal primo — l'unica lettura sensata di "ne ho visti cinque" —
e l'interfaccia lo dichiara, così chi li aveva visti in disordine sa di dover
correggere invece di scoprirlo dopo.

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
| C2 | DASH (`.mpd`) | ★ **preso** | `dash.js` caricato solo per i `.mpd`. MKV resta impossibile: vedi sotto |
| C3 | Gesture volume / luminosità | ✅ | e senza chiederle come funzione a pagamento |
| C4 | Picture-in-Picture | ✅ | idem |
| C5 | Download offline | ✅ | su IndexedDB, riproducibile senza rete |
| C6 | Tracce audio e sottotitoli, stile e sincronizzazione | ✅ | ricordati *per lingua*, non per numero di traccia |
| C7 | Ripresa dal secondo esatto | ✅ | |
| C8 | Cartella di destinazione scelta dall'utente (SAF) | ★ **preso** | `exportDownloadToDirectory()`: scrive segmenti + playlist dove dici tu, dove il browser lo permette |

**DASH sì, MKV no.** MKV nel browser non si riproduce: è un contenitore che
nessun motore HTML5 apre, e "supportarlo" vorrebbe dire transcodificare, cioè
scrivere un'altra applicazione. DASH invece è stato aggiunto, con la strada che
il costo la rendeva obbligatoria: `dash.js` pesa 819 KB, quanto `hls.js`, quindi
si carica **solo** quando l'indirizzo finisce per `.mpd`. Chi riproduce HLS —
quasi tutti — non lo scarica mai, ed è lo stesso ragionamento per cui il player
intero è una rotta a caricamento differito (`PRODUCT.md` §5).

### D. Account, sincronizzazione, notifiche

| # | Idea | Verdetto | Riferimento |
|---|---|---|---|
| D1 | Accesso con Google / Apple | ⛔️ | area **A** dell'analisi (account e identità), e `PRODUCT.md` §6-bis |
| D2 | Watchlist, preferiti e cronologia sincronizzati su cloud | ⛔️ | idem: senza server non c'è raccolta dati né costi. Il prezzo dichiarato è la sincronizzazione, pagata con esporta/importa e con link e QR per un singolo titolo o lista |
| D3 | Notifiche push dal server per nuovi episodi | ⛔️ | stesso motivo; l'equivalente locale — promemoria e notifiche sul dispositivo — c'è già |
| D4 | Cancellazione account con riautenticazione | ⛔️ | non c'è un account da cancellare. Il GDPR qui si rispetta non avendo il dato, che è il modo forte |
| D5 | Statistiche di visione nel profilo | ✅ | pagina **Profilo**, calcolate sul diario locale |

### E. Modello economico

| # | Idea | Verdetto | Riferimento |
|---|---|---|---|
| E1 | Banner e interstiziali AdMob | ⛔️ | area **S** (pubblicità e monetizzazione) |
| E2 | Abbonamento Premium, listino e promo di lancio | ⛔️ | area **B** (piani, prezzi, pagamenti) |
| E3 | Gestione abbonamenti con RevenueCat | ⛔️ | idem |
| E4 | Azioni sbloccate guardando *rewarded ads* | ⛔️ | aree **S** + **B** |
| E5 | Divieto di usare ad-blocker, pena la sospensione | ✂️ **no** | è la regola che rende visibile il vero prodotto di quel modello: l'utente. Vedi sotto |

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

## PARTE 3 — Il Link Host, e perché tutto quel livello resta fuori

Questo è il cuore del documento di partenza, ed è la parte che non viene presa.
Non per una regola generica: per quello che i quattro pezzi fanno, messi insieme.

| Pezzo | Cosa fa davvero |
|---|---|
| **Link Host** | l'app non contiene indirizzi di terze parti: li scrive l'utente e restano sul dispositivo, così il codice sorgente resta pulito |
| **Estrazione del flusso** | apre la pagina del sito indicato, ne isola l'indirizzo `.m3u8` e lo dirotta in un lettore proprio |
| **Web Viewer con ad-block** | rende usabile quella pagina sopprimendone script, pop-up e reindirizzamenti |
| **Redirect tracking + guide DNS** | segue il sito quando cambia dominio e insegna a cambiare DNS quando l'operatore non lo risolve più |

Presi singolarmente sembrano quattro problemi di ingegneria, e uno per uno lo
sono. Messi in fila sono una cosa sola, e il documento di partenza la descrive
con precisione quando chiama il primo pezzo *"isolamento legale"*: un sito che
cambia dominio perché viene bloccato, che va raggiunto scavalcando la
risoluzione dei nomi dell'operatore, e da cui va estratto un flusso video
saltando la pagina che lo circonda, è un sito che distribuisce roba che non ha i
diritti di distribuire. La struttura a strati non cambia cosa fa il software:
sposta soltanto su chi lo usa la responsabilità di quello che il software è
costruito per rendere facile.

Quindi no, per due ragioni:

1. **Il posto è già occupato.** Il titolo di `PRODUCT.md` §3.3 è, alla lettera,
   *"Dove guardarlo — Essenziale (sostituisce il Link Host)"*: in CineMate quel
   ruolo lo fanno i provider legali, il collegamento a JustWatch e — da oggi — il
   "apri sul servizio".
2. **Non lo scrivo io.** Un estrattore di flussi da siti terzi, un blocco
   pubblicitario pensato per rendere navigabili quei siti e una guida a cambiare
   DNS per raggiungerli quando l'operatore li blocca sono, nell'insieme, gli
   attrezzi di quel mestiere. Questa seconda ragione è la mia, non del documento:
   resta valida anche se le regole di prodotto cambiano, perché non discende da
   loro. Vale la pena dirla per esteso una volta invece di lasciarla implicita in
   un "fuori ambito".

**Cosa si salva di quel livello.** Una cosa, e c'era già: il principio per cui
gli indirizzi delle sorgenti non stanno nel codice ma li scrive l'utente e
restano sul suo dispositivo. In CineMate è `usePlayerPrefs` con i modelli di
`lib/sourceTemplate.ts`, ed è la stessa idea applicata a un caso in cui è
semplicemente giusta: il tuo server, il tuo file, il tuo indirizzo.

Il *redirect tracking* meriterebbe una riga a parte, perché su un proprio host
sarebbe innocuo. Resta fuori lo stesso: in quel documento non esiste per
seguire un server che ha traslocato, esiste per seguire un dominio che è stato
oscurato, e la funzione senza quel motivo non ha un problema da risolvere — un
host proprio che cambia indirizzo si aggiorna nelle impostazioni, dove peraltro
ce ne stanno tre proprio per fare da riserva l'uno all'altro.

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

### 2bis. Le altre quattro, in breve

- **Cast con i volti** (`CastGrid.tsx`): i crediti arrivano da una chiamata a
  parte fatta a foglio aperto e tenuta in cache, invece che dai dati salvati del
  titolo. In libreria il cast sono cinque stringhe: trasformarlo in oggetti
  avrebbe voluto dire migrare ogni scheda mai scritta per una cosa che si vede
  solo qui. Senza chiave, offline o mentre la richiesta è in volo restano i nomi.
- **Episodi uno per uno** (`SeasonEpisodes.tsx`): una stagione per volta, non
  tutte insieme — su una serie lunga sarebbero venti richieste, e chi apre la
  scheda guarda quasi sempre la stagione a cui è arrivato.
- **DASH** (`useVideoPlayer.ts`): il riconoscimento del formato è passato in
  `services/manifestKind.ts`, letto sia dal motore sia dai pannelli che validano
  quello che scrivi. Sta lì e non in `fromLibrary.ts` perché quel file conosce
  gli store di CineMate e gli hook del player non devono conoscerli.
- **Cartella per i download** (`exportDownloadToDirectory`): scrive una cartella
  con i segmenti e una `playlist.m3u8` che li elenca, invece di un unico file.
  Concatenare segmenti dà un file valido solo per certi formati; una playlist
  accanto ai suoi pezzi la apre qualunque lettore. La copia in IndexedDB resta:
  è quella che rende il download riproducibile dentro l'app.

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
| *Client-Side Injection* — nessun indirizzo di terzi nel sorgente, tutto a runtime da variabili locali | ✅ già così per le sorgenti del player. È il pezzo sano di quel livello |
| *Automated Redirect Resolution* — seguire i 3xx e aggiornare l'indirizzo salvato | ✂️ no: risolve un problema che qui non esiste (Parte 3) |
| *Intercepting Web Engine* — WebView con blocco pubblicitario e `window.open` disabilitato | ✂️ no (Parte 3) |
| *Stream Extraction & Native Transport* — isolare il manifest dalla pagina e iniettarlo nel lettore | ✂️ no (Parte 3) |
| *Tokenized Value Exchange* — crediti d'uso ricaricabili guardando pubblicità | ⛔️ aree **S** + **B** |

Uno su cinque. Vale la pena dirlo chiaramente: la parte davvero riutilizzabile di
quell'app non sta nei pattern che il documento mette in evidenza, sta nelle due
cose che elenca di sfuggita in fondo a una tabella di piattaforme supportate —
il telecomando e la copertina larga.

---

## PARTE 6 — Cosa resta

Delle quattro voci che questa parte elencava come candidate, tre sono state
fatte (cast con le foto, cartella per i download, griglia degli episodi). Restano
queste, e nessuna è promessa:

1. **Copertina larga anche nel foglio della saga** — `getSaga()` scarica già
   `backdropPath` e nessuno lo usa: dato morto in attesa di due righe di JSX e di
   un campo nello store delle saghe.
2. **Involucro nativo per Fire TV** — la Trusted Web Activity non funziona su
   Fire OS, che non ha Chrome. Servirebbe una WebView scritta apposta: un secondo
   progetto Android da mantenere, non una configurazione. Vedi `PACCHETTI.md`.
3. **MKV**, se un giorno esistesse un modo di aprirlo nel browser che non sia
   transcodificare.
