import { useState } from "react";

function Star({ filled, size }: { filled: boolean; size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill={filled ? "var(--rust)" : "none"}
      stroke={filled ? "var(--rust)" : "var(--text-faint)"}
      strokeWidth={1.4}
      aria-hidden="true"
    >
      <path
        d="M10 1.6l2.47 5.24 5.68.63-4.24 3.98 1.13 5.75L10 14.2l-5.04 2.99 1.13-5.75L1.85 7.47l5.68-.63L10 1.6z"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function StarRating({
  value,
  onChange,
  readOnly = false,
  size = "md",
  label = "Valutazione",
}: {
  value: number;
  onChange?: (value: number) => void;
  readOnly?: boolean;
  size?: "sm" | "md" | "lg";
  label?: string;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const px = size === "lg" ? 28 : size === "sm" ? 14 : 20;
  const shown = hovered ?? value;

  if (readOnly) {
    return (
      <div className="flex items-center gap-0.5" role="img" aria-label={`${value} su 5 stelle`}>
        {[1, 2, 3, 4, 5].map((i) => (
          <Star key={i} filled={i <= value} size={px} />
        ))}
      </div>
    );
  }

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="flex items-center gap-0.5"
      onMouseLeave={() => setHovered(null)}
    >
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          role="radio"
          aria-checked={value === i}
          aria-label={`${i} su 5 stelle`}
          tabIndex={value === i || (value === 0 && i === 1) ? 0 : -1}
          className="rounded-xs p-0.5 transition-transform duration-150 hover:scale-110 active:scale-95"
          onMouseEnter={() => setHovered(i)}
          onFocus={() => setHovered(i)}
          onBlur={() => setHovered(null)}
          onClick={() => onChange?.(i)}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight" || e.key === "ArrowUp") {
              e.preventDefault();
              onChange?.(Math.min(5, (value || 0) + 1));
            } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
              e.preventDefault();
              onChange?.(Math.max(1, (value || 1) - 1));
            } else if (e.key === "Home") {
              e.preventDefault();
              onChange?.(1);
            } else if (e.key === "End") {
              e.preventDefault();
              onChange?.(5);
            }
          }}
        >
          <Star filled={i <= shown} size={px} />
        </button>
      ))}
    </div>
  );
}
