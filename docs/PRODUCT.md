# CineMate — specifica di prodotto

Documento di lavoro: cosa costruiamo, in che ordine, e perché.
Ogni voce dichiara **problema → beneficio → priorità** (Essenziale / Utile / Futura).

---

## 1. Cos'è CineMate

Un **compagno di visione personale**: tiene il diario di cosa hai visto, ti dice
cosa guardare stasera e **dove guardarlo legalmente** fra i servizi a cui sei
già abbonato.

Non è un client di streaming: non ospita, non indicizza e non cerca file video.
Per i titoli sotto licenza la riproduzione avviene dove la licenza sta — Netflix,
Prime Video, Disney+, RaiPlay, Sky, cinema — e CineMate ti ci porta con un tocco.
Per una sorgente che è già tua (§3.6) c'è un player interno, che riproduce solo
gli indirizzi che le dai titolo per titolo.

### Perché questo posizionamento è più forte, non più debole

| | App pirata | CineMate |
|---|---|---|
| Sopravvivenza | Muore a ogni oscuramento AGCOM | Non ha nulla da oscurare |
| Qualità video | Quella che capita | 4K/HDR/Atmos del servizio ufficiale |
| Continuità | Riparte da zero a ogni cambio dominio | Il diario è tuo, esportabile |
| Sul telefono | APK da sideloadare | Link normale, icona sulla Home |

---

## 2. Confronto con i migliori, e cosa prendiamo

| App | Il punto forte da rubare | Il difetto da evitare |
|---|---|---|
| **Netflix** | "Continua a guardare" come prima riga assoluta | Righe infinite senza gerarchia; non sai mai *perché* ti consiglia una cosa |
| **Spotify** | Wrapped: i tuoi dati diventano un racconto | Home ormai illeggibile, tutto è un carosello |
| **YouTube** | Ripresa esatta al secondo su ogni dispositivo | Ottimizzata per trattenerti, non per farti scegliere |
| **Plex** | Il tuo archivio, tuo davvero | Onboarding da sistemista |
| **IMDb** | Profondità dei dati | UI densa, piena di pubblicità |
| **Letterboxd** | Il diario come oggetto affettivo; le liste | Lento su mobile, niente "dove guardarlo" |
| **JustWatch** | Disponibilità per servizio e per Paese | Nessuna memoria di chi sei |
| **Stremio** | Un'unica riga di ricerca per tutto | Ecosistema di addon che spinge alla pirateria |

**La sintesi che nessuno fa oggi:** il diario affettivo di Letterboxd + il
"dove guardarlo" di JustWatch + il racconto annuale di Spotify, in un'app che
resta tua e non ti vende niente.

---

## 3. Funzionalità

### 3.1 Home — Essenziale

| Sezione | Problema che risolve | Beneficio | Priorità |
|---|---|---|---|
| **Riprendi** | "A che episodio ero?" | Un tocco per ripartire, con progresso | Essenziale |
| **Il Nastro** | I dati personali sono tabelle morte | La tua visione come oggetto visivo | Essenziale ✅ |
| **Cosa guardo stasera** | Paralisi da scelta davanti a 200 titoli | Una proposta sola, rilanciabile | Essenziale ✅ |
| **In arrivo** | Perdi le uscite delle serie che segui | Conto alla rovescia per episodio | Essenziale ✅ |
| **Continua la saga** | Ti fermi al capitolo tre e non riparti | Il prossimo capitolo, già scelto | Essenziale ✅ |
| **Maratona in corso** | Una saga guardata in tre settimane sembra tre cose | Una sola corsa, con il segnalibro | Utile ✅ |
| **Per te** | I consigli generici non ti somigliano | Suggerimenti dal *tuo* storico, con motivazione | Utile |
| **Tendenze / Più votati / Nuove uscite** | Scoperta oltre la propria bolla | Cataloghi TMDB curati | Utile ✅ |
| **In uscita al cinema** | Scopri i film quando sono già usciti | Anticipo sulle uscite | Utile ✅ |
| **Collezioni** | Le saghe si perdono in ordine sparso | "Il Padrino 1‑2‑3" come un blocco | Utile ✅ |
| **Liste personali** | Watchlist unica troppo grezza | "Da vedere col partner", "Horror di ottobre" | Utile |

> **Regola anti‑Netflix:** massimo 6 righe in Home. Ogni riga deve dichiarare
> *perché* è lì ("Perché hai messo 9 a Dark"). Niente caroselli senza motivo.

### 3.2 Ricerca — Essenziale

| Funzione | Problema | Beneficio | Priorità |
|---|---|---|---|
| Ricerca istantanea | Aspettare i risultati | Filtra mentre digiti | Essenziale ✅ |
| Per titolo/regista/genere/attore | Ricordi l'attore, non il titolo | Trovi da qualsiasi appiglio | Essenziale ✅ |
| **Risultati raggruppati** | "nolan" è insieme un uomo e sei film | Titoli, saghe e persone come decisioni separate, non una zuppa ordinata | Essenziale ✅ |
| Filtri (tipo, stato, voto, anno, piattaforma) | 500 titoli, ne cerchi uno | Restringi in due tocchi | Essenziale |
| **Ricerca in linguaggio naturale** | "Fantascienza anni '90 sotto le 2 ore" non è una query | L'IA la traduce in filtri TMDB | Utile |
| Cronologia + correzione errori | Ripetere ricerche, typo | Meno attrito | Utile |
| Ricerca vocale | Mani occupate, mobile | Web Speech API, zero costi | Utile |
| Ricerca per immagine | Locandina fotografata | Riconoscimento visivo | **Futura** — costo alto, uso raro |

### 3.3 Dove guardarlo — Essenziale *(sostituisce il Link Host)*

| Funzione | Problema | Beneficio | Priorità |
|---|---|---|---|
| Provider legali per l'Italia | "Ce l'ho su Netflix o devo noleggiarlo?" | Risposta immediata, dati JustWatch | Essenziale ✅ |
| **Apri sul servizio** | Cercare di nuovo dentro l'app del servizio | Deep link diretto al titolo | Essenziale |
| **I miei abbonamenti** | Ti propongono cose che non puoi vedere | Filtro "solo ciò che ho già" | Utile |
| Avviso "in scadenza" | I titoli lasciano i cataloghi in silenzio | "Esce da Netflix il 30" | Utile |
| Link personali (2 per titolo) | Vuoi salvare un tuo riferimento | Segnalibri liberi | Essenziale ✅ |

### 3.4 Saghe, universi e ordine di visione — Essenziale

Il pezzo che nessun tracker fa bene e nessuna piattaforma fa affatto: una saga è
un oggetto solo, con un ordine e un avanzamento suoi.

| Funzione | Problema | Beneficio | Priorità |
|---|---|---|---|
| **Saghe automatiche** | Sei capitoli sparsi in una lista alfabetica | Le collezioni TMDB diventano un blocco con copertina, elenco numerato e % di completamento | Essenziale ✅ |
| **Ordine di uscita** | — | Il dato che TMDB già conosce | Essenziale ✅ |
| **Ordine cronologico** | Tokyo Drift è il terzo uscito e il sesto della storia | Claude lo calcola una volta per saga e resta salvato | Utile ✅ |
| **Ordine consigliato** | "Da dove comincio?" non ha una risposta ovvia | L'ordine migliore alla prima visione, con una riga che spiega la differenza | Utile ✅ |
| **Guarda tutta la saga** | Una saga si abbandona al capitolo tre | Coda con segnalibro persistente, riprende da dove sei | Utile ✅ |
| **Continua la storia** | Finisci un film e la scelta ricomincia da zero | Il capitolo successivo proposto subito | Essenziale ✅ |
| **Universi + timeline** | MCU e Wizarding World non sono una collezione sola | Costruiti dalle keyword TMDB, visibili come linea temporale | Utile ✅ |

**Perché le keyword e non una lista di id.** Un universo non esiste come entità
su TMDB: quello che tiene insieme i film è una keyword condivisa. Risolverla a
runtime evita di spedire una lista di id che invecchia alla prossima uscita, e un
universo la cui keyword non risponde più viene nascosto invece che mostrato monco.

**Perché l'ordine cronologico lo chiede a Claude.** L'ordine di uscita è un fatto
in catalogo; l'ordine della storia è un giudizio editoriale che nessun catalogo
contiene. Chiederlo una volta e salvarlo è più onesto — e più aggiornabile — che
codificare a mano una tabella di saghe famose.

### 3.5 Persone — Utile ✅

Attori e registi sono destinazioni, non didascalie: ogni nome nella scheda di un
titolo apre la sua pagina, con la filmografia da TMDB e in evidenza ciò che hai
già in libreria. Senza chiave TMDB la pagina mostra comunque cosa quella persona
ha fatto sul *tuo* scaffale, che è il motivo per cui hai toccato il nome.

I **personaggi** restano fuori: TMDB non ha un indice dei personaggi su cui
cercare, solo il ruolo dentro ai crediti di ogni titolo.

### 3.6 Player — solo sorgenti tue ✅

Decisione rivista. Prima questa sezione diceva "solo trailer" e rimandava tutto
il resto al servizio che ha la licenza. Resta vero che **CineMate non ospita e
non cerca file video** — quella è la riga che non si tocca, ed è quella che tiene
in piedi il §2 e la regola 5. Ma "non cercare video" e "non saper riprodurre un
indirizzo che l'utente ha già" sono due cose diverse, e confonderle costava una
funzione senza comprare niente in cambio.

| Funzione | Problema | Beneficio | Priorità |
|---|---|---|---|
| **Player HLS** | Hai una sorgente tua (un NAS, un tuo CDN) e ti serve un lettore | Qualità adattiva, selezione manuale, ripresa al secondo, velocità, PiP, mini player, schermo intero | Utile ✅ |
| **Sottotitoli** | I sottotitoli nativi non si possono davvero impostare | Renderer proprio: dimensione, colore, sfondo, posizione, sincronizzazione | Utile ✅ |
| **Salto intro/recap/crediti** | Riavvolgere a mano ogni episodio | Marker segnati dal punto in cui sei, con un tocco | Utile ✅ |
| **Anteprime sulla timeline** | Cercare una scena al buio | Il fotogramma del punto, non solo il minutaggio | Utile ✅ |
| **Autoplay nell'ordine della saga** | Il "prossimo" contraddice l'ordine che hai scelto | Stessa coda della pagina Saghe, §3.4 | Utile ✅ |
| **Consigli di fine visione** | Finisce un film e la scelta ricomincia da zero | Presi dal *tuo* scaffale, ognuno con il suo perché (regola 2) | Utile ✅ |
| **Chromecast / AirPlay** | Guardare dal telefono su un televisore | Passaggio di dispositivo dal secondo esatto | Utile ✅ |
| **Watch Party** | Guardare assieme a distanza | Stanza, play/pausa sincronizzati, chat, reazioni | Utile ✅ (fra dispositivi serve un relay tuo) |
| **Download offline** | Guardare senza rete | Segmenti letti dalla playlist e salvati su IndexedDB, riproducibili offline. Nessun backend | Utile ✅ |
| **Failover fra host mirror** | Una sola origine cade e la visione si interrompe | Cambio host senza interrompere la riproduzione | Utile ✅ |
| **Maratona della saga** | — | La stessa maratona del §3.4, non una seconda coda che vuol dire un'altra cosa: copre la saga di ciò che stai guardando e sparisce per un titolo standalone | Utile ✅ |
| **Il diario si aggiorna da sé** | Guardi qui e la libreria non se ne accorge | Finito un titolo diventa "Visto", con voce nel diario e traguardi | Essenziale ✅ |
| **Catalogo, ricerca di file, addon, scraper** | — | — | **Fuori perimetro**, e resta tale |

**Il vincolo che rende questo diverso da un client pirata.** Il player non ha
catalogo e non sa cercare: le sorgenti si incollano a mano, una per titolo, nel
pannello Sorgenti o fra i *link personali* (§3.3). Un titolo senza sorgente non è
riproducibile e non compare nella pagina. Non c'è nessun elenco di host da cui
pescare, nessun indice, nessun addon: il perimetro è fatto valere dal fatto che
l'unica via d'ingresso è un indirizzo che l'utente già possiede.

**Perché la configurazione per titolo sta nel player e non nell'`Item`.** Il
record di libreria è quello che esporta/importa gira e che ogni pagina legge, e a
nessuna di quelle serve sapere dove sta un file `.vtt`. Sorgenti, marker e sprite
vivono in uno store separato (`usePlayerSources`): la libreria resta quello che
era anche per chi non usa mai il player.

**Perché uno solo player e non "il player del servizio".** Per Netflix, Prime e
Disney+ vale ancora esattamente quanto diceva la versione precedente di questa
sezione: hanno il loro, con la licenza, e meglio. Questo player non è per loro —
è per il caso che quelli non coprono, cioè una sorgente che è già tua.

### 3.7 Profilo, dati, IA

| Funzione | Problema | Beneficio | Priorità |
|---|---|---|---|
| Diario cronologico | "Quando l'ho visto?" | Storia consultabile | Essenziale ✅ |
| Statistiche + anno in rassegna | I numeri non raccontano | Il tuo anno come storia, anno per anno | Essenziale ✅ |
| Attori e registi più visti | "Chi guardo davvero?" | Classifica dal tuo storico, ogni nome apre la sua pagina | Utile ✅ |
| Traguardi | Nessun ritorno emotivo | Riconoscimento delle abitudini, saghe e generi inclusi | Utile ✅ |
| **Promemoria uscite** | Un episodio esce e non lo sai | Notifica locale il giorno stesso | Utile ✅ |
| Esporta / importa | I dati locali si perdono | Backup e cambio dispositivo, comprese le sorgenti del player e gli host | Essenziale ✅ |
| **Riassunto senza spoiler** | Riprendi una serie dopo 8 mesi | "Dove eravamo" senza rovinare nulla | Utile |
| Assistente / critico | Consigli generici | Conosce i tuoi voti | Essenziale ✅ |
| Sync cloud multi‑dispositivo | Telefono e PC separati | Una libreria sola | **Futura** — richiede backend e account |

### 3.8 Download

**Metadati e copertine** per la consultazione offline: la libreria resta
sfogliabile in aereo. → Utile.

Per i titoli con una sorgente propria c'è anche il download del video, dentro il
player (§3.6): coda, pausa/ripresa, gestione dello spazio, riproduzione offline e
— se lo accendi — eliminazione automatica dopo la visione. Per i contenuti sotto
licenza resta valido quanto detto prima: lo offrono già le app dei servizi.

L'eliminazione automatica è **spenta di default** e guarda *quando* hai finito il
titolo, non solo *se*: la visione è registrata per titolo, non per download, così
"visto" da solo comprende anche un film finito l'anno scorso e scaricato adesso —
che è esattamente il caso in cui cancellare sarebbe sbagliato.

---

## 4. Design system

Identità **"Velluto e Technicolor"** (già in produzione).

- **Base**: aubergine da velluto di poltrona `#1B1221` — scuro ma cromatico
- **Coloranti Technicolor**: magenta `#FF4D9E`, ciano `#3FD3E8`, giallo `#FFC24D`
- **Voti**: freddo → caldo, non semaforo rosso/verde
- **Tipografia**: Bricolage Grotesque (display) · Instrument Sans (testo) · IBM Plex Mono (**ogni cifra**)
- **Firma**: Il Nastro — una sessione, un filo; tinta dal voto, larghezza dai minuti

**Movimento:** un solo momento curato (il Nastro che si srotola). Niente
micro‑animazioni ovunque: rispetto di `prefers-reduced-motion` sempre.

**Vetro e sfocatura:** solo dove separano davvero due piani (barre fisse,
fogli modali). Mai come decorazione.

**Accessibilità:** ogni coppia testo/sfondo ≥ WCAG AA, verificata da script —
oggi 168 coppie, zero fallimenti. Focus ring visibile, navigazione da tastiera,
`aria-label` su ogni controllo.

Il player ha una **palette propria** (§3.6) e quindi coppie proprie, tenute allo
stesso standard: il rosso di errore è sdoppiato in `--pv-accent-2` per bordi e
riempimenti e `--pv-accent-2-text` per ciò che si legge, perché il primo si ferma
a 3.41:1 — abbastanza per un bordo, non per del testo. Vale anche il resto della
regola: comandi da tastiera completi (spazio, frecce, `m`, `f`, `c`), `Esc` e
focus trap sul menu impostazioni come su ogni altro foglio, e la barra di
avanzamento esposta come `slider` con la posizione leggibile.

---

## 5. Architettura

```
src/
  components/     UI riusabile (Nastro, PosterArt, sheet, saghe, timeline,
                  maratona, prossimo capitolo, persone)
  pages/          Home · Libreria · Saghe · Scopri · Dati · Critico · Player
  store/          Zustand: libreria, saghe, maratona, promemoria, impostazioni, UI
  lib/            tmdb · sagas · universes · upcoming · anthropic · backup ·
                  search · stats · achievements · notify
  player/         modulo autonomo: hooks · services · components · styles
docs/             questa specifica
```

**Scelte e motivo**

- **Client‑only, dati in `localStorage`** — nessun server significa nessuna
  raccolta dati, nessun costo, nessun account. Il prezzo è la sincronizzazione,
  risolta per ora con esporta/importa.
- **Chiavi API personali dell'utente**, salvate solo sul dispositivo.
- **TMDB** come unica fonte di catalogo (+ JustWatch per la disponibilità).
- **Zustand** invece di Redux: lo stato è piccolo, la cerimonia non serve.
- **Cache**: i dati TMDB per titolo cambiano di rado → cache in memoria con TTL
  (6h per le date di uscita) e nessuna richiesta ripetuta a ogni render. Saghe e
  universi vanno oltre e si salvano su `localStorage` (7 giorni per gli universi,
  senza scadenza per le collezioni), così la pagina Saghe funziona anche senza
  rete e senza chiave: la chiave serve a *scoprire* saghe nuove, non a leggere lo
  scaffale. Le sinossi dei singoli capitoli non entrano nella cache — non sono
  mai mostrate e occuperebbero spazio che serve alla libreria.
- **Il player è un modulo separato** (`src/player/`) con tipi propri e chiavi
  `localStorage` proprie (prefisso `ppv:`): non scrive nella libreria né nel
  diario, e l'unico punto di contatto è `fromLibrary.ts`, che traduce un titolo
  in contenuto riproducibile. Così una funzione grossa e opzionale non si
  intreccia con il cuore dell'app, e la sua palette scura non contamina il tema.
  Corollario pratico: `hls.js` da solo pesa più di tutto il resto dell'app, per
  cui la rotta è a caricamento differito e l'avvio di chi non apre il player
  resta identico a prima.
- **Due passate di sincronizzazione**, entrambe in background e una alla volta:
  la prima collega i titoli a TMDB, la seconda chiede a quale collezione
  appartiene ogni film e scarica la collezione una volta sola. Un film che
  risulta standalone viene scritto come `collectionId: null`, ed è questo che
  impedisce di richiederlo per sempre.

**Se un giorno servisse il multi‑dispositivo:** Supabase con Row Level Security,
un record per utente, sincronizzazione a livello di evento del diario (non di
libreria intera) per evitare conflitti.

---

## 6. Roadmap

**Fatto** ✅ — libreria, diario, traguardi, anno in rassegna, Nastro, roulette,
in arrivo, copertine e dati TMDB automatici, provider legali, esporta/importa,
identità visiva, pubblicazione web installabile, pagina **Scopri**, **saghe e
collezioni** con i tre ordini di visione, **maratona**, **continua la storia**,
**universi e timeline**, **pagine di attori e registi**, **calendario
Prossimamente** con promemoria, **ricerca raggruppata**, statistiche su attori e
registi, badge di saga e di genere, **player per le sorgenti proprie** (§3.6).

**Prossimo (Essenziale)**
1. **Apri sul servizio**: deep link diretto a Netflix/Prime/Disney+
2. **Filtri avanzati** in ricerca

**Poi (Utile)**
3. Ricerca in linguaggio naturale (IA → filtri TMDB)
4. Liste personali ("Da vedere col partner", "Horror di ottobre")
5. Riassunto senza spoiler + "dove eravamo"
6. Trailer in‑app con PiP
7. Consigli "Per te" con motivazione esplicita
8. Universi costruiti a mano dall'utente, oltre a quelli da keyword

**Futuro**
9. Sync cloud con account
10. Ricerca per immagine

---

## 6-bis. Fuori perimetro, e perché

Richieste ricorrenti che restano deliberatamente fuori. Non sono "non fatte":
sono decise.

| Richiesta | Perché no |
|---|---|
| **Catalogo di contenuti, ricerca di file video, addon/scraper di host** | È la riga che separa questa app da quelle che muoiono a ogni oscuramento. Il player di §3.6 esiste, ma non sa cercare niente: l'unico ingresso è un indirizzo che l'utente incolla nei link personali di un titolo |
| Sottotitoli scaricati automaticamente da archivi online | Stessa ragione: sarebbe un indice di contenuti di terzi. I `.vtt` si passano a mano, come le sorgenti |
| Account, profili multipli con PIN, sync fra dispositivi, logout remoto | Presuppongono un backend. Oggi non c'è server, quindi non c'è raccolta dati, nessun costo e nessun account: il prezzo è la sincronizzazione, risolta con esporta/importa. Vedi §5 per come si farebbe se servisse |
| Recensioni pubbliche, follow, classifiche fra utenti | Stessa ragione: richiedono un servizio condiviso. Il diario resta privato per scelta |
| Ricerca per personaggio | TMDB non espone un indice dei personaggi: esistono solo come ruolo dentro ai crediti di un titolo |

---

## 7. Regole di prodotto

1. **Nessuna funzione perché va di moda.** Se non risolve un problema reale,
   finisce in "Futura" o non esiste.
2. **Ogni consiglio dichiara il perché.** Un suggerimento senza motivazione è
   pubblicità.
3. **Niente pattern che trattengono.** L'app deve farti *scegliere in fretta*,
   non farti restare.
4. **I dati sono dell'utente.** Esportabili in un file leggibile, sempre.
5. **Solo fonti legali.** Non per prudenza: perché è ciò che rende l'app
   duratura e di qualità superiore. Il player (§3.6) non è un'eccezione a questa
   regola: non procura sorgenti, le riproduce. Quello che ci metti dentro è tua
   responsabilità, esattamente come per un lettore installato sul computer.
