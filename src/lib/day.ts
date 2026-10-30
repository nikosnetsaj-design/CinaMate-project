/**
 * Il giorno di calendario, quello del telefono che hai in mano.
 *
 * Il diario si scriveva con `toISOString().slice(0, 10)`, cioè col giorno di
 * Greenwich: in Italia un episodio segnato alle 00:40 finiva nel giorno prima,
 * e d'estate succedeva fino alle due di notte. Non era una svista estetica —
 * l'obiettivo «due film a settimana» confronta il diario con i confini della
 * settimana *locale*, quindi un film finito lunedì all'una non contava per la
 * settimana nuova, e la striscia di giorni di fila si spezzava proprio nelle
 * sere in cui si guarda di più. Il player lo sapeva già (`localDay` in
 * `player/services/statsAndHistory.ts`, che resta suo per non intrecciare i
 * due moduli): adesso lo sa anche il resto dell'app, in un posto solo.
 */
export function localDay(at: Date = new Date()): string {
  const y = at.getFullYear();
  const m = String(at.getMonth() + 1).padStart(2, "0");
  const d = String(at.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Il giorno di `days` giorni fa, contato sul calendario e non in ore. */
export function localDaysAgo(days: number, from: Date = new Date()): string {
  return localDay(new Date(from.getFullYear(), from.getMonth(), from.getDate() - days));
}

/** Il primo record con un id a orologio è del 2020: prima è un numero, non un istante. */
const EARLIEST_TIMESTAMP = Date.UTC(2020, 0, 1);

/**
 * L'istante in cui è nato un record, quando l'id lo porta scritto.
 *
 * Diario e libreria danno ai record un id della forma `1730163600000-k3j9x2`:
 * la prima metà è `Date.now()` al momento della scrittura. È l'unico posto in
 * cui l'ora esatta sopravvive, ed è ciò che permette di correggere le date
 * scritte prima di questa versione senza indovinare niente.
 */
export function timestampFromId(id: string): number | null {
  const head = /^(\d{13})-/.exec(id)?.[1];
  if (!head) return null;
  const ts = Number(head);
  // Un giorno di margine sul futuro: un orologio di sistema avanti di qualche
  // ora non deve far scartare un record vero.
  return ts >= EARLIEST_TIMESTAMP && ts <= Date.now() + 86_400_000 ? ts : null;
}

/**
 * La data giusta per un record scritto col giorno di Greenwich.
 *
 * Si corregge solo quando la data salvata è *esattamente* il giorno UTC
 * dell'istante nell'id: è la prova che è stata calcolata in quel momento, e
 * non scritta a mano, importata da un altro servizio o scelta di proposito.
 * Per lo stesso motivo la funzione è idempotente — una data già locale, se
 * diversa da quella UTC, non supera più il controllo — e può girare a ogni
 * avvio e su ogni backup che arriva, senza un interruttore «già fatto».
 */
export function repairUtcDay(date: string, id: string): string {
  const ts = timestampFromId(id);
  if (ts === null) return date;
  const instant = new Date(ts);
  return instant.toISOString().slice(0, 10) === date ? localDay(instant) : date;
}
