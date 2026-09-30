export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-lg bg-hairline ${className}`}
    />
  );
}

/** Ligne de texte : la derniere est plus courte pour simuler une ligne reelle. */
export function SkeletonText({
  lines = 3,
  className = "",
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={`space-y-2 ${className}`} aria-hidden="true">
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton
          key={i}
          className={`h-3.5 ${i === lines - 1 ? "w-3/5" : "w-full"}`}
        />
      ))}
    </div>
  );
}

export function SkeletonCard({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`rounded-2xl border border-hairline bg-card p-6 ${className}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-3">
          <Skeleton className="h-4 w-1/3" />
          <SkeletonText lines={2} />
        </div>
        <Skeleton className="size-10 shrink-0 rounded-xl" />
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        <Skeleton className="h-6 w-20 rounded-full" />
        <Skeleton className="h-6 w-24 rounded-full" />
        <Skeleton className="h-6 w-16 rounded-full" />
      </div>
    </div>
  );
}

/** En-tete de page : titre + sous-titre, pour caler la mise en page. */
export function SkeletonHeader() {
  return (
    <div aria-hidden="true" className="mb-8 space-y-3">
      <Skeleton className="h-8 w-64 max-w-full" />
      <SkeletonText lines={1} className="w-96 max-w-full" />
    </div>
  );
}

export function SkeletonGrid({
  count = 6,
  className = "",
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={`grid gap-4 sm:grid-cols-2 lg:grid-cols-3 ${className}`}
    >
      {Array.from({ length: count }, (_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

/** Message pour les lecteurs d'ecran pendant le chargement. */
export function LoadingLabel({ label = "Chargement" }: { label?: string }) {
  return (
    <span role="status" aria-live="polite" className="sr-only">
      {label}…
    </span>
  );
}
