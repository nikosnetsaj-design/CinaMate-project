import type { Item } from "../types";

/**
 * Age ratings, and the honest limits of turning them into one number.
 *
 * Italy and the US do not rate the same film the same way, and neither system
 * maps cleanly onto "minimum age": "PG-13" is advice to parents, "VM14" is a
 * legal restriction. What follows is a working translation to the lowest age
 * the rating is generally taken to allow — good enough to keep a horror film
 * off a seven-year-old's shelf, and not a substitute for looking at what your
 * child is watching. The UI says so rather than implying an authority the
 * mapping doesn't have.
 */
const AGE_BY_CERTIFICATION: Record<string, number> = {
  // Italy
  T: 0,
  "VM6": 6,
  "VM12": 12,
  "VM14": 14,
  "VM18": 18,
  // United States — films
  G: 0,
  PG: 6,
  "PG-13": 13,
  R: 17,
  "NC-17": 18,
  // United States — television
  "TV-Y": 0,
  "TV-Y7": 7,
  "TV-G": 0,
  "TV-PG": 6,
  "TV-14": 14,
  "TV-MA": 17,
};

export const AGE_LEVELS = [0, 6, 12, 14, 18] as const;
export type AgeLevel = (typeof AGE_LEVELS)[number];

export const AGE_LABELS: Record<AgeLevel, string> = {
  0: "Per tutti",
  6: "Dai 6 anni",
  12: "Dai 12 anni",
  14: "Dai 14 anni",
  18: "Solo adulti",
};

/**
 * The minimum age for a title, or null when nothing says. Null is the
 * interesting case and the one the caller has to decide about: an unrated
 * title is not a safe title, it is an unknown one.
 */
export function minimumAge(item: Item): number | null {
  const cert = item.certification?.trim().toUpperCase();
  if (!cert) return null;
  return AGE_BY_CERTIFICATION[cert] ?? null;
}

export interface ParentalRules {
  enabled: boolean;
  maxAge: AgeLevel;
  /**
   * What to do with a title nothing has rated. Defaults to hiding it, because
   * the alternative — showing everything TMDB happens not to have rated — is
   * the exact hole that makes a parental filter worthless.
   */
  allowUnrated: boolean;
}

/** True when the rules say this title should be out of sight. */
export function isBlocked(item: Item, rules: ParentalRules): boolean {
  if (!rules.enabled) return false;
  const age = minimumAge(item);
  if (age === null) return !rules.allowUnrated;
  return age > rules.maxAge;
}

export function applyParental(items: Item[], rules: ParentalRules): Item[] {
  if (!rules.enabled) return items;
  return items.filter((item) => !isBlocked(item, rules));
}

/**
 * SHA-256 of the PIN with a per-device salt, so the stored value is not the
 * PIN itself.
 *
 * Worth being plain about what this is and isn't: everything here lives in
 * localStorage on a device the child is holding, so anyone who opens developer
 * tools can clear the flag. Hashing stops the PIN being *readable* — which
 * matters, because people reuse PINs — but this is a lock on a cupboard, not
 * a safe. Real enforcement needs an account and a server, which this app
 * deliberately doesn't have (PRODUCT.md §6-bis).
 */
export async function hashPin(pin: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${pin}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function newSalt(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
