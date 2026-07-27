import { motion } from "framer-motion";
import { PosterArt } from "./PosterArt";
import { VoteBadge } from "./VoteBadge";
import { StatusChip } from "./StatusChip";
import { HeartIcon } from "./icons";
import type { Item } from "../types";

export function PosterCard({
  item,
  onOpen,
  progress = false,
}: {
  item: Item;
  onOpen: (item: Item) => void;
  progress?: boolean;
}) {
  const pct = item.kind !== "film" && item.episodes ? Math.round(((item.seen || 0) / item.episodes) * 100) : null;

  return (
    <div className="group flex flex-col gap-2">
      <motion.div
        role="button"
        tabIndex={0}
        aria-label={`Apri dettagli di ${item.title}, ${item.year}`}
        onClick={() => onOpen(item)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onOpen(item);
          }
        }}
        whileHover={{ y: -4 }}
        whileTap={{ scale: 0.98 }}
        transition={{ type: "spring", stiffness: 380, damping: 26 }}
        className="cursor-pointer overflow-hidden rounded-sm shadow-[var(--shadow-sm)] transition-shadow duration-200 group-hover:shadow-[var(--shadow-md)]"
      >
        <PosterArt item={item} size="sm" />
      </motion.div>
      <div className="flex flex-col gap-1 px-0.5">
        <div className="flex items-center gap-1">
          <p className="truncate font-display text-sm font-medium text-text" title={item.title}>
            {item.title}
          </p>
          {item.fav && <HeartIcon size={11} filled />}
        </div>
        <div className="flex items-center justify-between gap-2">
          <StatusChip status={item.status} size="sm" />
          <VoteBadge vote={item.vote} size="sm" />
        </div>
        {progress && pct !== null && (
          <div className="mt-0.5">
            <div className="h-[3px] overflow-hidden rounded-full bg-surface-hover">
              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "var(--status-watching)" }} />
            </div>
            <div className="mt-1 text-[10px] text-text-faint">
              {item.seen || 0}/{item.episodes} episodi
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
