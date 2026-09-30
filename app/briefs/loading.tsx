import {
  LoadingLabel,
  SkeletonGrid,
  SkeletonHeader,
} from "@/components/skeleton";

export default function Loading() {
  return (
    <div className="py-12">
      <LoadingLabel label="Chargement des briefs" />
      <div className="container-tl">
        <SkeletonHeader />
        <SkeletonGrid count={6} />
      </div>
    </div>
  );
}
