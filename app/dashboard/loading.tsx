import { LoadingLabel, Skeleton } from "@/components/skeleton";

export default function Loading() {
  return (
    <div className="py-12">
      <LoadingLabel label="Chargement du tableau de bord" />
      <div className="container-tl">
        <Skeleton className="h-8 w-56" />

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>

        <div className="mt-8 space-y-3">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
