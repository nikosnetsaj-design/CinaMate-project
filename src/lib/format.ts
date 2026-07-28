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

export function dayLabel(dateStr: string): string {
  return new Intl.DateTimeFormat("it-IT", { weekday: "short", day: "numeric", month: "short" }).format(
    new Date(`${dateStr}T00:00:00`),
  );
}
