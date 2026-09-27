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
import { SENEGAL_REGIONS } from "@/lib/tokens";
import { Hero } from "@/components/landing/hero";
import { ProblemSection } from "@/components/landing/problem";
import { ConceptSection } from "@/components/landing/concept";
import { HowItWorks } from "@/components/landing/how-it-works";
import { BuyerSection } from "@/components/landing/buyer";
import { SellersSection } from "@/components/landing/sellers";
import { DemoSection } from "@/components/landing/demo";
import { CategoriesSection } from "@/components/landing/categories";
import { BenefitsSection } from "@/components/landing/benefits";
import { TrustSection } from "@/components/landing/trust";
import { StatsSection } from "@/components/landing/stats";
import { TestimonialsSection } from "@/components/landing/testimonials";
import { FaqSection } from "@/components/landing/faq";
import { FinalCta } from "@/components/landing/cta";
import { PortalSection } from "@/components/landing/portal";
import { Section, SectionHeader } from "@/components/landing/section";
import { CATEGORIES, META } from "@/components/landing/content";

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
            text: "TERANGA LABS est le marketplace inversé du Sénégal : les clients publient le brief de leur site web pour 1 Token, et les développeurs sérieux viennent vers eux en débloquant le contact avec 1 Token (2 500 F).",
          },
        },
      ],
    },
  ],
};

async function getHomeData() {
  const supabase = await createClient();
  if (!supabase) return { briefs: [] as PublicRequest[] };

  const briefsRes = await supabase
    .from("requests")
    .select(
      "id, client_name, client_city, project_type, budget, description, status, hidden, budget_verified, created_at"
    )
    .eq("status", "ouvert")
    .eq("hidden", false)
    .order("created_at", { ascending: false })
    .limit(6);

  return { briefs: (briefsRes.data ?? []) as PublicRequest[] };
}

export default async function HomePage() {
  const [user, role] = await Promise.all([getCurrentUser(), getCurrentRole()]);
  if (user) redirect(role === "client" ? "/client" : "/dashboard");

  const { briefs } = await getHomeData();

  const realStats =
    briefs.length > 0
      ? {
          count: briefs.length,
          cities: new Set(briefs.map((b) => b.client_city)).size,
          avgBudget: Math.round(
            briefs.reduce((sum, b) => sum + b.budget, 0) / briefs.length
          ),
        }
      : null;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <div className="bg-[#0A0A0A]">
        <Hero />
        <PortalSection />
        <MarqueeStrip
          items={[
            ...CATEGORIES.map((c) => c.title),
            ...SENEGAL_REGIONS,
          ]}
          ariaLabel="Catégories et régions couvertes"
        />
        <ProblemSection />
        <ConceptSection />
        <HowItWorks />
        <BuyerSection />
        <SellersSection />
        <DemoSection />
        <CategoriesSection />
        <BenefitsSection />
        <TrustSection />
        <StatsSection stats={realStats} />
        <RecentRequests briefs={briefs} />
        <TestimonialsSection />
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