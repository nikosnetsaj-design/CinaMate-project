# CineMate — Audit dell'interfaccia e proposta «Sala e carta»

Fase 1: analisi. Nessuna pagina dell'app è stata modificata; l'unica aggiunta è
la tavola `/design-preview`, isolata (vedi §4).

---

## 1. Come è stato fatto

- **Codice letto:** `index.css`, `player/styles/player.css`, `App`, `Nav`,
  `TopBar`, `Home`, `Billboard`, `PosterCard`, `PosterRow`, `Sheet`,
  `StatusChip`, `VoteBadge`, `EmptyState`, `Skeletons`, `icons`, `accents`,
  `useTheme`, `useFocusTrap`, `scripts/contrast.mjs`, più `docs/REDESIGN.md`.
- **App avviata** con una libreria di prova realistica: 24 titoli con locandine
  TMDB vere, stati e voti misti, cronologia di un mese, un film a metà.
  Fotografate 9 rotte × 3 larghezze (375, 768, 1440) × 2 temi, più scheda
  titolo, impostazioni, primo avvio e libreria vuota: 68 schermate.
- **Misurato nel browser:** scorrimento orizzontale, errori di console, corpo
  dei campi, dimensione reale dei bersagli toccabili, raggio dei controlli a
  fuoco.
- **Punto di partenza:** build, lint, 5 file di test e 136 coppie di contrasto
  passano. Nessuno scroll orizzontale a nessuna larghezza, nessun errore in
  console.

## 2. Cosa c'è già e va tenuto

Il lavoro precedente ha costruito una base solida, e la proposta la conserva:

- il **verificatore di contrasto** (`npm run contrast`), che resta il guardiano
  della nuova palette;
- `prefers-reduced-motion` rispettato ovunque, transizioni di vista comprese;
- lo **zoom lasciato acceso** (WCAG 1.4.4);
- i fogli che **restituiscono il fuoco** a chi li ha aperti (verificato);
- **quattro destinazioni** di navigazione, la mini-barra del lettore;
- il **tono dei testi**: un fatto e non un aggettivo, il perché nella stessa
  riga, nessun punto esclamativo;
- la scala dei voti **da freddo a caldo** come idea, e le cifre in colonna.

**Una nota su `REDESIGN.md`.** Quel documento diceva di non toccare la palette
«Sala buia». Questa proposta la sostituisce perché la direzione richiesta ora è
un'altra: neutri caldi, un solo accento caldo, un serif per i titoli. Le cose che
quel documento proteggeva per buone ragioni (il verificatore, la leggibilità, la
semantica dei voti) restano; cambia l'aspetto, non le regole.

---

## 3. I problemi, dal più grave

### 3.1 L'accento è ovunque, quindi non indica più niente

Il verde compare su: il bottone principale, «Aggiungi titolo», il pallino della
voce attiva, le barrette prima dei titoli di sezione (7 file), **tutte** le icone
delle Impostazioni, l'etichetta «NETFLIX», i quattro cerchi d'azione della scheda
(cuore, stella e occhio verdi insieme), le barre di avanzamento, l'anello del
fuoco, la selezione del testo, i link «tutti», il logo. Il lettore aggiunge un
**secondo accento**, ambra (`#e3a64e`), con una palette sua.

Un accento che sta su tutto smette di dire «qui c'è da fare qualcosa».
**Proposta:** un accento solo, caldo, riservato ad azione principale, stato
attivo e avanzamento. Il resto è neutro. Il lettore usa lo stesso.

### 3.2 Troppi colori in competizione con le locandine

- **Cinque colori di stato** (blu, verde, viola, rosso, grigio), ognuno in una
  pastiglia con bordo, riempimento e un carattere Unicode (▶ ✓ ◷ ✕ ⏸).
- **Dieci colori di voto**, dal blu al rosso, su ogni cifra: un 9 e un 10 in
  arancio e rosso si leggono come avvisi.
- In Libreria ogni copertina porta **tre segnali colorati**: pastiglia di stato,
  voto colorato, barra blu degli episodi.
- Il Nastro è una striscia arcobaleno.

Le locandine sono il colore dell'app: l'interfaccia intorno deve tacere.
**Proposta:** stato = un punto e la parola, con tre colori già esistenti e due
forme (cerchio vuoto per «da vedere», trattino per «abbandonato»); voto in cifre
neutre; la scala dei voti, ricalibrata nei toni della carta, vive solo nel Nastro
e nel selettore del voto.

### 3.3 Gerarchia tipografica piatta, scala non rispettata

- **13 corpi diversi** nei componenti (`text-[9px]` compreso; `text-[10px]` 46
  volte, `text-[11px]` 88 volte) più una ventina di misure diverse in
  `player.css`.
- I sette ruoli `t-*` definiti in `index.css` sono usati in tutto **23 volte**.
- Titoli e testo sono due grotteschi molto simili: la gerarchia si regge solo
  sul corpo, e «Libreria» a 30 px non stacca dalle sezioni a 20.
- **170 usi del mono:** «2023·108 min alla fine» nella mini-barra si legge come
  un terminale.
- Testi a 9–11 px sul telefono sono sotto la soglia del leggibile.

**Proposta:** sei ruoli e cinque corpi, minimo 12 px; serif per i titoli; cifre
tabulari nel sans (Instrument Sans le ha vere: «1111» e «0000» misurano uguale);
il mono resta per indirizzi e codici.

### 3.4 Cornici ovunque

**597 classi di bordo**; **12 file con bordi tratteggiati**. Nella scheda titolo
«Guarda» e «Scarica» sono due riquadri tratteggiati e sembrano segnaposto. La
pagina **Tu** è fatta di riquadri grigi bordati dentro la pagina; le Impostazioni
bordano ogni gruppo.

**Proposta:** separare con lo spazio e con le superfici; filo sottile solo dentro
gli elenchi; nessun tratteggio.

### 3.5 Il fuoco da tastiera cambia forma ai controlli (difetto)

`:focus-visible { border-radius: var(--radius-xs) }` sta fuori da ogni livello
della cascata e batte le classi `rounded-*` di Tailwind: **ogni bottone tondo o
pastiglia diventa un quadrato da 2 px quando riceve il fuoco**. Misurato sul
bottone Impostazioni: raggio da pieno a `2px`. Lo stesso meccanismo
(`* { border-color }` fuori livello) è il motivo per cui in tutta l'app i bordi
colorati vanno scritti in `style`.

**Proposta:** regole di base dentro `@layer base`; il fuoco disegna l'anello
senza toccare la forma.

### 3.6 Tre linguaggi di icone

`components/icons.tsx`: 30 icone con **8 spessori diversi** (da 1,1 a 1,9) su 3
griglie. `player/components/Icons.tsx`: altre 26, tratto 2 su griglia 24. In più
una ventina di **caratteri Unicode usati come icone**: ✕ per chiudere i fogli, ★,
✓, ←, ↗. Il Critico usa la scintilla, il segno di ogni prodotto «con l'IA».

**Proposta:** Lucide, griglia 24, tratto 1,75; il Critico diventa una citazione.

### 3.7 Forme e spazi senza ritmo

Bottoni a 5 px di raggio (spigolosi, aria da modulo generico) accanto a pastiglie
tonde e schede a 9 e 14. Mezzi passi ovunque: `py-2.5` 67 volte, `gap-1.5` 64,
`gap-2.5` 45, `px-3.5` 34, cioè 6, 10, 14 px fuori dalla griglia da 4/8.

**Proposta:** spazi 4·8·12·16·24·32·48·64; raggi 6·10·14·24 e pillola.

### 3.8 Campi e bersagli sul telefono

- La ricerca della Libreria e di Cerca è a **14 px**, l'ordinamento a **12 px**:
  Safari su iPhone ingrandisce la pagina al tocco di ogni campo sotto i 16 px,
  e l'app è pensata per stare sulla schermata Home di un iPhone.
- Comandi sotto i 44 px senza area estesa, misurati a 375 px: **31 su 44** in
  Stasera, **24 su 54** in Tu, 7 su 36 in Libreria, 6 su 21 in Cerca (Novità e
  Altro a 36×36, «Accendilo» 81×28, «Filtri» 55×30). WCAG 2.2 AA chiede 24 px,
  e quasi tutti ci stanno; 44 è la soglia richiesta qui, ed è quella di Apple.

### 3.9 Il tablet perde un terzo dello schermo

Da 768 px compare la colonna laterale da 240 px: su un iPad in verticale restano
528 px per il contenuto. **Proposta:** barra in basso fino a 1023 px, colonna da
1024.

### 3.10 Superfici e materiali

- Tema chiaro **grigio freddo** (`#f5f5f6`) con schede bianco ottico; tema scuro
  quasi nero assoluto (`#0a0a0b`), su cui le locandine sembrano adesivi.
- La **grana** copre tutto lo schermo (z 100, `mix-blend-mode: overlay`, fissa):
  è texture contro la direzione «calma», e ha un costo di composizione a ogni
  scorrimento sul telefono.
- La sfocatura compare in 25 punti del codice.

### 3.11 Stati: buoni nella sostanza, incoerenti nella forma

- Gli scheletri esistono, ma il lettore e la Diagnostica caricano con la parola
  «Caricamento…».
- Lo stato vuoto è un riquadro tratteggiato.
- La barra rossa «dati danneggiati» ha un bottone **distruttivo senza
  conferma** («Ripristina dati locali»): già segnalato in `REDESIGN.md` §5.2 e
  ancora così.

### 3.12 Il tocco sulle locandine aspetta 300 ms

`PosterCard` attende 300 ms dopo ogni tocco per capire se ne arriva un secondo
(doppio tocco = preferito). Ogni apertura di un titolo dalla griglia parte quindi
con un terzo di secondo di ritardo: è la cosa che più fa sembrare l'app una
pagina e non un'app nativa. È una scelta di prodotto, quindi è fra le domande
(§6).

---

## 4. La proposta: «Sala e carta»

La tavola completa è su `/design-preview` (fuori dalla navigazione, caricata a
richiesta, con il suo carattere e le sue icone: il pacchetto principale non
cambia di misura). Tutti i valori sono sotto `.ds` in
`src/design-preview/preview.css`.

### Colore

| Token | Sera | Giorno | Uso |
|---|---|---|---|
| `--bg` | `#131211` | `#f6f3ee` | La pagina |
| `--surface` | `#1c1b19` | `#fdfcfa` | Fogli, elenchi, colonna |
| `--surface-2` | `#262422` | `#eeeae3` | Campi, pastiglie, secondari |
| `--surface-hover` | `#302e2b` | `#e5e0d7` | Hover e pressione |
| `--text` | `#f3efe7` | `#1c1a17` | 16,3:1 · 15,7:1 sul fondo |
| `--text-muted` | `#b9b2a6` | `#57524a` | 8,9:1 · 7,0:1 |
| `--text-faint` | `#a19a8f` | `#645e54` | 6,7:1 · 5,8:1 |
| `--border-strong` | testo al 40% | testo al 50% | Bordi dei campi, interruttore spento (≥3:1) |
| `--accent` «brace» | `#dc7a54` | `#b0502c` | Azione principale, stato attivo |
| `--success` | `#93c08a` | `#3d7536` | Visto, salvato |
| `--warning` | `#e3b462` | `#865900` | In pausa, da controllare |
| `--danger` | `#f47c8b` | `#b42a40` | Errore (cremisi: lontano dalla brace) |

Le **88 coppie** della proposta superano WCAG AA in entrambi i temi; la scala dei
voti regge 3:1 sul fondo a ogni gradino. I due temi non sono uno l'inverso
dell'altro: di sera la profondità la dà la luminosità delle superfici e un filo
di luce sul bordo alto; di giorno la carta più chiara del fondo e ombre morbide.

### Tipi

| Ruolo | Carattere | Corpo / interlinea |
|---|---|---|
| Titolo grande | Newsreader 500, taglio ottico | 34→44 / 1,08 |
| Titolo | Newsreader 500 | 22 / 28 |
| Evidenza | Instrument Sans 600 | 16 / 24 |
| Testo | Instrument Sans 400 | 16 / 24 |
| Secondario | Instrument Sans 400–500 | 14 / 20 |
| Nota | Instrument Sans 500 | 12 / 16 |

Esce Bricolage Grotesque; IBM Plex Mono resta al solo peso 400.

### Spazio, forma, profondità, movimento

- **Spazi:** 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64.
- **Raggi:** 6 (segni) · 10 (locandine) · 14 (bottoni, campi, elenchi) · 24
  (fogli, vetrina) · pillola.
- **Ombre:** tre livelli, riposo · sollevato · foglio.
- **Movimento:** pressione 100 ms, stato 200, spostamento 280, foglio 350 con
  una molla senza rimbalzo; curva `cubic-bezier(0.22, 1, 0.36, 1)`. Con «riduci
  movimento» resta una dissolvenza.
- **Materiale traslucido** solo su barre e controlli sopra un'immagine.

### Un rischio da nominare

Carta calda, titoli in serif e accento terracotta sono oggi anche una delle
combinazioni più frequenti nelle interfacce generate. La direzione è quella
richiesta, e la distanza dal generico la fanno tre cose: le locandine portano il
colore e l'interfaccia no, l'accento compare di rado, e Newsreader con il suo
taglio ottico invece dei serif di tutti.

---

## 5. Il piano

Ogni passo è un commit, con build, lint, test e contrasto verdi e schermate
prima/dopo. Nessuna modifica a logica, API o dati.

| # | Passo | Cosa cambia |
|---|---|---|
| 1 | **Fondamenta** | I token passano in `index.css` con gli stessi nomi di oggi, così i 597 usi seguono da soli. Il verificatore di contrasto copre le coppie nuove. Newsreader al posto di Bricolage. Regole di base dentro `@layer base` (difetto §3.5). Via la grana e le barrette di sezione. Il lettore usa lo stesso accento. |
| 2 | **Icone** | `icons.tsx` e `player/…/Icons.tsx` ridisegnate su Lucide **mantenendo i nomi esportati**, così nessun file che le usa cambia. Via i caratteri Unicode usati come icone. |
| 3 | **Componenti di base** | Restyling sul posto di `Sheet`, `EmptyState`, `Skeletons`, `StatusChip`, `VoteBadge`, `ToastStack`; bottoni, campi a 16 px, pastiglie, interruttori e controlli segmentati come nella tavola. Si uniforma l'esistente, non si duplica. |
| 4 | **Navigazione** | Barra in basso fino a 1023 px, colonna da 1024; barre di vetro; mini-barra del lettore; bersagli da 44. |
| 5 | **Stasera** | Vetrina, righe, Continua a guardare, saghe, uscite, Nastro con la nuova scala. |
| 6 | **Libreria** | Locandine con punto di stato e voto neutro, barra degli strumenti, filtri. |
| 7 | **Scheda titolo** | Via i riquadri tratteggiati di Guarda e Scarica; stessa grammatica per saga, persona, catalogo. |
| 8 | **Cerca e Scopri** | Campo a 16 px, risultati, palette dei comandi. |
| 9 | **Tu e Critico** | Via le schede dentro le schede; numeri grandi in sans tabulare. |
| 10 | **Impostazioni e primo avvio** | Elenco raggruppato come nella tavola; fogli di aggiunta e modifica; conferma prima del ripristino distruttivo. |
| 11 | **Lettore e Diagnostica** | Un solo accento, icone, corpi della scala; scheletro al posto di «Caricamento…». |
| 12 | **Verifica** | Tutte le schermate prima/dopo, tastiera, bersagli, movimento ridotto, contrasto. |

L'ordine fa sì che dopo il passo 1 l'app intera abbia già la nuova pelle, anche
se i componenti hanno ancora la forma di prima; dal 3 in poi si aggiusta la
forma, una schermata alla volta, dalla più usata.

---

## 6. Le decisioni che servono

1. **Direzione.** «Sala e carta» com'è nella tavola: palette, Newsreader, brace.
2. **Icone.** Lucide come unico set (una dipendenza nuova; si importano solo le
   icone usate). In alternativa si ridisegna a mano il set attuale.
3. **Colore d'accento nelle Impostazioni.** Oggi si sceglie fra sei. Proposta:
   tenere la scelta con sei varianti ricalibrate sui neutri caldi e la brace
   come predefinita. Toglierla del tutto sarebbe togliere una funzione.
4. **Voti.** Cifre neutre sulle locandine e scala di colore solo in Nastro e
   selettore (proposta), oppure cifre colorate come oggi.
5. **Doppio tocco sulle locandine** (§3.12). Tenerlo con i suoi 300 ms di attesa
   a ogni apertura, oppure aprire subito al tocco e lasciare il preferito nella
   scheda.
