import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { ArrowRight, ArrowUpRight, Clock3, Eye, MessageSquare, Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatFCFA } from "@/lib/formatting";
import type { PublicRequest } from "@/types/database";

export const LATEST_PROJECTS_COLUMNS =
  "id, client_name, client_city, project_type, budget, description, status, hidden, budget_verified, demo, created_at, features";

type FeedItem = PublicRequest & { features?: unknown[] | null; title?: string };

type BriefStats = { offers: number; views: number };

/**
 * Projets récemment publiés — la section C de la référence Codeur.com.
 * Grille sur deux colonnes, cartes détaillées (client, budget, offres,
 * vues, compétences) et bouton « Voir plus de projets » vers /briefs.
 *
 * Les vrais projets publiés sont utilisés dès qu'il en existe. Sinon, des
 * exemples de démonstration sont affichés et explicitement étiquetés
 * « Démo » : aucun compteur, prix ou client fictif n'est présenté comme
 * une donnée réelle.
 */
export async function LatestProjects() {
  const supabase = await createClient();
  const t = await getTranslations("Landing.latestProjects");
  const locale = await getLocale();
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
      .limit(8);

    briefs = ((data ?? []) as FeedItem[]).filter((brief) => Boolean(brief?.id));

    if (briefs.length > 0) {
      const { data: rows } = await supabase.rpc("get_public_brief_stats" as never, {
        p_ids: briefs.map((brief) => brief.id),
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
    <section id="projets" className="scroll-mt-24 border-t border-hairline py-20 sm:py-24">
      <div className="container-tl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-hairline bg-card px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />
              {t("badge")}
            </span>
            <h2 className="mt-4 font-headings text-3xl font-bold tracking-tight sm:text-4xl">
              {t("title")}
            </h2>
            <p className="mt-3 max-w-2xl text-muted-foreground">{t("lead")}</p>
          </div>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-2">
          {items.map((brief) => (
            <ProjectFeedCard
              key={brief.id}
              brief={brief}
              stats={stats.get(brief.id)}
              demo={isDemo}
              locale={locale}
              typeLabel={types[brief.project_type] ?? brief.project_type}
              labels={{
                demo: t("demoBadge"),
                open: t("open"),
                offers: (count: number) => t("offers", { count }),
                views: (count: number) => t("views", { count }),
                viewProject: t("viewProject"),
              }}
            />
          ))}
        </div>

        {isDemo ? (
          <p className="mt-6 text-center text-xs text-muted-foreground">{t("demoNote")}</p>
        ) : null}

        {/* Section D : navigation vers la vraie page des projets. */}
        <div className="mt-10 flex justify-center">
          <Link
            href="/briefs"
            className="btn-shine inline-flex min-h-11 items-center gap-2 rounded-full border border-primary/30 bg-primary-soft px-6 py-2.5 text-sm font-semibold text-primary transition-colors outline-none hover:border-primary/60 hover:bg-primary/15 focus-visible:ring-2 focus-visible:ring-primary/50"
          >
            {t("cta")}
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}

function ProjectFeedCard({
  brief,
  stats,
  demo,
  locale,
  typeLabel,
  labels,
}: {
  brief: FeedItem;
  stats?: BriefStats;
  demo: boolean;
  locale: string;
  typeLabel: string;
  labels: {
    demo: string;
    open: string;
    offers: (count: number) => string;
    views: (count: number) => string;
    viewProject: string;
  };
}) {
  const title = brief.title ?? firstLine(brief.description) ?? brief.client_name;
  const tags = (brief.features ?? []).map(String).filter(Boolean).slice(0, 3);
  const href = demo ? "/briefs" : `/briefs/${brief.id}`;
  const initials = clientInitials(brief.client_name);

  return (
    <article className="group relative flex h-full flex-col rounded-2xl border border-hairline bg-card p-5 transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-[0_24px_60px_-30px_rgba(57,255,136,0.35)] sm:p-6">
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="flex size-10 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-primary-soft font-headings text-xs font-bold text-primary"
        >
          {initials}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{brief.client_name}</p>
          <p className="truncate text-xs text-muted-foreground">{brief.client_city}</p>
        </div>
        <div className="ml-auto flex shrink-0 flex-col items-end gap-1.5">
          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
            <Clock3 className="size-3" aria-hidden="true" />
            {relativeTime(brief.created_at, locale)}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
            <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />
            {demo ? labels.demo : labels.open}
          </span>
        </div>
      </div>

      <span className="mt-4 inline-flex w-fit items-center rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
        {typeLabel}
      </span>

      <h3 className="mt-2.5 line-clamp-2 font-headings text-lg font-semibold leading-snug tracking-tight">
        <Link
          href={href}
          className="outline-none underline-offset-4 transition-colors hover:text-primary focus-visible:text-primary focus-visible:underline"
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

      <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-hairline pt-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5 font-semibold text-foreground">
          <Wallet className="size-3.5 text-primary" aria-hidden="true" />
          {formatFCFA(brief.budget)}
        </span>
        {stats ? (
          <>
            <span className="inline-flex items-center gap-1">
              <MessageSquare className="size-3.5" aria-hidden="true" />
              {labels.offers(stats.offers)}
            </span>
            <span className="inline-flex items-center gap-1">
              <Eye className="size-3.5" aria-hidden="true" />
              {labels.views(stats.views)}
            </span>
          </>
        ) : null}
        <Link
          href={href}
          className="ml-auto inline-flex items-center gap-1 rounded-full px-2 py-1.5 text-xs font-semibold text-primary outline-none transition-colors hover:text-primary-light focus-visible:ring-2 focus-visible:ring-primary/50"
          aria-label={`${labels.viewProject} — ${title}`}
        >
          {labels.viewProject}
          <ArrowUpRight className="size-3.5" aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}

function clientInitials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("") || "DM"
  );
}

/** Temps relatif localisé (FR/EN), sans dépendance supplémentaire. */
function relativeTime(isoDate: string, locale: string): string {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(isoDate).getTime()) / 60000));
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  if (minutes < 60) return formatter.format(-minutes, "minute");
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return formatter.format(-hours, "hour");
  const days = Math.floor(hours / 24);
  return formatter.format(-days, "day");
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
    title: "Boutique Shopify pour une marque de cosmétiques naturels",
    client_name: "Boutique Ndiaye",
    client_city: "Dakar, Sénégal",
    project_type: "e-commerce",
    budget: 450000,
    description:
      "Création d'une boutique Shopify complète : catalogue, paiement mobile money et livraison à Dakar. Charte graphique fournie.",
    status: "ouvert",
    hidden: false,
    budget_verified: true,
    demo: true,
    created_at: new Date(Date.now() - 35 * 60000).toISOString(),
    features: ["Shopify", "Mobile money", "Design"],
  },
  {
    id: "demo-2",
    title: "Refonte du site vitrine d'un cabinet de conseil",
    client_name: "Cabinet Konaté",
    client_city: "Abidjan, Côte d'Ivoire",
    project_type: "refonte",
    budget: 800000,
    description:
      "Nouveau design, blog et prise de rendez-vous en ligne. Le site actuel est lent et ne fonctionne pas correctement sur mobile.",
    status: "ouvert",
    hidden: false,
    budget_verified: true,
    demo: true,
    created_at: new Date(Date.now() - 2 * 3600000).toISOString(),
    features: ["Next.js", "Blog", "Réservation"],
  },
  {
    id: "demo-3",
    title: "Application web de suivi des récoltes pour une coopérative",
    client_name: "AgriTech Sahel",
    client_city: "Bamako, Mali",
    project_type: "app web",
    budget: 1200000,
    description:
      "Tableau de bord, saisie des récoltes, suivi des ventes et export Excel. Une dizaine d'utilisateurs sur le terrain, connexion instable.",
    status: "ouvert",
    hidden: false,
    budget_verified: false,
    demo: true,
    created_at: new Date(Date.now() - 5 * 3600000).toISOString(),
    features: ["Dashboard", "API", "Excel"],
  },
  {
    id: "demo-4",
    title: "Landing page de lancement pour une app de livraison",
    client_name: "Studio Loko",
    client_city: "Cotonou, Bénin",
    project_type: "landing page",
    budget: 180000,
    description:
      "Page de lancement avec formulaire d'inscription, tracking des conversions et version mobile soignée. Textes à rédiger.",
    status: "ouvert",
    hidden: false,
    budget_verified: true,
    demo: true,
    created_at: new Date(Date.now() - 9 * 3600000).toISOString(),
    features: ["Landing", "SEO", "Analytics"],
  },
  {
    id: "demo-5",
    title: "Site vitrine pour une école de formation numérique",
    client_name: "École Numérik",
    client_city: "Lomé, Togo",
    project_type: "vitrine",
    budget: 350000,
    description:
      "Présentation des formations, calendrier des sessions, formulaire de candidature et espace actualités. Contenu fourni par l'école.",
    status: "ouvert",
    hidden: false,
    budget_verified: true,
    demo: true,
    created_at: new Date(Date.now() - 14 * 3600000).toISOString(),
    features: ["Next.js", "Formulaire", "CMS"],
  },
  {
    id: "demo-6",
    title: "Application mobile de mise en relation pour artisans",
    client_name: "Artisan Connect",
    client_city: "Ouagadougou, Burkina Faso",
    project_type: "app web",
    budget: 2000000,
    description:
      "Application Android et iOS : profils d'artisans, demande de devis, messagerie et paiement mobile. Maquettes déjà prêtes.",
    status: "ouvert",
    hidden: false,
    budget_verified: false,
    demo: true,
    created_at: new Date(Date.now() - 22 * 3600000).toISOString(),
    features: ["React Native", "Paiement", "Messagerie"],
  },
  {
    id: "demo-7",
    title: "Intégration d'un chatbot de support client",
    client_name: "Maison Sarr",
    client_city: "Saint-Louis, Sénégal",
    project_type: "app web",
    budget: 600000,
    description:
      "Chatbot entraîné sur la FAQ de la boutique, connecté à WhatsApp Business et au catalogue produits. Réponses en français et en anglais.",
    status: "ouvert",
    hidden: false,
    budget_verified: true,
    demo: true,
    created_at: new Date(Date.now() - 28 * 3600000).toISOString(),
    features: ["IA", "WhatsApp", "API"],
  },
  {
    id: "demo-8",
    title: "Optimisation SEO et vitesse d'un site e-commerce",
    client_name: "Kora Market",
    client_city: "Conakry, Guinée",
    project_type: "refonte",
    budget: 300000,
    description:
      "Audit technique, correction des erreurs d'indexation, optimisation des images et des Core Web Vitals. Rapport mensuel attendu.",
    status: "ouvert",
    hidden: false,
    budget_verified: true,
    demo: true,
    created_at: new Date(Date.now() - 32 * 3600000).toISOString(),
    features: ["SEO", "Performance", "Audit"],
  },
];
