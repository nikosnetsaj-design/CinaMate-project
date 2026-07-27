export function PosterSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <div className="skeleton aspect-2/3 rounded-sm" />
      <div className="skeleton h-3 w-3/4 rounded-xs" />
      <div className="skeleton h-2.5 w-1/2 rounded-xs" />
    </div>
  );
}

export function PosterGridSkeleton({ count = 10 }: { count?: number }) {
  return (
    <div
      className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
      aria-hidden="true"
    >
      {Array.from({ length: count }).map((_, i) => (
        <PosterSkeleton key={i} />
      ))}
    </div>
  );
}

export function StatCardSkeleton() {
  return (
    <div className="flex flex-col gap-2 rounded-md border border-border bg-surface p-4">
      <div className="skeleton h-3 w-20 rounded-xs" />
      <div className="skeleton h-7 w-14 rounded-xs" />
    </div>
  );
}
