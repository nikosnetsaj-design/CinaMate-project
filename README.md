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

CineMate **non riproduce e non ospita video**: ti dice cosa guardare, in che
ordine e su quale servizio legale trovarlo. Vedi `docs/PRODUCT.md` per il
perimetro completo e il perché.

## Stack

- **Vite + React 18 + TypeScript**
- **Tailwind CSS v4** — design tokens "Cinema Noir" custom in `src/index.css`
- **Zustand** per lo stato (libreria, tema, impostazioni, sheet), persistito su `localStorage`
- **React Router** per la navigazione
- **Framer Motion** per le micro-interazioni
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
  pages/        Home, Libreria, Saghe, Scopri, Dati, Critico
  store/        stato Zustand (libreria, saghe, maratona, promemoria, tema, UI)
  lib/          dominio e utility (tmdb, sagas, universes, upcoming, stats,
                achievements, search, anthropic, backup)
```

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
