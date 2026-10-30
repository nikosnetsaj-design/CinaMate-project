// Il fuso dell'utente tipico: un'ora avanti d'inverno, due d'estate. È dove il
// giorno di Greenwich e quello del telefono non coincidono dopo mezzanotte.
process.env.TZ = "Europe/Rome";

const { localDay, localDaysAgo, timestampFromId, repairUtcDay } = await import("../../src/lib/day.ts");
const { computeGoalProgress } = await import("../../src/lib/goals.ts");

let failures = 0;
function check(name: string, cond: boolean, detail = "") {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!cond) failures++;
}

// 1. Il giorno locale, non quello di Greenwich.
{
  const late = new Date(2026, 9, 29, 0, 40); // 29 ottobre, 00:40 a Roma
  check("00:40 di notte resta nel giorno locale", localDay(late) === "2026-10-29", localDay(late));
  check("…mentre il giorno UTC è ancora quello prima", late.toISOString().slice(0, 10) === "2026-10-28");
  const summer = new Date(2026, 6, 15, 1, 30); // luglio, ora legale: due ore avanti
  check("d'estate anche all'1:30", localDay(summer) === "2026-07-15", localDay(summer));
}

// 2. «n giorni fa» si conta sul calendario, anche a cavallo del cambio d'ora.
{
  // Il 29 marzo 2026 è la notte dell'ora legale: quel giorno dura 23 ore, e
  // togliere 24 ore a mezzanotte e mezza del 30 cadrebbe nel 28.
  const after = new Date(2026, 2, 30, 0, 30);
  check("un giorno fa, oltre l'ora legale", localDaysAgo(1, after) === "2026-03-29", localDaysAgo(1, after));
  check("trenta giorni fa", localDaysAgo(30, new Date(2026, 9, 29, 12)) === "2026-09-29", localDaysAgo(30, new Date(2026, 9, 29, 12)));
  check("zero giorni fa è oggi", localDaysAgo(0, new Date(2026, 0, 1, 23, 59)) === "2026-01-01");
}

// 3. L'istante scritto nell'id.
{
  const ts = Date.UTC(2026, 9, 28, 23, 30);
  check("id a orologio → istante", timestampFromId(`${ts}-k3j9x2`) === ts);
  check("id senza orologio → nulla", timestampFromId("goal-abc-123") === null);
  check("numero troppo vecchio → nulla", timestampFromId("1000000000000-x") === null, "2001");
  check("id nel futuro lontano → nulla", timestampFromId(`${Date.now() + 10 * 86_400_000}-x`) === null);
}

// 4. La correzione delle date scritte in UTC.
{
  // Il 25 ottobre 2026 finisce l'ora legale: dal 28 Roma è un'ora avanti, e
  // le 23:30 di Greenwich sono già le 00:30 del giorno dopo.
  const ts = Date.UTC(2026, 9, 28, 23, 30);
  const id = `${ts}-abcdef`;
  check("data UTC dell'istante → giorno locale", repairUtcDay("2026-10-28", id) === "2026-10-29", repairUtcDay("2026-10-28", id));
  check("idempotente: la data già locale resta", repairUtcDay("2026-10-29", id) === "2026-10-29");
  check("una data scelta (importata, a mano) non si tocca", repairUtcDay("2019-05-03", id) === "2019-05-03");
  check("senza istante nell'id non si tocca", repairUtcDay("2026-10-28", "senza-orologio") === "2026-10-28");
  const noon = Date.UTC(2026, 9, 28, 10, 0);
  check("a mezzogiorno UTC e locale coincidono", repairUtcDay("2026-10-28", `${noon}-x`) === "2026-10-28");
}

// 5. Il punto di tutto: un film finito lunedì dopo mezzanotte conta per la settimana nuova.
{
  // Lunedì 26 ottobre alle 00:30: a Greenwich è ancora domenica.
  const monday = new Date(2026, 9, 26, 0, 30);
  const item = { id: "f1", title: "Film", kind: "film", runtime: 100, genre: "" } as any;
  const goal = { id: "g", metric: "titoli", period: "settimana", target: 2, createdAt: "2026-10-01" } as any;
  const entry = (date: string) => ({ id: "h", itemId: "f1", title: "Film", kind: "film", date, action: "watched" }) as any;
  const now = new Date(2026, 9, 26, 9, 0);
  const local = computeGoalProgress(goal, [item], [entry(localDay(monday))], now);
  const utc = computeGoalProgress(goal, [item], [entry(monday.toISOString().slice(0, 10))], now);
  check("con la data locale il film conta", local.current === 1, String(local.current));
  check("con quella UTC (il vecchio comportamento) no", utc.current === 0, String(utc.current));
}

if (failures > 0) {
  console.log(`\n${failures} controlli falliti.`);
  process.exit(1);
}
console.log("\nTutti i controlli passati.");
