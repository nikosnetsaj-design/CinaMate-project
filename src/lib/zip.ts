/**
 * Lettura di uno ZIP, quanto basta per un export di Letterboxd.
 *
 * Letterboxd consegna i dati come ZIP, e sul telefono aprirlo per pescare i
 * CSV giusti è il passaggio in cui ci si arrende. Il browser sa già
 * decomprimere (`DecompressionStream("deflate-raw")`): qui c'è solo la mappa
 * del formato — la directory centrale in fondo al file, l'intestazione di
 * ogni voce — senza una libreria da trenta kB per fare la stessa cosa.
 *
 * Fuori di proposito: ZIP64 (oltre 4 GB, o 65 535 voci: non un export di
 * film) e la cifratura. Uno ZIP così dà un errore che dice cosa fare.
 */

export class ZipError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ZipError";
  }
}

export interface ZipEntry {
  name: string;
  /** Il contenuto, decompresso. */
  read: () => Promise<Uint8Array>;
}

const EOCD = 0x06054b50;
const CENTRAL = 0x02014b50;
const LOCAL = 0x04034b50;

export function zipSupported(): boolean {
  if (typeof DecompressionStream === "undefined") return false;
  try {
    new DecompressionStream("deflate-raw");
    return true;
  } catch {
    return false;
  }
}

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export function listZip(buffer: ArrayBuffer): ZipEntry[] {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  if (bytes.length < 22) throw new ZipError("Il file è troppo corto per essere uno ZIP.");

  // La fine della directory centrale sta negli ultimi 22 byte, più un
  // eventuale commento di al massimo 65 535: si cerca all'indietro.
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 0xffff); i--) {
    if (view.getUint32(i, true) === EOCD) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new ZipError("Non sembra un file ZIP.");

  const count = view.getUint16(eocd + 10, true);
  let offset = view.getUint32(eocd + 16, true);
  if (count === 0xffff || offset === 0xffffffff) throw new ZipError("ZIP troppo grande (ZIP64): estrailo e scegli i file CSV.");

  const decoder = new TextDecoder();
  const entries: ZipEntry[] = [];
  for (let n = 0; n < count; n++) {
    if (offset + 46 > bytes.length || view.getUint32(offset, true) !== CENTRAL) throw new ZipError("Lo ZIP è danneggiato.");
    const flags = view.getUint16(offset + 8, true);
    const method = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localOffset = view.getUint32(offset + 42, true);
    const name = decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLength));
    offset += 46 + nameLength + extraLength + commentLength;

    if (name.endsWith("/")) continue; // una cartella
    const encrypted = (flags & 0x1) !== 0;

    entries.push({
      name,
      read: async () => {
        if (encrypted) throw new ZipError(`«${name}» è cifrato.`);
        if (view.getUint32(localOffset, true) !== LOCAL) throw new ZipError("Lo ZIP è danneggiato.");
        // Le lunghezze dell'intestazione locale possono differire da quelle
        // della directory centrale (il campo extra spesso sì): vanno rilette.
        const localName = view.getUint16(localOffset + 26, true);
        const localExtra = view.getUint16(localOffset + 28, true);
        const start = localOffset + 30 + localName + localExtra;
        const data = bytes.subarray(start, start + compressedSize);
        if (method === 0) return data.slice();
        if (method === 8) return inflateRaw(data);
        throw new ZipError(`«${name}» usa una compressione che il browser non conosce.`);
      },
    });
  }
  return entries;
}

/** I file di testo dello ZIP che finiscono in `.csv`, letti come UTF-8. */
export async function readZipCsvs(buffer: ArrayBuffer): Promise<{ name: string; text: string }[]> {
  const decoder = new TextDecoder();
  const out: { name: string; text: string }[] = [];
  for (const entry of listZip(buffer)) {
    // I metadati che macOS aggiunge agli ZIP che crea (__MACOSX/._file)
    // hanno estensione .csv e contengono byte senza senso.
    if (!entry.name.toLowerCase().endsWith(".csv") || entry.name.includes("__MACOSX/")) continue;
    out.push({ name: entry.name, text: decoder.decode(await entry.read()) });
  }
  return out;
}
