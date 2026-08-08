const { TokenBucket } = await import("../../src/lib/rateLimit.ts");

let failures = 0;
function check(name: string, cond: boolean, detail = "") {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!cond) failures++;
}

// 1. La raffica entro la capienza passa senza attesa.
{
  const b = new TokenBucket(20, 10);
  const t0 = Date.now();
  await Promise.all(Array.from({ length: 20 }, () => b.take()));
  const ms = Date.now() - t0;
  check("20 richieste entro capienza → nessuna attesa", ms < 30, `${ms}ms`);
}

// 2. Oltre la capienza si aspetta il ricarico, al ritmo dichiarato.
{
  const b = new TokenBucket(5, 10); // 10/s → un gettone ogni 100ms
  const t0 = Date.now();
  await Promise.all(Array.from({ length: 8 }, () => b.take()));
  const ms = Date.now() - t0;
  // 5 subito, le altre 3 a 100ms l'una → ~300ms
  check("8 richieste su capienza 5 → attende ~300ms", ms >= 250 && ms < 600, `${ms}ms`);
}

// 3. L'ordine è d'arrivo: chi chiede prima parte prima.
{
  const b = new TokenBucket(1, 20);
  const order: number[] = [];
  await Promise.all(
    Array.from({ length: 5 }, (_, i) => b.take().then(() => void order.push(i))),
  );
  check("ordine FIFO rispettato", order.join(",") === "0,1,2,3,4", order.join(","));
}

// 4. Chi annulla libera il posto e non consuma il gettone.
{
  const b = new TokenBucket(1, 5); // lento: 200ms a gettone
  await b.take(); // svuota il secchio
  const ac = new AbortController();
  const abortStamp = { done: false };
  const cancelled = b.take(ac.signal).catch(() => void (abortStamp.done = true));
  check("in coda dopo l'annullamento previsto", b.waiting === 1, `waiting=${b.waiting}`);
  ac.abort();
  await cancelled;
  check("annullato → rimosso dalla coda", b.waiting === 0, `waiting=${b.waiting}`);
  check("annullato → promise respinta", abortStamp.done);
}

// 5. L'errore di annullamento è quello che gli passiamo (TmdbAbortError nel client).
{
  const b = new TokenBucket(0, 1);
  const ac = new AbortController();
  ac.abort();
  class Custom extends Error {}
  let err: unknown;
  await b.take(ac.signal, () => new Custom("custom")).catch((e) => (err = e));
  check("segnale già annullato → errore fornito dal chiamante", err instanceof Custom);
}

// 6. Il secchio si ricarica nel tempo e torna a lasciar passare una raffica.
{
  const b = new TokenBucket(3, 50); // 20ms a gettone
  await Promise.all([b.take(), b.take(), b.take()]);
  await new Promise((r) => setTimeout(r, 120)); // tempo per riempirsi
  const t0 = Date.now();
  await Promise.all([b.take(), b.take(), b.take()]);
  const ms = Date.now() - t0;
  check("dopo la pausa la raffica ripassa senza attesa", ms < 30, `${ms}ms`);
}

console.log(failures === 0 ? "\nTutti i controlli passati." : `\n${failures} controlli falliti.`);
process.exit(failures === 0 ? 0 : 1);
