import {
  Award,
  CalendarCheck,
  Clapperboard,
  Compass,
  Drama,
  Fingerprint,
  Flame,
  Ghost,
  Landmark,
  Layers,
  Medal,
  PenLine,
  Repeat,
  Rocket,
  Tv,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AnimeKindIcon } from "./icons";

/**
 * L'icona di un traguardo, scelta dal suo id.
 *
 * I traguardi portavano un'emoji ciascuno (🩸 🛸 🔥 🧐…): disegnate da chi fa
 * il sistema operativo, con i colori di chi fa il sistema operativo, diverse
 * su ogni telefono, e l'unica cosa dell'app che sembrasse un adesivo. Qui ogni
 * traguardo ha un'icona dello stesso disegno di tutte le altre. L'emoji resta
 * nei dati di `lib/achievements` — è la parte che non si tocca — e semplicemente
 * non si disegna più.
 */
const ICONS: Record<string, LucideIcon> = {
  centurione: Medal,
  "saga-completa": Layers,
  collezionista: Landmark,
  "serie-finite": Tv,
  maratoneta: Flame,
  esploratore: Compass,
  cinefilo: Clapperboard,
  fedelissimo: Repeat,
  costante: CalendarCheck,
  critico: PenLine,
  horror: Ghost,
  fantascienza: Rocket,
  commedia: Drama,
  thriller: Fingerprint,
};

export function AchievementIcon({ id, size = 22 }: { id: string; size?: number }) {
  if (id === "otaku") return <AnimeKindIcon size={size} />;
  const Glyph = ICONS[id] ?? Award;
  return <Glyph size={size} strokeWidth={1.75} aria-hidden="true" />;
}
