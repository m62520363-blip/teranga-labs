import {
  LoadingLabel,
  Skeleton,
  SkeletonText,
} from "@/components/skeleton";

export default function Loading() {
  return (
    <div className="py-12">
      <LoadingLabel label="Chargement du profil" />
      <div className="container-tl">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
          <Skeleton className="size-24 shrink-0 rounded-2xl" />
          <div className="flex-1">
            <Skeleton className="h-8 w-56" />
            <Skeleton className="mt-3 h-4 w-72" />
            <div className="mt-6 flex flex-wrap gap-2">
              <Skeleton className="h-6 w-24 rounded-full" />
              <Skeleton className="h-6 w-32 rounded-full" />
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
          </div>
        </div>
        <div className="mt-10">
          <SkeletonText lines={5} />
        </div>
      </div>
    </div>
  );
}
