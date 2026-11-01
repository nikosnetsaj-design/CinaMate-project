import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { join } from "node:path";

/**
 * Il budget del primo caricamento: quello che il browser scarica per aprire
 * l'app, cioè lo script d'ingresso, i pezzi che `index.html` precarica e il
 * CSS — compressi come li servirebbe GitHub Pages. Sopra il tetto la CI si
 * ferma: un'app che si apre in un lampo smette di farlo un import alla volta.
 */
const LIMIT_KB = 200;
const dist = process.argv[2] ?? "dist";
const html = readFileSync(join(dist, "index.html"), "utf8");
const files = [...new Set([...html.matchAll(/(?:src|href)="[^"]*?(assets\/[^"]+\.(?:js|css))"/g)].map((m) => m[1]))];

let total = 0;
const rows = files.map((f) => {
  const size = gzipSync(readFileSync(join(dist, f)), { level: 9 }).length;
  total += size;
  return { f, size };
});
rows.sort((a, b) => b.size - a.size);
for (const { f, size } of rows.slice(0, 6)) console.log(`${(size / 1024).toFixed(1).padStart(7)} KB  ${f}`);
const kb = total / 1024;
console.log(`\nPrimo caricamento: ${kb.toFixed(1)} KB gzip in ${files.length} file (tetto ${LIMIT_KB} KB).`);
if (kb > LIMIT_KB) {
  console.error(`Oltre il budget di ${(kb - LIMIT_KB).toFixed(1)} KB.`);
  process.exit(1);
}
