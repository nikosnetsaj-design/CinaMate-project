# CineMate

### ▶ [Apri CineMate](https://nikosnetsaj-design.github.io/CinaMate-project/)

L'indirizzo per esteso è `https://nikosnetsaj-design.github.io/CinaMate-project/`,
ma conviene toccare il link qui sopra invece di scriverlo: basta una lettera
sbagliata nella parte prima del punto e il browser risponde "non trova il
server". Una volta aperto, sul telefono aggiungilo alla schermata Home
(Condividi → Aggiungi a Home) e non serve più cercarlo.

---

La tua libreria personale di film, serie TV, anime e documentari. Traccia stato,
voto (su 10), episodi visti e note; raggruppa automaticamente i film in saghe e
universi con l'ordine giusto in cui guardarli; scopri e aggiungi nuovi titoli con
l'aiuto di Claude; chiedi consigli su misura al critico IA. Solo per te, solo sul
tuo dispositivo.

Ti dice cosa guardare, in che ordine e dove trovarlo. C'è anche un player
(pagina **Player**), che riproduce le sorgenti che indichi tu: l'indirizzo del
tuo server, scritto una volta sola nelle Impostazioni.

## Stack

- **Vite + React 18 + TypeScript**
- **Tailwind CSS v4** — design tokens "Sala buia" custom in `src/index.css`:
  nero neutro, grigi neutri, accento verde
- **Zustand** per lo stato (libreria, tema, obiettivi, layout della Home,
  controllo genitori, impostazioni, sheet), persistito su `localStorage`
- **React Router** per la navigazione
- **Framer Motion** per le micro-interazioni
- **hls.js** per il player (streaming adattivo), caricato solo quando apri la
  pagina Player e non all'avvio dell'app — e precaricato appena il puntatore
  arriva sul link, così di solito è già lì quando premi
- **qrcode-generator** per i codici QR, anch'esso caricato solo con il foglio
  che lo usa
- **API Anthropic (Claude)** chiamata direttamente dal browser con la tua chiave
  personale, per la ricerca assistita dei titoli e il critico IA

Nessun backend: l'app è local-first, i dati restano sul dispositivo. La chiave
API Anthropic (se la aggiungi nelle Impostazioni) resta anch'essa solo nel
`localStorage` del tuo browser.

## Sviluppo

```bash
npm install
npm run dev      # ambiente di sviluppo
npm run build    # build di produzione (tsc + vite build)
npm run lint      # oxlint
npm run contrast  # WCAG AA su ogni coppia testo/sfondo dei due temi
```

`npm run contrast` legge i colori veri da `src/index.css`, compone le
trasparenze sul fondo su cui finiscono e calcola il rapporto secondo WCAG 2.1.
Esce con codice 1 se una coppia scende sotto soglia (4.5:1 il testo, 3:1 il
testo grande e i bordi dei controlli), così la promessa di leggibilità è
verificata da una macchina invece che a occhio.

## Struttura

```
src/
  components/   componenti UI (poster, sheet, saghe, maratona, timeline, nav…)
  pages/        Home («Stasera»), Libreria, Cerca, Tu — le quattro della barra —
                più Saghe, Scopri, Critico, Player, Diagnostica, raggiunte da
                dentro invece che da una voce fissa.
                  Tu.tsx      fonde le vecchie pagine Dati e Profilo: erano due
                              destinazioni per la stessa domanda, e si vedeva
                              dai loro due stati vuoti diversi
                  Profile.tsx / Stats.tsx  non sono più rotte: esportano i
                              pezzi che Tu monta come schede
  store/        stato Zustand (libreria, saghe, maratona, promemoria,
                obiettivi, layout della Home, punto di ripresa, controllo
                genitori, tema, primo avvio, UI)
  lib/          dominio e utility (tmdb, sagas, universes, upcoming, stats,
                activity, continueWatching, achievements, search, filters,
                recommend, goals, parental, accents, share, deepLinks,
                spatialNav, anthropic, backup, errorLog, selfTest)
                  useTitleExtras.ts il resto della scheda in una richiesta sola:
                                    troupe, budget, studi, video, immagini,
                                    correlati — fuori dal record della libreria
                  useAddFromCatalog.ts  da una locandina del catalogo al foglio
                                    di aggiunta già compilato, uguale ovunque
                                    (lo usa il pulsante dentro la scheda del
                                    catalogo, non il tocco sulla locandina)
                  featured.ts       chi finisce in vetrina, e la riga che dice
                                    perché: una gerarchia dichiarata, non un
                                    sorteggio
                  homeBadges.ts     la pastiglia sulla copertina, al massimo una
                                    e solo con un fatto dietro
                  reactions.ts      i tre pollici del player ↔ il voto da 1 a 10
                  useUpcoming.ts    le uscite in arrivo, condivise fra vetrina,
                                    riga «In arrivo» e pastiglie
                  linkHost.ts       i siti su cui cercare: concatenazione dei
                                    metadati e costruzione della ricerca
                  streamExtract.ts  lettura di una pagina, isolamento dell'.m3u8
                                    e scelta del risultato che è il titolo
                  pageReader.ts     il lettore di pagine: l'unica strada per
                                    leggere un sito che non manda CORS, e la
                                    pagina letta preparata per essere mostrata
                                    invece che incorniciata
                  hostRedirect.ts   dove è finito un indirizzo che ha traslocato,
                                    e i nomi alternativi quando è sparito
                  dnsGuide.ts       riferimento DoH/DoT e resolver pubblici
                  doh.ts            risoluzione via DoH dal browser, come
                                    diagnosi: è il nome o è il server?
  player/       il player, autonomo dal resto dell'app:
                  hooks/      motore video (hls.js), gesture, sottotitoli,
                              maratona, download, watch party, cast,
                              host monitor
                  services/   download su IndexedDB, lettura delle playlist HLS,
                              cronologia e statistiche, trasporto realtime,
                              salute, velocità e storico degli host
                  components/ shell del player, barra del titolo con i tre
                              pollici, comandi al centro, colonna della
                              luminosità, riga di azioni, cartello della
                              classificazione, foglio Episodi, Ritaglia,
                              schermata di fine, impostazioni, pannelli
                              download/party/host
                  styles/     player.css — palette propria, tutta sotto .pv-app
                  ── strato di collegamento con CineMate ──
                  fromLibrary.ts        da titolo della libreria a contenuto
                                        riproducibile, nell'ordine della saga
                  recommendFromLibrary.ts  consigli di fine visione dallo scaffale
                  SourcePanel.tsx       configurazione per titolo (stream,
                                        sottotitoli, marker, anteprime)
                  resolveSource.ts      quale indirizzo usare, provandoli in ordine
                  searchOnLinkHost.ts   la ricerca sui siti indicati, ultimo
                                        passo di resolveSource
                  clock.ts              minutaggi mm:ss
```

Il player è un modulo a sé: usa i propri tipi (`src/player/types.ts`) e le
proprie chiavi `localStorage` (prefisso `ppv:`) per cronologia e statistiche
interne. I file dello strato di collegamento sono i soli che conoscono gli store
di CineMate; `player/components/` e `player/hooks/` non ne sanno nulla — l'unica
eccezione è `useFocusTrap`, che è un'utility generica per i modali usata da tutti
i fogli dell'app e che riscrivere qui sarebbe peggio che condividere.

Il lettore di pagine sta invece in `useSettings`, accanto alle chiavi API: non è
una sorgente ma un modo di leggere, e vale per tutta l'app — la ricerca
automatica sui Siti e il Web Viewer passano dalla stessa `readPage`.

Gli store lato CineMate sono `usePlayerSources` (le sorgenti per titolo),
`usePlayerPrefs` (modelli di indirizzo, risparmio dati, relay della Watch Party,
nome nella stanza) e `useLinkHosts` (i siti su cui cercare); i modelli si
compilano in `lib/sourceTemplate.ts`, le ricerche in `lib/linkHost.ts`.
Tutti e tre, più la lista degli host, finiscono nell'**esporta/importa**: sono dati
scritti a mano che nessuno può ricostruire, quindi seguono la stessa regola della
libreria. Le misure del player (posizioni di ripresa, ping storici) restano fuori
perché si rifanno da sole, e i ping di un altro dispositivo descriverebbero una
rete che non è la tua.

## Funzionalità principali

- **Libreria unificata**: ogni titolo ha uno stato (In visione / Visto / Da
  vedere / Abbandonato / In pausa), un voto da 1 a 10, piattaforma, ed
  eventualmente episodi/stagioni per serie e anime.
- **Saghe e collezioni**: i film si raggruppano da soli nella loro saga usando le
  collezioni TMDB. Ogni saga ha copertina, descrizione, elenco numerato dei
  capitoli, stato di visione per capitolo e percentuale di completamento.
- **Ordine di visione**: uscita, cronologico e consigliato. Il primo lo sa TMDB;
  gli altri due li calcola Claude una volta per saga e restano salvati.
- **Universi e timeline**: mondi che attraversano più saghe (MCU, Wizarding
  World, MonsterVerse…), costruiti dalle keyword TMDB e mostrabili come linea
  temporale verticale.
- **Modalità maratona**: metti in coda una saga intera, il progresso resta
  salvato fra sessioni e riavvii, e ogni capitolo completato fa avanzare la coda.
- **Continua la storia**: appena finisci un capitolo, l'app propone il
  successivo della stessa saga.
- **Scheda del titolo**: si apre con la copertina larga e il play al centro,
  la riga dei fatti (anno · classificazione · stagioni · durata · qualità), un
  solo pulsante pieno — **Guarda** — e cinque azioni tonde: Trailer, Preferito,
  Voto, Guardato, Condividi. Sotto, quattro schede: **Episodi**, Dettagli, Saga,
  Simili.
- **Cast con le facce**: foto tonde, nome e personaggio, con «mostra tutti».
  Un attore si ricorda per la faccia e per il ruolo prima che per il nome; senza
  TMDB restano le pastiglie con i nomi, che la libreria ha comunque.
- **Dove guardarlo, diviso per come ci arrivi**: **Streaming** (compreso
  nell'abbonamento), **Gratis**, **Noleggia** e **Acquista** in file separate,
  ognuna con le icone quadrate dei servizi invece dei nomi scritti. Erano un
  elenco unico di pastiglie: appiattite insieme facevano sembrare compreso
  qualcosa che va pagato a parte, e «Disney+» in mezzo ad altre cinque scritte
  si legge, mentre il quadratino col castello si *vede*. Il nome resta
  nell'`alt`, quindi con un lettore di schermo l'elenco è identico a prima.
- **Regia e troupe**: le carte con la faccia di chi l'ha fatto — regia,
  sceneggiatura, musiche, fotografia, produzione — e per le serie chi l'ha
  ideata. Un tocco apre la scheda della persona con la sua filmografia. TMDB
  elenca duecento nomi fino al secondo assistente al catering: qui ci sono i
  sei che uno cerca davvero.
- **Dati finanziari**: budget e incassi a confronto, con la sola cosa che
  interessa leggendoli detta a parole — «ha incassato 2,6× il budget: un
  successo pieno» — invece di lasciare una divisione da fare a mente. Solo per i
  film, perché delle serie TMDB i bilanci non li tiene, e in dollari come li
  pubblica: convertirli al cambio di oggi sarebbe una stima inventata per un
  film del 1994.
- **Studi di produzione**: i marchi, su fondo chiaro. Non è gusto: i loghi di
  TMDB sono inchiostro nero su trasparente, e messi sul fondo scuro
  sparirebbero.
- **Grafica «Sala buia»**: fondo nero, grigi neutri e verde. Prima era velluto
  melanzana con i grigi tinti di lillà: il testo secondario tirava al rosa e su
  quel fondo non si staccava da niente. Adesso i titoli di sezione sono bianchi
  e grandi, le etichette dei gruppi sono verdi, e i voti vanno dal blu al rosso
  invece che dal ciano al magenta — nel Nastro un 6 e un 9 erano la stessa
  striscia rosa. Gli altri cinque accenti restano in Impostazioni → Aspetto.
- **Maggiori informazioni**: il pulsante sotto il cast porta ai dati del film —
  regia, incassi, studi, media — senza risalire alla riga delle schede.
- **Colonna sonora**: un tocco apre la ricerca di Spotify già scritta, col nome
  del compositore quando lo conosciamo — «Dune Hans Zimmer» trova l'album, «Dune
  soundtrack» trova venti raccolte di terzi. Si apre la ricerca e non l'album,
  per la stessa ragione dei servizi di streaming: quell'indirizzo non sta in
  nessun catalogo che l'app possa leggere.
- **Media**: tre schede — **Video**, **Poster**, **Sfondi**. I trailer si aprono
  dentro l'app, in un pannello sopra la scheda (`youtube-nocookie`, quindi
  nessun cookie di profilazione finché non premi play); locandine e sfondi si
  ingrandiscono a tutto schermo. Uscire dal sito per novanta secondi di trailer
  vuol dire perdere il posto in cui eri, e al ritorno l'app riparte da capo.
- **Prequel & Sequel**: la saga come una linea da percorrere — le locandine in
  ordine, l'anno sulla copertina, il numero del capitolo grande dietro, e
  **SEI QUI** sotto quello aperto. La fila si porta da sola sul capitolo
  corrente, perché in una saga da dieci film «sei qui» sarebbe fuori schermo. I
  capitoli che non hai sono spenti e aprono il foglio di aggiunta: un buco nella
  saga è esattamente il momento in cui uno vuole tapparlo.
- **Film correlati**: venti titoli con la locandina, presi da TMDB nel momento
  in cui apri la scheda — quindi non invecchiano mai. Quelli che hai già portano
  il segno e aprono la loro scheda; gli altri si aggiungono da lì. Le tre
  stringhe salvate all'aggiunta restano solo per i titoli non collegati a TMDB.
- **Voto TMDB**: sotto la trama, accanto al cast — non in cima vicino al tuo.
  Sono due giudizi diversi e affiancarli suggerirebbe un confronto che non
  interessa a nessuno.
- **Scarica dalla scheda**: i download non vivono più solo dentro il player.
  L'indirizzo viene risolto *prima* di partire, perché un download che comincia
  da un indirizzo indovinato fallisce a metà senza dire perché.
- **Episodi per stagione**: per una serie collegata a TMDB l'elenco delle
  puntate con miniatura, durata, voto e trama, con la tendina delle stagioni
  (sette stagioni in fila orizzontale costringono a scorrere per arrivare
  all'ultima, che è quella che si cerca). Il segno di spunta segna «visto
  fino a qui» — traducendo la puntata nel totale che la libreria tiene — e il
  play su una riga apre *quella* puntata: stagione ed episodio finiscono nelle
  sorgenti del titolo, quindi l'indirizzo costruito diventa `…/s02e07.m3u8`
  invece del solito `S01E{visti+1}`. Il play sta in fondo alla riga, sempre
  visibile: prima compariva passando il puntatore sulla miniatura, un gesto che
  su un telefono — dove questa lista si usa — non esiste. Le puntate già viste
  restano riconoscibili senza leggerle: miniatura spenta e segno verde sopra.
- **Il logo del titolo**: in vetrina e in cima alla scheda, quando TMDB ha il
  lettering disegnato della serie o del film. È metà dell'effetto — «Cent'anni
  di solitudine» nel suo lettering *è* la locandina, lo stesso nome nel font
  dell'app è una didascalia — e quando non c'è resta il titolo scritto.
- **Cerca**: una pagina con la casella appesa in alto, due schede — **Film & TV**
  e **Persone** — e la griglia dei risultati, tenendo separato quello che hai
  (si apre) da quello che non hai (si aggiunge). A casella vuota propone cosa
  riprendere invece di una pagina bianca. Tutta la pastiglia della casella è
  toccabile, non solo la riga di testo: su un telefono il bersaglio è largo
  quanto lo schermo, e la tastiera si apre da qualunque punto.
- **Risultati che rispondono alla domanda**: TMDB cerca per sottostringa, quindi
  «Ns» pescava *Ded@ns*, *Käpt'ns Dinner* e una serie olandese del 1981 — tutti
  legittimi, nessuno la risposta. Ora i risultati sono ordinati prima per quanto
  il titolo corrisponde a ciò che hai scritto e poi per popolarità, le schede
  senza nemmeno una locandina restano fuori quando c'è di meglio, e sotto le tre
  lettere l'app lo dice invece di riempire la griglia di rumore.
- **Le pastiglie di scorciatoia**, sopra la vetrina: **Serie TV · Film · Da
  vedere · Generi ⌄**, una fila che scorre. Ognuna apre la Libreria col filtro
  già acceso, e la tendina dei generi elenca solo quelli che hai davvero sullo
  scaffale. Stanno lì e non nella barra dell'app perché sono un modo di guardare
  la *libreria*, cioè contenuto: la barra è per ciò che riguarda l'app.
- **In barra restano due cose**: la **campanella**, che si accende solo quando
  una serie o un film che segui ha una data entro un mese e mezzo, e i **tre
  puntini** con Aggiungi titolo, Gestisci Link Host, Apri Web Viewer, Aggiorna
  contenuti, Tu, tema, Diagnostica e Impostazioni.
- **Quattro destinazioni, le stesse sul telefono e sul desktop**: **Stasera ·
  Libreria · Cerca · Tu**. Erano dieci, e ognuna aveva la sua buona ragione per
  esserci — è così che si arriva a dieci. Saghe è un modo di guardare lo
  scaffale, quindi sta in Libreria; Scopri è dentro Cerca, dove già stava sul
  telefono; Dati e Profilo rispondevano alla stessa domanda e sono diventati
  **Tu**; il Critico si invoca da ogni scheda invece di essere un posto; la
  Diagnostica resta nelle Impostazioni, che sono ovunque.
- **La mini-barra del lettore** ha preso il posto della voce «Player»: compare
  quando c'è qualcosa lasciato a metà, dice a che punto sei e quanto manca, e ci
  riporta dentro con il titolo già scelto. La voce in barra c'era perché
  altrimenti sul telefono il lettore diventava irraggiungibile: un vincolo vero,
  risolto meglio — una scheda fissa è un indirizzo, questa è lo stato.
- **Il primo minuto**: al primo avvio quattro schermate. Un muro di copertine
  che mostra com'è l'app piena, una griglia di ventiquattro titoli famosi da
  toccare per dire cosa hai già visto (bastano tre, e diventano il tuo
  scaffale), e **solo allora** la chiave del catalogo — spiegata per quello che
  accende, verificata mentre la incolli, e saltabile. Prima non c'era niente di
  tutto questo: l'app si apriva su una libreria vuota e su un invito a cercare,
  rivolto a un motore che senza chiave non avrebbe risposto mai. Si rivede da
  Impostazioni → Rivedi il primo avvio.
- **Sei righe in Home, per davvero**: la regola anti-Netflix era dichiarata in
  `PRODUCT.md` e nel commento di `useHomeLayout`, e applicata in nessun punto —
  le sezioni predefinite erano tredici e nessuna era spenta. Adesso `MAX_ROWS` è
  una costante che il pannello «Home su misura» fa rispettare: dice quante ne
  hai accese e, arrivato a sei, che per accenderne una bisogna spegnerne
  un'altra.
- **Quando manca la chiave del catalogo, lo dice un posto solo.** Prima lo
  dicevano dieci componenti, ognuno con la sua frase e il suo tono, e nessuno
  arrivava prima del momento in cui la cosa non funzionava: si scopriva che
  serviva una chiave *fallendo*. Ora c'è una striscia chiudibile in cima alla
  Home, una riga sotto ciò che senza catalogo è solo più povero, e un blocco al
  posto di ciò che senza catalogo non esiste — stesso testo, tre pesi.
- **Doppio tocco su una locandina: preferito.** Il cuore c'era già, ma per
  arrivarci servivano tre tocchi e un viaggio nella scheda. Non aggiunge un
  pixel all'interfaccia, ed è il gesto che tutti hanno già imparato altrove.
- **Aggiorna contenuti**: butta via quello che TMDB ha lasciato in cache — fino a
  sei ore per una stagione, tutta la sessione per una locandina — ed è la
  risposta a «è uscito ieri e qui non lo vedo». La libreria non la tocca.
- **In vetrina**: la Home si apre con un titolo solo, grande, e due pulsanti —
  **Riproduci** e **La mia lista**. Sotto al titolo c'è sempre un fatto
  verificabile e mai uno slogan: la data del prossimo episodio, i minuti che
  restano, o il giorno in cui l'hai aggiunto. Chi ci finisce lo decide una
  gerarchia dichiarata (prima una data in arrivo, poi ciò che hai lasciato a
  metà, poi un preferito mai visto) e non un sorteggio a ogni apertura.
- **Pastiglie sulle copertine**: «Nuova stagione — tra 3 giorni», «Aggiunto di
  recente». Al massimo una per copertina e solo quando dietro c'è un fatto, così
  la riga mantiene una gerarchia invece di essere tutta marchiata.
- **Perché hai guardato…**: una riga di consigli che parte dall'ultimo titolo che
  hai finito davvero. Il motivo è il titolo stesso della riga, e se dallo
  scaffale non emerge niente che gli somigli la riga non compare.
- **Continua a guardare**: la riga in cima alla Home tiene da parte tutto quello
  che hai lasciato a metà, dal più recente. Le schede sono larghe come una scena
  e non alte come una locandina — questa riga risponde a «dove ero rimasto», e
  la risposta è il fotogramma, il punto in cui sei e quanto manca: tre cose che
  in una copertina verticale non ci stanno. Ogni scheda dice a che percentuale
  sei, quale stagione ed episodio ti aspetta e quanti minuti mancano alla fine;
  un tocco e riparte dal secondo esatto in cui avevi smesso. Il punto lo salva il
  player da solo mentre guardi, ma la riga tiene conto anche di quello che segni
  a mano — così ci finiscono anche i titoli visti altrove.
- **Profilo**: la tua pagina personale, con le ore totali che salgono mentre
  guardi, film visti, serie completate ed episodi, un grafico dei minuti per
  giorno con vista settimana / mese / anno, il livello che cresce con le ore, il
  giorno record, i giorni di fila, la classifica delle tue serie per episodi e le
  copertine di ciò che hai finito.
- **Pagine persone**: attori e registi cliccabili ovunque, con filmografia da
  TMDB e in evidenza ciò che hai già in libreria.
- **Prossimamente**: calendario dei nuovi episodi delle serie che segui e delle
  uscite dei film in watchlist, con promemoria e notifiche locali.
- **Ricerca intelligente**: una sola barra che trova titoli, saghe, universi,
  attori e registi, con i risultati raggruppati per tipo — e che perdona gli
  errori di battitura, proponendo il titolo che intendevi.
- **Cercare un titolo nuovo**: i risultati arrivano mentre scrivi, senza premere
  niente. Se sbagli una lettera non ti lascia a mani vuote: TMDB non ha una
  ricerca tollerante, quindi quando la parola esatta non trova nulla la si
  accorcia — così una lettera sbagliata in fondo smette di contare — e i
  risultati vengono riordinati per somiglianza a quello che avevi scritto, sotto
  la riga «forse cercavi». Intanto ti dice anche se quel titolo ce l'hai già.
- **La scheda di un titolo che non hai**: tocca un risultato della ricerca — o
  un film correlato, un capitolo di saga che ti manca, un titolo nella
  filmografia di un attore — e si apre la sua scheda intera: trama, cast con le
  facce, dove guardarlo, regia e troupe, incassi, studi, media e correlati.
  Prima quel tocco *aggiungeva*: per leggere una trama bisognava mettersi il
  titolo in casa, cioè decidere prima di avere in mano le cose su cui si decide,
  e chi guardava per curiosità si ritrovava lo scaffale da riordinare.
  «Aggiungi alla libreria» è un pulsante dentro la scheda, e apre il foglio già
  compilato. Se il titolo ce l'hai già, la scheda lo dice e porta alla tua.
- **Apri sul servizio**: l'icona del provider è un collegamento. Un tocco e
  si apre Netflix, Prime Video, Disney+, Apple TV+, Paramount+, Crunchyroll,
  RaiPlay o MUBI con la ricerca del titolo già scritta — e sul telefono si apre
  l'app, non il sito, se ce l'hai installata. Vale anche per la piattaforma che
  hai indicato tu sulla scheda, quindi funziona pure senza chiave TMDB. Si apre
  la ricerca e non la scheda del film perché l'indirizzo interno di un titolo non
  è in nessun catalogo pubblico: l'app lo dice invece di prometterti un salto
  esatto che non può fare. I servizi senza una rotta di ricerca stabile — Sky /
  NOW, HBO Max, Mediaset Infinity — restano etichette, con il collegamento a
  JustWatch accanto.
- **Niente pulsante «+» che galleggia**: stava appeso in basso a destra su ogni
  pagina e copriva stabilmente l'angolo di una copertina, di una riga di
  episodi, di un grafico. Aggiungere un titolo a mano è una cosa che si fa di
  rado — dalla ricerca si aggiunge dalla scheda — quindi è sceso nel menu dei
  tre puntini, dove stanno le altre azioni sull'app.
- **Sul televisore, col telecomando**: le frecce spostano il fuoco fra le
  copertine invece di scorrere la pagina, il bordo di selezione diventa spesso e
  tutto si ingrandisce per essere letto da lontano. → sull'ultima copertina di
  una riga non fa niente, perché il bordo di una lista si deve sentire; ↓ invece
  arriva anche a quello che non è incolonnato con nulla. Nel player le frecce
  restano avanti, indietro e volume. Si accende da sola su una TV, un Fire TV o
  un Chromecast, e nelle impostazioni c'è l'interruttore a tre stati con scritto
  cosa ha riconosciuto.
- **Copertina larga nella scheda**: l'immagine orizzontale del titolo dietro
  all'intestazione, sfumata verso il fondo. Quando manca — o mentre arriva —
  resta la sfumatura generata dal titolo, che è sempre stata l'intestazione
  predefinita.
- **Filtri avanzati**: tipo, stato, genere, studio, paese, lingua audio,
  qualità della tua copia, durata, anno, il tuo voto e quello di TMDB, e
  "solo con sottotitoli". Le opzioni sono prese dal tuo scaffale, quindi ogni
  voce del menu corrisponde a qualcosa che hai davvero.
- **Ricerca a parole**: scrivi «film di fantascienza anni '90» e Claude la
  traduce in filtri per TMDB, che risponde. Il modello sceglie i filtri, non i
  titoli: così la lista è vera per costruzione.
- **Consigli con il perché**: le righe *Per te*, *Più visti*, *Ultimi aggiunti*
  e *Simili sul tuo scaffale*, ognuna con la ragione scritta sotto al titolo.
- **Obiettivi personali**: due film a settimana, cinquanta all'anno, dieci
  horror a ottobre. Si misurano sul diario, non sullo scaffale.
- **Condivisione**: un link o un codice QR per aprire un titolo — o la lista
  che hai davanti, filtri compresi — su un altro dispositivo. Senza server: la
  lista viaggia dentro il link.
- **Controllo genitori**: filtro per età sulla classificazione reale del film,
  protetto da PIN.
- **Si comporta da applicazione, non da pagina**: niente rimbalzo elastico a
  fine scorrimento e niente «tira per aggiornare» (in una libreria che si scorre
  tutto il giorno è un ricaricamento a sorpresa), niente menu «salva immagine»
  tenendo premuto su una locandina, niente selezione di testo che parte
  scorrendo di fretta — ma la trama e le note restano copiabili, perché un'app
  locale che non lascia copiare i propri dati è una scortesia. I tocchi non
  aspettano più i trecento millisecondi che il browser teneva da parte per il
  doppio tap (`touch-action: manipulation`), e ogni pressione risponde subito
  con un cenno visivo invece che al cambio di schermata.
- **Transizioni native**: aprire una scheda, un catalogo o la pagina di una
  persona passa dalla **View Transitions API** del browser — le due schermate
  vengono fotografate e interpolate sulla GPU, fuori dal thread che disegna la
  pagina. Zero byte di libreria, e chi ha chiesto meno movimento nelle
  impostazioni di sistema non ne vede nessuno.
- **Lo zoom resta, tutto intero**: né `user-scalable=no` né `touch-action:
  manipulation`. Il primo toglie l'ingrandimento a chi ne ha bisogno per leggere
  (WCAG 1.4.4); il secondo si porta via il doppio tocco per ingrandire in cambio
  di trecento millisecondi che sui browser moderni non esistono più — costo
  reale, beneficio immaginario.
- **«Episodi» dentro il lettore**: mentre guardi una serie, il pulsante Episodi
  apre le puntate **di quella stagione** — fotogramma, numero, titolo, durata e
  trama, con la tendina per cambiare stagione e quella in onda evidenziata.
  Toccarne una riparte da lì: stagione ed episodio finiscono nelle sorgenti del
  titolo e l'indirizzo viene ricercato per la puntata nuova. Prima quel pannello
  elencava *gli altri titoli* dello scaffale, che è la risposta a un'altra
  domanda; adesso ci sono entrambe, in due schede — «Questa serie» e «Da
  riprodurre».
- **Gli attrezzi del player si vedono solo quando stai guardando qualcosa**:
  Sorgenti, Siti, Download, Watch Party e Host sono cose che si fanno *a un
  titolo aperto*. Sulla pagina vuota erano cinque schede senza soggetto.
- **Funziona offline**: dopo la prima apertura con la rete, l'app si avvia
  anche senza. Libreria, diario, statistiche, saghe e profilo sono già tutti sul
  dispositivo; le copertine già viste restano in cache. Un avviso dice cosa
  resta in attesa della connessione — la ricerca su TMDB, le copertine nuove e
  il critico — invece di lasciarti davanti a una ricerca che non risponde.
- **Aggiornamenti che chiedono il permesso**: quando esce una versione nuova
  compare un avviso con «Ricarica». Non si aggiorna da sola: potresti essere a
  metà di una recensione o di un film.
- **Diagnostica**: test automatici, salute degli host e log degli errori, tutto
  sul dispositivo.
- **Critico IA**: fai domande sui tuoi gusti, basate sulla tua libreria reale,
  incluse le saghe lasciate a metà.
- **Statistiche e traguardi**: ore totali, film e serie completati, distribuzione
  voti, generi, attori e registi più visti, anno per anno, e badge da sbloccare.
- **Il player ti conosce**: volume, muto, velocità, lingua dell'audio e dei
  sottotitoli, stile dei sottotitoli e tetto di qualità non si rimettono a ogni
  episodio — si scelgono una volta e valgono per ogni titolo che apri. La lingua
  è ricordata come lingua, non come numero di traccia, così vale anche su una
  serie dove l'ordine delle tracce cambia da un episodio all'altro.
- **Comandi di sistema**: titolo, copertina e play/pausa arrivano sulla
  schermata di blocco, nelle notifiche e sui tasti multimediali; lo schermo del
  telefono resta acceso mentre scorre il video e solo mentre scorre.
- **Errori che dicono cosa fare**: 404, CORS, accesso negato, codec non
  supportato, playlist non valida — ognuno con la sua causa e il suo rimedio, e
  il pulsante «Riprova» solo dove aspettare può davvero servire. Se cade la
  rete, riparte da solo quando torna.
- **Spegnimento automatico**: 15, 30, 60 minuti o «fine episodio», per
  addormentarsi senza svegliarsi quattro episodi più avanti.
- **Player**: per i titoli a cui hai dato una sorgente HLS, un lettore completo —
  gesture sul telefono (scorri per avanzare, su e giù per volume e luminosità,
  doppio tocco per ±10s), buffer che si dimensiona sulla rete misurata,
  qualità adattiva con selezione manuale, ripresa dal secondo esatto, velocità,
  Picture in Picture, schermo intero, mini player, sottotitoli `.vtt`
  personalizzabili e sincronizzabili, salto intro/recap/crediti, anteprime sulla
  timeline, autoplay nell'ordine della saga, consigli di fine visione presi dalla
  tua libreria, Chromecast/AirPlay, Watch Party con chat e reazioni, download
  offline riproducibile senza rete, e failover fra host mirror — con test di
  velocità, priorità automatica a punteggio e bilanciamento del carico.

## Impostazioni, e il Link Host

Le impostazioni sono un indice: righe raggruppate — icona, titolo, sottotitolo,
freccia — e una schermata per volta. Le sezioni sono le stesse di prima
(chiavi e modello, indirizzi delle sorgenti, Link Host, aspetto, Home su
misura, televisore, controllo genitori, dati e backup, diagnostica); quello che
cambia è che per cambiare il colore d'accento non si passa più davanti a due
chiavi API. In fondo c'è **Informazioni**: di cosa è fatta l'app, con chi parla
il tuo browser e cosa promette sui tuoi dati — comprese le attribuzioni a TMDB
e JustWatch, che stanno lì perché è lì che si cercano.

**Gestisci Link Host** ha la sua schermata, con due schede in fondo che restano
leggibili anche dopo il primo giorno:

- **Come funziona?** — CineMate non ospita né fornisce alcun contenuto. Un Link
  Host è l'indirizzo di un *sito* che indichi tu, usato come punto di partenza
  tecnico per la ricerca: l'app concatena i metadati del titolo, li trasforma
  nella ricerca di quel sito, legge la pagina che risponde e, se ci trova un
  `.m3u8`, lo manda al lettore. L'app non conosce nessun sito e non ne propone:
  la lista è vuota finché non ci scrivi qualcosa tu.
- **Attenzione** — accedere a materiale protetto da copyright senza
  autorizzazione viola i termini di servizio dei siti e le leggi vigenti.
  CineMate non è affiliata a nessun Link Host e non verifica cosa ci sia dietro
  l'indirizzo che scrivi: quello che ci metti, e cosa ne fai, è una tua
  responsabilità.

## Il player: com'è fatta la scena

I comandi stanno in tre fasce, e ognuna risponde a una domanda diversa.

**In alto: cosa sto guardando.** L'etichetta dice `S1:E10 «Titolo»` per una
serie e il solo titolo per un film. Accanto ci sono i tre pollici — *non fa per
me*, *mi piace*, *adoro* — che **scrivono il voto della libreria** (4, 8, 10):
non è un giudizio parallelo, è lo stesso campo che poi leggi nella scheda, e da
lì puoi sempre aggiustare la sfumatura. A destra: trasmetti, lucchetto, chiudi.

**Il lucchetto blocca i comandi, non lo schermo.** Un telefono tenuto in mano
durante un film riceve decine di tocchi involontari; da bloccato la scena non
risponde più né al dito né alla tastiera, e resta solo il pulsante per
sbloccare.

**Al centro: il tempo.** Indietro di 10, play/pausa, avanti di 10, grandi e
lontani fra loro — tre bersagli premibili al buio invece di undici icone in
fila. Sul bordo sinistro c'è la colonna della luminosità, che fa la stessa cosa
dello scorrimento col dito ma si vede: e come sempre scurisce *l'immagine*, non
la retroilluminazione dello schermo, che nessuna pagina web può toccare.

**In fondo: l'avanzamento e le azioni.** A destra della barra c'è quanto manca
alla fine, non quanto è passato. Sotto, cinque azioni con l'etichetta scritta:

- **Ritaglia** — segna un momento e lo condivide. Il collegamento apre il player
  a quel secondo: il video non viene copiato né caricato da nessuna parte, e il
  foglio lo dice invece di far credere che parta uno spezzone.
- **Velocità** e **Audio e sottotitoli** — aprono le impostazioni già sulla
  scheda giusta.
- **Episodi** — l'elenco di cosa altro c'è da riprodurre, in un foglio laterale
  con copertina e posizione. Prima era una fila di pastiglie fuori dal player,
  quindi invisibile a schermo intero.
- **Pross. ep.** — manda avanti subito.

Volume, PiP, mini player e schermo intero restano a destra come icone sole.

**All'avvio, il cartello della classificazione.** Sigla dell'ente (`TV-14`,
`VM14`) e, sotto, le avvertenze che hai scritto tu nella scheda del titolo alla
voce **Avvertenze** — «linguaggio forte, consumo di tabacco». Sono scritte a
mano perché nessun catalogo pubblico le espone in modo affidabile e dedurle dal
genere significherebbe inventarle. Senza classificazione il cartello non compare
affatto.

**A fine episodio**, «Guarda i titoli di coda» oppure «Prossimo episodio», con
il conto alla rovescia che riempie il pulsante mentre scorre.

### La scena bassa, che è quella di un telefono

Un 16/9 largo quanto un telefono in verticale è alto **180 pixel**: la stessa
scena che su un portatile ne è alta 470. Tutte e tre le fasce erano scritte per
la seconda, e sulla prima si accavallavano — il cartello della classificazione
atterrava sul play, la colonna della luminosità restava alta venti pixel, e la
fila delle azioni andava a capo prendendosi *più della metà del film* per una
riga di icone.

Adesso la scena si misura da sola. Sotto i 380 pixel di altezza le fasce si
stringono, il cartello passa su una riga sola, la colonna della luminosità si
toglie di mezzo — il gesto verticale e la voce in Impostazioni fanno la stessa
cosa — e la slitta del volume sparisce, che su un telefono ha due tasti fisici
accanto che la battono. Sotto i 700 pixel di larghezza le parole delle azioni
lasciano le sole icone.

Due dettagli che valgono più di quanto sembri:

- **si misura la scena, non la finestra.** Un telefono in orizzontale ha 844
  pixel di finestra e 520 di scena: una `@media` guarda i primi e sbaglia. Una
  `@container` guarda i secondi. È l'unico modo perché la stessa regola valga
  nel player della pagina, nel mini player e a schermo intero.
- **le pastiglie e il cartello ora sono una colonna sola.** Erano due strati
  assoluti a due coordinate diverse, sfalsati in diagonale per schivare la
  luminosità: schivavano quella e si scrivevano addosso l'un l'altro appena
  comparivano insieme. Impilati non possono più, a nessuna altezza.

E la scena non è più più alta dello schermo: su un telefono in orizzontale il
riquadro si ferma a tre quarti dell'altezza e l'immagine si mette in mezzo alle
sue bande nere, invece di finire sotto il bordo e costringere a scorrere la
pagina mentre il film va. A schermo intero il tetto si toglie.

### Schermo pieno, e il fatto che su iPhone non esista

**Su iPhone l'API di schermo intero per gli elementi non c'è.** Safari la
concede solo al video nudo (`webkitEnterFullscreen`), e solo dopo che il video ha
una sorgente caricata: su una scena ancora ferma quella chiamata lancia, il
`catch` la ingoiava, e il pulsante sembrava rotto perché *non faceva niente* —
che è esattamente come lo si vive.

Quindi lo schermo pieno è diventato una cosa garantita da noi: se il browser ha
l'API vera la usa; altrimenti la scena si prende la pagina — `position: fixed`,
tutto lo schermo, i nostri comandi ancora addosso e la pagina sotto bloccata
perché non scorra dietro al film. Non è un ripiego povero: le regole di scena
bassa misurano il riquadro, quindi a schermo pieno il lettore si ridisegna da
solo alla nuova altezza, e i comandi restano i nostri — episodi, sottotitoli,
maratona — che nel lettore di sistema sparirebbero tutti.

Due conseguenze pratiche: il pulsante c'è **sempre** (prima si decideva
guardando `videoRef.current`, che al primo render è ancora `null` — e un ref non
fa ridisegnare niente, quindi su un telefono poteva restare nascosto proprio
all'apertura), e la soglia della scena bassa è a 420px perché un telefono girato
a schermo pieno è alto fra i 375 e i 415: sotto la soglia vecchia ci finiva per
un pelo dalla parte sbagliata.

## Player: come dargli qualcosa da riprodurre

La pagina Player prende i titoli dalla tua libreria e mostra quelli per cui c'è
una sorgente. Due strade:

**Il modo veloce, se i tuoi video stanno tutti sullo stesso server.** Vai in
**Impostazioni → Indirizzi delle tue sorgenti** e scrivi l'indirizzo una volta
sola. Può bastare il server e basta:

```
https://mio-server.com
```

Da quel momento ogni titolo della libreria ha il suo pulsante **Guarda** nella
scheda: lo cerchi, lo premi e parte, senza incollare più niente. Il file lo trova
lui: costruisce i percorsi soliti per quel titolo — `/il-padrino.m3u8`,
`/film/il-padrino/index.m3u8`, `/breaking-bad/s01e04.m3u8` e una ventina d'altri
— e li prova finché uno risponde. Se non risponde nessuno, legge l'indice della
cartella e prende il file il cui nome corrisponde al titolo, anche quando si
chiama `Il.Padrino.1972.1080p.ITA.m3u8`.

Se invece sai già com'è fatto l'indirizzo, scrivilo con un segnaposto al posto
del titolo ed è quello esatto, senza tentativi:

```
https://mio-server/film/{slug}.m3u8
```

Le caselle sono tre e fanno anche da riserva: il player le prova in ordine e usa
la prima che risponde, così se il primo server è giù passa al secondo da solo.
Anche gli **host** del pannello Host contano come indirizzi, e vengono provati
dopo le tre caselle nell'ordine di priorità che hanno lì. I segnaposto
disponibili (`{slug}`, `{titolo}`, `{anno}`, `{tmdb}`, `{s}`, `{e}`, `{ss}`,
`{ee}`) sono elencati nelle Impostazioni, con l'anteprima di cosa producono.

**Il modo per un titolo solo**, se ognuno sta in un posto diverso:

1. apri la pagina Player e il pannello **Sorgenti**, e incolla l'indirizzo di un
   manifest HLS (un indirizzo il cui percorso finisce in `.m3u8`);
2. in alternativa salva lo stesso indirizzo fra i **link personali** del titolo,
   nella sua scheda in libreria: viene riconosciuto allo stesso modo;
3. il titolo compare fra quelli riproducibili in cima alla pagina Player.

Il player prova nell'ordine: l'indirizzo del singolo titolo, poi il suo link
personale, poi gli indirizzi delle Impostazioni e gli host, poi l'indice delle
cartelle di quegli stessi indirizzi, e come ultima cosa i **Link Host** — i siti
che hai indicato tu, se ne hai indicati.

Ogni indirizzo provato sta su un server o su un sito che hai scritto tu.
CineMate non ne contiene nessuno.

Gli altri link personali restano segnalibri normali: solo l'estensione `.m3u8`
viene interpretata come sorgente video. Senza nessuna sorgente la pagina mostra
lo stream pubblico di test di hls.js, così puoi vedere come si comporta il player
prima di collegare qualcosa di tuo.

I titoli riproducibili sono in coda **nell'ordine di visione della loro saga** —
lo stesso che scegli nella pagina Saghe — così "prossimo contenuto", l'autoplay e
la barra della maratona non contraddicono mai quello che vedi lì. E quando arrivi
in fondo a un titolo, il player lo segna **Visto** in libreria: la voce nel
diario, i traguardi e il prompt "continua la storia" scattano come se l'avessi
spuntato a mano.

Il pannello **Sorgenti** raccoglie tutto ciò che il player sa di un titolo oltre
allo stream: le tracce di sottotitoli `.vtt`, il punto in cui iniziano e finiscono
intro, recap e crediti, e l'immagine a griglia per le anteprime sulla timeline.
Per i marker basta mettere in pausa nel punto giusto e premere ⌖: prende il
minutaggio dal player.

Nessuna funzione richiede un backend. Restano fuori dalla portata del browser
solo queste, ed è documentato cosa servirebbe:

| Funzione | Come funziona qui | Cosa servirebbe per fare di più |
|---|---|---|
| Download offline | legge i segmenti dalla playlist del titolo e li salva su IndexedDB; "Guarda offline" li ricompone in una playlist locale e li riproduce senza rete | un endpoint `GET /api/content/:id/download-manifest?quality=` — se risponde viene preferito, perché può dare dimensioni esatte e URL firmati. Sorgenti cifrate (`EXT-X-KEY`) o con `EXT-X-BYTERANGE` non sono supportate e lo dicono |
| Consigli di fine visione | costruiti dalla tua libreria — resto della saga, titoli simili, stesso regista, stesso genere — ognuno con la sua motivazione | niente: un endpoint `/api/content/:id/recommendations` viene usato se esiste, ma non serve |
| Watch Party fra dispositivi diversi | incolla l'indirizzo di un relay nelle impostazioni del pannello. Senza relay usa `BroadcastChannel`, che sincronizza **solo fra schede dello stesso browser** | un piccolo servizio WebSocket che rimandi ogni messaggio agli altri client della stessa stanza |
| Scadenza reale del certificato SSL di un host | mostra solo se l'handshake TLS è riuscito | un endpoint che ispezioni il certificato con il modulo `tls` di Node |

Le **tracce audio** non vanno configurate: sono dichiarate dal manifest e hls.js
le trova da sé.

## Link Host: cercare su un sito invece che su una cartella

Un **Link Host** è l'indirizzo di un *sito* su cui cercare, invece
dell'indirizzo di una *cartella* da cui leggere. È l'altra metà della domanda
"dove sta questo titolo": gli indirizzi delle sorgenti indovinano un percorso,
un Link Host pone una domanda.

Si aggiunge in **Impostazioni → Link Host**. Basta l'indirizzo nudo:

```
https://sito.tld
```

Da lì in avanti, quando premi **Guarda** su un titolo che i tuoi indirizzi non
hanno:

1. **I metadati vengono concatenati.** Titolo, anno e — per le serie — stagione
   ed episodio diventano una domanda sola: `Breaking Bad 2008 S02E05`. Quanto
   metterci lo decidi tu, con quattro ricette (solo il titolo, titolo e anno,
   titolo ed episodio, tutto).
2. **La domanda diventa un indirizzo**, in due famiglie che si provano in
   ordine. Prima la **ricerca del sito** — `/?s=`, `/search?q=`, `/cerca/`… —
   che perdona uno slug approssimativo; poi i **percorsi diretti**, che saltano
   la pagina dei risultati quando indovinano: `/film/interstellar-2014/`,
   `/serie/the-boys/stagione-3/episodio-1/`. Se conosci il tuo sito puoi
   dichiarare quale delle due usare, o scrivere il percorso esatto
   (`/find?title={query-}`) ed è l'unico provato. I segnaposto sono elencati
   nelle Impostazioni: `{query}`, `{query+}` e `{query-}` sono la stessa domanda
   in tre codifiche, perché i siti non sono d'accordo su come si scrive uno
   spazio; `{sNeN}` e `{sxe}` sono `S02E05` e `2x05`.
3. **La pagina che risponde viene letta** e se ne isola l'`.m3u8`, che finisce
   nel lettore senza farti vedere la pagina. Fra più manifest vince il master
   firmato, non la variante a 720p; quelli serviti da una rete pubblicitaria
   nota vengono scartati del tutto, così un pre-roll non finisce mai nel
   lettore. Se nella pagina non c'è nessun `.m3u8` esplicito, gli indirizzi che
   *promettono* una playlist (`/getlink?id=…&sig=…`) vengono letti per
   confermarli dal MIME type o dalla riga `#EXTM3U`.

**Quale episodio.** La libreria conta gli episodi visti come un totale unico,
non per stagione: da «visti: 27» non si ricava se sia S02E03 o S03E01, e
indovinare è il tipo di errore che ti fa partire l'episodio sbagliato. Quindi il
valore predefinito è l'unico onesto — stagione 1, episodio `visti + 1` — e il
pannello **Siti** del player ha due caselle per correggerlo. Sono anche ciò che
rende raggiungibili i percorsi annidati per stagione.

**Più siti insieme.** Con più Link Host la ricerca parte su tutti in parallelo,
non uno dopo l'altro: in fila, tre siti lenti sono tre timeout sommati. E fra
più risposte non vince la più veloce ma la migliore — si legge il master di
ognuna e la risoluzione pesa più della latenza, perché un titolo si apre una
volta e si guarda per due ore.

### Il Web Viewer, e perché serve

Quando la catena non arriva in fondo c'è il **Web Viewer**: una finestra sul
sito con gli script spenti. Non è una lista di domini pubblicitari da
aggiornare — è l'attributo `sandbox` di un `<iframe>`, che parte da zero
permessi. Senza script non c'è quasi niente di quello che rende quelle pagine
insopportabili: gli overlay, i pop-under, il redirect al terzo clic. Tre
permessi non si concedono a nessun livello — `allow-popups`,
`allow-top-navigation`, `allow-modals` — perché sono esattamente i tre
comportamenti che il viewer esiste per togliere.

Tre livelli: **Rigido** (niente script né moduli), **Normale** (i moduli
funzionano, per i siti la cui ricerca è un form), **Minimo** (gli script girano,
per i player che si caricano da JavaScript). Da dentro, il pulsante **Estrai il
flusso** rilegge la pagina corrente e, se ci trova un manifest, lo collega al
titolo e apre il lettore. Cerca anche gli indirizzi *senza* `.m3u8` in fondo —
un `/api/getlink?id=…` firmato — e li conferma leggendoli: se rispondono
`#EXTM3U`, sono una playlist comunque.

**«Il sito» oppure «Pagina letta».** Sono due modi di mostrare la stessa pagina,
e servono contro due muri diversi.

- *Il sito* è il riquadro di sempre. Se resta bianco, quel sito rifiuta di
  essere incorniciato (`X-Frame-Options`) e non c'è opzione che lo convinca.
- *Pagina letta* non lo incornicia affatto: legge il sorgente e lo **ridisegna
  qui**, dentro un documento nostro con un `<base>` che punta al sito, così
  immagini e stili arrivano da lì. Un divieto di incorniciare non è un divieto
  di leggere, ed è esattamente la differenza che rende visibile una pagina che
  prima era un rettangolo bianco.

In «Pagina letta» i permessi sono azzerati e non sono scegliibili: in un
`srcdoc`, `allow-same-origin` vorrebbe dire *la nostra* origine, cioè HTML di
terzi con gli script accesi dentro casa. I clic sui collegamenti sono spenti
per lo stesso motivo per cui la modalità esiste — porterebbero il riquadro sul
sito vero, contro il divieto di prima. Per spostarsi c'è la barra
dell'indirizzo e, quando il viewer è stato aperto per un titolo, **i
collegamenti della pagina che somigliano a quel titolo**, estratti e messi come
pulsanti suoi: dalla pagina dei risultati alla scheda in un tocco.

Perché «Pagina letta» funzioni bisogna poter *leggere* la pagina, ed è l'altro
muro — CORS — di cui parla la sezione qui sotto.

### Il limite, detto una volta

CineMate è una pagina web, non un'app nativa. **Leggere il sorgente di una
pagina di un altro dominio richiede che quel dominio mandi gli header CORS**, e
i siti di terzi quasi mai li mandano. Quindi:

| Passo | Su un host tuo | Su un sito di terzi | Con un lettore di pagine |
|---|---|---|---|
| Costruire la ricerca | ✅ sempre | ✅ sempre | ✅ sempre |
| Leggere i risultati ed estrarre l'`.m3u8` | ✅ se manda CORS | ⛔️ bloccato dal browser | ✅ |
| Vedere la pagina nel Web Viewer | ✅ | ✅ salvo `X-Frame-Options` | ✅ con «Pagina letta», anche allora |
| Riprodurre l'`.m3u8` trovato | ✅ se manda CORS | ⛔️ stesso muro | ⛔️ **il muro resta** |

Non è un difetto da correggere: è come funziona il browser, e il codice lo
riporta invece di mascherarlo. Un fallimento dice *quale* dei due è —
"non l'ho trovato" o "il browser non mi ha lasciato leggere" — perché le due
strade che restano sono diverse.

### Il lettore di pagine

La terza colonna della tabella è l'unica cosa che, da dentro un browser, quel
muro lo scavalca — e proprio perché *non* è un browser. Un **lettore di pagine**
è un servizio tuo che scarica una pagina al posto del browser e te la ripassa
con l'header che serve: venti righe di Cloudflare Worker, un `cors-anywhere` su
un Raspberry in casa, o una rotta del reverse proxy che hai già davanti al tuo
server. L'indirizzo si scrive in **Impostazioni → Indirizzi delle tue sorgenti →
Lettore di pagine**, in una delle tre forme che i lettori del mondo usano:

| Come lo scrivi | Cosa fa |
|---|---|
| `https://mio-lettore.dev/?u={url}` | l'indirizzo va nel parametro, codificato |
| `https://mio-lettore.casa/leggi/{url-nudo}` | l'indirizzo va nel percorso, intero |
| `https://mio-lettore.casa/` | nessun segnaposto: si attacca in fondo (è come funziona `cors-anywhere`) |

Da qui in poi ogni lettura ci prova **prima da sola e poi attraverso il
lettore**: il tuo server manda già CORS e non ha nessun bisogno di un
intermediario, e un salto di rete in più su una richiesta che sarebbe riuscita è
solo tempo perso. Il lettore è il ripiego, non la strada maestra.

Se non ne hai uno, la ricetta completa — un Cloudflare Worker, piano gratuito,
dieci minuti — sta in **[docs/LETTORE-DI-PAGINE.md](docs/LETTORE-DI-PAGINE.md)**,
e la stessa è dentro l'app sotto la casella, perché il momento in cui serve è
quello in cui hai la casella vuota davanti e non vuoi aprire GitHub dal telefono.

**«Non ci si può fingere un browser normale, così il sito ci lascia entrare?»**
È la domanda che si fanno tutti, e la risposta dice qualcosa di preciso su dove
sta il muro. No, e non perché sia difficile: `User-Agent` è un *forbidden
header*, e `fetch` in una pagina si rifiuta di impostarlo. Ma soprattutto non
servirebbe — **i due muri non li alza il sito, li alza il browser che stai
usando**. Il sito risponde, spesso perfettamente; è il browser che, arrivata la
risposta, si rifiuta di consegnarla al codice della pagina. Non c'è un
buttafuori da ingannare: è una serratura sul lato interno della nostra porta.
Dove invece quell'idea funziona è *dentro il lettore*, che browser non è: lì lo
`User-Agent` si scrive, e cambia davvero cosa il sito serve. Il Worker della
guida lo fa.

Tre cose vanno dette prima di scriverne uno:

- **CineMate non ne contiene e non ne propone nessuno**, per la stessa ragione
  per cui non contiene indirizzi di siti. La casella è vuota finché non la
  riempi tu, e quello che ci scrivi resta su questo dispositivo.
- **Il lettore vede ogni indirizzo che gli passi.** Uno tuo è una cosa fra te e
  il tuo server; uno pubblico di terzi è una persona in mezzo che legge la tua
  navigazione. La differenza è tutta lì.
- **Non riproduce.** Il lettore serve a *leggere pagine*, non a far passare il
  video: il flusso lo chiede `hls.js` direttamente all'host, e se quell'host non
  manda CORS il film non parte comunque. È l'ultima riga della tabella, ed è
  perché dice ⛔️ anche nella terza colonna.

#### Cosa richiederebbe una WebView nativa

L'architettura di riferimento di queste funzioni è quella di un'app Android con
una WebView, che ha permessi che una pagina web non ha. Vale la pena elencare
cosa resta di là dal muro, invece di lasciarlo scoprire:

| Tecnica dell'app nativa | Perché non si fa qui | Cosa si fa invece |
|---|---|---|
| `shouldInterceptRequest` per vedere ogni risorsa che la pagina chiede | Un `<iframe>` di un altro dominio non espone le sue richieste alla pagina che lo contiene, e non esiste API per intercettarle | Si legge il sorgente con `fetch` quando CORS lo permette, e si sniffa il `#EXTM3U` sui candidati senza estensione |
| Hooking di `window.fetch` e `XMLHttpRequest.prototype.open` dentro la pagina | Iniettare script in un documento cross-origin è precisamente ciò che la same-origin policy vieta | — |
| Riuso di `Referer`, `Origin`, `User-Agent`, `Cookie` nelle richieste del player | Sono *forbidden headers*: il browser li gestisce e `fetch` rifiuta di impostarli | Un manifest che richiede quegli header non si riproduce, e il player lo dice |
| Ad-block a livello di rete su blacklist di domini | Nessun modo di filtrare le richieste di un iframe cross-origin | La sandbox toglie gli script, che è ciò che genera quelle richieste; la blacklist si applica all'*estrazione*, così un pre-roll non finisce mai nel lettore |
| `shouldOverrideUrlLoading` per tenere la navigazione sul dominio | Non si può osservare né bloccare la navigazione interna di un iframe cross-origin | `allow-top-navigation` resta negato: la pagina non può portarsi via l'app, anche se dentro il riquadro può andare dove vuole |
| Reverse proxy locale su `127.0.0.1` per iniettare header e decifrare AES-128 | Non c'è un server locale in una pagina web | hls.js decifra da sé l'AES-128 quando la chiave è raggiungibile; per gli header non c'è rimedio |
| Resolver DoH usato per *tutte* le connessioni dell'app | Una pagina non può dirottare la propria risoluzione dei nomi, ed è giusto così | Il DoH si interroga come **diagnosi** — vedi sotto — non come instradamento |

### Quando un sito cambia indirizzo

**Controlla l'indirizzo** segue i redirect e, se il dominio finale è diverso da
quello salvato, lo propone. *Propone*: non riscrive niente da solo. Un redirect
può portare a una pagina di cortesia o a un dominio parcheggiato, e cambiare in
silenzio un indirizzo che hai scritto tu sarebbe sbagliato anche quando indovina.

Quando invece non risponde proprio niente, **Cerca un nome alternativo** prova
lo stesso nome sotto una quindicina di estensioni diverse. Prima chiede al DNS e
bussa solo a chi ha risposto: quindici domini inesistenti sarebbero quindici
timeout in fila. Anche qui il risultato è una lista da guardare, non una
sostituzione automatica — che `esempio.net` esista non dice chi ci sia dietro.

La stessa verifica gira nella pagina **Diagnostica**, per tutti gli host insieme.

### La scheda DNS, e il resolver che funziona davvero

**Impostazioni → Quando un indirizzo non si risolve** apre un riferimento su DoH
(DNS su HTTPS, porta 443) e DoT (DNS su TLS, porta 853): cosa sono, la tabella
dei resolver pubblici — Cloudflare, Google, Quad9, AdGuard, OpenDNS,
CleanBrowsing, con IPv4, IPv6, endpoint DoH e hostname DoT — e dove si scrivono
su Android, iOS, Windows, macOS, Firefox, Chrome e sul router.

La parte che non è solo documentazione: **Cloudflare e Google servono il
resolver anche in JSON su HTTPS, con `Access-Control-Allow-Origin: *`**. Una
pagina web può interrogarli, e CineMate lo fa. Serve a rispondere a una domanda
che prima l'app poteva solo girare all'utente:

> Questo host che non risponde è spento, o è il *nome* che non diventa un
> indirizzo?

Sono due guasti con due rimedi diversi. Ora l'app li distingue: «Il nome non
esiste» (nemmeno per un resolver pubblico — non è il tuo DNS, è il dominio),
«Il nome esiste, il server non risponde» (il dominio c'è, dietro non c'è
nessuno), «Risponde ma non si lascia leggere» (CORS). La scheda ha anche una
casella per provare un nome a mano e confrontare cosa rispondono i due resolver.

**Cosa questo non fa**, ed è scritto anche nella scheda: non cambia come il
browser risolve i nomi. Quella decisione è del sistema operativo, o del browser
se ha il DoH acceso nelle sue impostazioni; nessuna pagina web può dirottare la
propria risoluzione dei nomi, e sarebbe grave se potesse. Quello che l'app fa è
una **diagnosi**, non un instradamento.

Cambiare resolver sposta **chi vede le tue richieste di risoluzione**, non ti
rende anonimo e non cambia cosa è lecito guardare. I blocchi che non passano dal
DNS — per IP, per rotta, applicati dal servizio stesso — restano dove sono.

### Dove finiscono i tuoi indirizzi

Da nessuna parte. La lista parte vuota, CineMate non conosce e non propone
nessun sito, e quello che ci scrivi resta in `localStorage` su questo
dispositivo. Entra nel backup insieme al resto della configurazione, per lo
stesso motivo per cui ci entrano le altre cose che hai digitato: nessun altro
può ricostruirle. Cosa ci metti, e cosa ne fai, è una tua responsabilità.

### Comandi da tastiera

Valgono quando il player ha il fuoco (basta cliccarci sopra), e mai mentre stai
scrivendo in un campo. Sono le stesse combinazioni di YouTube e Netflix.

| Tasto | Cosa fa |
|---|---|
| `Spazio` · `K` | Play / pausa |
| `→` · `L` | Avanti 10 secondi |
| `←` · `J` | Indietro 10 secondi |
| `↑` · `↓` | Volume |
| `M` | Muto |
| `F` | Schermo intero |
| `C` | Scorre le tracce di sottotitoli, poi le spegne |
| `Esc` | Chiude le impostazioni del player |

Sulla **gestione host**: serve solo se lo stesso contenuto è servito da più
origini identiche (gli stessi percorsi su ogni mirror). Se non ne configuri
nessuna, il player usa l'indirizzo del link e basta; se ne configuri, il cambio
di host avviene riscrivendo l'origine delle richieste di hls.js, quindi senza
interrompere la riproduzione — e viene applicato **solo** ai titoli la cui
sorgente sta già su uno degli host configurati, perché altrimenti un pool creato
per un titolo dirotterebbe tutti gli altri. Su Safari con HLS nativo il cambio
ricarica la sorgente: posizione e stato di play sono preservati, ma c'è una breve
interruzione. Il "ping" mostrato è il time-to-first-byte HTTP, non un ping ICMP,
che dal browser non esiste; "SSL valido" significa solo che l'handshake TLS è
riuscito.
