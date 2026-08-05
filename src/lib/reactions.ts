import type { Reaction } from "../player/types";

/**
 * I tre pollici del player ↔ il voto da 1 a 10 della libreria.
 *
 * Sono la stessa cosa detta a due velocità: mentre guardi non hai voglia di
 * scegliere fra "7" e "8", ma un pollice sì. Tenerli separati — reazioni da una
 * parte, voti dall'altra — avrebbe prodotto due giudizi paralleli sullo stesso
 * titolo e nessuna delle due statistiche sarebbe più stata vera.
 *
 * La traduzione perde per forza qualcosa: chi dà un pollice in su intende un
 * "buono", non necessariamente un 8 tondo. Va nella direzione giusta e resta
 * modificabile a mano nella scheda, che è il posto dove si mette la sfumatura.
 */

export const REACTION_VOTE: Record<Reaction, number> = {
  down: 4,
  up: 8,
  love: 10,
};

export const REACTION_LABEL: Record<Reaction, string> = {
  down: "Non fa per me",
  up: "Mi piace",
  love: "Adoro",
};

/** Il pollice che corrisponde a un voto già dato, o null se non c'è voto. */
export function reactionOf(vote: number | null | undefined): Reaction | null {
  if (vote == null) return null;
  if (vote <= 5) return "down";
  if (vote <= 8) return "up";
  return "love";
}
