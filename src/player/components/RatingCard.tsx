import type { ContentRating } from '../types';

/**
 * Il cartello dei primi secondi: per chi è questo titolo, e perché.
 *
 * Compare solo se la classificazione c'è davvero. Le avvertenze sotto la sigla
 * sono quelle scritte a mano nella scheda del titolo (campo "Avvertenze"):
 * nessun catalogo pubblico le espone in modo affidabile, e dedurle dal genere
 * — "è un horror, quindi violenza" — sarebbe inventarle. Meglio una riga in
 * meno che una riga falsa.
 */
export default function RatingCard({ rating }: { rating: ContentRating }) {
  const second = rating.descriptors.length ? rating.descriptors.join(', ') : rating.ageLabel;
  return (
    <div className="pv-rating-card" role="note">
      <span className="pv-rating-cert">Classificazione {rating.certification}</span>
      {second && <span className="pv-rating-detail">{second}</span>}
    </div>
  );
}
