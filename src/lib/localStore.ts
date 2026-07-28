/**
 * Shared read/write for the localStorage-backed stores. Every one of them wants
 * the same three things — never throw on a private-mode or quota failure, never
 * trust what comes back, always fall back to a known-good value — so the guard
 * lives here instead of once per store.
 */
export function readJson<T>(key: string, isValid: (value: unknown) => value is T, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    const parsed: unknown = JSON.parse(raw);
    return isValid(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

/** Returns false when the write was rejected (quota, private mode, no storage). */
export function writeJson(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function removeKey(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* nothing to do: the value simply outlives the session */
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
