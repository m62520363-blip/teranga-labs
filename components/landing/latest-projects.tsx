import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import {
  LatestProjectsClient,
  type BriefStats,
  type LandingProjectItem,
} from "@/components/landing/latest-projects-client";

export const LATEST_PROJECTS_COLUMNS =
  "id, client_name, client_city, project_type, budget, description, status, hidden, budget_verified, demo, created_at, features";

/**
 * Projets récemment publiés — données 100 % réelles issues de `public.requests`.
 *
 * Aucun projet de démonstration fictif n'est injecté : si la base ne contient
 * aucun projet ouvert ou qu'un filtre ne renvoie rien, un état vide soigné
 * invite à publier un projet (/poster) ou à créer une alerte (/inscription-developpeur).
 */
export async function LatestProjects() {
  const supabase = await createClient();
  const t = await getTranslations("Landing.latestProjects");
  const types = t.raw("types") as Record<string, string>;

  let briefs: LandingProjectItem[] = [];
  const statsMap: Record<string, BriefStats> = {};

  if (supabase) {
    const { data } = await supabase
      .from("requests")
      .select(LATEST_PROJECTS_COLUMNS)
      .eq("status", "ouvert")
      .eq("hidden", false)
      .order("created_at", { ascending: false })
      .limit(24);

    briefs = ((data ?? []) as LandingProjectItem[]).filter((brief) =>
      Boolean(brief?.id)
    );

    if (briefs.length > 0) {
      const { data: rows } = await supabase.rpc(
        "get_public_brief_stats" as never,
        {
          p_ids: briefs.map((brief) => brief.id),
        } as never
      );

      for (const row of (Array.isArray(rows) ? rows : []) as {
        request_id?: string;
        offers_count?: number;
        views_count?: number;
      }[]) {
        if (!row?.request_id) continue;
        statsMap[row.request_id] = {
          offers: Number(row.offers_count ?? 0),
          views: Number(row.views_count ?? 0),
        };
      }
    }
  }

  return (
    <section
      id="projets"
      className="scroll-mt-24 border-t border-hairline py-20 sm:py-24"
    >
      <div className="container-tl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-hairline bg-card px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              <span
                className="size-1.5 rounded-full bg-primary"
                aria-hidden="true"
              />
              {t("badge")}
            </span>
            <h2 className="mt-4 font-headings text-3xl font-bold tracking-tight sm:text-4xl">
              {t("title")}
            </h2>
            <p className="mt-3 max-w-2xl text-muted-foreground">{t("lead")}</p>
          </div>
        </div>

        <LatestProjectsClient
          briefs={briefs}
          statsMap={statsMap}
          types={types}
          labels={{
            open: t("open"),
            viewProject: t("viewProject"),
            cta: t("cta"),
          }}
        />
      </div>
    </section>
  );
}
