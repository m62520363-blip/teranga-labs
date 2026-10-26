import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowRight, Clock3, MapPin, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatFCFA, formatRelativeTime } from "@/lib/formatting";
import type { PublicRequest } from "@/types/database";

export const LATEST_PROJECTS_COLUMNS =
  "id, client_name, client_city, project_type, budget, description, status, hidden, budget_verified, demo, created_at, features";

type FeedItem = PublicRequest & { features?: unknown[] | null };

type BriefStats = { offers: number; views: number };

/**
 * Derniers projets publiés — le flux « Projets récemment publiés » de la
 * page d'accueil, dans l'esprit de Codeur.com : budget, ancienneté,
 * nombre d'offres reçues et ville.
 *
 * Les compteurs viennent de la RPC `get_public_brief_stats` (migration
 * 0069). Si la migration n'est pas encore appliquée, la carte s'affiche
 * sans compteur : aucune requête ne casse la page.
 */
export async function LatestProjects() {
  const supabase = await createClient();
  const t = await getTranslations("Landing.latestProjects");
  const types = t.raw("types") as Record<string, string>;

  let briefs: FeedItem[] = [];
  const stats = new Map<string, BriefStats>();

  if (supabase) {
    const { data } = await supabase
      .from("requests")
      .select(LATEST_PROJECTS_COLUMNS)
      .eq("status", "ouvert")
      .eq("hidden", false)
      .order("created_at", { ascending: false })
      .limit(4);

    briefs = ((data ?? []) as FeedItem[]).filter((b) => Boolean(b?.id));

    if (briefs.length > 0) {
      const { data: rows } = await supabase.rpc("get_public_brief_stats" as never, {
        p_ids: briefs.map((b) => b.id),
      } as never);

      for (const row of (Array.isArray(rows) ? rows : []) as {
        request_id?: string;
        offers_count?: number;
        views_count?: number;
      }[]) {
        if (!row?.request_id) continue;
        stats.set(row.request_id, {
          offers: Number(row.offers_count ?? 0),
          views: Number(row.views_count ?? 0),
        });
      }
    }
  }

  const isDemo = briefs.length === 0;
  const items: FeedItem[] = isDemo ? DEMO_PROJECTS : briefs;

  return (
    <section id="projets" className="border-t border-hairline py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-5 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 px-3 py-1 text-sm">
              <span className="size-2 rounded-full bg-primary" aria-hidden="true" />
              {t("badge")}
            </span>
            <h2 className="mt-4 font-headings text-3xl font-bold tracking-tight sm:text-4xl">
              {t("titleA")} <span className="text-primary">{t("titleB")}</span>
            </h2>
            <p className="mt-3 max-w-2xl text-muted-foreground">{t("lead")}</p>
          </div>
          <Link
            href="/briefs"
            className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full border border-hairline bg-card px-5 text-sm font-medium transition-colors outline-none hover:border-primary/40 hover:text-primary focus-visible:ring-2 focus-visible:ring-primary/50"
          >
            {t("cta")}
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>

        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((brief) => (
            <ProjectFeedCard
              key={brief.id}
              brief={brief}
              stats={stats.get(brief.id)}
              demo={isDemo}
              typeLabel={types[brief.project_type] ?? brief.project_type}
              offersLabel={(count: number) => t("offers", { count })}
              noCommission={t("noCommission")}
            />
          ))}
        </div>

        {isDemo ? (
          <p className="mt-6 text-center text-xs text-muted-foreground">
            {t("demoNote")}
          </p>
        ) : null}
      </div>
    </section>
  );
}

function ProjectFeedCard({
  brief,
  stats,
  demo,
  typeLabel,
  offersLabel,
  noCommission,
}: {
  brief: FeedItem;
  stats?: BriefStats;
  demo: boolean;
  typeLabel: string;
  offersLabel: (count: number) => string;
  noCommission: string;
}) {
  const title = firstLine(brief.description) || brief.client_name;
  const tags = (brief.features ?? []).map(String).filter(Boolean).slice(0, 3);
  const href = demo ? "/briefs" : `/briefs/${brief.id}`;

  return (
    <article className="group flex h-full flex-col rounded-2xl border border-hairline bg-card p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex h-6 items-center rounded-full bg-muted px-2.5 text-[11px] font-semibold uppercase tracking-wide">
          {typeLabel}
        </span>
        <span className="inline-flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
          <Clock3 className="size-3.5" aria-hidden="true" />
          {formatRelativeTime(brief.created_at)}
        </span>
      </div>

      <h3 className="mt-3 line-clamp-2 text-base font-semibold leading-snug tracking-tight">
        <Link
          href={href}
          className="outline-none underline-offset-4 hover:text-primary focus-visible:underline"
        >
          {title}
        </Link>
      </h3>

      <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
        {brief.description}
      </p>

      {tags.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex h-5 items-center rounded-md border border-hairline px-2 text-[11px] text-muted-foreground"
            >
              {tag}
            </span>
          ))}
        </div>
      ) : null}

      <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
        <MapPin className="size-3.5" aria-hidden="true" />
        {brief.client_city}
      </div>

      <div className="mt-auto flex items-center justify-between gap-3 border-t border-hairline pt-4">
        <span className="text-sm font-semibold tracking-tight">
          {formatFCFA(brief.budget)}
        </span>
        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
          <Users className="size-3.5" aria-hidden="true" />
          {stats && stats.offers > 0 ? offersLabel(stats.offers) : noCommission}
        </span>
      </div>
    </article>
  );
}

function firstLine(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  const dot = clean.indexOf(".");
  const sentence = dot > 20 ? clean.slice(0, dot) : clean;
  return sentence.length > 72 ? sentence.slice(0, 72) + "…" : sentence;
}

const DEMO_PROJECTS: FeedItem[] = [
  {
    id: "demo-1",
    client_name: "Boutique Ndiaye",
    client_city: "Dakar, Sénégal",
    project_type: "e-commerce",
    budget: 450000,
    description:
      "Création d'une boutique Shopify pour une marque de cosmétiques naturels, avec paiement mobile money et livraison à Dakar.",
    status: "ouvert",
    hidden: false,
    budget_verified: true,
    demo: true,
    created_at: new Date(Date.now() - 35 * 60000).toISOString(),
    features: ["Shopify", "Mobile money", "Design"],
  },
  {
    id: "demo-2",
    client_name: "Cabinet Konaté",
    client_city: "Abidjan, Côte d'Ivoire",
    project_type: "refonte",
    budget: 800000,
    description:
      "Refonte complète du site vitrine d'un cabinet de conseil : nouveau design, blog et prise de rendez-vous en ligne.",
    status: "ouvert",
    hidden: false,
    budget_verified: true,
    demo: true,
    created_at: new Date(Date.now() - 2 * 3600000).toISOString(),
    features: ["Next.js", "Blog", "Réservation"],
  },
  {
    id: "demo-3",
    client_name: "AgriTech Sahel",
    client_city: "Bamako, Mali",
    project_type: "app web",
    budget: 1200000,
    description:
      "Application web de suivi des récoltes et des ventes pour une coopérative agricole, avec tableau de bord et export Excel.",
    status: "ouvert",
    hidden: false,
    budget_verified: false,
    demo: true,
    created_at: new Date(Date.now() - 5 * 3600000).toISOString(),
    features: ["Dashboard", "API", "Excel"],
  },
  {
    id: "demo-4",
    client_name: "Studio Loko",
    client_city: "Cotonou, Bénin",
    project_type: "landing page",
    budget: 180000,
    description:
      "Landing page de lancement pour une application de livraison, avec formulaire d'inscription et tracking des conversions.",
    status: "ouvert",
    hidden: false,
    budget_verified: true,
    demo: true,
    created_at: new Date(Date.now() - 9 * 3600000).toISOString(),
    features: ["Landing", "SEO", "Analytics"],
  },
];
