export function formatRuntime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
}

/** Whole days from today to an ISO `yyyy-mm-dd`; negative once it has passed. */
export function daysBetweenToday(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${dateStr}T00:00:00`);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

export function countdown(dateStr: string): string {
  const diff = daysBetweenToday(dateStr);
  if (diff < 0) return "uscito";
  if (diff === 0) return "oggi";
  if (diff === 1) return "domani";
  if (diff < 30) return `tra ${diff} giorni`;
  const months = Math.round(diff / 30);
  return months === 1 ? "tra un mese" : `tra ${months} mesi`;
}

export function monthLabel(dateStr: string): string {
  return new Intl.DateTimeFormat("it-IT", { month: "long", year: "numeric" }).format(new Date(`${dateStr}T00:00:00`));
}

/**
 * Le cifre di un bilancio, in dollari come le pubblica TMDB.
 *
 * Restano in dollari e non convertite in euro perché il cambio di oggi non
 * dice niente di un film del 1994: «$25.000.000» è il dato, «23 milioni di
 * euro» sarebbe una stima inventata al tasso sbagliato.
 */
export function formatUsd(amount: number): string {
  return `$${new Intl.NumberFormat("it-IT").format(Math.round(amount))}`;
}

/** Lo stesso numero dove non c'è spazio: «$370 mln», «$1,2 mld». */
export function formatUsdShort(amount: number): string {
  const abs = Math.abs(amount);
  const round = (n: number) => new Intl.NumberFormat("it-IT", { maximumFractionDigits: 1 }).format(n);
  if (abs >= 1_000_000_000) return `$${round(amount / 1_000_000_000)} mld`;
  if (abs >= 1_000_000) return `$${round(amount / 1_000_000)} mln`;
  if (abs >= 1_000) return `$${round(amount / 1_000)} mila`;
  return formatUsd(amount);
}

export function dayLabel(dateStr: string): string {
  return new Intl.DateTimeFormat("it-IT", { weekday: "short", day: "numeric", month: "short" }).format(
    new Date(`${dateStr}T00:00:00`),
  );
}
