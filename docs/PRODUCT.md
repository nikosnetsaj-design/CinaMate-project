# CineMate — specifica di prodotto

Documento di lavoro: cosa costruiamo, in che ordine, e perché.
Ogni voce dichiara **problema → beneficio → priorità** (Essenziale / Utile / Futura).

---

## 1. Cos'è CineMate

Un **compagno di visione personale**: tiene il diario di cosa hai visto, ti dice
cosa guardare stasera e **dove guardarlo legalmente** fra i servizi a cui sei
già abbonato.

Non è un client di streaming e non ospita né cerca file video. La riproduzione
avviene dove il contenuto è concesso in licenza: Netflix, Prime Video, Disney+,
RaiPlay, Sky, cinema. CineMate ti ci porta con un tocco.

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
| **Per te** | I consigli generici non ti somigliano | Suggerimenti dal *tuo* storico, con motivazione | Utile |
| **Tendenze / Più votati / Nuove uscite** | Scoperta oltre la propria bolla | Cataloghi TMDB curati | Utile |
| **In uscita al cinema** | Scopri i film quando sono già usciti | Anticipo sulle uscite | Utile |
| **Collezioni** | Le saghe si perdono in ordine sparso | "Il Padrino 1‑2‑3" come un blocco | Utile |
| **Liste personali** | Watchlist unica troppo grezza | "Da vedere col partner", "Horror di ottobre" | Utile |

> **Regola anti‑Netflix:** massimo 6 righe in Home. Ogni riga deve dichiarare
> *perché* è lì ("Perché hai messo 9 a Dark"). Niente caroselli senza motivo.

### 3.2 Ricerca — Essenziale

| Funzione | Problema | Beneficio | Priorità |
|---|---|---|---|
| Ricerca istantanea | Aspettare i risultati | Filtra mentre digiti | Essenziale ✅ |
| Per titolo/regista/genere/attore | Ricordi l'attore, non il titolo | Trovi da qualsiasi appiglio | Essenziale ✅ |
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

### 3.4 Player — solo trailer

| Funzione | Priorità |
|---|---|
| Trailer ufficiali in‑app, PiP, AirPlay/Chromecast sul trailer | Utile |
| Player di contenuti da host esterni | **Fuori perimetro** |

Skip Intro, tracce audio, sottotitoli e velocità appartengono al servizio che
detiene la licenza: li ha già, e meglio di quanto potremmo farli noi.

### 3.5 Profilo, dati, IA

| Funzione | Problema | Beneficio | Priorità |
|---|---|---|---|
| Diario cronologico | "Quando l'ho visto?" | Storia consultabile | Essenziale ✅ |
| Statistiche + anno in rassegna | I numeri non raccontano | Il tuo anno come storia | Essenziale ✅ |
| Traguardi | Nessun ritorno emotivo | Riconoscimento delle abitudini | Utile ✅ |
| Esporta / importa | I dati locali si perdono | Backup e cambio dispositivo | Essenziale ✅ |
| **Riassunto senza spoiler** | Riprendi una serie dopo 8 mesi | "Dove eravamo" senza rovinare nulla | Utile |
| Assistente / critico | Consigli generici | Conosce i tuoi voti | Essenziale ✅ |
| Sync cloud multi‑dispositivo | Telefono e PC separati | Una libreria sola | **Futura** — richiede backend e account |

### 3.6 Download

Solo **metadati e copertine** per la consultazione offline: la libreria resta
sfogliabile in aereo. Il download dei video appartiene alle app dei servizi,
che lo offrono già con la licenza. → Utile.

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

---

## 5. Architettura

```
src/
  components/     UI riusabile (Nastro, PosterArt, sheet, player trailer)
  pages/          Home · Libreria · Scopri · Dati · Critico
  store/          Zustand: libreria, impostazioni, UI
  lib/            tmdb · anthropic · backup · search · stats · achievements
  data/           (vuoto: nessun dato precaricato)
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
  (6h per le date di uscita) e nessuna richiesta ripetuta a ogni render.

**Se un giorno servisse il multi‑dispositivo:** Supabase con Row Level Security,
un record per utente, sincronizzazione a livello di evento del diario (non di
libreria intera) per evitare conflitti.

---

## 6. Roadmap

**Fatto** ✅ — libreria, diario, traguardi, anno in rassegna, Nastro, roulette,
in arrivo, copertine e dati TMDB automatici, provider legali, esporta/importa,
identità visiva, pubblicazione web installabile.

**Prossimo (Essenziale)**
1. Pagina **Scopri**: tendenze, più votati, nuove uscite, in uscita — da TMDB
2. **Apri sul servizio**: deep link diretto a Netflix/Prime/Disney+
3. **Filtri avanzati** in ricerca

**Poi (Utile)**
4. Ricerca in linguaggio naturale (IA → filtri TMDB)
5. Liste personali e collezioni
6. Riassunto senza spoiler + "dove eravamo"
7. Trailer in‑app con PiP
8. Consigli "Per te" con motivazione esplicita
9. Notifiche per nuovi episodi

**Futuro**
10. Sync cloud con account
11. Ricerca per immagine

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
   duratura e di qualità superiore.
