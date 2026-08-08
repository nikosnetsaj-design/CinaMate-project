# CineMate — Riprogettazione di prodotto

**Audit UX/UI, architettura informazionale e piano di esecuzione.**
Documento di strategia. Ogni affermazione qui dentro è verificata sul codice:
dove c'è un numero, c'è un file da cui l'ho contato.

---

## Premessa: cosa ho letto, e perché conta

Ho letto `README.md` (48 KB), `docs/PRODUCT.md` (50 KB), i due documenti di
analisi sullo streaming, e il sorgente: **35.527 righe**, 60 componenti,
10 pagine, 25 store, 57 moduli di dominio e 57 file di player.

Devo dire una cosa prima di tutto il resto, perché cambia la natura di questo
documento.

**Questo non è un progetto da salvare. È un progetto già scritto meglio del 95%
di quello che gira in produzione.** Il contrasto dei colori non è "controllato a
occhio": c'è uno script (`scripts/contrast.mjs`) che compone le trasparenze sul
fondo reale e verifica 136 coppie testo/sfondo secondo WCAG 2.1 — l'ho eseguito,
**0 sotto soglia**. La vetrina non ruota da sola, e il commento in
`Billboard.tsx` spiega *perché* («un carosello che si muove mentre stai leggendo
è la ragione per cui i caroselli si ignorano»). La scala dei voti è passata da
ciano→magenta a blu→rosso perché nel Nastro «un 6 e un 9 erano la stessa striscia
rosa». `touch-action: manipulation` è stato **tolto** di proposito, con tre righe
di motivazione, per non rubare il doppio-tocco a chi ingrandisce per leggere.

Un'analisi che arrivasse qui a proporre "palette moderna, gradienti, glassmorphism,
onboarding in 3 step" sarebbe un downgrade travestito da consulenza.

Quindi il metodo è un altro. **Ho cercato i punti in cui il prodotto tradisce le
regole che si è dato da solo.** Ne ho trovati tre, tutti verificabili, e tutti e
tre grossi. È lì che sta il valore, non nella palette.

---

## Il verdetto in una pagina

| | |
|---|---|
| **Cosa è già eccellente** | Il sistema di colore e il suo verificatore automatico · il tono di voce (il migliore che abbia visto in un prodotto consumer italiano) · la regola "un fatto, mai uno slogan" · la gerarchia dichiarata della vetrina · il player come modulo autonomo · la disciplina delle pastiglie (max una per copertina, solo con un fatto dietro) |
| **I tre difetti strutturali** | **1.** Zero onboarding, su un'app che senza una chiave API non fa *niente* · **2.** La regola anti‑Netflix delle 6 righe è dichiarata due volte e non applicata mai · **3.** I dati personali vivono su 4 superfici, di cui 2 sono destinazioni di navigazione separate |
| **La mossa strategica** | Smettere di essere *tre prodotti in un'icona* (diario + guida + player) e diventare **un prodotto con tre gradi di profondità**, che l'utente attraversa quando è pronto |
| **Il numero da cambiare** | Destinazioni di navigazione: **10 → 4** |

---

# 1. 💡 Visione Generale & Proposta di Valore

## 1.1 Il problema con il posizionamento attuale

`PRODUCT.md` §1 dice: *«Un compagno di visione personale.»* La sintesi
dichiarata è: *«il diario affettivo di Letterboxd + il "dove guardarlo" di
JustWatch + il racconto annuale di Spotify.»*

È una buona sintesi. Ma il codice racconta una storia diversa: **dentro
CineMate ci sono tre prodotti che si contendono l'identità.**

| Il prodotto | Dove vive nel codice | Peso |
|---|---|---|
| **Il diario** — cosa ho visto, che voto gli do, quante ore | `useLibrary`, `stats`, `diary`, `activity`, `Nastro`, `Profile`, `Stats` | Il cuore affettivo |
| **La guida** — cosa guardo stasera, dove lo trovo | `featured`, `recommend`, `continueWatching`, `upcoming`, `WatchAndLinks`, `sagas`, `universes` | Il motivo per riaprirla |
| **Il player** — riproduci le sorgenti che indichi tu | `src/player/**` (57 file), `linkHost`, `streamExtract`, `hostRedirect`, `doh`, `resolveSource` | **Il 30% del codice** |

Il terzo è tecnicamente il più impressionante — risoluzione parallela degli
host, scelta del master per risoluzione e non per latenza, diagnosi DoH per
distinguere «il nome non esiste» da «il server tace» — ed è anche **quello che
trascina il prodotto verso il difetto che il documento stesso rimprovera a Plex:
"onboarding da sistemista"**.

## 1.2 La proposta di valore, riscritta

> ## Stasera, in un tocco.
> **CineMate ricorda cosa hai visto, decide cosa guardare adesso, e sa in che
> ordine. Resta sul tuo telefono. Non ti vende niente.**

Tre frasi, tre promesse, ognuna verificabile:

1. **Ricorda** — il diario (differenziale contro Netflix, che dimentica; contro JustWatch, che non ti conosce)
2. **Decide** — la vetrina + Per te + Continua (differenziale contro Letterboxd, che archivia ma non propone)
3. **Sa l'ordine** — saghe, universi, timeline (**il differenziale che nessuno ha**)

## 1.3 Il vantaggio che nessun concorrente può copiare

Ho cercato a lungo la risposta a «perché questa app e non Trakt». La trovo qui,
ed è già costruita ma non è mai *raccontata*:

**Nessuna app al mondo risponde a «in che ordine devo guardarli».**
`lib/sagas.ts`, `lib/universes.ts`, `SagaTimeline.tsx`, i tre ordini di visione
(uscita / cronologico / consigliato), il «SEI QUI» sotto il capitolo aperto in
`ItemSagaStrip`. Netflix mette i film in ordine di caricamento. Letterboxd non
ha il concetto. Trakt ha le collezioni ma non l'ordine consigliato.

**Questa è la copertina del prodotto, e oggi è sepolta in una tab della scheda.**

## 1.4 I tre gradi (la mossa strategica)

Invece di tre prodotti in conflitto, tre **gradi di profondità** che l'utente
attraversa quando gli servono — l'unico modello che permette di tenere il player
senza pagarne il costo di onboarding:

| Grado | Si sblocca | Cosa fa | Cosa NON chiede |
|---|---|---|---|
| **I. Diario** | Subito, zero configurazione | Segna cosa hai visto, dai un voto, guarda le tue ore crescere | Nessuna chiave, nessuna rete |
| **II. Guida** | Alla chiave del catalogo | Copertine, trame, cast, «dove guardarlo», saghe, uscite | Nessun server, nessun host |
| **III. Sala** | Al primo indirizzo di sorgente | Il player, la maratona, i download, la Watch Party | — |

Il grado I **oggi non esiste**: senza chiave TMDB l'app è un guscio. Costruirlo
è l'intervento con il rapporto valore/costo più alto di tutto il documento
(§3.1, §4.2).

---

# 2. 📱 Analisi Ispirazionale — "Steal & Elevate"

`PRODUCT.md` §2 ha già una tabella di questo tipo, con 8 app. La estendo con
quello che **non è ancora stato rubato**, e specifico il file in cui atterra.

| App di riferimento | Feature da rubare | Come adattarla a CineMate | Perché funziona qui |
|---|---|---|---|
| **Duolingo** | La prima lezione **prima** della registrazione. Valore in 20 secondi, configurazione dopo. | **Lo scaffale di prova.** Al primo avvio la Home è già piena: ~12 titoli famosi impacchettati nell'app (JSON + locandine locali, zero rete, zero chiave), etichettati «esempio». Prima azione: *«Questi non sono tuoi. Dimmi cosa hai visto davvero»* → griglia di 24 locandine → 3 tocchi → lo scaffale diventa suo. | Oggi il primo schermo è una scatola vuota che chiede di cercare, su un motore che senza chiave non risponde mai. È l'unico punto dell'app dove l'utente può andarsene per sempre. |
| **Duolingo** | La *streak* come oggetto affettivo, non come ricatto. | `Profile` ha già `giorni di fila`. Portarlo in Home come anello sottile accanto al saluto. **Mai** notifiche di colpa («stai per perdere la serie!»): la serie si spezza in silenzio. | Il tono di voce dell'app non ammette il ricatto. Una streak onesta è coerente; una che ti insegue non lo è. |
| **Spotify — Wrapped** | I dati personali che diventano un racconto condivisibile. | **«Il tuo Anno al Cinema»**: storie verticali generate *in locale* da `stats.ts` + `diary.ts`, esportabili come immagine via `<canvas>`. `lib/share.ts` esiste già. | È l'unica leva virale possibile per un'app senza account e senza grafo sociale. Il racconto è il prodotto; il server non serve. |
| **Spotify — daylist** | Una selezione che si nomina da sola in base a *quando* e *come* ascolti. | **«Il tuo momento»**: una riga sola che legge gli orari reali in `statsAndHistory` — *«martedì sera, episodi corti»*, *«domenica pomeriggio, tre ore libere»*. | Il prodotto conosce già la durata di ogni titolo e l'ora di ogni sessione. È la personalizzazione più forte che si possa fare senza mandare un byte fuori. |
| **Netflix** | La vetrina che decide al posto tuo. | **Già rubata, e fatta meglio** (gerarchia dichiarata in `featured.ts`, fatto verificabile sotto il titolo, nessuna rotazione automatica). Non toccare. | — |
| **Netflix** | La **barra a 4 voci**. Netflix ha 4 destinazioni con 18.000 titoli. | CineMate ne ha **10** (`Nav.tsx:10-21`). Portarle a 4: Stasera · Libreria · Cerca · Tu. | §3.2. |
| **Apple Music / tvOS** | **Una sola coda**, a cui ogni superficie scrive. | Oggi ci sono **quattro** meccanismi «cosa viene dopo»: `ContinueWatchingRow`, `ContinueSagaRow`, `MarathonCard`, `NextChapterPrompt` + `ResumePrompt`. Unificarli in **La Coda**, un oggetto solo. | Quattro risposte alla stessa domanda sono quattro occasioni di dirsi cose diverse. Un solo oggetto è anche un solo bug. |
| **Spotify** | La **mini-barra del player** sempre presente, che si espande a schermo intero. | Risolve il problema dichiarato in `Nav.tsx:31-33` («niente sul telefono porta al Player, quindi la pagina era irraggiungibile»). La barra sostituisce la voce di navigazione e **libera uno slot**. | Un player che ha una scheda in barra è una pagina. Un player che ha una barra viva è un'app. |
| **Airbnb** | Il conteggio **live** dei risultati dentro i filtri, prima di applicarli. | `FilterSheet.tsx`: il pulsante diventa **«Mostra 42 titoli»**, e va a 0 mentre stringi. | Toglie il ciclo applica → deludi → torna indietro. Il conteggio è già calcolabile in locale a costo zero. |
| **Uber** | L'attesa raccontata: vedi il puntino muoversi, quindi aspetti. | La risoluzione della sorgente (`resolveSource.ts`) è oggi una scatola nera che può fallire per CORS. Renderla una **pipeline visibile**: *Indirizzo tuo → Link personali → Modelli → Host → Siti*, ogni passo che si accende. | L'app ha già la regola d'oro («l'errore dice quale dei due è»). Questa la estende dal fallimento all'attesa. |
| **Notion** | L'architettura orientata agli oggetti: tutto è un oggetto, apribile da ovunque, con la stessa grammatica. | Gli oggetti ci sono già (Titolo, Puntata, Saga, Universo, Persona, Sessione) ma ognuno ha un foglio su misura: `ItemDetailSheet`, `SagaSheet`, `PersonSheet`, `CatalogSheet`. Definire una **grammatica unica di scheda** (§4.4). | Una grammatica sola si impara una volta e vale per sei oggetti. È anche meno codice. |
| **Notion / Linear** | `⌘K` come sistema nervoso. | `CommandPalette.tsx` esiste ma è **solo da tastiera** (`Nav.tsx:92-100`, dentro la sidebar desktop). Su telefono non esiste. | La ricerca globale è la funzione più usata di ogni app di catalogo, ed è invisibile sul dispositivo su cui l'app è pensata per essere installata. |
| **Instagram** | Il **doppio tocco** per mettere il cuore, con l'animazione che conferma. | `PosterCard.tsx`: doppio tocco = preferito, con il cuore che pulsa e sparisce. Nessun pulsante nuovo, nessun pixel in più. | L'app ha già `item.fav`. Oggi si arriva al cuore aprendo la scheda: tre tocchi per un gesto che ne vale uno. |
| **Letterboxd** | La recensione come oggetto con una data, che invecchia. | **Il voto a caldo e a freddo** (§6.2): il pollice nel player, e sette giorni dopo *«Dopo una settimana, Interstellar vale ancora 9?»* | Nessuno lo fa. Rende il diario più onesto e crea un motivo di ritorno che non è una notifica promozionale. |
| **Apple — Impostazioni** | La gerarchia progressiva: la prima schermata non mostra mai una casella di testo. | `SettingsSheet.tsx` è **904 righe** in un foglio solo, con la chiave API in cima. Spezzarlo in una lista di destinazioni. | §3.4. |
| **IMDb / JustWatch** | *Il difetto da evitare*, già identificato correttamente in `PRODUCT.md`. | Nessuna azione. Confermo la lettura. | — |

---

# 3. ✂️ Cosa Eliminare / Semplificare subito

Ordinato per rapporto (danno rimosso) / (lavoro richiesto).

## 3.1 🔴 Il vuoto al primo avvio — *il difetto più grave del prodotto*

**Le prove.**

- `grep -ri "onboard\|primo avvio\|benvenut" src/` → **0 risultati.**
- `store/useSettings.ts:23` — `tmdbApiKey` nasce `""`.
- Senza quella chiave: niente ricerca, niente copertine, niente trame, niente
  cast, niente «dove guardarlo», niente saghe, niente uscite. **L'app è un
  guscio.**
- Il primo schermo (`Home.tsx:176-190`) è: *«La tua libreria è vuota»* →
  *«Aggiungi il primo titolo»* → si apre `AddItemSheet` → una casella che
  invita a scrivere → **e che non risponderà mai**, perché la chiave non c'è.
- La mancanza della chiave è gestita **a valle, in almeno 10 componenti
  diversi**, ognuno con la sua scusa locale: `CatalogSheet.tsx:242`,
  `AddItemSheet.tsx:90`, `WatchAndLinks.tsx:161`, `UpcomingRow.tsx:16`,
  `LinkToTmdb.tsx:52`, `AiItemExtras.tsx:103`, `NextChapterPrompt.tsx:38`,
  `SagaSheet.tsx:184`, `CastRow.tsx:80`…

**Il paradosso.** `PRODUCT.md:27` rimprovera a Plex *«Onboarding da
sistemista»*. `ANALISI-STREAMING.md:541` rimprovera a Trakt *«la frizione
dell'onboarding: chiede di collegare mezzo mondo prima di mostrare un solo
risultato utile»*.

**CineMate oggi chiede due chiavi API e non mostra un solo risultato utile.**
Ed è più severo di entrambi, perché non lo chiede nemmeno: lascia che l'utente
lo scopra da una casella che tace.

**Da eliminare:** la scatola vuota.
**Da costruire:** §4.2.

---

## 3.2 🔴 Dieci destinazioni

`Nav.tsx:10-21` — 10 voci sul desktop, 6 sul telefono.

I commenti nel file sono lucidi e ragionati uno per uno («Diagnostica esce
perché è dove vai quando qualcosa non va», «un settimo tab restringe tutti gli
altri»). Ma sono **ottimizzazioni locali su una lista che è troppo lunga in
partenza**. Netflix: 4. Spotify: 3. Instagram: 5.

| Voce attuale | Destino | Perché |
|---|---|---|
| Home | **→ Stasera** | Il nome dice cosa contiene: una decisione, non un indirizzo |
| Libreria | **resta** | — |
| Saghe | **→ scheda dentro Libreria** | Una saga *è* un modo di guardare la libreria, non un posto diverso |
| Cerca | **resta** | — |
| Scopri | **→ assorbita in Cerca** | Già fatto sul telefono (`Nav.tsx:40-42`) e il commento dice che «non manca niente». Se è vero lì, è vero anche sul desktop |
| Dati | **→ fusa in Tu** | §3.3 |
| Profilo | **→ Tu** | — |
| Critico | **→ azione, non luogo** | È già raggiungibile da ogni scheda. Un assistente è qualcosa che invochi, non un posto in cui vai |
| Player | **→ mini-barra** | Steal da Spotify. Risolve il problema dichiarato in `Nav.tsx:31-33` e libera lo slot |
| Diagnostica | **→ solo da Impostazioni** | Già fuori dalla barra mobile per questa ragione. Applicare la stessa logica al desktop |

**Risultato: 10 → 4.** `Stasera · Libreria · Cerca · Tu`, più la mini-barra del
player quando qualcosa suona. Stessa barra sul telefono e sul desktop: **si
impara una interfaccia, non due.**

---

## 3.3 🔴 I dati personali su quattro superfici

Le stesse informazioni — quanto guardi, cosa, quando — vivono in:

1. La riga `statistiche` in Home (`Home.tsx:82-89`) — 4 numeri
2. La riga `nastro` in Home (`Home.tsx:78`) — 30 giorni
3. La pagina **`/dati`** (422 righe) — anno, nastro, generi, attori, registi
4. La pagina **`/profilo`** (319 righe) — livello, ore, grafico, streak, top serie

**La prova che è una duplicazione e non una scelta:** l'app ha **quattro modi
diversi di dire "non c'è ancora niente"**, perché ha quattro superfici che
possono essere vuote separatamente:

| File | Stringa |
|---|---|
| `Home.tsx:178` | «La tua libreria è vuota» |
| `Stats.tsx:290` | «Il tuo diario è vuoto» |
| `Stats.tsx:389` | «Nessun dato ancora» |
| `Profile.tsx:166` | «Il profilo è ancora vuoto» |

Quattro frasi per un solo stato: *non hai ancora visto niente.*

**Da fare:** `/dati` e `/profilo` diventano **Tu**, una pagina con tre schede
(*Riepilogo · Diario · Gusti*). La riga `statistiche` esce dalla Home — la Home
serve a decidere stasera, non a fare il bilancio. Il **Nastro resta** in Home:
non è una statistica, è un oggetto affettivo, ed è l'unica cosa in quella lista
che si guarda invece di leggerla.

---

## 3.4 🟡 Sei righe dichiarate, tredici consegnate

`PRODUCT.md:64` — la regola più citata del documento:

> **Regola anti‑Netflix:** massimo 6 righe in Home.

`store/useHomeLayout.ts:9` la ripete nel codice:

> `maxRows` in PRODUCT.md §3.1 caps the page at six rows

E poi, undici righe più sotto, `useHomeLayout.ts`:

```ts
const DEFAULT_ORDER: HomeSectionId[] = HOME_SECTIONS.map((s) => s.id); // 13
// …
{ order: DEFAULT_ORDER, hidden: [] }   // nessuna nascosta
```

`grep -rn "maxRows\|MAX_ROWS\|slice(0, 6)" src/store src/pages/Home.tsx` →
**nessun risultato.** La costante `maxRows` **non esiste**. Il tetto è scritto
in prosa due volte e applicato zero volte: `Home.tsx:197-201` renderizza tutto
ciò che non è nascosto, e non è nascosto niente.

Diverse righe restituiscono `null` da vuote, quindi un utente nuovo ne vede
poche — ma **un utente affezionato, cioè quello che conta, ne vede da 11 a 13.**
La regola anti‑Netflix protegge esattamente lui, ed è disattivata esattamente
per lui.

**Da fare:** spedire un `hidden` predefinito con 7 id dentro, e le 6 righe che
restano scelte così:

| # | Riga | Perché queste sei |
|---|---|---|
| 1 | **In vetrina** | La decisione |
| 2 | **Continua a guardare** | La domanda più frequente in assoluto |
| 3 | **Il tuo momento** *(nuova)* | La personalizzazione onesta |
| 4 | **Continua la saga** | Il differenziale del prodotto |
| 5 | **In arrivo** | L'unica ragione temporale per riaprire l'app |
| 6 | **Il Nastro** | L'oggetto affettivo che chiude la pagina |

Le altre sette restano in Impostazioni, accendibili. E il tetto diventa **una
costante vera**, che il selettore di layout fa rispettare: *«Sei righe è il
massimo. Per accenderne una, spegnine un'altra.»* — un vincolo dichiarato è una
funzione, non una limitazione.

---

## 3.5 🟡 Il preambolo sopra la vetrina

`Home.tsx:155-165` — prima di qualunque contenuto:

1. Occhiello «LA TUA COLLEZIONE»
2. Saluto «Buonasera.»
3. Conteggio «142 titoli»
4. Data «giovedì 7 agosto»
5. Pulsante NightPicker

Cinque elementi di cornice prima del primo pixel di contenuto. Netflix e
Spotify aprono **sul contenuto**.

**Da fare:** la vetrina in cima, a filo. Saluto e data si spostano in **Tu**,
dove un saluto ha senso. Il NightPicker (*«cosa guardo stasera»*) non è cornice
— è la funzione principale: diventa un'azione **dentro** la vetrina, accanto a
*Riproduci*.

---

## 3.6 🟡 Le impostazioni come muro

`SettingsSheet.tsx` — **904 righe**, un foglio unico, 5 gruppi
(`Catalogo e intelligenza · Riproduzione · App · Dati · Info`), con le chiavi API
nel primo.

**Da fare:** primo livello = una lista di destinazioni con una riga di
descrizione ciascuna, zero campi di testo. Le chiavi vivono sotto **Catalogo**,
raggiunte da chi le cerca, invitate dall'onboarding a chi non sa di volerle.

## 3.7 🟢 Nove livelli sovrapposti montati globalmente

`App.tsx:178-195` monta 9 portali sempre presenti (`ToastStack`,
`CommandPalette`, 6 fogli, `ResumePrompt`, `NextChapterPrompt`,
`IncomingShare`, `UpdatePrompt`, `WebViewer`).

Due sono già ridondanti dopo §2 (`ResumePrompt` e `NextChapterPrompt` confluiscono
ne **La Coda**). Il resto: un **router dei fogli** unico — uno store, un livello,
una regola di impilamento — invece di nove montaggi indipendenti che possono
aprirsi insieme senza che nessuno lo abbia deciso.

---

# 4. 🏗️ Nuova Architettura e Flussi Utente

## 4.1 La mappa a oggetti (OOUX)

Gli oggetti esistono già nel dominio; quello che manca è che siano **trattati
allo stesso modo ovunque**.

| Oggetto | Attributi che si vedono | Azioni | Relazioni |
|---|---|---|---|
| **Titolo** | copertina, anno, durata, stato, tuo voto, voto TMDB, classificazione | Guarda · Preferito · Vota · Visto · Condividi · Scarica | → Saga, Persona, Puntata, Sorgente |
| **Puntata** | miniatura, S·E, durata, trama, visto | Riproduci · Segna fino a qui | → Titolo |
| **Saga** | copertina, n° capitoli, % completata, ordine | Maratona · Riprendi · Ordina | → Titolo[], Universo |
| **Universo** | copertina, saghe, linea temporale | Esplora | → Saga[] |
| **Persona** | foto, ruolo, filmografia | Apri · Filtra la libreria | → Titolo[] |
| **Sessione** | data, minuti, titolo, puntata | *(immutabile — è il diario)* | → Titolo |
| **Sorgente** | indirizzo, qualità, salute | Prova · Modifica | → Titolo |
| **Coda** ⭐ | ciò che viene dopo, e perché | Riprendi · Rimuovi · Riordina | → Titolo, Puntata, Saga |
| **Traguardo** | livello, ore, giorni di fila | *(nessuna — si guarda)* | → Sessione[] |

**La Coda è l'oggetto nuovo**, e sostituisce quattro meccanismi (§2). Un solo
posto risponde a *«cosa viene dopo»*, con quattro sorgenti in ordine di
priorità: la puntata a metà → il capitolo successivo della saga in corso → la
maratona attiva → il titolo in vetrina.

## 4.2 ⭐ Flusso A — Primo avvio: da 0 al primo titolo in 60 secondi

Il flusso che oggi non esiste. **Ogni schermata dà valore prima di chiedere.**

**Schermata 1 — Lo scaffale di prova** *(0 s)*
La Home è già piena, con ~12 titoli famosi impacchettati nell'app. Nessuna rete,
nessuna chiave, nessuna attesa. In basso, una striscia:

> **Questa è CineMate con la libreria di qualcun altro.**
> Rendila tua: un minuto.  → **[ Comincia ]**

**Schermata 2 — «Cosa hai visto?»** *(20 s)*
Griglia di 24 locandine famose, impacchettate. Si toccano quelle viste, si va
avanti da 3 in su. *(Netflix fa questo alla registrazione; Duolingo lo fa prima
di chiedere l'account.)*

> **Tocca quelli che hai già visto.**
> Bastano tre. Da qui capisco cosa proporti.

**Schermata 3 — La chiave, ma dopo il valore** *(40 s)*
Ora lo scaffale è suo e le copertine servono davvero. Solo adesso si chiede.

> **Il catalogo.**
> Copertine, trame, cast e date arrivano da **TMDB**, un archivio aperto e
> gratuito. Serve una chiave tua: è gratis, ci vogliono due minuti, e resta su
> questo telefono.
>
> **[ Apri TMDB ]**  ·  campo che incolla e **verifica in diretta** ✓
> **[ Lo faccio dopo ]**

Tre proprietà non negoziabili: **è saltabile**; **spiega perché serve** (non
«inserisci API key»); **si verifica subito**, così non si scopre l'errore di
battitura tre schermate dopo.

**Schermata 4 — Fatto** *(60 s)*

> **Il tuo scaffale.** Sette titoli, due da riprendere.

**E se salta la chiave?** *Un solo* invito persistente e chiudibile in cima alla
Home — non le dieci scuse locali di oggi:

> **Le copertine mancano.** Il catalogo è spento. **[ Accendilo ]**

**Da costruire:** un componente `<ServeIlCatalogo>` che sostituisce i ~10 rami
`!tmdbApiKey` sparsi. Un solo posto che lo dice, un solo modo di dirlo.

## 4.3 Flusso B — «Stasera»: da aperta a riproduzione in 3 tocchi

| | Oggi | Dopo |
|---|---|---|
| 1 | Apri (5 elementi di cornice, poi la vetrina) | Apri → **la vetrina è il primo pixel** |
| 2 | Riproduci | **Riproduci** |
| 3 | *(se non convince)* scorri 11 righe | *(se non convince)* **Un'altra** dentro la vetrina |

Il NightPicker esiste già (`NightPicker.tsx`) ma sta nel preambolo come pulsante
di testo. Portato dentro la vetrina come *«Un'altra»* diventa il gesto centrale
del prodotto: **la vetrina propone, tu rilanci.**

## 4.4 La grammatica unica di scheda

Oggi: `ItemDetailSheet`, `CatalogSheet`, `SagaSheet`, `PersonSheet` — quattro
fogli con quattro anatomie. Una sola grammatica, per ogni oggetto:

```
┌──────────────────────────────────────┐
│  IMMAGINE LARGA        [azione ▶]    │   1. Identità + azione principale
│  Logo / Titolo                       │
├──────────────────────────────────────┤
│  fatto · fatto · fatto · fatto       │   2. I fatti, in mono, mai aggettivi
├──────────────────────────────────────┤
│  ◯  ◯  ◯  ◯  ◯                       │   3. Max 5 azioni tonde, reversibili
├──────────────────────────────────────┤
│  Scheda · Scheda · Scheda            │   4. Max 4 schede, la prima è quella
├──────────────────────────────────────┤      che serve *a questo oggetto*
│  contenuto                           │
└──────────────────────────────────────┘
```

La scheda del Titolo già segue questa forma (`PRODUCT.md` §3.1‑bis) — **ed è la
migliore dell'app.** Va estesa a Saga, Persona e Universo invece di essere
un'eccezione riuscita.

## 4.5 Wayfinding

Tre regole, tre bug risolti:

1. **Ogni schermata dice cosa la sta filtrando.** Da una pastiglia «Serie TV» si
   arriva in Libreria filtrata; il filtro deve essere una pastiglia **visibile e
   rimovibile** in cima, non uno stato invisibile.
2. **Ogni foglio dice da dove sei venuto.** Tornare da `PersonSheet` →
   `ItemDetailSheet` → `SagaSheet` deve riportare il fuoco all'elemento che ha
   aperto il foglio, non in cima alla pagina.
3. **Ogni attesa dice cosa sta aspettando.** «Caricamento…» (`App.tsx:153`) è
   una parola che non informa: va sostituita dallo scheletro della pagina che
   arriverà (`Skeletons.tsx` esiste già).

---

# 5. ✍️ Guida al Microcopy & Tono di Voce

**Il tono di voce di CineMate non va inventato: va estratto e messo per
iscritto.** È già il migliore elemento del prodotto, ma vive nei commenti al
codice invece che in una guida, e questo significa che il prossimo testo scritto
potrebbe non somigliargli.

## 5.1 Le sette regole, dedotte dal prodotto stesso

| # | Regola | L'esempio che è già nell'app |
|---|---|---|
| 1 | **Un fatto, mai un aggettivo.** | «ha incassato 2,6× il budget» — non «un grande successo» |
| 2 | **Il perché sta nella stessa riga.** | «Perché hai guardato Dark» come *titolo* della riga |
| 3 | **L'errore dice quale dei due è.** | «non trovato» vs «il browser non mi ha lasciato leggere»: solo il secondo si risolve col Web Viewer |
| 4 | **Mai il gergo dell'app.** | «chiave del catalogo», non «API key». La persona gestisce *copertine*, non *endpoint* |
| 5 | **I numeri sono in mono.** | «Un diario di visione è un registro, e le cifre devono incolonnarsi» (`index.css:329`) |
| 6 | **Niente esclamativi, niente «Ops!», niente emoji di sistema.** | Nessuno in tutta l'app oggi. Da proteggere |
| 7 | **Seconda persona singolare, sempre.** | «la *tua* libreria», «dove *eri* rimasto» |

## 5.2 Riscritture, sulle stringhe reali

| Dove | Oggi | Proposta | Perché |
|---|---|---|---|
| `App.tsx:71` | «Sei offline: la tua libreria funziona tutta, ma la ricerca su TMDB, le copertine nuove e il critico restano in attesa della connessione.» | **«Sei offline. La libreria funziona tutta; copertine e ricerca tornano con la rete.»** | 28 parole → 14. Nomina TMDB e «il critico», che a chi legge non dicono nulla in quel momento |
| `App.tsx:87` | «I dati salvati sul dispositivo sembrano danneggiati e non possono essere letti.» + **[Ripristina dati locali]** | **«Non riesco a leggere i dati di questo dispositivo.»** + **[Prova a ripristinare]**, con la conseguenza scritta prima di procedere | Regola 3: dice cosa succede. Oggi un pulsante distruttivo non chiede conferma e non dice cosa si perde |
| `Home.tsx:178` | «La tua libreria è vuota» / «Aggiungi il primo titolo» | *Sostituita dal flusso di §4.2* | Una libreria vuota non è uno stato d'errore: è il minuto uno |
| `App.tsx:153,167` | «Caricamento…» / «Caricamento del player…» | *Nessun testo — lo scheletro della pagina* | Una parola che descrive sé stessa non informa. Lo scheletro dice *cosa* sta arrivando |
| `Stats.tsx:389` | «Nessun dato ancora» / «Aggiungi e vota qualche titolo per vedere le tue statistiche.» | **«Il diario comincia col primo voto.»** | Da constatazione a invito. Zero istruzioni: l'azione è già ovunque |
| `WatchAndLinks.tsx:170` | «Non disponibile al momento.» | **«Non so dove danno questo titolo.»** | «Non disponibile» sembra dire che il *film* non c'è. La cosa che manca è la nostra informazione |
| `Nav.tsx:98` | «Cerca nella libreria…» | **«Cerca un titolo, una persona, una saga»** | La palette cerca già tutto questo (`CommandPalette.tsx:42`). Il segnaposto promette meno di quello che fa |

## 5.3 Le stringhe dei tre momenti nuovi

**La chiave del catalogo** — mai «Inserisci la tua API key»:
> **Il catalogo.** Copertine, trame e cast arrivano da TMDB, un archivio aperto
> e gratuito. Serve una chiave tua: è gratis e resta su questo telefono.

**La Coda, vuota** — mai «Nessun elemento»:
> **Non hai niente a metà.** È un buon momento per cominciare qualcosa.

**Il voto a freddo** — mai «Valuta di nuovo!»:
> Una settimana fa hai dato **9** a *Interstellar*. Vale ancora?

---

# 6. 🚀 Roadmap delle Funzionalità "Best in Class"

## 6.1 Orizzonte 1 — Le fondamenta *(2–3 settimane)*

Niente di nuovo. Solo far rispettare al prodotto le regole che si è già dato.

| # | Intervento | § | Impatto | Costo |
|---|---|---|---|---|
| 1 | **Onboarding in 4 schermate + scaffale di prova** | 4.2 | 🔥🔥🔥 | M |
| 2 | **`<ServeIlCatalogo>` unico** al posto dei ~10 rami sparsi | 4.2 | 🔥🔥 | S |
| 3 | **Navigazione 10 → 4** + mini-barra del player | 3.2 | 🔥🔥🔥 | M |
| 4 | **Tetto di 6 righe applicato davvero** (costante + default) | 3.4 | 🔥🔥 | S |
| 5 | **`/dati` + `/profilo` → Tu**, un solo stato vuoto | 3.3 | 🔥🔥 | M |
| 6 | **La Coda**: un oggetto al posto di quattro | 4.1 | 🔥🔥 | M |
| 7 | **Via il preambolo**, vetrina a filo, «Un'altra» dentro | 3.5 | 🔥 | S |

## 6.2 Orizzonte 2 — Il carattere *(4–6 settimane)*

Qui il prodotto smette di somigliare agli altri.

**① Il Recupero** — *la funzione che nessuno ha*
Torni su una serie dopo quattro mesi. Un tocco: **«Dov'ero?»**. Claude scrive il
riassunto **fino al tuo episodio esatto e non oltre** — l'app sa a che punto sei
(`useWatchProgress`), quindi lo spoiler è delimitabile per costruzione.
Netflix ti fa ricominciare la stagione. Nessuno risolve questo. *È la funzione
di retention più forte del documento.*

**② Il Programmatore di Serate**
> «Ho due ore e mezza e sono stanco.»

L'app conosce le durate, il tuo scaffale e a che ora guardi cosa. Compone una
**serata**: un episodio corto + il film, totale 2h24. Tutti gli altri consigliano
*un titolo*; nessuno riempie *una serata*.

**③ Il tuo Anno al Cinema** — il Wrapped locale
Storie verticali generate da `stats.ts` + `diary.ts`, esportabili come immagine
via `<canvas>`. Nessun server, nessun account. **L'unica leva virale disponibile
a un'app local-first.**

**④ Il voto a caldo e a freddo**
Il pollice nel player (già c'è, `reactions.ts`) e la domanda a sette giorni.
Misura il decadimento dell'entusiasmo — e rende il diario più onesto di
Letterboxd.

**⑤ La prova sociale che è tua**
Senza account non esiste «2,3 milioni di persone». Ma esiste una prova più
forte: **«Di questo regista ne hai già visti 4. Media: 8,5.»** Calcolata in
locale da `stats.byDirector`, che esiste già.

**⑥ La pipeline di risoluzione visibile** (§2, steal da Uber) · **⑦ Il conteggio
live nei filtri** (steal da Airbnb) · **⑧ `⌘K` anche su telefono** · **⑨ Doppio
tocco = preferito** · **⑩ Il tuo momento** (steal da daylist).

## 6.3 Orizzonte 3 — Il vantaggio *(8+ settimane)*

- **Il buco nella saga, proattivo** — *«Ti manca il capitolo 3 di 7. È su Prime.»*
- **La Sala** — `useWatchParty` è già costruito e non è mai in superficie.
- **Notifica contestuale onesta** — *«L'episodio che aspetti esce stasera alle 21.»* Un fatto con un'ora, mai «Torna sull'app!».
- **L'ordine consigliato come prodotto pubblico** — l'unica cosa che CineMate sa e nessun altro sa. Una saga condivisa come immagine è marketing che si scrive da solo.

## 6.4 Le metriche (il "funnel", senza vendere niente)

Non c'è conversione commerciale: la conversione è **attivazione**.

| Passo | Oggi | Obiettivo |
|---|---|---|
| Apre l'app | — | — |
| **Vede qualcosa di vivo** | ❌ scatola vuota | **100%** (scaffale di prova) |
| Aggiunge il primo titolo | ⚠️ impossibile senza chiave | **> 60%** entro 60 s |
| Configura il catalogo | ❌ mai richiesto | **> 40%** entro il primo giorno |
| **Torna il secondo giorno** | — | **> 35%** |
| Prima riproduzione | ❌ nessun percorso guidato | **> 15%** entro la prima settimana |

---

# 7. 🎨 Specifiche UI e Design System

## 7.1 Cosa NON toccare

Verificato, non supposto:

- **La palette «Sala buia».** `npm run contrast` → *136 coppie verificate, 0 sotto soglia*, su entrambi i temi. Ho eseguito lo script.
- **La scala dei voti blu→rosso.** Freddo→caldo, ogni gradino distinguibile.
- **I numeri in mono con `tabular-nums`.** Un diario è un registro.
- **La grana della pellicola** a `0.025` di opacità.
- **Il `section-mark`** — una barretta d'accento da 3px al posto di una linea di separazione.
- **`prefers-reduced-motion`** rispettato ovunque, comprese le View Transitions.
- **Lo zoom lasciato acceso** (WCAG 1.4.4) contro la ricetta «app-like».

## 7.2 Cosa manca al Design System

I token di colore sono un sistema. **Tutto il resto è ad hoc**, scritto inline
schermata per schermata. Ecco i cinque che mancano.

**① Scala tipografica.** Oggi `text-3xl`, `text-xl`, `text-sm`, `text-[11px]`,
`text-[10px]` decisi caso per caso. Sette ruoli nominati:

| Ruolo | Uso | Corpo / interlinea | Famiglia |
|---|---|---|---|
| `display` | Titolo di pagina, vetrina | 32–44 / 1.04 | Display |
| `title` | Titolo di scheda | 24 / 1.1 | Display |
| `section` | Titolo di riga | 20 / 1.2 | Display |
| `body` | Trame, note | 15 / 1.55 | Sans |
| `caption` | Motivi, didascalie | 13 / 1.45 | Sans |
| `label` | Occhielli, gruppi | 11 / 1.2, `0.14em` | Sans |
| `numeral` | Voti, durate, date | ereditato | **Mono, tabular** |

**② Scala di spaziatura.** Oggi `gap-9`, `gap-4`, `gap-3`, `gap-2.5`, `gap-1.5`.
Sei passi su base 4: `2 · 4 · 8 · 12 · 20 · 36`. Nient'altro.

**③ Scala di elevazione — e un'incoerenza reale.**

| Livello | z | Cosa |
|---|---|---|
| `nav` | 40 | Barre |
| `toast` | 50 | Avvisi |
| `grain` | **60** | Grana |
| `sheet` | **70** | Fogli |

La grana sta **sopra** navigazione e toast, ma **sotto** i fogli
(`index.css:413` vs `Sheet.tsx:20`). Risultato: barre e toast sono granulosi, i
fogli no. È invisibile fino a che non lo si nota, e allora non si smette. **La
grana è atmosfera: va sopra tutto** (`z: 100`, `pointer-events: none`) o sotto
tutto. Non a metà.

**④ Token di movimento.** Oggi `120ms`, `220ms`,
`cubic-bezier(0.22, 1, 0.36, 1)`, `0.15s`, `1.6s` scritti a mano. Quattro nomi:

```css
--ease-out:  cubic-bezier(0.22, 1, 0.36, 1);  /* già in uso: tenerlo */
--dur-tap:    90ms;   /* riscontro immediato */
--dur-move:  180ms;   /* qualcosa si sposta */
--dur-enter: 240ms;   /* qualcosa entra */
```

**⑤ Matrice degli stati.** Per ogni primitiva, otto stati dichiarati:
`default · hover · active · focus-visible · disabled · loading · empty · error`.
Oggi `loading` ed `empty` sono improvvisati componente per componente — ed è
esattamente il motivo delle quattro frasi diverse per «è vuoto» (§3.3).

## 7.3 Micro-interazioni da aggiungere

| Gesto | Riscontro | Durata |
|---|---|---|
| Tocco su copertina | Scala 0.97 + apertura | 90 ms *(già c'è)* |
| **Doppio tocco su copertina** | **Cuore che pulsa e sfuma** | **340 ms** |
| Voto assegnato | Il numero prende il colore della sua scala | 180 ms |
| Puntata segnata vista | Miniatura che si spegne, segno che entra | 180 ms |
| Riga della Coda completata | Scorre via, le altre risalgono | 240 ms |
| Chiave verificata | Segno di spunta che si disegna | 300 ms |
| Vetrina, «Un'altra» | Dissolvenza incrociata, mai scorrimento | 240 ms |
| Traguardo raggiunto | Anello che si chiude una volta. **Niente coriandoli** | 600 ms |

Tutte dietro `prefers-reduced-motion`, come già fa il resto dell'app.

## 7.4 Accessibilità — cosa manca

Il livello di partenza è alto (script del contrasto, `:focus-visible`, skip
link, `.tap-target` a 44px, `prefers-reduced-motion`, navigazione spaziale per
TV, zoom preservato). Restano quattro buchi:

1. **Regioni live.** `aria-live` compare in **3 file su 60**
   (`ToastStack`, `ResumePrompt`, `player/Overlays`). **La ricerca — la
   superficie più asincrona dell'app, che aggiorna i risultati a ogni tasto —
   non ne ha.** Chi usa un lettore di schermo digita e non sente nulla.
   → `aria-live="polite"`: *«7 risultati»*.
2. **Il ritorno del fuoco dai fogli.** `useFocusTrap` intrappola correttamente,
   ma il ritorno all'elemento che ha aperto il foglio va garantito su tutti e
   sei (§4.4 lo rende una regola sola invece di sei).
3. **La vetrina si dichiara carosello** (`aria-roledescription="carosello"`,
   `Billboard.tsx`) ma ha solo lo scorrimento a dito: servono i controlli
   precedente/successivo e l'indice corrente annunciato.
4. **`aria-current="page"`** sulla voce attiva della navigazione: oggi lo stato
   attivo è solo colore e un pallino.

---

## In sintesi

Tre interventi, in ordine. Tutto il resto viene dopo.

1. **Costruire il minuto uno.** L'app non ha un primo avvio, e chiede due chiavi
   API senza dirlo. È l'unico punto dove si perde un utente per sempre.
2. **Far rispettare le regole già scritte.** Le 6 righe della Home sono
   dichiarate due volte e applicate zero. Le destinazioni sono 10 dove le
   migliori ne hanno 4. I dati personali stanno su 4 superfici, e si vede dalle
   4 frasi diverse per dire «è vuoto».
3. **Raccontare il differenziale.** *In che ordine devo guardarli* è la cosa che
   CineMate sa fare e nessun altro sa fare, ed è sepolta in una tab.

Il resto del prodotto — il colore, il tono, il rigore — non va riprogettato.
Va protetto.
