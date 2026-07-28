export function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-border bg-surface p-4">
      <span className="text-xs font-medium uppercase tracking-wide text-text-faint">{label}</span>
      <span className="font-mono tabular text-2xl font-medium text-text">{value}</span>
      {hint && <span className="text-xs text-text-muted">{hint}</span>}
    </div>
  );
}
