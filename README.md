# CineMate

La tua libreria personale di film, serie TV, anime e documentari. Traccia stato,
voto (su 10), episodi visti e note; scopri e aggiungi nuovi titoli con l'aiuto
di Claude; chiedi consigli su misura al critico IA. Solo per te, solo sul tuo
dispositivo.

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
  components/   componenti UI (poster, sheet, chip di stato, voto, nav…)
  pages/        Home, Libreria, Dati, Critico
  store/        stato Zustand (libreria, tema, impostazioni, sheet UI)
  data/         libreria di partenza (seed) con titoli reali
  lib/          utility (formattazione, statistiche, palette poster, client Anthropic)
```

## Funzionalità principali

- **Libreria unificata**: ogni titolo ha uno stato (In visione / Visto / Da
  vedere / Abbandonato / In pausa), un voto da 1 a 10, piattaforma, ed
  eventualmente episodi/stagioni per serie e anime.
- **Ricerca assistita da IA**: cerchi un titolo per nome, Claude compila anno,
  genere, trama, cast e episodi.
- **Critico IA**: fai domande sui tuoi gusti, basate sulla tua libreria reale.
- **Statistiche**: ore totali, distribuzione voti, generi e piattaforme più
  frequenti, top 5.
