import type { HistoryEntry, Item } from "../types";
import type { Goal } from "../store/useGoals";

export interface GoalProgress {
  goal: Goal;
  current: number;
  target: number;
  percent: number;
  /** Human label for the window being measured, e.g. "questo mese". */
  windowLabel: string;
  /** Days left in the current window — what makes a goal feel like one. */
  daysLeft: number;
  done: boolean;
  /**
   * Where you'd land if you carried on at this rate. Null before the window
   * has enough elapsed time for a projection to mean anything: on day one of
   * a year, one film projects to 365 and that is not encouragement, it's noise.
   */
  projected: number | null;
}

const WINDOW_LABELS: Record<Goal["period"], string> = {
  settimana: "questa settimana",
  mese: "questo mese",
  anno: "quest’anno",
};

/**
 * Start and end of the window a goal is measured over. Weeks start on Monday,
 * which is what "questa settimana" means in Italy — a Sunday-start week would
 * reset the counter in the middle of most people's weekend viewing.
 */
function windowFor(period: Goal["period"], now: Date): { start: Date; end: Date } {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start);

  if (period === "settimana") {
    const weekday = (start.getDay() + 6) % 7; // Monday = 0
    start.setDate(start.getDate() - weekday);
    end.setTime(start.getTime());
    end.setDate(start.getDate() + 7);
  } else if (period === "mese") {
    start.setDate(1);
    end.setTime(start.getTime());
    end.setMonth(start.getMonth() + 1);
  } else {
    start.setMonth(0, 1);
    end.setTime(start.getTime());
    end.setFullYear(start.getFullYear() + 1);
  }

  return { start, end };
}

function isoDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * Measured from the diary rather than from the library's current state, and
 * that distinction is the whole point: a goal asks "how much did I watch *in
 * this window*", which item statuses cannot answer — a film marked Visto says
 * nothing about when, and re-reading the shelf would make last year's viewing
 * count towards this month's goal.
 */
export function computeGoalProgress(goal: Goal, items: Item[], history: HistoryEntry[], now = new Date()): GoalProgress {
  const { start, end } = windowFor(goal.period, now);
  const startIso = isoDate(start);
  const endIso = isoDate(end);
  const itemById = new Map(items.map((i) => [i.id, i]));

  let current = 0;
  for (const entry of history) {
    if (entry.date < startIso || entry.date >= endIso) continue;
    const item = itemById.get(entry.itemId);
    if (!item) continue;
    if (goal.genre && item.genre !== goal.genre) continue;

    const count = entry.count ?? 1;
    if (goal.metric === "titoli") {
      // Rewatches count: finishing a film you'd seen before is still an
      // evening spent watching it, which is what the goal is about.
      if (entry.action === "watched" || entry.action === "rewatch") current += 1;
    } else if (goal.metric === "episodi") {
      if (entry.action === "episode") current += count;
    } else {
      if (entry.action === "episode") current += (item.runtime * count) / 60;
      else if (item.kind === "film" || item.kind === "doc") current += item.runtime / 60;
    }
  }

  current = goal.metric === "ore" ? Math.round(current * 10) / 10 : current;

  const msPerDay = 24 * 60 * 60 * 1000;
  const totalDays = Math.round((end.getTime() - start.getTime()) / msPerDay);
  const elapsedDays = Math.max(1, Math.ceil((now.getTime() - start.getTime()) / msPerDay));
  const daysLeft = Math.max(0, totalDays - elapsedDays);

  // A projection needs both a decent slice of the window behind it and
  // something to project from; either missing makes the number a fiction.
  const projected =
    elapsedDays >= Math.max(2, totalDays * 0.15) && current > 0
      ? Math.round((current / elapsedDays) * totalDays * 10) / 10
      : null;

  return {
    goal,
    current,
    target: goal.target,
    percent: goal.target > 0 ? Math.min(100, Math.round((current / goal.target) * 100)) : 0,
    windowLabel: WINDOW_LABELS[goal.period],
    daysLeft,
    done: current >= goal.target,
    projected,
  };
}
