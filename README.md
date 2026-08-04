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
- **Tailwind CSS v4** — design tokens "Cinema Noir" custom in `src/index.css`
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
```

## Struttura

```
src/
  components/   componenti UI (poster, sheet, saghe, maratona, timeline, nav…)
  pages/        Home, Libreria, Saghe, Scopri, Dati, Profilo, Critico, Player,
                Diagnostica
  store/        stato Zustand (libreria, saghe, maratona, promemoria,
                obiettivi, layout della Home, punto di ripresa, controllo
                genitori, tema, UI)
  lib/          dominio e utility (tmdb, sagas, universes, upcoming, stats,
                activity, continueWatching, achievements, search, filters,
                recommend, goals, parental, accents, share, anthropic, backup,
                errorLog, selfTest)
  player/       il player, autonomo dal resto dell'app:
                  hooks/      motore video (hls.js), gesture, sottotitoli,
                              maratona, download, watch party, cast,
                              host monitor
                  services/   download su IndexedDB, lettura delle playlist HLS,
                              cronologia e statistiche, trasporto realtime,
                              salute, velocità e storico degli host
                  components/ shell del player, controlli, timeline, overlay,
                              impostazioni, pannelli download/party/host
                  styles/     player.css — palette propria, tutta sotto .pv-app
                  ── strato di collegamento con CineMate ──
                  fromLibrary.ts        da titolo della libreria a contenuto
                                        riproducibile, nell'ordine della saga
                  recommendFromLibrary.ts  consigli di fine visione dallo scaffale
                  SourcePanel.tsx       configurazione per titolo (stream,
                                        sottotitoli, marker, anteprime)
                  resolveSource.ts      quale indirizzo usare, provandoli in ordine
                  clock.ts              minutaggi mm:ss
```

Il player è un modulo a sé: usa i propri tipi (`src/player/types.ts`) e le
proprie chiavi `localStorage` (prefisso `ppv:`) per cronologia e statistiche
interne. I file dello strato di collegamento sono i soli che conoscono gli store
di CineMate; `player/components/` e `player/hooks/` non ne sanno nulla — l'unica
eccezione è `useFocusTrap`, che è un'utility generica per i modali usata da tutti
i fogli dell'app e che riscrivere qui sarebbe peggio che condividere.

Gli store lato CineMate sono `usePlayerSources` (le sorgenti per titolo) e
`usePlayerPrefs` (modelli di indirizzo, risparmio dati, relay della Watch Party,
nome nella stanza); i modelli si compilano in `lib/sourceTemplate.ts`.
Entrambi, più la lista degli host, finiscono nell'**esporta/importa**: sono dati
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
- **Continua a guardare**: la riga in cima alla Home tiene da parte tutto quello
  che hai lasciato a metà, dal più recente. Ogni scheda dice a che percentuale
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
- **Dettagli prima di salvare**: tocca un risultato e vedi trama, regia, cast,
  durata, voto TMDB e dove guardarlo — senza doverlo prima aggiungere alla
  libreria. Aggiungerlo resta un secondo passo, se lo vuoi.
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
personale, poi gli indirizzi delle Impostazioni e gli host, e come ultima cosa
l'indice delle cartelle di quegli stessi indirizzi.

Quello che non fa, in nessuno di questi passaggi: cercare il titolo altrove. Ogni
indirizzo provato sta su un server che hai indicato tu.

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
