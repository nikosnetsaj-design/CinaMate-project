# CineMate

Il tuo diario cinematografico personale. Traccia i film visti con voto e nota, curane la watchlist, scopri nuovi titoli — senza feed, senza rumore.

## Stack

- **Vite + React 18 + TypeScript**
- **Tailwind CSS v4** (design tokens custom in `src/index.css`)
- **Zustand** per lo stato (libreria utente + tema), persistito su `localStorage`
- **React Router** per la navigazione
- **Framer Motion** per le micro-interazioni

Nessun backend: l'app è local-first, i dati restano sul dispositivo.

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
  components/   componenti UI riutilizzabili
  pages/        Home, Discover, Watchlist, Diary
  store/        stato Zustand (libreria, tema, palette comandi, film selezionato)
  data/         catalogo film di esempio
  lib/          utility (formattazione, statistiche)
```
