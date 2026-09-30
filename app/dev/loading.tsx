import {
  LoadingLabel,
  SkeletonGrid,
  SkeletonHeader,
} from "@/components/skeleton";

export default function Loading() {
  return (
    <div className="py-12">
      <LoadingLabel label="Chargement de l’annuaire" />
      <div className="container-tl">
        <SkeletonHeader />
        <SkeletonGrid count={6} />
      </div>
    </div>
  );
}
