import { useMemo, useState } from "react";
import { useLibrary } from "../store/useLibrary";
import { useSelectedItem } from "../store/useSelectedItem";
import { useAddSheet } from "../store/useAddSheet";
import { SearchBar } from "../components/SearchBar";
import { PosterCard } from "../components/PosterCard";
import { PosterArt } from "../components/PosterArt";
import { StatusChip } from "../components/StatusChip";
import { VoteBadge } from "../components/VoteBadge";
import { EmptyState } from "../components/EmptyState";
import { PosterGridSkeleton } from "../components/Skeletons";
import { STATUSES } from "../lib/status";
import { useAppReady } from "../lib/useAppReady";
import type { Kind, Status } from "../types";

const KINDS: { value: Kind; label: string }[] = [
  { value: "film", label: "Film" },
  { value: "serie", label: "Serie TV" },
  { value: "anime", label: "Anime" },
  { value: "doc", label: "Documentario" },
];

type Sort = "recenti" | "voto" | "titolo" | "anno";

function Pill({ children, active, onClick }: { children: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
        active ? "border-transparent" : "border-border-strong text-text-muted hover:bg-surface-hover"
      }`}
      style={active ? { background: "var(--accent)", color: "var(--accent-contrast)" } : undefined}
    >
      {children}
    </button>
  );
}

export function Library() {
  const ready = useAppReady();
  const items = useLibrary((s) => s.items);
  const openItem = useSelectedItem((s) => s.open);
  const openAddSheet = useAddSheet((s) => s.open);

  const [q, setQ] = useState("");
  const [fKind, setFKind] = useState<Kind | "Tutti">("Tutti");
  const [fStatus, setFStatus] = useState<Status | "Tutti">("Tutti");
  const [sort, setSort] = useState<Sort>("recenti");
  const [grid, setGrid] = useState(true);

  const list = useMemo(() => {
    return items
      .filter((i) => fKind === "Tutti" || i.kind === fKind)
      .filter((i) => fStatus === "Tutti" || i.status === fStatus)
      .filter((i) => {
        if (!q) return true;
        const query = q.toLowerCase();
        return (
          i.title.toLowerCase().includes(query) ||
          i.notes.toLowerCase().includes(query) ||
          i.director.toLowerCase().includes(query)
        );
      })
      .sort((a, b) => {
        if (sort === "voto") return (b.vote ?? 0) - (a.vote ?? 0);
        if (sort === "titolo") return a.title.localeCompare(b.title);
        if (sort === "anno") return b.year - a.year;
        return b.added.localeCompare(a.added);
      });
  }, [items, fKind, fStatus, q, sort]);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6 sm:px-6 sm:py-10">
      <div>
        <h1 className="font-display text-3xl font-semibold text-text">Libreria</h1>
        <p className="mt-1 text-sm text-text-muted">{items.length} titoli in totale.</p>
      </div>

      <SearchBar value={q} onChange={setQ} placeholder="Cerca nella libreria…" />

      <div className="flex gap-2 overflow-x-auto pb-1">
        <Pill active={fKind === "Tutti"} onClick={() => setFKind("Tutti")}>
          Tutti
        </Pill>
        {KINDS.map((k) => (
          <Pill key={k.value} active={fKind === k.value} onClick={() => setFKind(k.value)}>
            {k.label}
          </Pill>
        ))}
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        <Pill active={fStatus === "Tutti"} onClick={() => setFStatus("Tutti")}>
          Tutti
        </Pill>
        {STATUSES.map((s) => (
          <Pill key={s} active={fStatus === s} onClick={() => setFStatus(s)}>
            {s}
          </Pill>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs text-text-faint">{list.length} titoli</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setGrid((g) => !g)}
            aria-label={grid ? "Vista elenco" : "Vista griglia"}
            className="rounded-sm border border-border-strong px-2 py-1 text-xs text-text-muted"
          >
            {grid ? "☰" : "▦"}
          </button>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            aria-label="Ordina per"
            className="rounded-sm border border-border-strong bg-surface px-2 py-1 text-xs text-text-muted"
          >
            <option value="recenti">Recenti</option>
            <option value="voto">Voto</option>
            <option value="titolo">A–Z</option>
            <option value="anno">Anno</option>
          </select>
        </div>
      </div>

      {!ready ? (
        <PosterGridSkeleton count={8} />
      ) : list.length === 0 ? (
        <EmptyState
          title={items.length === 0 ? "La tua libreria è vuota" : "Nessun risultato"}
          description={
            items.length === 0
              ? "Aggiungi il tuo primo titolo per iniziare a costruire la tua collezione."
              : "Nessun titolo corrisponde ai filtri attuali."
          }
          action={
            <button
              type="button"
              onClick={() => {
                if (items.length === 0) {
                  openAddSheet();
                  return;
                }
                setQ("");
                setFKind("Tutti");
                setFStatus("Tutti");
              }}
              className="rounded-sm border border-border-strong px-4 py-2 text-sm font-medium text-text hover:bg-surface-hover"
            >
              {items.length === 0 ? "Aggiungi un titolo" : "Azzera filtri"}
            </button>
          }
        />
      ) : grid ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {list.map((item) => (
            <PosterCard key={item.id} item={item} onOpen={openItem} progress />
          ))}
        </div>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {list.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => openItem(item)}
                aria-label={`Apri dettagli di ${item.title}, ${item.year}`}
                className="flex w-full items-center gap-3.5 rounded-md border border-border bg-surface p-3 text-left transition-colors hover:bg-surface-hover"
              >
                <PosterArt item={item} size="sm" className="w-12 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-sm font-semibold text-text">{item.title}</p>
                  <p className="mt-0.5 truncate text-xs text-text-faint">
                    {[item.year, item.genre, item.platform].filter(Boolean).join(" · ")}
                  </p>
                  <div className="mt-1">
                    <StatusChip status={item.status} size="sm" />
                  </div>
                </div>
                <VoteBadge vote={item.vote} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
