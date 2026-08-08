// Esercita il ciclo di ritentativi di tmdbGet stubbando fetch.
const store = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};

const { searchTitles, TmdbApiError, TmdbAbortError } = await import(
  "../../src/lib/tmdb.ts"
);

type Step = { status: number; headers?: Record<string, string>; body?: unknown };

function stubFetch(steps: Step[]) {
  let i = 0;
  const calls: number[] = [];
  (globalThis as any).fetch = async (_url: string, init?: RequestInit) => {
    if (init?.signal?.aborted) throw new DOMException("aborted", "AbortError");
    const step = steps[Math.min(i, steps.length - 1)];
    i++;
    calls.push(Date.now());
    return new Response(JSON.stringify(step.body ?? { results: [] }), {
      status: step.status,
      headers: { "content-type": "application/json", ...(step.headers ?? {}) },
    });
  };
  return { count: () => i, calls };
}

let failures = 0;
function check(name: string, cond: boolean, detail = "") {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!cond) failures++;
}

const OK_BODY = {
  results: [
    { id: 1, media_type: "movie", title: "Heat", release_date: "1995-12-15", overview: "", poster_path: null, popularity: 1 },
  ],
};

// 1. Un 429 seguito da un 200 deve risolversi, non fallire.
{
  const f = stubFetch([{ status: 429 }, { status: 200, body: OK_BODY }]);
  const t0 = Date.now();
  const out = await searchTitles("heat", "key");
  const ms = Date.now() - t0;
  check("429 poi 200 → risolve", out.length === 1, `${out.length} risultati`);
  check("429 poi 200 → 2 chiamate", f.count() === 2, `${f.count()} chiamate`);
  check("429 poi 200 → ha atteso", ms >= 200, `${ms}ms`);
}

// 2. Retry-After viene rispettato al posto del backoff calcolato.
{
  const f = stubFetch([{ status: 429, headers: { "retry-after": "1" } }, { status: 200, body: OK_BODY }]);
  const t0 = Date.now();
  await searchTitles("heat", "key");
  const ms = Date.now() - t0;
  check("Retry-After: 1 → attende ~1s", ms >= 950 && ms < 1600, `${ms}ms`);
  check("Retry-After → 2 chiamate", f.count() === 2);
}

// 3. Un 429 permanente si arrende dopo MAX_RETRIES e lo dice con status 429.
{
  const f = stubFetch([{ status: 429 }]);
  let err: unknown;
  try {
    await searchTitles("heat", "key");
  } catch (e) {
    err = e;
  }
  check("429 permanente → TmdbApiError", err instanceof TmdbApiError);
  check("429 permanente → status 429", (err as any)?.status === 429, String((err as any)?.status));
  check("429 permanente → 4 tentativi (1+3)", f.count() === 4, `${f.count()} chiamate`);
  check(
    "429 permanente → messaggio dedicato",
    String((err as any)?.message).includes("limitando"),
    String((err as any)?.message),
  );
}

// 4. Un 500 si ritenta; un 404 e un 401 no.
{
  const f = stubFetch([{ status: 500 }, { status: 200, body: OK_BODY }]);
  await searchTitles("heat", "key");
  check("500 poi 200 → risolve in 2 chiamate", f.count() === 2, `${f.count()} chiamate`);
}
{
  const f = stubFetch([{ status: 401 }]);
  let err: any;
  try { await searchTitles("heat", "key"); } catch (e) { err = e; }
  check("401 → nessun ritentativo", f.count() === 1, `${f.count()} chiamate`);
  check("401 → status 401", err?.status === 401);
}

// 5. L'annullamento durante l'attesa non resta appeso per il backoff.
{
  stubFetch([{ status: 429 }]);
  const ac = new AbortController();
  const t0 = Date.now();
  const p = searchTitles("heat", "key", ac.signal).catch((e: unknown) => e);
  setTimeout(() => ac.abort(), 50);
  const err = await p;
  const ms = Date.now() - t0;
  check("abort durante il backoff → TmdbAbortError", err instanceof TmdbAbortError, String((err as any)?.name));
  check("abort durante il backoff → non aspetta il backoff", ms < 400, `${ms}ms`);
}

console.log(failures === 0 ? "\nTutti i controlli passati." : `\n${failures} controlli falliti.`);
process.exit(failures === 0 ? 0 : 1);
