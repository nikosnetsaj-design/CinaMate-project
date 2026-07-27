export function FilterChips<T extends string>({
  options,
  active,
  onToggle,
  label,
}: {
  options: readonly T[];
  active: T[];
  onToggle: (option: T) => void;
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((option) => {
        const isActive = active.includes(option);
        return (
          <button
            key={option}
            type="button"
            aria-pressed={isActive}
            onClick={() => onToggle(option)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
              isActive
                ? "border-transparent"
                : "border-border-strong text-text-muted hover:bg-surface-hover"
            }`}
            style={isActive ? { background: "var(--accent)", color: "var(--accent-contrast)" } : undefined}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}
