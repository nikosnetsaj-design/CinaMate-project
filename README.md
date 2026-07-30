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

CineMate **non ospita e non cerca video**: ti dice cosa guardare, in che ordine
e su quale servizio legale trovarlo. C'è anche un player (pagina **Player**), ma
riproduce soltanto le sorgenti HLS che aggiungi tu, titolo per titolo: non c'è
catalogo, non c'è ricerca di file, non c'è niente da guardare finché non gli dai
un tuo indirizzo. Vedi `docs/PRODUCT.md` per il perimetro completo e il perché.

## Stack

- **Vite + React 18 + TypeScript**
- **Tailwind CSS v4** — design tokens "Cinema Noir" custom in `src/index.css`
- **Zustand** per lo stato (libreria, tema, impostazioni, sheet), persistito su `localStorage`
- **React Router** per la navigazione
- **Framer Motion** per le micro-interazioni
- **hls.js** per il player (streaming adattivo), caricato solo quando apri la
  pagina Player e non all'avvio dell'app
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
  pages/        Home, Libreria, Saghe, Scopri, Dati, Critico, Player
  store/        stato Zustand (libreria, saghe, maratona, promemoria, tema, UI)
  lib/          dominio e utility (tmdb, sagas, universes, upcoming, stats,
                achievements, search, anthropic, backup)
  player/       il player, autonomo dal resto dell'app:
                  hooks/      motore video (hls.js), sottotitoli, maratona,
                              download, watch party, cast, host monitor
                  services/   download su IndexedDB, cronologia e statistiche,
                              trasporto realtime, salute e storico degli host
                  components/ shell del player, controlli, timeline, overlay,
                              impostazioni, pannelli download/party/host
                  styles/     player.css — palette propria, tutta sotto .pv-app
                  fromLibrary.ts  da titolo della libreria a contenuto riproducibile
```

Il player è un modulo a sé: usa i propri tipi (`src/player/types.ts`) e le
proprie chiavi `localStorage` (prefisso `ppv:`), quindi non tocca la libreria né
il diario. L'unico punto di contatto è `fromLibrary.ts`.

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
- **Pagine persone**: attori e registi cliccabili ovunque, con filmografia da
  TMDB e in evidenza ciò che hai già in libreria.
- **Prossimamente**: calendario dei nuovi episodi delle serie che segui e delle
  uscite dei film in watchlist, con promemoria e notifiche locali.
- **Ricerca intelligente**: una sola barra che trova titoli, saghe, universi,
  attori e registi, con i risultati raggruppati per tipo.
- **Critico IA**: fai domande sui tuoi gusti, basate sulla tua libreria reale,
  incluse le saghe lasciate a metà.
- **Statistiche e traguardi**: ore totali, film e serie completati, distribuzione
  voti, generi, attori e registi più visti, anno per anno, e badge da sbloccare.
- **Player**: per i titoli a cui hai dato una sorgente HLS, un lettore completo —
  qualità adattiva con selezione manuale, ripresa dal secondo esatto, velocità,
  Picture in Picture, schermo intero, mini player, sottotitoli `.vtt`
  personalizzabili, salto intro/recap/crediti, autoplay del titolo successivo,
  Chromecast/AirPlay, Watch Party, download offline e failover fra host mirror.

## Player: come dargli qualcosa da riprodurre

La pagina Player non ha un catalogo. Prende i titoli dalla tua libreria e mostra
solo quelli per cui hai salvato una sorgente:

1. apri un titolo della libreria;
2. fra i suoi **link personali** incolla l'indirizzo di un manifest HLS, cioè un
   indirizzo il cui percorso finisce in `.m3u8`;
3. il titolo compare fra quelli riproducibili nella pagina Player.

Gli altri link personali restano segnalibri normali: solo l'estensione `.m3u8`
viene interpretata come sorgente video. Senza nessuna sorgente la pagina mostra
lo stream pubblico di test di hls.js, così puoi vedere come si comporta il player
prima di collegare qualcosa di tuo.

Alcune funzioni restano dei gusci in attesa di un backend, perché dal browser non
si possono fare:

| Funzione | Cosa manca |
|---|---|
| Download offline | un endpoint `GET /api/content/:id/download-manifest?quality=` che elenchi i segmenti |
| Consigli di fine visione | un endpoint `GET /api/content/:id/recommendations` (senza, ricade sul "prossimo titolo") |
| Watch Party fra dispositivi diversi | un relay WebSocket. Di serie usa `BroadcastChannel`, che sincronizza **solo fra schede dello stesso browser** |
| Sottotitoli, anteprime timeline, marker di intro/crediti | file `.vtt`, sprite e marker che CineMate non può conoscere: le tracce audio, invece, arrivano dal manifest e si vedono da sole |
| Scadenza reale del certificato SSL di un host | un endpoint che ispezioni il certificato con il modulo `tls` di Node |

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
