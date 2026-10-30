import { useTitleExtras } from "../lib/useTitleExtras";
import type { Item } from "../types";
import { SeatIcon } from "./icons";

/**
 * «C'è una scena dopo i titoli?» detto nella scheda, prima di cominciare.
 *
 * Sta sotto la riga dei fatti e non dentro: quelli dicono cos'è il titolo,
 * questo dice cosa fare a fine visione — e una pastiglia con la poltrona si
 * nota a colpo d'occhio, che è l'unico momento in cui serve. Senza il dato non
 * compare niente: un'assenza della keyword su TMDB non vuol dire che la
 * scena non ci sia, e l'app non lo afferma.
 */
export function CreditsScenesNote({ item }: { item: Item }) {
  const { extras } = useTitleExtras(item);
  const scenes = extras?.creditsScenes;
  if (!scenes || (!scenes.during && !scenes.after)) return null;
  const text =
    scenes.during && scenes.after
      ? "Scene durante e dopo i titoli di coda"
      : scenes.after
        ? "Scena dopo i titoli di coda"
        : "Scena durante i titoli di coda";
  return (
    <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-surface-2 px-3 py-1.5 text-xs font-medium text-text">
      <span aria-hidden="true" style={{ color: "var(--accent-text)" }}>
        <SeatIcon size={14} />
      </span>
      {text}
    </p>
  );
}
