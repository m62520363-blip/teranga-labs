import { LoadingLabel, Skeleton } from "@/components/skeleton";

export default function Loading() {
  return (
    <div className="py-12">
      <LoadingLabel label="Chargement de l’espace client" />
      <div className="container-tl">
        <Skeleton className="h-8 w-52" />
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
        <div className="mt-8 space-y-3">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
