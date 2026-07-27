import { useState, type ReactNode } from "react";
import type { Item, Kind } from "../types";
import { paletteFor } from "../lib/palette";
import { posterUrl } from "../lib/tmdb";
import { AnimeKindIcon, DocKindIcon, FilmKindIcon, SerieKindIcon } from "./icons";

const KIND_ICON: Record<Kind, (props: { size?: number }) => ReactNode> = {
  film: FilmKindIcon,
  serie: SerieKindIcon,
  anime: AnimeKindIcon,
  doc: DocKindIcon,
};

function Sprockets({ side }: { side: "left" | "right" }) {
  return (
    <div
      aria-hidden="true"
      className={`absolute top-0 bottom-0 ${side === "left" ? "left-0" : "right-0"} w-[7%] flex flex-col justify-between py-[6%]`}
    >
      {Array.from({ length: 9 }).map((_, i) => (
        <span key={i} className="aspect-square w-full rounded-[1.5px] bg-black/35" />
      ))}
    </div>
  );
}

function KindBadge({ kind, size }: { kind: Kind; size: "sm" | "md" | "lg" }) {
  const Icon = KIND_ICON[kind];
  return (
    <div
      className="absolute left-1.5 top-1.5 flex items-center justify-center rounded-xs bg-black/45 p-1 text-white/90 backdrop-blur-sm"
      aria-hidden="true"
    >
      <Icon size={size === "sm" ? 10 : 13} />
    </div>
  );
}

export function PosterArt({
  item,
  size = "md",
  showTitle = true,
  className = "",
}: {
  item: Pick<Item, "title" | "kind"> & { posterPath?: string | null };
  size?: "sm" | "md" | "lg";
  showTitle?: boolean;
  className?: string;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const src = posterUrl(item.posterPath, size === "lg" ? "w500" : "w342");

  if (src && !imgFailed) {
    return (
      <div className={`relative aspect-2/3 overflow-hidden rounded-sm bg-surface-2 ${className}`}>
        <img
          src={src}
          alt={`Copertina di ${item.title}`}
          loading="lazy"
          onError={() => setImgFailed(true)}
          className="h-full w-full object-cover"
        />
        <KindBadge kind={item.kind} size={size} />
      </div>
    );
  }

  const [a, b] = paletteFor(item.title);
  const titleSize =
    size === "lg" ? "text-2xl sm:text-3xl" : size === "sm" ? "text-[11px] leading-tight" : "text-sm sm:text-base";

  return (
    <div
      className={`relative aspect-2/3 overflow-hidden rounded-sm ${className}`}
      style={{ background: `linear-gradient(150deg, ${b} 0%, ${a} 100%)` }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{ background: "radial-gradient(120% 90% at 15% -10%, rgba(255,255,255,0.4), transparent 55%)" }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{ background: "linear-gradient(to top, rgba(0,0,0,0.55), transparent 60%)" }}
      />
      <Sprockets side="left" />
      <Sprockets side="right" />
      <div className="absolute left-[9%] top-[6%] text-white/85">
        {(() => {
          const Icon = KIND_ICON[item.kind];
          return <Icon size={size === "sm" ? 11 : 15} />;
        })()}
      </div>
      {showTitle && (
        <div className="absolute inset-x-[9%] bottom-[7%] top-auto flex flex-col gap-1">
          <span
            className={`font-display font-semibold leading-[1.05] text-white/95 ${titleSize}`}
            style={{ textShadow: "0 1px 4px rgba(0,0,0,0.6)" }}
          >
            {item.title}
          </span>
        </div>
      )}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.07] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />
    </div>
  );
}
