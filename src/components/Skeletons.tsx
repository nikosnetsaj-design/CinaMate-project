/*
 * Gli scheletri hanno la forma esatta di quello che arriva — stessa proporzione
 * della locandina, stesse righe di testo — così quando arriva non salta niente.
 */

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

/**
 * L'attesa di una pagina che arriva a pezzi (Diagnostica, il lettore): la sua
 * forma — un titolo e un elenco, o il riquadro del video e due righe — invece
 * della parola «Caricamento…», che dice solo che si aspetta.
 */
export function PageSkeleton({ variant = "list" }: { variant?: "list" | "player" }) {
  return (
    <div role="status" className="mx-auto max-w-4xl px-[var(--gutter)] py-6 sm:py-10">
      <span className="sr-only">Caricamento…</span>
      <div aria-hidden="true" className="flex flex-col gap-4">
        {variant === "player" ? (
          <>
            <div className="skeleton aspect-video w-full rounded-lg" />
            <div className="skeleton h-6 w-1/2 rounded-xs" />
            <div className="skeleton h-4 w-1/3 rounded-xs" />
          </>
        ) : (
          <>
            <div className="skeleton h-10 w-48 rounded-sm" />
            <div className="skeleton h-4 w-2/3 rounded-xs" />
            <div className="mt-4 flex flex-col gap-px overflow-hidden rounded-md">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="skeleton h-14 rounded-none" />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
