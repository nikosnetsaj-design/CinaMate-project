import type { ReactNode } from "react";

function ReelIcon() {
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" fill="none" aria-hidden="true">
      <circle cx="22" cy="22" r="15" stroke="var(--border-strong)" strokeWidth="2" />
      <circle cx="22" cy="10.5" r="2.2" fill="var(--border-strong)" />
      <circle cx="32.5" cy="16" r="2.2" fill="var(--border-strong)" />
      <circle cx="32.5" cy="28" r="2.2" fill="var(--border-strong)" />
      <circle cx="22" cy="33.5" r="2.2" fill="var(--border-strong)" />
      <circle cx="11.5" cy="28" r="2.2" fill="var(--border-strong)" />
      <circle cx="11.5" cy="16" r="2.2" fill="var(--border-strong)" />
      <circle cx="22" cy="22" r="4.5" fill="var(--accent)" />
    </svg>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed border-border px-6 py-16 text-center">
      {icon ?? <ReelIcon />}
      <div className="flex flex-col gap-1.5">
        <h3 className="font-display text-lg font-medium text-text">{title}</h3>
        <p className="max-w-sm text-sm text-text-muted">{description}</p>
      </div>
      {action}
    </div>
  );
}
