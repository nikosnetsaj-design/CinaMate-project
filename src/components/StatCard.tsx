export function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-md bg-surface p-4 shadow-[var(--shadow-sm)]">
      <span className="text-xs font-medium text-text-faint">{label}</span>
      <span className="tabular text-2xl font-semibold text-text">{value}</span>
      {hint && <span className="text-xs text-text-muted">{hint}</span>}
    </div>
  );
}
