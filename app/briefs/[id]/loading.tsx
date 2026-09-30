import {
  LoadingLabel,
  Skeleton,
  SkeletonText,
} from "@/components/skeleton";

export default function Loading() {
  return (
    <div className="py-12">
      <LoadingLabel label="Chargement du brief" />
      <div className="container-tl">
        <div className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Skeleton className="h-9 w-3/4" />
            <div className="mt-4 flex gap-2">
              <Skeleton className="h-6 w-24 rounded-full" />
              <Skeleton className="h-6 w-28 rounded-full" />
            </div>
            <div className="mt-8 space-y-4">
              <SkeletonText lines={6} />
            </div>
          </div>
          <div className="space-y-4">
            <Skeleton className="h-40 w-full rounded-2xl" />
            <Skeleton className="h-12 w-full rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );
}
