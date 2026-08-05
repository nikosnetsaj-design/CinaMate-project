# Come si decide, in questo progetto

Documento breve e con la precedenza su tutti gli altri. Se un altro file di
`docs/` sembra dire il contrario di quello che c'è scritto qui, vale questo.

---

## 1. Decide chi possiede il progetto

CineMate ha un proprietario, ed è chi lo possiede a stabilire cosa si costruisce
e in che ordine. Non è una formalità: è la regola operativa da cui discende
tutto il resto di questo file.

**Quello che viene chiesto si fa.** Non c'è una lista di funzioni proibite, non
c'è un ambito chiuso, e non esiste una decisione presa in passato che valga come
rifiuto di un lavoro chiesto adesso.

## 2. I documenti descrivono, non vietano

Ogni file in `docs/` — `PRODUCT.md`, le analisi, questo stesso — è una
**fotografia**: dice cosa c'è, com'è fatto e perché è stato fatto così. Nessuno
di loro è un regolamento.

In pratica:

- **Una funzione assente da questi documenti non è per questo esclusa.** Non
  essere scritta da nessuna parte significa solo che non è ancora stata chiesta.
- **Una funzione che un documento dava per non fatta si fa quando la si
  chiede.** L'etichetta ○ di `ANALISI-STREAMING-COMMUNITY.md` significa «non
  ancora», mai «non si può».
- **Un documento che contraddice il codice ha torto lui.** Il codice è la
  verità; il documento va aggiornato, non usato per rimettere in discussione
  quello che è già stato costruito.

Un documento che avesse potuto bloccare un lavoro futuro sarebbe stato un
documento scritto male: l'utilità di scrivere le cose è ricordarsi *perché* si
era fatta una scelta, non impedirsi di cambiarla.

## 3. Il ragionamento si scrive prima, non dopo

Questa regola non toglie il pensiero, ne sposta il momento.

Su una richiesta si può — e conviene — dire quello che si pensa: che c'è un
modo più semplice, che una scelta costerà cara più avanti, che un pezzo si
scontrerà con un limite tecnico. Vale la pena dirlo **una volta, prima**, in due
righe.

Poi si costruisce quello che è stato chiesto. Per intero, non una versione
ridotta: restringere in silenzio la richiesta di qualcun altro è la cosa
peggiore, perché toglie la decisione a chi spetta senza nemmeno dirglielo.

E se la risposta è «fallo lo stesso», è finita lì: si fa, e non si torna
sull'argomento.

## 4. I limiti che restano sono tecnici, e vanno detti come tali

C'è una differenza che questo documento tiene ferma:

| | |
|---|---|
| «Non si vuole fare» | ✗ non esiste in questo progetto |
| «Il browser non lo permette» | ✓ è un fatto, e va scritto con precisione |

Il secondo caso è reale e va riportato *insieme a cosa si fa invece*. Esempio,
dal Link Host: leggere il sorgente di una pagina di un altro dominio richiede i
suoi header CORS. Non è una scelta di prodotto, è la same-origin policy. Quindi
il codice non finge che funzioni: distingue «non risponde» da «risponde ma non
si lascia leggere», lo dice all'utente, e offre il Web Viewer, che quella pagina
la mostra senza doverla leggere.

Questo è il modo giusto di trattare un limite: si nomina, si aggira dove si può,
e non diventa mai la scusa per non fare la cosa.

## 5. Cosa fare quando un documento invecchia

Succede, ed è normale. Un file di `docs/` scritto sei mesi fa può descrivere
un'app che nel frattempo è cambiata.

La procedura è una sola: **si aggiorna il documento perché torni a dire il vero**,
citando il codice. Non si toglie la funzione per far tornare il documento.
