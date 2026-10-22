import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { getCurrentRole, getCurrentUser } from "@/lib/supabase/server";
import { Hero } from "@/components/landing/hero";
import { HowItWorks } from "@/components/landing/how-it-works";
import { PricingSection } from "@/components/landing/pricing";
import { FaqSection } from "@/components/landing/faq";
import { RoleCards } from "@/components/landing/role-cards";
import { SocialProof } from "@/components/landing/social-proof";
import { TokenSection } from "@/components/landing/token-section";
import { ComparisonTable } from "@/components/landing/comparison-table";
import { Testimonials } from "@/components/landing/testimonials";
import { ForWhoTabs } from "@/components/landing/for-who-tabs";
import { CountryFlags } from "@/components/landing/country-flags";
import { META } from "@/components/landing/content";
import { TOKEN_LABEL_PRICED } from "@/lib/formatting";
import { absoluteUrl } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Meta");
  const locale = await getLocale();
  return {
    title: t("title"),
    description: t("description"),
    applicationName: "TERANGA LABS",
    keywords: t("keywords"),
    openGraph: {
      title: t("title"),
      description: t("description"),
      type: "website",
      siteName: "TERANGA LABS",
      locale,
      url: META.url || undefined,
      images: [
        {
          url: absoluteUrl("/og.png"),
          width: 1200,
          height: 630,
          alt: t("ogAlt"),
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: t("title"),
      description: t("description"),
      images: [absoluteUrl("/og.png")],
    },
  };
}

export default async function HomePage() {
  const [user, role] = await Promise.all([getCurrentUser(), getCurrentRole()]);
  if (user) redirect(role === "client" ? "/client" : "/dashboard");

  const locale = await getLocale();
  const metaT = await getTranslations("Meta");
  const faqT = await getTranslations("Landing");
  const faqs = faqT.raw("faqs") as { q: string; a: string }[];

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        name: "TERANGA LABS",
        description: metaT("description"),
        inLanguage: locale,
      },
      {
        "@type": "FAQPage",
        mainEntity: faqs.map((_, i) => ({
          "@type": "Question",
          name: faqT(`faqs.${i}.q`),
          acceptedAnswer: {
            "@type": "Answer",
            text: faqT(`faqs.${i}.a`, { token: TOKEN_LABEL_PRICED }),
          },
        })),
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <div className="bg-background">
        <Hero />
        <CountryFlags />
        <SocialProof />
        <HowItWorks />
        <TokenSection />
        <PricingSection />
        <ComparisonTable />
        <ForWhoTabs />
        <Testimonials />
        <FaqSection />
        <RoleCards />
      </div>
    </>
  );
}
