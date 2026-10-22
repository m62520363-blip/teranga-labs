import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Heart } from "lucide-react";
import { requireUser } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { BRIEFS_COLUMNS, isBriefSponsored } from "@/lib/briefs-pagination";
import { BriefCard } from "@/components/brief-card";
import { BriefGrid } from "@/components/brief-grid";
import { EmptyState } from "@/components/empty-state";
import { FavoriteButton } from "@/components/favorite-button";
import { Link } from "@/i18n/navigation";
import type { PublicRequestWithSponsor } from "@/types/database";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Pages.favorites");
  return {
    title: t("metaTitle"),
    description: t("metaDesc"),
    robots: { index: false, follow: false },
  };
}

/**
 * Page « Mes favoris » (F1, §25) : les briefs marqués du cœur par
 * l'utilisateur, relus via la jointure `favorites → requests`. Un brief
 * supprimé ou rendu invisible par RLS disparaît tout seul (embed null).
 */
export default async function FavoritesPage() {
  await requireUser();
  const t = await getTranslations("Pages.favorites");

  const supabase = await createClient();
  let briefs: PublicRequestWithSponsor[] = [];

  if (supabase) {
    const { data } = await supabase
      .from("favorites")
      .select(`request_id, created_at, requests(${BRIEFS_COLUMNS})`)
      .order("created_at", { ascending: false })
      .limit(100);

    // Le cast passe par `unknown` : les types générés ignorent la FK
    // favorites → requests (présente en base depuis la migration 0040),
    // PostgREST résout l'embed au runtime par la contrainte réelle.
    briefs = ((data ?? []) as unknown as Array<{
      request_id: string;
      requests: PublicRequestWithSponsor | null;
    }>)
      .map((row) => row.requests)
      .filter((brief): brief is PublicRequestWithSponsor => Boolean(brief?.id));
  }

  return (
    <div className="bg-surface py-16 md:py-24">
      <div className="container-tl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold leading-tight tracking-tight">
              {t("h1")}
            </h1>
            <p className="mt-3 text-base leading-relaxed text-muted-foreground">
              {t("lead")}
            </p>
          </div>
          <p className="text-sm font-medium text-muted-foreground">
            {t("count", { count: briefs.length })}
          </p>
        </div>

        <div className="mt-10">
          {briefs.length === 0 ? (
            <EmptyState
              title={t("emptyTitle")}
              description={t("emptyDesc")}
              action={
                <Link
                  href="/briefs"
                  className="btn-shine inline-flex h-10 items-center gap-2 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground transition-[filter] outline-none hover:brightness-110 active:brightness-95 focus-visible:ring-2 focus-visible:ring-primary/50"
                >
                  <Heart className="size-4" aria-hidden="true" />
                  {t("browse")}
                </Link>
              }
            />
          ) : (
            <BriefGrid>
              {briefs.map((brief) => (
                <BriefCard
                  key={brief.id}
                  brief={brief}
                  sponsored={isBriefSponsored(brief)}
                  footer={
                    <FavoriteButton briefId={brief.id} initialFavorite />
                  }
                />
              ))}
            </BriefGrid>
          )}
        </div>
      </div>
    </div>
  );
}
