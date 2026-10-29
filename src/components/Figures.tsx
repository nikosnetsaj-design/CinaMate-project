import type { ReactNode } from "react";

/*
 * La fascia di cifre: una superficie sola, un filo fra le colonne e, quando
 * va a capo, uno fra le righe.
 *
 * Prima ogni totale era una scheda: quattro in Home, quattro in Diagnostica,
 * tre più sei in Tu, tutte uguali e tutte con la loro ombra. Erano una sola
 * risposta divisa in riquadri. I fili si calcolano dalla posizione perché il
 * numero di celle cambia (in «Il tuo anno» il genere e il mese possono
 * mancare) e perché le colonne cambiano da 640 px in su.
 */

type Edge = "" | "L" | "T" | "B";

// Scritte per intero perché Tailwind trova le classi leggendo il codice: una
// classe composta al volo non arriverebbe mai nel foglio di stile.
const EDGE: Record<Edge, string> = {
  "": "",
  L: "shadow-[inset_1px_0_0_var(--separator)]",
  T: "shadow-[inset_0_1px_0_var(--separator)]",
  B: "shadow-[inset_1px_0_0_var(--separator),inset_0_1px_0_var(--separator)]",
};
const SM_EDGE: Record<Edge, string> = {
  "": "sm:shadow-none",
  L: "sm:shadow-[inset_1px_0_0_var(--separator)]",
  T: "sm:shadow-[inset_0_1px_0_var(--separator)]",
  B: "sm:shadow-[inset_1px_0_0_var(--separator),inset_0_1px_0_var(--separator)]",
};
const COLS: Record<number, string> = { 2: "grid-cols-2", 3: "grid-cols-3", 4: "grid-cols-4" };
const SM_COLS: Record<number, string> = { 2: "sm:grid-cols-2", 3: "sm:grid-cols-3", 4: "sm:grid-cols-4" };

function edge(index: number, cols: number): Edge {
  const left = index % cols !== 0;
  const top = index >= cols;
  return left && top ? "B" : left ? "L" : top ? "T" : "";
}

export interface FigureData {
  value: ReactNode;
  label: string;
  /** Un segno prima dell'etichetta: lo stato, con la forma delle copertine. */
  mark?: ReactNode;
}

/**
 * Una cifra con la sua etichetta. L'etichetta viene prima nel codice — chi
 * legge con lo screen reader sente «film visti, 8» — e dopo a vista, dove il
 * numero deve arrivare per primo. In colonna rovesciata l'inizio è in basso:
 * `justify-end` tiene le cifre allineate in alto anche quando un'etichetta va
 * a capo.
 */
function Figure({ value, label, mark, className }: FigureData & { className: string }) {
  return (
    <div className={`flex min-w-0 flex-col-reverse justify-end gap-0.5 px-4 py-3.5 ${className}`}>
      <dt className="flex min-w-0 items-center gap-1.5 text-xs text-text-muted">
        {mark}
        <span>{label}</span>
      </dt>
      <dd className="t-figure truncate text-text">{value}</dd>
    </div>
  );
}

export function FigureBand({
  figures,
  cols,
  smCols,
  label,
}: {
  figures: FigureData[];
  /** Colonne sul telefono. */
  cols: 2 | 3 | 4;
  /** Colonne da 640 px, se diverse. */
  smCols?: 2 | 3 | 4;
  label?: string;
}) {
  return (
    <dl
      aria-label={label}
      className={`grid rounded-lg bg-surface shadow-[var(--shadow-sm)] ${COLS[cols]} ${smCols ? SM_COLS[smCols] : ""}`}
    >
      {figures.map((f, i) => (
        <Figure
          key={f.label}
          {...f}
          className={`${EDGE[edge(i, cols)]} ${smCols ? SM_EDGE[edge(i, smCols)] : ""}`}
        />
      ))}
    </dl>
  );
}
