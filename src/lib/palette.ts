/**
 * Fallback poster art for titles with no TMDB image.
 *
 * Erano dodici gradienti di magenta, viola e ciano su fondo melanzana — i tre
 * colori della vecchia identità — e su uno scaffale senza copertine facevano
 * la cosa più accesa dello schermo, nella combinazione di colori più abusata
 * delle interfacce di oggi. Ora sono toni di terra e d'inchiostro, spenti e
 * scuri: brace, ocra, salvia, ardesia, vinaccia, ottone. Uno scaffale di titoli
 * senza copertina resta una famiglia, e il titolo bianco sopra si legge sempre.
 */
const PALETTES: [string, string][] = [
  ["#1d1612", "#6b3a26"],
  ["#1b1a14", "#6b5a2e"],
  ["#141a16", "#3f5a45"],
  ["#12171d", "#34506a"],
  ["#1e1416", "#6a3038"],
  ["#181616", "#4d4640"],
  ["#1c1712", "#7a4a2a"],
  ["#131a1b", "#2f5859"],
  ["#1d1518", "#5a3a4a"],
  ["#171914", "#4f5a38"],
  ["#16161b", "#40415a"],
  ["#1e1912", "#7d6036"],
];

function hashOf(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function paletteFor(title: string): [string, string] {
  return PALETTES[hashOf(title || "x") % PALETTES.length];
}
