import { voteFill, voteWord } from "../lib/vote";

export function VotePicker({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
  return (
    <div>
      <div className="grid grid-cols-10 gap-1" role="radiogroup" aria-label="Il tuo voto">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
          const active = (value ?? 0) >= n;
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={value === n}
              aria-label={`${n} su 10`}
              onClick={() => onChange(value === n ? null : n)}
              className="flex h-8 items-center justify-center rounded-xs text-[11px] font-bold transition-colors"
              style={{
                background: active && value ? voteFill(value) : "var(--surface-hover)",
                color: active ? "var(--vote-fill-ink)" : "var(--text-faint)",
              }}
            >
              {n}
            </button>
          );
        })}
      </div>
      <div className="mt-1.5 h-4 text-center text-xs text-text-muted">{value ? voteWord(value) : ""}</div>
    </div>
  );
}
