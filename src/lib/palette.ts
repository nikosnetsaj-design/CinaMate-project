const PALETTES: [string, string][] = [
  ["#2A1B3D", "#5B3E8C"],
  ["#16283D", "#2E5266"],
  ["#3D1618", "#8C2F2F"],
  ["#12301F", "#2F6B4F"],
  ["#3A2C12", "#8C6B2F"],
  ["#2D163D", "#6B2F8C"],
  ["#3D1626", "#8C2F5E"],
  ["#123334", "#2F7A7A"],
  ["#232323", "#5C5C5C"],
  ["#3A2412", "#8C5A2F"],
  ["#1A1F3D", "#3E4A8C"],
  ["#3D2418", "#A6553A"],
];

function hashOf(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function paletteFor(title: string): [string, string] {
  return PALETTES[hashOf(title || "x") % PALETTES.length];
}
