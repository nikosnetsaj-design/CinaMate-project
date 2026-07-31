import { create } from "zustand";
import { isRecord, readJson, writeJson } from "../lib/localStore";

const KEY = "cinemate:goals:v1";

/**
 * A personal goal, as distinct from a *traguardo*: achievements are a fixed
 * list the app decides and you discover, goals are ones you set yourself. That
 * is the whole difference and the reason they live apart — an achievement you
 * could edit would not be an achievement, and a goal the app chose for you
 * would not be personal.
 */
export type GoalMetric = "titoli" | "ore" | "episodi";
export type GoalPeriod = "settimana" | "mese" | "anno";

export interface Goal {
  id: string;
  metric: GoalMetric;
  period: GoalPeriod;
  target: number;
  /** Optional narrowing, e.g. only horror. Empty means every genre. */
  genre?: string;
  createdAt: string;
}

export const GOAL_METRICS: { value: GoalMetric; label: string; unit: string }[] = [
  { value: "titoli", label: "Titoli finiti", unit: "titoli" },
  { value: "ore", label: "Ore guardate", unit: "ore" },
  { value: "episodi", label: "Episodi visti", unit: "episodi" },
];

export const GOAL_PERIODS: { value: GoalPeriod; label: string }[] = [
  { value: "settimana", label: "a settimana" },
  { value: "mese", label: "al mese" },
  { value: "anno", label: "all’anno" },
];

function isGoal(value: unknown): value is Goal {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.target === "number" &&
    GOAL_METRICS.some((m) => m.value === value.metric) &&
    GOAL_PERIODS.some((p) => p.value === value.period)
  );
}

function isGoalArray(value: unknown): value is Goal[] {
  return Array.isArray(value) && value.every(isGoal);
}

interface GoalsState {
  goals: Goal[];
  add: (goal: Omit<Goal, "id" | "createdAt">) => void;
  remove: (id: string) => void;
  restore: (value: unknown) => void;
}

function persist(goals: Goal[]): Goal[] {
  writeJson(KEY, goals);
  return goals;
}

export const useGoals = create<GoalsState>((set, get) => ({
  goals: readJson<Goal[]>(KEY, isGoalArray, []),

  add: (goal) =>
    set({
      goals: persist([
        ...get().goals,
        {
          ...goal,
          id: `goal-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
          createdAt: new Date().toISOString().slice(0, 10),
        },
      ]),
    }),

  remove: (id) => set({ goals: persist(get().goals.filter((g) => g.id !== id)) }),

  restore: (value) => set({ goals: persist(isGoalArray(value) ? value : []) }),
}));
