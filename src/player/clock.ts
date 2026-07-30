/** Timestamp parsing and formatting for the source panel's marker fields. */

export function formatClock(totalSec: number): string {
  const sec = Math.max(0, Math.round(totalSec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const mm = String(m).padStart(h > 0 ? 2 : 1, "0");
  return h > 0 ? `${h}:${mm}:${String(s).padStart(2, "0")}` : `${mm}:${String(s).padStart(2, "0")}`;
}

/**
 * Accepts "90" (seconds), "1:30" and "0:01:30" — the three ways someone
 * actually types a timestamp. Returns null for anything else, so a typo leaves
 * the marker where it was instead of moving it to second zero.
 */
export function parseClock(raw: string): number | null {
  const text = raw.trim();
  if (!text) return null;
  if (!/^\d+(:\d{1,2}){0,2}$/.test(text)) return null;
  const parts = text.split(":").map(Number);
  if (parts.some((n) => !Number.isFinite(n))) return null;
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] * 3600 + parts[1] * 60 + parts[2];
}
