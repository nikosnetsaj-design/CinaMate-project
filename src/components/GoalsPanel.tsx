import { useMemo, useState } from "react";
import { useLibrary } from "../store/useLibrary";
import { GOAL_METRICS, GOAL_PERIODS, useGoals, type GoalMetric, type GoalPeriod } from "../store/useGoals";
import { computeGoalProgress } from "../lib/goals";
import { EmptyState } from "./EmptyState";
import type { Item } from "../types";
import { CloseIcon, PlusIcon } from "./icons";
import { RowHeader } from "./RowHeader";
import { t } from "../lib/i18n";

function GoalCard({
  progress,
  onRemove,
}: {
  progress: ReturnType<typeof computeGoalProgress>;
  onRemove: () => void;
}) {
  const { goal, current, target, percent, windowLabel, daysLeft, done, projected } = progress;
  const unit = GOAL_METRICS.find((m) => m.value === goal.metric)?.unit ?? "";
  const colour = done ? "var(--success)" : "var(--accent)";

  return (
    <div className="rounded-lg bg-surface p-4 shadow-[var(--shadow-sm)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-base font-semibold text-text">
            {target} {unit} {GOAL_PERIODS.find((p) => p.value === goal.period)?.label}
            {goal.genre && <span className="font-normal text-text-muted"> · {goal.genre}</span>}
          </p>
          <p className="mt-0.5 text-xs text-text-muted">
            {windowLabel} · {daysLeft === 0 ? t("GoalsPanel.ultimo_giorno") : t("GoalsPanel.giorni_rimasti", { v0: daysLeft })}
          </p>
        </div>
        <button
          type="button"
          onClick={onRemove}
          aria-label={t("GoalsPanel.elimina_obiettivo")}
          className="icon-btn icon-btn-sm -mr-1 -mt-1 shrink-0 text-text-faint"
        >
          <CloseIcon size={16} />
        </button>
      </div>

      {/* La cifra resta neutra: il colore sta solo nella barra, ed è verde
          solo quando l'obiettivo è preso. */}
      <div className="mt-3 flex items-baseline justify-between">
        <span className="t-figure text-text">
          {current}
          <span className="text-sm font-normal text-text-faint">/{target}</span>
        </span>
        <span className="text-sm tabular text-text-muted">{percent}%</span>
      </div>

      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
        <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${percent}%`, background: colour }} />
      </div>

      <p className="mt-2 text-xs text-text-muted">
        {done
          ? t("GoalsPanel.obiettivo_raggiunto_il_resto")
          : projected !== null
            ? t("GoalsPanel.di_questo_passo_arrivi", { v0: projected })
            : t("GoalsPanel.ancora_presto_per_dire")}
      </p>
    </div>
  );
}

function NewGoalForm({ genres, onDone }: { genres: string[]; onDone: () => void }) {
  const add = useGoals((s) => s.add);
  const [metric, setMetric] = useState<GoalMetric>("titoli");
  const [period, setPeriod] = useState<GoalPeriod>("mese");
  const [target, setTarget] = useState(4);
  const [genre, setGenre] = useState("");

  const selectCls = "field";

  return (
    <form
      className="flex flex-col gap-4 rounded-lg bg-surface p-4 shadow-[var(--shadow-sm)]"
      onSubmit={(e) => {
        e.preventDefault();
        if (target > 0) add({ metric, period, target, genre: genre || undefined });
        onDone();
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-text-muted">{t("GoalsPanel.cosa")}</span>
          <select value={metric} onChange={(e) => setMetric(e.target.value as GoalMetric)} className={selectCls}>
            {GOAL_METRICS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-text-muted">{t("GoalsPanel.ogni")}</span>
          <select value={period} onChange={(e) => setPeriod(e.target.value as GoalPeriod)} className={selectCls}>
            {GOAL_PERIODS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-text-muted">{t("GoalsPanel.quanti")}</span>
          <input
            type="number"
            min={1}
            value={target}
            onChange={(e) => setTarget(Number(e.target.value))}
            className={t("GoalsPanel.tabular", { v0: selectCls })}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-text-muted">{t("GoalsPanel.solo_genere")}</span>
          <select value={genre} onChange={(e) => setGenre(e.target.value)} className={selectCls}>
            <option value="">{t("GoalsPanel.tutti")}</option>
            {genres.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex gap-2.5">
        <button
          type="button"
          onClick={onDone}
          className="btn btn-secondary flex-1"
        >
          {t("GoalsPanel.annulla")}
        </button>
        <button
          type="submit"
          className="btn btn-primary flex-1"
        >
          {t("GoalsPanel.crea_obiettivo")}
        </button>
      </div>
    </form>
  );
}

export function GoalsPanel({ items }: { items: Item[] }) {
  const history = useLibrary((s) => s.history);
  const goals = useGoals((s) => s.goals);
  const remove = useGoals((s) => s.remove);
  const [adding, setAdding] = useState(false);

  const genres = useMemo(
    () => [...new Set(items.map((i) => i.genre).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [items],
  );

  // `new Date()` is passed explicitly rather than defaulted inside so the whole
  // panel measures every goal against one instant: a render that straddled
  // midnight would otherwise show two goals in two different weeks.
  const progresses = useMemo(() => {
    const now = new Date();
    return goals.map((goal) => computeGoalProgress(goal, items, history, now));
  }, [goals, items, history]);

  return (
    <section className="flex flex-col gap-4">
      {/* I traguardi li decide l'app; questi li scegli tu. Il titolo lo dice
          senza bisogno del paragrafo che lo spiegava. */}
      <RowHeader
        title={t("GoalsPanel.obiettivi")}
        note={t("GoalsPanel.si_misurano_sul_diario")}
      />

      {progresses.map((progress) => (
        <GoalCard key={progress.goal.id} progress={progress} onRemove={() => remove(progress.goal.id)} />
      ))}

      {goals.length === 0 && !adding && (
        <EmptyState
          title={t("GoalsPanel.nessun_obiettivo")}
          description={t("GoalsPanel.due_film_a_settimana")}
          action={
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="btn btn-primary"
            >
              {t("GoalsPanel.crea_il_primo_obiettivo")}
            </button>
          }
        />
      )}

      {adding ? (
        <NewGoalForm genres={genres} onDone={() => setAdding(false)} />
      ) : (
        goals.length > 0 && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="btn btn-secondary self-start"
          >
            <PlusIcon size={16} />
            {t("GoalsPanel.aggiungi_obiettivo")}
          </button>
        )
      )}
    </section>
  );
}
