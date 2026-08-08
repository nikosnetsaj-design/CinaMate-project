/**
 * Un secchio a gettoni (Token Bucket) per contingentare le richieste uscenti.
 *
 * Il backoff in `tmdb.ts` è una cura: interviene *dopo* che il server ha detto
 * basta. Questo è la prevenzione, e serve perché il backoff da solo ha un
 * difetto — per imparare che stiamo esagerando dobbiamo prima esagerare, e il
 * prezzo lo paga l'utente in attesa.
 *
 * Perché a gettoni e non "una richiesta ogni N millisecondi": il caso normale
 * di questa app è una raffica breve e legittima (si apre la Home e partono
 * dodici chiamate) seguita da minuti di silenzio. Una cadenza fissa punirebbe
 * proprio quel caso, mettendo in fila dodici richieste che il server accetta
 * senza battere ciglio. Il secchio invece parte pieno: la raffica passa
 * intera, e il limite si fa sentire solo su chi continua a chiedere — la
 * passata di collegamento automatico su una libreria di duecento titoli.
 */
export class TokenBucket {
  private tokens: number;
  private last = Date.now();
  private queue: { resolve: () => void; reject: (e: unknown) => void; release: () => void }[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private readonly capacity: number;
  private readonly refillPerSecond: number;

  /**
   * @param capacity Quanti gettoni sta nel secchio, cioè quanto è lunga la
   *   raffica che passa senza attesa.
   * @param refillPerSecond Quanti gettoni tornano dentro ogni secondo, cioè il
   *   ritmo a regime.
   */
  constructor(capacity: number, refillPerSecond: number) {
    this.capacity = capacity;
    this.refillPerSecond = refillPerSecond;
    this.tokens = capacity;
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = (now - this.last) / 1000;
    // Un orologio che va all'indietro (cambio d'ora, sospensione del portatile)
    // non deve togliere gettoni: nel dubbio si riparte da adesso.
    if (elapsed <= 0) {
      this.last = now;
      return;
    }
    this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillPerSecond);
    this.last = now;
  }

  /**
   * Aspetta il proprio turno. Risolve subito se c'è un gettone libero e
   * nessuno in coda prima — la coda è in ordine d'arrivo, perché scavalcare
   * significherebbe che la ricerca che l'utente sta aspettando può restare
   * indietro rispetto a una passata di fondo.
   */
  take(signal?: AbortSignal, onAbort?: () => unknown): Promise<void> {
    if (signal?.aborted) return Promise.reject(onAbort?.() ?? new Error("Richiesta annullata"));
    this.refill();
    if (this.queue.length === 0 && this.tokens >= 1) {
      this.tokens -= 1;
      return Promise.resolve();
    }
    return new Promise<void>((resolve, reject) => {
      const entry = {
        resolve,
        reject,
        release: () => signal?.removeEventListener("abort", abort),
      };
      const abort = () => {
        // Chi se ne va libera il posto senza consumare il gettone: la coda
        // scorre per gli altri. È il caso della ricerca a ogni battuta, dove
        // quasi tutte le richieste vengono abbandonate prima di partire.
        const i = this.queue.indexOf(entry);
        if (i >= 0) this.queue.splice(i, 1);
        reject(onAbort?.() ?? new Error("Richiesta annullata"));
      };
      signal?.addEventListener("abort", abort, { once: true });
      this.queue.push(entry);
      this.pump();
    });
  }

  private pump(): void {
    this.refill();
    while (this.queue.length > 0 && this.tokens >= 1) {
      const next = this.queue.shift()!;
      this.tokens -= 1;
      next.release();
      next.resolve();
    }
    if (this.queue.length > 0) this.scheduleNext();
  }

  private scheduleNext(): void {
    if (this.timer !== null) return;
    const missing = Math.max(0, 1 - this.tokens);
    const ms = Math.max(10, Math.ceil((missing / this.refillPerSecond) * 1000));
    this.timer = setTimeout(() => {
      this.timer = null;
      this.pump();
    }, ms);
  }

  /** Quanti ne stanno aspettando. Serve alla pagina Diagnostica, non alla logica. */
  get waiting(): number {
    return this.queue.length;
  }
}
