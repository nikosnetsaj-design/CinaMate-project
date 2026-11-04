# Dieci idee da scegliere

Proposte originali, **non implementate**: le sceglie chi decide il prodotto.
Ognuna dice quale problema reale risolve, quanto costa (in giorni di lavoro di
una persona che conosce il codice), cosa può andare storto, e come rispetta le
regole di prodotto (PRODUCT.md §7) e il perimetro (§6-bis): niente backend,
niente account, dati sempre esportabili, ogni consiglio dichiara il perché,
niente pattern che trattengono.

Le stime partono da quello che c'è già: registro degli episodi, palato, liste,
IndexedDB, condivisione via link/QR, il critico su `lib/anthropic.ts`.

---

## 1. «Ho due ore»: la serata a misura di tempo

**Problema.** La domanda vera della sera non è «cosa mi piace» ma «cosa ci sta
in quello che ho»: un'ora e quaranta prima di dormire, quaranta minuti in
treno. Oggi si apre un titolo, si legge la durata, si torna indietro.

**Cosa fa.** Un selettore di tempo in Home («45 min · 1 h 30 · 2 h · stasera
tutta») che propone dalla lista «Da vedere» e dalle serie in corso solo ciò che
ci sta: un film entro la durata, oppure *quanti episodi* della serie che stai
seguendo (dal registro e dalle durate TMDB per puntata: «3 episodi di Dark,
finisci la stagione 2»). Ogni proposta dice il conto («104 min, ti restano 16»).

**Costo.** 2 giorni. **Rischio.** Basso: le durate per episodio TMDB a volte
mancano; si ripiega sulla durata media della serie, e lo si dice.

**Regole.** Tutto locale; il perché è il conto dei minuti; fa scegliere in
fretta — è il contrario di un pattern che trattiene.

## 2. Il passaggio di consegne fra dispositivi, senza server

**Problema.** Esporta/importa è la sincronizzazione di CineMate, ma è un rito:
file, cartella, apertura. Chi ha telefono e tablet finisce per tenerne uno solo
aggiornato.

**Cosa fa.** «Passa a un altro dispositivo»: il telefono mostra un QR animato
(una sequenza di QR, come i portafogli di criptovalute fanno per le firme) con
il backup compresso; il tablet lo inquadra con la fotocamera
(`BarcodeDetector`, dove c'è) e unisce invece di sostituire — stessa logica
senza doppioni dell'importazione da altre app. Per librerie piccole basta un
QR solo.

**Costo.** 4–5 giorni (codifica a fontana, unione dei registri, prove su più
browser). **Rischio.** Medio: `BarcodeDetector` manca su Safari; lì resta il
file. Librerie molto grandi richiedono molti fotogrammi.

**Regole.** Nessun server: i dati passano dallo schermo alla fotocamera. Il
file di backup resta il formato di riferimento, quindi sempre esportabile.

## 3. Note che restano al minuto giusto

**Problema.** Le note di un titolo sono un campo unico. Chi annota mentre
guarda («la battuta al 47′», «la scena del treno») non ha dove metterla, e
dopo un mese non ritrova il punto.

**Cosa fa.** Dal lettore, «annota questo momento»: una nota legata a titolo,
episodio e secondo. Nella scheda le note compaiono sulla linea del tempo
dell'episodio, e un tocco riapre il lettore lì (il «momento» condivisibile
esiste già). Nel diario la visione porta le sue note.

**Costo.** 2–3 giorni. **Rischio.** Basso. Va solo deciso dove vivono nel
backup (nel registro degli episodi o accanto).

**Regole.** Dati scritti dall'utente, quindi nel backup; nessuna rete.

## 4. Il riassunto della stagione che hai appena finito

**Problema.** «Nelle puntate precedenti» serve a riprendere. Chi finisce una
stagione vorrebbe l'opposto: fermare in testa cosa è successo, prima che si
mescoli con la prossima serie.

**Cosa fa.** Quando l'ultimo episodio di una stagione entra nel registro, la
scheda offre «Il punto sulla stagione»: un riassunto per personaggi e fili
aperti, con le sinossi TMDB di *quella* stagione come base e il confine
dichiarato (la stagione finita, niente della successiva). Resta in memoria
come gli altri riassunti, e si può salvare nelle note.

**Costo.** 1–2 giorni (riusa `lib/recap.ts`). **Rischio.** Basso; come ogni
uscita del modello va presentato come riassunto, non come fatto.

**Regole.** Offerto, mai chiesto da solo (costa credito dell'utente); il
confine anti-spoiler è nel prompt come per il riassunto esistente.

## 5. Il diario che si legge come un libro

**Problema.** L'anno a quadretti e le statistiche dicono *quanto*. Manca il
*come*: le serate, le persone, i posti — che ora il diario conosce (con chi,
dove).

**Cosa fa.** Una pagina «Il mio anno, raccontato» generata in locale dai dati:
capitoli per stagione dell'anno, il film con cui hai aperto l'anno, la serie
che ti ha tenuto compagnia a novembre, le visioni «con Marta», il cinema dove
sei andato più spesso. Esportabile in PDF o immagine. L'IA, se c'è la chiave,
può solo levigare le frasi — mai aggiungere fatti.

**Costo.** 3 giorni. **Rischio.** Basso; il tono va curato per non sembrare
marketing.

**Regole.** Solo dati dell'utente, sul dispositivo; niente classifiche fra
persone.

## 6. Watchlist con la data di scadenza dello streaming

**Problema.** Un film in lista sparisce da un servizio e lo si scopre la sera
in cui si voleva vederlo. I cataloghi pubblicano le uscite, TMDB no; ma la
disponibilità si può *osservare*.

**Cosa fa.** La pagina Abbonamenti ricontrolla periodicamente (all'apertura,
con la cache di un giorno) dove stanno i titoli in lista e tiene uno storico
locale: «su Netflix da marzo», «non più su Prime da ieri». Quando un titolo
cambia servizio o esce, compare nella campanella con il motivo.

**Costo.** 2 giorni. **Rischio.** Medio: è un'osservazione, non un annuncio —
si sa che è uscito, non quando uscirà. Va detto chiaramente.

**Regole.** Nessun servizio esterno oltre TMDB con la chiave dell'utente; ogni
avviso dice da dove viene.

## 7. Rewatch consapevole

**Problema.** Riguardare è metà del cinema di molti, ma la libreria lo tratta
come un contatore. Non si sa *se* un film regge alla seconda visione, né se il
voto è cambiato.

**Cosa fa.** Alla seconda visione la scheda chiede un voto nuovo affiancato al
vecchio, e il palato impara la differenza («i film che rivedi crescono di 0,8
in media»). Una riga in Tu: «Da rivedere», i titoli che hai votato alto anni fa
e non hai più toccato, ordinati per tempo trascorso — con il perché.

**Costo.** 2 giorni. **Rischio.** Basso; serve un campo in più nel registro
delle visioni dei film (nel backup).

**Regole.** Il perché è il tempo e il voto; nessun invito automatico, solo una
riga che si può spegnere da Home su misura.

## 8. Profili ospite sullo stesso dispositivo

**Problema.** Il tablet di casa è di tutti. Gli account sono fuori perimetro,
ma «chi sta guardando» non richiede un server: richiede solo di non mescolare
diari e palati.

**Cosa fa.** Profili locali (nome e colore, nessuna password): ognuno con il
suo registro, diario, palato, voti; la libreria dei titoli può essere comune.
Cambiare profilo è un tocco nell'intestazione di Tu. Il backup li contiene
tutti, o uno solo a scelta.

**Costo.** 5–6 giorni (separare gli store per profilo, migrare, testare).
**Rischio.** Alto: tocca quasi tutti gli store; va fatto dopo un congelamento
delle funzioni. Non è un controllo d'accesso, e va detto (come il PIN del
controllo genitori).

**Regole.** Nessun account né server; i dati restano esportabili per profilo.
**Attenzione:** §6-bis mette «profili multipli» fuori perimetro insieme agli
account, perché li pensa sincronizzati. Questa è la versione solo locale, che
non ne ha bisogno: sceglierla vuol dire rivedere quella riga, non aggirarla.

## 9. Cineforum: la stagione di un gruppo

**Problema.** Gruppi di amici che guardano «un film a settimana» tengono il
calendario su una chat; le scelte si perdono, i voti pure.

**Cosa fa.** Una lista condivisa *per link* (come «Stasera in due», solo id
TMDB) con un ordine e una data per ogni serata. Ognuno la importa nella sua
app; i voti di ciascuno restano suoi, e chi vuole li rimanda nel gruppo con un
altro link (voti, niente nomi). L'app ricompone la classifica della stagione
sul dispositivo di chi la apre.

**Costo.** 3 giorni. **Rischio.** Medio: senza server lo stato del gruppo vive
nei link che girano in chat; va progettato perché l'ultimo link vinca senza
confusione.

**Regole.** Niente servizio condiviso: è ancora un link. Nessuna classifica
pubblica; il gruppo è chi ha il link.

## 10. Modalità «ho poca batteria e niente rete»

**Problema.** In viaggio contano due cose: che l'app parta senza rete e che
non consumi. Oggi offline funziona, ma niente lo dice e niente si adatta.

**Cosa fa.** Un interruttore (e un'accensione automatica con la Battery Status
API, dove esiste, sotto il 20 %) che: spegne le animazioni, sospende le passate
in background verso TMDB, blocca le immagini non in cache, e mostra in Home
solo ciò che è già sul dispositivo — i download, le serie in corso, la lista.
Una riga dice cosa è spento e perché.

**Costo.** 1–2 giorni. **Rischio.** Basso; la Battery Status API c'è solo nei
browser Chromium, altrove resta l'interruttore.

**Regole.** Riduce il lavoro dell'app invece di aumentarlo; nessun dato nuovo.
