import { useEffect, useState, type ReactNode } from "react";
import type { Item, Kind } from "../types";
import { paletteFor } from "../lib/palette";
import { posterUrl, posterSrcSet, type PosterSize } from "../lib/tmdb";
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

// What each size is actually rendered at, so the browser can pick the right
// file instead of guessing from the (unknown until layout) CSS width. The
// values track the real containers: `sm` is a grid card that grows from a
// two-up phone grid to a five-up desktop one, `lg` is the detail-sheet poster.
const SIZES_ATTR: Record<"sm" | "md" | "lg", string> = {
  sm: "(min-width: 1024px) 190px, (min-width: 640px) 160px, 45vw",
  md: "(min-width: 640px) 240px, 45vw",
  lg: "(min-width: 640px) 96px, 80px",
};

const SRCSET_WIDTHS: Record<"sm" | "md" | "lg", PosterSize[]> = {
  sm: ["w92", "w154", "w185", "w342", "w500"],
  md: ["w154", "w185", "w342", "w500"],
  lg: ["w185", "w342", "w500"],
};

export function PosterArt({
  item,
  size = "md",
  showTitle = true,
  className = "",
  priority = false,
}: {
  item: Pick<Item, "title" | "kind"> & { posterPath?: string | null };
  size?: "sm" | "md" | "lg";
  showTitle?: boolean;
  className?: string;
  /**
   * Set on the few posters that are on screen before any scrolling. Lazy
   * loading them is a net loss: the browser waits for layout before it will
   * even start the request, which delays exactly the images the page is
   * judged on.
   */
  priority?: boolean;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const src = posterUrl(item.posterPath, size === "lg" ? "w500" : "w342");

  // A new poster deserves a fresh attempt: without this the component keeps
  // showing fallback art after an edit that fixed a broken image.
  useEffect(() => setImgFailed(false), [item.posterPath]);

  if (src && !imgFailed) {
    return (
      <div className={`relative aspect-2/3 overflow-hidden rounded-sm bg-surface-2 ${className}`}>
        <img
          src={src}
          srcSet={posterSrcSet(item.posterPath, SRCSET_WIDTHS[size])}
          sizes={SIZES_ATTR[size]}
          alt={`Copertina di ${item.title}`}
          loading={priority ? "eager" : "lazy"}
          // Off the main thread, so decoding a grid of posters doesn't compete
          // with the scroll that revealed them.
          decoding="async"
          fetchPriority={priority ? "high" : "auto"}
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
