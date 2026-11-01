/**
 * Il minimo per aprire uno ZIP nel browser, senza librerie: quello che
 * Letterboxd manda è uno ZIP di CSV, e chiedere di scompattarlo a mano prima
 * di importare sarebbe un passaggio in più per niente.
 *
 * Legge l'indice in fondo al file, poi ogni voce: «stored» così com'è,
 * «deflate» con `DecompressionStream("deflate-raw")`, che i browser moderni
 * hanno tutti. Le cartelle e i file che non sono testo restano fuori.
 */
export interface ZipEntry {
  name: string;
  text: string;
}

export function isZip(buffer: ArrayBuffer): boolean {
  const b = new Uint8Array(buffer, 0, Math.min(4, buffer.byteLength));
  return b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04;
}

async function inflate(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export async function unzip(buffer: ArrayBuffer, accept: (name: string) => boolean = () => true): Promise<ZipEntry[]> {
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  // La fine dell'indice: la firma 0x06054b50 negli ultimi 64 KB.
  let end = -1;
  for (let i = buffer.byteLength - 22; i >= Math.max(0, buffer.byteLength - 65_557); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      end = i;
      break;
    }
  }
  if (end < 0) throw new Error("Lo ZIP non ha un indice leggibile.");

  const count = view.getUint16(end + 10, true);
  let offset = view.getUint32(end + 16, true);
  const decoder = new TextDecoder("utf-8");
  const out: ZipEntry[] = [];

  for (let i = 0; i < count; i++) {
    if (view.getUint32(offset, true) !== 0x02014b50) break;
    const method = view.getUint16(offset + 10, true);
    const compressed = view.getUint32(offset + 20, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const local = view.getUint32(offset + 42, true);
    const name = decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLength));
    offset += 46 + nameLength + extraLength + commentLength;

    if (name.endsWith("/") || !accept(name)) continue;
    const localName = view.getUint16(local + 26, true);
    const localExtra = view.getUint16(local + 28, true);
    const start = local + 30 + localName + localExtra;
    const data = bytes.subarray(start, start + compressed);
    let raw: Uint8Array;
    if (method === 0) raw = data;
    else if (method === 8) raw = await inflate(data);
    else continue;
    out.push({ name, text: decoder.decode(raw) });
  }
  return out;
}
