import type { Item, Status } from "../types";

/**
 * Mettere e togliere dalla lista, senza inventare uno stato che non esiste.
 *
 * In CineMate ogni titolo ha uno stato, sempre: non c'è un «nessuno stato» in
 * cui far cadere quello che togli dalla lista, e per un po' questo è stato il
 * motivo per cui il pulsante non c'era. Ma l'unica alternativa rimasta era
 * *Elimina*, che cancella il titolo, il voto e le note — cioè una cosa
 * completamente diversa da «non lo guardo più».
 *
 * Quindi si sceglie lo stato più vicino alla verità e lo si dice ad alta voce:
 * un titolo che non avevi ancora iniziato diventa *Abbandonato* («lasciato
 * perdere»), uno che avevi già cominciato diventa *In pausa* («messo da
 * parte»). Nessuno dei due perde niente, ed entrambi si cambiano con un tocco
 * dalle pastiglie dello stato.
 */

export function isInWatchlist(item: Item): boolean {
  return item.status === "Da vedere";
}

/**
 * Dove finisce un titolo tolto dalla lista: esattamente dov'era prima di
 * finirci, cioè *Sullo scaffale*.
 *
 * La prima versione lo segnava *Abbandonato*, che è un'altra cosa: dice «ci ho
 * rinunciato» di un titolo che magari non hai nemmeno aperto. Togliere dalla
 * lista non è una rinuncia, è annullare una promessa — e dopo deve essere come
 * se non l'avessi mai fatta.
 */
export function removedStatus(_item: Item): Status {
  return "Sullo scaffale";
}

export function removalMessage(item: Item): string {
  return `«${item.title}» è fuori dalla lista: resta in libreria, sullo scaffale. Non è stato eliminato.`;
}
