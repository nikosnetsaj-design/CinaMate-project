import { intlLocale, t } from "./i18n";

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
  if (diff < 0) return t("format.uscito");
  if (diff === 0) return t("format.oggi");
  if (diff === 1) return t("format.domani");
  if (diff < 30) return t("format.tra_giorni", { v0: diff });
  const months = Math.round(diff / 30);
  return months === 1 ? t("format.tra_un_mese") : t("format.tra_mesi", { v0: months });
}

export function monthLabel(dateStr: string): string {
  return new Intl.DateTimeFormat(intlLocale(), { month: "long", year: "numeric" }).format(new Date(`${dateStr}T00:00:00`));
}

/**
 * Le cifre di un bilancio, in dollari come le pubblica TMDB.
 *
 * Restano in dollari e non convertite in euro perché il cambio di oggi non
 * dice niente di un film del 1994: «$25.000.000» è il dato, «23 milioni di
 * euro» sarebbe una stima inventata al tasso sbagliato.
 */
export function formatUsd(amount: number): string {
  return `$${new Intl.NumberFormat(intlLocale()).format(Math.round(amount))}`;
}

/** Lo stesso numero dove non c'è spazio: «$370 mln», «$1,2 mld». */
export function formatUsdShort(amount: number): string {
  const abs = Math.abs(amount);
  const round = (n: number) => new Intl.NumberFormat(intlLocale(), { maximumFractionDigits: 1 }).format(n);
  if (abs >= 1_000_000_000) return t("format.mld", { v0: round(amount / 1_000_000_000) });
  if (abs >= 1_000_000) return t("format.mln", { v0: round(amount / 1_000_000) });
  if (abs >= 1_000) return t("format.mila", { v0: round(amount / 1_000) });
  return formatUsd(amount);
}

export function dayLabel(dateStr: string): string {
  return new Intl.DateTimeFormat(intlLocale(), { weekday: "short", day: "numeric", month: "short" }).format(
    new Date(`${dateStr}T00:00:00`),
  );
}

/** «1 titolo», «12 titoli», con le migliaia all'italiana. */
export function plural(n: number, one: string, many: string): string {
  return `${n.toLocaleString(intlLocale())} ${n === 1 ? one : many}`;
}

/**
 * Fa scaricare un file creato qui. L'indirizzo temporaneo si libera dopo un
 * attimo e non subito: Safari annulla lo scaricamento se lo revochi nello
 * stesso giro in cui hai fatto clic.
 */
export function downloadFile(data: Blob, fileName: string): void {
  const url = URL.createObjectURL(data);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Lo scorrimento animato, tranne per chi ha chiesto meno movimento: il CSS
 * spegne `scroll-behavior`, ma uno `scrollIntoView({ behavior: "smooth" })`
 * scritto in JavaScript lo scavalcherebbe.
 */
export function scrollBehavior(): ScrollBehavior {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
}
