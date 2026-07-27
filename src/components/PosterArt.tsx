import type { Movie, PosterTone } from "../types";

const TONE_STYLES: Record<PosterTone, { gradient: string; ink: string; sub: string }> = {
  gold: {
    gradient: "linear-gradient(160deg, #6b4610 0%, #e3a339 55%, #f7d38c 100%)",
    ink: "#1b1305",
    sub: "rgba(27,19,5,0.72)",
  },
  rust: {
    gradient: "linear-gradient(160deg, #4f1f13 0%, #b5502e 55%, #e59a76 100%)",
    ink: "#fff8f1",
    sub: "rgba(255,248,241,0.78)",
  },
  teal: {
    gradient: "linear-gradient(160deg, #0a201d 0%, #1f5c57 55%, #5ab0a4 100%)",
    ink: "#f2fbf9",
    sub: "rgba(242,251,249,0.78)",
  },
  ink: {
    gradient: "linear-gradient(160deg, #000000 0%, #211f25 55%, #423f47 100%)",
    ink: "#e3a339",
    sub: "rgba(227,163,57,0.72)",
  },
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

export function PosterArt({
  movie,
  size = "md",
  className = "",
}: {
  movie: Movie;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const tone = TONE_STYLES[movie.tone];
  const titleSize =
    size === "lg" ? "text-2xl sm:text-3xl" : size === "sm" ? "text-[11px] leading-tight" : "text-sm sm:text-base";

  return (
    <div
      className={`relative aspect-2/3 overflow-hidden rounded-sm ${className}`}
      style={{ background: tone.gradient }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{ background: "radial-gradient(120% 90% at 15% -10%, rgba(255,255,255,0.55), transparent 55%)" }}
      />
      <Sprockets side="left" />
      <Sprockets side="right" />
      <div className="absolute inset-x-[9%] bottom-[7%] top-auto flex flex-col gap-1">
        <span
          className="font-sans text-[10px] font-semibold tracking-[0.16em] uppercase"
          style={{ color: tone.sub }}
        >
          {movie.year}
        </span>
        <span
          className={`font-display font-semibold leading-[1.05] ${titleSize}`}
          style={{ color: tone.ink }}
        >
          {movie.title}
        </span>
        {size !== "sm" && (
          <span className="font-sans text-[11px]" style={{ color: tone.sub }}>
            {movie.director}
          </span>
        )}
      </div>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.06] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />
    </div>
  );
}
