/**
 * CSV, nel dialetto che usano davvero gli export: RFC 4180 con le sue
 * eccezioni di fatto.
 *
 * Campi fra virgolette che contengono virgole, a capo e virgolette raddoppiate
 * (`"Dottor Stranamore, ovvero…"`, una recensione su tre righe); fine riga
 * `\r\n` o `\n`; il BOM che Excel mette in testa e che altrimenti diventa
 * parte del nome della prima colonna. Il separatore si indovina dalla prima
 * riga: un foglio salvato da un Excel italiano usa il punto e virgola, perché
 * la virgola è il separatore dei decimali.
 */
export function parseCsv(text: string): string[][] {
  const source = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const delimiter = guessDelimiter(source);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let i = 0;

  while (i < source.length) {
    const c = source[i];
    if (quoted) {
      if (c === '"') {
        if (source[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        quoted = false;
        i++;
        continue;
      }
      field += c;
      i++;
      continue;
    }
    if (c === '"' && field === "") {
      quoted = true;
      i++;
      continue;
    }
    if (c === delimiter) {
      row.push(field);
      field = "";
      i++;
      continue;
    }
    if (c === "\r" || c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i += c === "\r" && source[i + 1] === "\n" ? 2 : 1;
      continue;
    }
    field += c;
    i++;
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function guessDelimiter(text: string): string {
  const firstLine = text.slice(0, Math.max(0, text.search(/\r?\n/)) || text.length);
  const count = (ch: string) => firstLine.split(ch).length - 1;
  return count(";") > count(",") ? ";" : ",";
}

/**
 * Le righe come oggetti, chiave l'intestazione. Le righe vuote — quelle che
 * separano i blocchi in un export di Letterboxd — si saltano; le intestazioni
 * si confrontano senza badare a maiuscole e spazi, perché «Watched Date»,
 * «watched date» e «WatchedDate» sono la stessa colonna scritta da tre
 * programmi diversi.
 */
export function rowsAsRecords(rows: string[][]): { headers: string[]; records: Record<string, string>[] } {
  const nonEmpty = rows.filter((r) => r.some((cell) => cell.trim() !== ""));
  if (nonEmpty.length === 0) return { headers: [], records: [] };
  const headers = nonEmpty[0].map(headerKey);
  const records = nonEmpty.slice(1).map((r) => {
    const record: Record<string, string> = {};
    headers.forEach((h, index) => {
      if (h) record[h] = (r[index] ?? "").trim();
    });
    return record;
  });
  return { headers, records };
}

/** «Watched Date» → «watcheddate»: la forma con cui si confrontano le intestazioni. */
export function headerKey(header: string): string {
  return header.toLowerCase().replace(/[\s_\-()]/g, "");
}

/** Una cella pronta per un CSV: fra virgolette solo quando serve. */
export function csvCell(value: string | number | null | undefined, delimiter = ","): string {
  if (value === null || value === undefined) return "";
  const text = String(value);
  const needsQuotes = /["\r\n]/.test(text) || text.includes(delimiter) || /^\s|\s$/.test(text);
  return needsQuotes ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * Le righe come testo CSV.
 *
 * `delimiter: ";"` è per chi apre il file con un doppio clic: l'Excel
 * italiano separa le colonne col punto e virgola, perché la virgola è il
 * separatore dei decimali, e un file a virgole gli finisce tutto nella
 * colonna A. Il lettore qui sopra indovina il separatore, quindi il file
 * torna indietro uguale.
 */
export function toCsv(rows: (string | number | null | undefined)[][], delimiter = ","): string {
  // `\r\n` come chiede la RFC: è quello che Excel e Numbers si aspettano, e
  // gli altri lo leggono comunque.
  return rows.map((row) => row.map((cell) => csvCell(cell, delimiter)).join(delimiter)).join("\r\n") + "\r\n";
}
