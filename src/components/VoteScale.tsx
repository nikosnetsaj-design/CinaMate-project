import { useRef } from "react";
import { voteFill, voteWord } from "../lib/vote";
import { t } from "../lib/i18n";

const SCALE = Array.from({ length: 10 }, (_, i) => i + 1);

export type CommitHow = "pointer" | "key" | "enter";

/**
 * La scala da 1 a 10: si tocca, si trascina col dito, si usa con le frecce.
 *
 * Dieci gradini colorati da freddo a caldo; quello scelto si alza un poco.
 * Mentre il dito scorre il voto cambia (`onChange`), quando lo alzi è deciso
 * (`onCommit`). Con la tastiera è uno slider vero: frecce, Home/Fine, i
 * numeri (0 vale 10), Canc per toglierlo.
 */
export function VoteScale({
  value,
  onChange,
  onCommit,
  onClear,
  label,
  size = "lg",
}: {
  value: number | null;
  onChange: (vote: number) => void;
  onCommit: (vote: number, how: CommitHow) => void;
  onClear?: () => void;
  label: string;
  size?: "lg" | "md";
}) {
  const barRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  function valueAt(clientX: number): number {
    const rect = barRef.current!.getBoundingClientRect();
    const x = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 0.9999);
    return Math.floor(x * 10) + 1;
  }

  function change(next: number) {
    if (next === value) return;
    onChange(next);
    // Uno scatto leggero a ogni gradino, dove il telefono lo sa fare.
    navigator.vibrate?.(4);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    const current = value ?? 0;
    let next: number | null = null;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") next = Math.min(current + 1, 10);
    else if (e.key === "ArrowLeft" || e.key === "ArrowDown") next = Math.max(current - 1, 1);
    else if (e.key === "Home") next = 1;
    else if (e.key === "End") next = 10;
    else if (/^[1-9]$/.test(e.key)) next = Number(e.key);
    else if (e.key === "0") next = 10;
    else if ((e.key === "Delete" || e.key === "Backspace") && onClear && value != null) {
      e.preventDefault();
      onClear();
      return;
    } else if (e.key === "Enter" && value != null) {
      e.preventDefault();
      onCommit(value, "enter");
      return;
    }
    if (next == null) return;
    e.preventDefault();
    onCommit(next, "key");
  }

  return (
    <div
      ref={barRef}
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={1}
      aria-valuemax={10}
      aria-valuenow={value ?? undefined}
      aria-valuetext={value ? t("RateSheet.su_10_parola", { v0: value, v1: voteWord(value) }) : t("RateSheet.nessun_voto")}
      onKeyDown={onKeyDown}
      onPointerDown={(e) => {
        dragging.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
        change(valueAt(e.clientX));
      }}
      onPointerMove={(e) => {
        if (dragging.current) change(valueAt(e.clientX));
      }}
      onPointerUp={(e) => {
        if (!dragging.current) return;
        dragging.current = false;
        onCommit(valueAt(e.clientX), "pointer");
      }}
      onPointerCancel={() => {
        dragging.current = false;
      }}
      className="grid cursor-pointer touch-none select-none grid-cols-10 gap-1 rounded-md outline-offset-4"
    >
      {SCALE.map((n) => {
        const on = value != null && n <= value;
        return (
          <span
            key={n}
            aria-hidden="true"
            className={`flex items-end justify-center rounded-sm text-xs font-semibold tabular transition-[background-color,transform,color] duration-150 ${
              size === "lg" ? "h-14 pb-1.5" : "h-10 pb-1"
            }`}
            style={{
              // Ogni gradino il suo colore: la scala si legge da freddo a caldo.
              background: on ? voteFill(n) : "var(--surface-2)",
              color: on ? "var(--vote-fill-ink)" : "var(--text-faint)",
              transform: n === value ? "translateY(-4px)" : undefined,
            }}
          >
            {n}
          </span>
        );
      })}
    </div>
  );
}
