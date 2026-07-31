# CineMate — specifica di prodotto

Documento di lavoro: cosa costruiamo, in che ordine, e perché.
Ogni voce dichiara **problema → beneficio → priorità** (Essenziale / Utile / Futura).

---

## 1. Cos'è CineMate

Un **compagno di visione personale**: tiene il diario di cosa hai visto, ti dice
cosa guardare stasera e **dove guardarlo legalmente** fra i servizi a cui sei
già abbonato.

Per i titoli sotto licenza ti porta con un tocco dove la licenza sta — Netflix,
Prime Video, Disney+, RaiPlay, Sky, cinema. Per le tue sorgenti c'è un player
interno (§3.6).

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
| **Per te** | I consigli generici non ti somigliano | Suggerimenti dal *tuo* storico, con motivazione | Utile ✅ |
| **Tendenze / Più votati / Nuove uscite** | Scoperta oltre la propria bolla | Cataloghi TMDB curati | Utile ✅ |
| **In uscita al cinema** | Scopri i film quando sono già usciti | Anticipo sulle uscite | Utile ✅ |
| **Collezioni** | Le saghe si perdono in ordine sparso | "Il Padrino 1‑2‑3" come un blocco | Utile ✅ |
| **Più visti / Ultimi aggiunti** | "Dove sono finite le mie ore?" e "cos'è entrato ieri?" | Due domande diverse, due righe | Utile ✅ |
| **Home su misura** | Sei righe fisse non sono le stesse per tutti | Riordini e spegni le righe in Impostazioni; il tetto di sei resta | Utile ✅ |
| **Liste personali** | Watchlist unica troppo grezza | "Da vedere col partner", "Horror di ottobre" | Utile |

> **Regola anti‑Netflix:** massimo 6 righe in Home. Ogni riga deve dichiarare
> *perché* è lì ("Perché hai messo 9 a Dark"). Niente caroselli senza motivo.

### 3.2 Ricerca — Essenziale

| Funzione | Problema | Beneficio | Priorità |
|---|---|---|---|
| Ricerca istantanea | Aspettare i risultati | Filtra mentre digiti | Essenziale ✅ |
| Per titolo/regista/genere/attore | Ricordi l'attore, non il titolo | Trovi da qualsiasi appiglio | Essenziale ✅ |
| **Risultati raggruppati** | "nolan" è insieme un uomo e sei film | Titoli, saghe e persone come decisioni separate, non una zuppa ordinata | Essenziale ✅ |
| Filtri avanzati (tipo, stato, genere, studio, paese, audio, qualità, durata, anno, voto tuo e TMDB, sottotitoli) | 500 titoli, ne cerchi uno | Restringi in due tocchi, con le opzioni prese dal *tuo* scaffale | Essenziale ✅ |
| **Ricerca in linguaggio naturale** | "Fantascienza anni '90 sotto le 2 ore" non è una query | Claude la traduce in filtri, TMDB risponde | Utile ✅ |
| **Correzione errori di battitura** | Una lettera sbagliata e non trovi niente | Trova lo stesso, e propone il titolo giusto | Utile ✅ |
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

### 3.6 Player ✅

Decisione rivista: prima questa sezione diceva "solo trailer" e rimandava tutto
il resto al servizio che ha la licenza.

| Funzione | Problema | Beneficio | Priorità |
|---|---|---|---|
| **Player HLS** | Hai una sorgente tua (un NAS, un tuo CDN) e ti serve un lettore | Qualità adattiva, selezione manuale, ripresa al secondo, velocità, PiP, mini player, schermo intero | Utile ✅ |
| **Sottotitoli** | I sottotitoli nativi non si possono davvero impostare | Renderer proprio: dimensione, colore, sfondo, posizione, sincronizzazione | Utile ✅ |
| **Salto intro/recap/crediti** | Riavvolgere a mano ogni episodio | Marker segnati dal punto in cui sei, con un tocco | Utile ✅ |
| **Anteprime sulla timeline** | Cercare una scena al buio | Il fotogramma del punto, non solo il minutaggio | Utile ✅ |
| **Autoplay nell'ordine della saga** | Il "prossimo" contraddice l'ordine che hai scelto | Stessa coda della pagina Saghe, §3.4 | Utile ✅ |
| **Consigli di fine visione** | Finisce un film e la scelta ricomincia da zero | Presi dal *tuo* scaffale, ognuno con il suo perché (regola 2) | Utile ✅ |
| **Gesture** | Sul telefono i controlli sono più piccoli del dito | Scorri per avanzare, alza e abbassa volume e luminosità, doppio tocco per ±10s | Utile ✅ |
| **Buffer intelligente** | Un buffer fisso è sbagliato in entrambe le direzioni | Si dimensiona sulla rete misurata: rete debole, buffer *più* grande | Utile ✅ |
| **Chromecast / AirPlay** | Guardare dal telefono su un televisore | Passaggio di dispositivo dal secondo esatto | Utile ✅ |
| **Watch Party** | Guardare assieme a distanza | Stanza, play/pausa sincronizzati, chat, reazioni | Utile ✅ (fra dispositivi serve un relay tuo) |
| **Download offline** | Guardare senza rete | Segmenti letti dalla playlist e salvati su IndexedDB, riproducibili offline. Nessun backend | Utile ✅ |
| **Host** | Aggiungere un host non serviva a niente per guardare | Un host è un indirizzo dove cercare i titoli, come le caselle in Impostazioni; e resta il cambio host senza interrompere la riproduzione quando un mirror cade | Utile ✅ |
| **Host: velocità, priorità automatica, bilanciamento** | Con più mirror, "quale uso?" non ha una risposta a mano | Test di banda vero, punteggio 0–100, e tre modi di scegliere: ordine tuo, punteggio, o carico distribuito | Utile ✅ |
| **Maratona della saga** | — | La stessa maratona del §3.4, non una seconda coda che vuol dire un'altra cosa: copre la saga di ciò che stai guardando e sparisce per un titolo standalone | Utile ✅ |
| **Il diario si aggiorna da sé** | Guardi qui e la libreria non se ne accorge | Finito un titolo diventa "Visto", con voce nel diario e traguardi | Essenziale ✅ |

**Come arriva una sorgente.** L'indirizzo del tuo server, scritto una volta sola
in Impostazioni (tre caselle) o aggiunto come host nel pannello Host: sono la
stessa cosa e vengono provati nello stesso ordine, prima le caselle e poi gli
host per priorità. In alternativa un indirizzo per il singolo titolo (pannello
Sorgenti, o fra i *link personali* del §3.3), che ha sempre la precedenza.

**Trovare il file senza saperlo a memoria.** Un indirizzo può essere scritto con
un segnaposto al posto del titolo (`https://mio-server/film/{slug}.m3u8`) e
allora è esatto. Ma può anche essere l'indirizzo nudo del server, e questo è il
caso normale: chiedere un modello significa chiedere all'utente come si chiamano
i file sul *suo* server, che è la cosa che nessuno ricorda. Da un indirizzo nudo
il player costruisce i percorsi soliti per quel titolo — `/il-padrino.m3u8`,
`/film/il-padrino/index.m3u8`, `/breaking-bad/s01e04.m3u8` — e li prova a gruppi
finché uno risponde; se non risponde nessuno legge l'indice della cartella e
prende il file il cui nome corrisponde al titolo (`Il.Padrino.1972.1080p.m3u8`).
Il perimetro non cambia: si guarda solo dentro un host che hai indicato tu, e
non si interroga nessun catalogo.

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
| **Obiettivi personali** | I traguardi li decide l'app | Quelli che scegli tu, misurati sul diario e non sullo scaffale | Utile ✅ |
| **Promemoria uscite** | Un episodio esce e non lo sai | Notifica locale il giorno stesso | Utile ✅ |
| Esporta / importa | I dati locali si perdono | Backup e cambio dispositivo, comprese le sorgenti del player e gli host | Essenziale ✅ |
| **Riassunto senza spoiler** | Riprendi una serie dopo 8 mesi | "Dove eravamo" senza rovinare nulla | Utile ✅ |
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

### 3.9 Condivisione, controllo genitori, diagnostica — Utile ✅

| Funzione | Problema | Beneficio | Priorità |
|---|---|---|---|
| **Condividi un titolo o una lista** | "Guarda questo" finisce in un messaggio che nessuno ritrova | Un link che apre il titolo, o la lista che hai davanti — filtri e ricerca compresi | Utile ✅ |
| **Codice QR** | Il telefono in mano e il televisore dall'altra parte della stanza non si passano un indirizzo | Inquadri e si apre | Utile ✅ |
| **Controllo genitori** | Uno scaffale è di chi lo tiene, non di chi lo apre | Filtro per età sulla classificazione reale, con PIN | Utile ✅ |
| **Diagnostica** | Senza telemetria, un guasto non lascia traccia | Test, salute degli host e log errori, tutto sul dispositivo | Utile ✅ |

**Perché il link *è* la lista.** Non c'è un server dove depositarla, quindi tutto
quello che serve viaggia dentro il frammento dell'indirizzo — la sola parte che
il browser non manda mai a nessuno. Il prezzo è un tetto: oltre un certo numero
di titoli il link non sta più in un codice QR, e il foglio lo dice invece di
generarne uno che non si legge. Niente si aggiunge da solo: un link che ti
scrivesse venti titoli in libreria sarebbe uno sconosciuto che ti modifica il
diario.

**Perché i non classificati sono nascosti di default.** Un titolo che TMDB non ha
classificato non è un titolo sicuro: è un titolo di cui non si sa nulla.
Mostrarli è esattamente il buco che rende inutile un filtro del genere. Sui
limiti veri del PIN, vedi §6-bis.

**Perché la diagnostica esiste.** L'app non raccoglie niente e non manda niente
da nessuna parte, il che significa che un errore normalmente sparisce con il
messaggio che l'ha annunciato. Il log è un anello di dimensione fissa: illimitato
finirebbe per mangiarsi la stessa quota dove vive la libreria, che è la cosa che
vale la pena tenere.

### 3.10 Prestazioni e batteria — Utile ✅

- **Immagini alla misura giusta.** TMDB ricodifica ogni larghezza a parte, quindi
  un `srcset` non è la stessa immagine rimpicciolita dal browser: una copertina
  da 96px su uno schermo 1× scarica ~6 KB invece dei ~40 KB di prima.
- **Precaricamento all'intenzione.** Il chunk del player parte quando il
  puntatore arriva sul link, non quando l'app è ferma: scaricare 600 KB "per
  ogni evenienza" è precisamente ciò che svuota la batteria in mobilità.
- **Sonno in secondo piano.** I controlli periodici si fermano a pagina nascosta
  e ripartono al ritorno. Su un telefono l'app è quasi sempre nascosta e quasi
  mai chiusa, quindi "nessuno sta guardando" è lo stato normale.

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
                  maratona, prossimo capitolo, persone, filtri, condivisione,
                  QR, obiettivi, controllo genitori)
  pages/          Home · Libreria · Saghe · Scopri · Dati · Critico · Player ·
                  Diagnostica
  store/          Zustand: libreria, saghe, maratona, promemoria, obiettivi,
                  layout della Home, controllo genitori, impostazioni, UI
  lib/            tmdb · sagas · universes · upcoming · anthropic · backup ·
                  search · filters · recommend · goals · parental · accents ·
                  share · stats · achievements · notify · errorLog · selfTest
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
- **Un solo punto per il filtro genitori.** Ogni superficie di navigazione legge
  `useVisibleItems`, non la libreria grezza. Statistiche, diario ed
  esporta/importa restano volutamente sulla lista intera: un export filtrato
  toglierebbe metà libreria dal file, che è una perdita di dati travestita da
  controllo genitori.
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
registi, badge di saga e di genere, **player per le sorgenti proprie** (§3.6),
**filtri avanzati** (studio, paese, audio, qualità, durata, voti), **correzione
degli errori di battitura**, **ricerca in linguaggio naturale**, **riassunto
senza spoiler**, **traduzione della sinossi**, righe **Per te / Più visti /
Ultimi aggiunti / Simili sul tuo scaffale**, **obiettivi personali**, **tinte
d'accento e Home riordinabile**, **condivisione di liste e codice QR**,
**controllo genitori**, **diagnostica con test e log errori**, e nel player
**gesture**, **buffer adattivo** e **host con test velocità, priorità
automatica e bilanciamento**.

**Prossimo (Essenziale)**
1. **Apri sul servizio**: deep link diretto a Netflix/Prime/Disney+

**Poi (Utile)**
2. Liste personali salvate ("Da vedere col partner", "Horror di ottobre") —
   oggi una lista si condivide ma non si conserva
3. Trailer in‑app con PiP
4. Universi costruiti a mano dall'utente, oltre a quelli da keyword

**Futuro**
5. Sync cloud con account
6. Ricerca per immagine

---

## 6-bis. Fuori perimetro, e perché

Richieste ricorrenti che restano deliberatamente fuori. Non sono "non fatte":
sono decise.

| Richiesta | Perché no |
|---|---|
| Account, profili multipli, sync fra dispositivi, logout remoto | Presuppongono un backend. Oggi non c'è server, quindi non c'è raccolta dati, nessun costo e nessun account: il prezzo è la sincronizzazione, risolta con esporta/importa — e, per un titolo o una lista, con un link o un codice QR (§3.9). Vedi §5 per come si farebbe se servisse |
| **Controllo genitori a prova di ragazzino** | Il filtro per età c'è (§3.9) e fa il suo lavoro, ma vive in `localStorage` sul dispositivo che il ragazzino ha in mano: chi sa aprire gli strumenti per sviluppatori lo azzera. Il PIN è salato e hashato, quindi non è *leggibile*, ma è una serratura da armadietto. Renderla una cassaforte è la stessa richiesta della riga sopra: serve un account e un server |
| **Scorciatoie Siri, app per Apple Watch, luminosità dello schermo** | Non sono decisioni di prodotto, sono confini della piattaforma. CineMate è una pagina web installabile: Siri e watchOS richiedono un'app nativa firmata e distribuita sull'App Store, e nessuna API del browser tocca la retroilluminazione (una pagina che potesse abbassarti lo schermo potrebbe anche nascondersi). La gesture della luminosità nel player agisce sull'immagine, e lo dice |
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
5. **Il player riproduce, non procura.** Le sorgenti le indichi tu; quello che
   ci metti dentro è una tua scelta, esattamente come per un lettore installato
   sul computer.
