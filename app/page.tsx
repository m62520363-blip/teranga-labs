import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentRole, getCurrentUser } from "@/lib/supabase/server";
import { Hero } from "@/components/landing/hero";
import { HowItWorks } from "@/components/landing/how-it-works";
import { PricingSection } from "@/components/landing/pricing";
import { FaqSection } from "@/components/landing/faq";
import { RoleCards } from "@/components/landing/role-cards";
import { FAQS_LANDING, META } from "@/components/landing/content";

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
    locale: "fr",
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
      inLanguage: "fr",
    },
    {
      "@type": "FAQPage",
      mainEntity: FAQS_LANDING.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
  ],
};

export default async function HomePage() {
  const [user, role] = await Promise.all([getCurrentUser(), getCurrentRole()]);
  if (user) redirect(role === "client" ? "/client" : "/dashboard");

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <div className="bg-background">
        <Hero />
        <HowItWorks />
        <PricingSection />
        <FaqSection />
        <RoleCards />
      </div>
    </>
  );
}
