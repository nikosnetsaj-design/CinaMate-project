/*
 * Le funzioni di animazione di framer-motion, caricate dopo l'avvio.
 *
 * L'app usa i componenti leggeri `m.*` dentro `<LazyMotion>`: il motore delle
 * animazioni (springs, keyframes, gesti) arriva da qui, con un import a parte,
 * invece di stare nel primo caricamento. Bastano le funzioni DOM: nessuna
 * schermata dell'app usa il layout animato (solo la tavola di design, che si
 * porta le sue).
 */
export { domAnimation as default } from "framer-motion";
