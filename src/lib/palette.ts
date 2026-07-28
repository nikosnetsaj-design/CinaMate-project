/**
 * Fallback poster art for titles with no TMDB image. Every pair is mixed from
 * the same three Technicolor dyes as the interface — magenta, cyan, yellow —
 * over the aubergine base, so a shelf of unlinked titles still reads as one
 * family instead of a bag of random jewel tones.
 */
const PALETTES: [string, string][] = [
  ["#2B1030", "#8E1F63"],
  ["#241436", "#5B2F9E"],
  ["#101F33", "#1F5F8E"],
  ["#0E2A2E", "#1E7A80"],
  ["#2E1226", "#B3247A"],
  ["#1A1A34", "#443C9E"],
  ["#301A12", "#A85A2A"],
  ["#122A26", "#26806A"],
  ["#33122A", "#96206B"],
  ["#1C1030", "#6B2FA0"],
  ["#0F2436", "#2A6E9E"],
  ["#2A1436", "#7A2F8E"],
];

function hashOf(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function paletteFor(title: string): [string, string] {
  return PALETTES[hashOf(title || "x") % PALETTES.length];
}
