import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { createClient, getCurrentRole, getCurrentUser } from "@/lib/supabase/server";
import type { PublicRequest } from "@/types/database";
import { BriefCard } from "@/components/brief-card";
import { BriefGrid } from "@/components/brief-grid";
import { EmptyState } from "@/components/empty-state";
import { MarqueeStrip } from "@/components/marquee-strip";
import { PROJECT_TYPE_LABELS } from "@/lib/tokens";
import { COUNTRIES } from "@/lib/countries";
import { formatFCFA } from "@/lib/formatting";

/** Bandeau défilant : les types de projets réellement acceptés + les pays et régions desservis. */
const PROJECT_TYPE_LABELS_LIST = [
  ...Object.values(PROJECT_TYPE_LABELS),
  ...COUNTRIES.map((c) => c.nameFr),
  ...COUNTRIES.flatMap((c) => c.regions.map((r) => r.name)),
];
import { Hero } from "@/components/landing/hero";
import { ConceptSection } from "@/components/landing/concept";
import { HowItWorks } from "@/components/landing/how-it-works";
import { BuyerSection } from "@/components/landing/buyer";
import { SellersSection } from "@/components/landing/sellers";
import { TrustSection } from "@/components/landing/trust";
import { StatsSection } from "@/components/landing/stats";
import { FaqSection } from "@/components/landing/faq";
import { FinalCta } from "@/components/landing/cta";
import { Section, SectionHeader } from "@/components/landing/section";
import { META } from "@/components/landing/content";

export const metadata: Metadata = {
  title: META.title,
  description: META.description,
  applicationName: "TERANGA LABS",
  keywords: META.keywords,
  openGraph: {
    title: META.title,
    description: META.description,
    type: "website",
    siteName: "TERANGA LABS",
    locale: "fr_SN",
    url: META.url || undefined,
  },
  twitter: {
    card: "summary_large_image",
    title: META.title,
    description: META.description,
  },
};

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      name: "TERANGA LABS",
      description: META.description,
      inLanguage: "fr-SN",
    },
    {
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: "Qu’est-ce que TERANGA LABS ?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "TERANGA LABS est le marketplace des projets web de l'Afrique de l'Ouest francophone : le client publie le brief de son site pour 1 Token, et le développeur qui s'intéresse débloque le contact avec 1 Token. Aucune commission.",
          },
        },
      ],
    },
  ],
};

export type HomeStats = {
  count: number;
  cities: number;
  avgBudget: number;
};

async function getHomeData() {
  const supabase = await createClient();
  if (!supabase) return { briefs: [] as PublicRequest[], stats: null as HomeStats | null };

  // Les compteurs « En direct » portent sur TOUS les briefs publiés, pas seulement
  // les 6 affichés plus bas : on demande donc le total exact et les agrégats
  // séparément de la grille récente.
  const [briefsRes, statsRes] = await Promise.all([
    supabase
      .from("requests")
      .select(
        "id, client_name, client_city, project_type, budget, description, status, hidden, budget_verified, created_at"
      )
      .eq("status", "ouvert")
      .eq("hidden", false)
      .order("created_at", { ascending: false })
      .limit(6),
    supabase
      .from("requests")
      .select("client_city, budget", { count: "exact" })
      .eq("status", "ouvert")
      .eq("hidden", false),
  ]);

  const briefs = (briefsRes.data ?? []) as PublicRequest[];
  const rows = statsRes.data ?? [];
  const total = statsRes.count ?? 0;

  if (rows.length === 0) {
    return { briefs, stats: null };
  }


  const cities = new Set(
    rows
      .map((row) => (row.client_city ?? "").trim())
      .filter((city) => city.length > 0)
  );
  const totalBudget = rows.reduce((sum, row) => sum + (row.budget ?? 0), 0);

  return {
    briefs,
    stats: {
      count: Math.max(total, rows.length),
      cities: cities.size,
      avgBudget: Math.round(totalBudget / rows.length),
    },
  };
}

export default async function HomePage() {
  const [user, role] = await Promise.all([getCurrentUser(), getCurrentRole()]);
  if (user) redirect(role === "client" ? "/client" : "/dashboard");

  const { briefs, stats } = await getHomeData();

  // Le visuel du hero montre un VRAI brief quand il y en a un : c'est la preuve
  // la plus forte qu'on puisse afficher sans recruiter de faux témoignages.
  const heroBrief = briefs[0]
    ? {
        title: briefs[0].description.length > 90
          ? `${briefs[0].description.slice(0, 90)}…`
          : briefs[0].description,
        budget: formatFCFA(briefs[0].budget),
        location: `${briefs[0].client_city} · Discussion privée`,
      }
    : null;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <div className="bg-background">
        <Hero realBrief={heroBrief} />
        <ConceptSection />
        <MarqueeStrip
          items={PROJECT_TYPE_LABELS_LIST}
          ariaLabel="Catégories et régions couvertes"
        />
        <HowItWorks />
        <BuyerSection />
        <SellersSection />
        <TrustSection />
        <StatsSection stats={stats} />
        <RecentRequests briefs={briefs} />
        <FaqSection />
        <FinalCta />
      </div>
    </>
  );
}

function RecentRequests({ briefs }: { briefs: PublicRequest[] }) {
  return (
    <Section ariaLabel="Demandes récentes">
      <SectionHeader
        eyebrow="En direct"
        title="Ce qui se cherche en ce moment"
        lead="Chaque demande est publiée par un client pour 1 Token. Le développeur intéressé débloque le contact avec 1 Token et écrit directement."
      />
      <div className="mt-14">
        {briefs.length > 0 ? (
          <BriefGrid>
            {briefs.map((brief) => (
              <BriefCard key={brief.id} brief={brief} />
            ))}
          </BriefGrid>
        ) : (
          <EmptyState
            title="Aucune demande en ligne pour le moment"
            description="Les dernières demandes publiées apparaîtront ici automatiquement."
            action={
              <Link href="/poster" className="btn btn-primary">
                Publier une demande
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            }
          />
        )}
      </div>
    </Section>
  );
}