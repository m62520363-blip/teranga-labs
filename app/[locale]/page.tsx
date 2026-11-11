import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { getCurrentRole, getCurrentUser } from "@/lib/supabase/server";
import { Hero } from "@/components/landing/hero";
import { LatestProjects } from "@/components/landing/latest-projects";
import { HowItWorks } from "@/components/landing/how-it-works";
import { Categories } from "@/components/landing/categories";
import { SocialProof } from "@/components/landing/social-proof";
import { Faq } from "@/components/landing/faq";
import { RoleCards } from "@/components/landing/role-cards";
import { META } from "@/components/landing/content";
import { createClient } from "@/lib/supabase/server";
import type { ApprovedDeveloper } from "@/types/database";
import { absoluteUrl } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Meta");
  const locale = await getLocale();
  return {
    title: t("title"),
    description: t("description"),
    applicationName: "Devmarket",
    keywords: t("keywords"),
    openGraph: {
      title: t("ogTitle"),
      description: t("description"),
      type: "website",
      siteName: "Devmarket",
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
      title: t("ogTitle"),
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
  const faq = faqT.raw("faq") as {
    clients: { items: { q: string; a: string }[] };
    developers: { items: { q: string; a: string }[] };
  };
  const faqs = [...faq.clients.items, ...faq.developers.items];

  // Avatars réels des développeurs approuvés (preuve sociale comme Codeur.com).
  // Aucune photo fictive : on ne prend que les profils qui possèdent un avatar_url.
  const supabase = await createClient();
  let developerAvatars: { id: string; name: string; username: string | null; avatar_url: string }[] = [];
  if (supabase) {
    const { data } = await supabase.rpc("list_approved_developers", {
      p_limit: 12,
      p_offset: 0,
    });
    developerAvatars = ((Array.isArray(data) ? data : []) as ApprovedDeveloper[])
      .filter((d) => Boolean(d?.id) && Boolean(d?.avatar_url))
      .slice(0, 8)
      .map((d) => ({
        id: d.id,
        name: d.full_name ?? d.username ?? (locale === "en" ? "Developer" : "Développeur"),
        username: d.username,
        avatar_url: d.avatar_url as string,
      }));
  }

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        name: "Devmarket",
        description: metaT("description"),
        inLanguage: locale,
      },
      {
        "@type": "FAQPage",
        mainEntity: faqs.map((item) => ({
          "@type": "Question",
          name: item.q,
          acceptedAnswer: {
            "@type": "Answer",
            text: item.a,
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
        <Hero developerAvatars={developerAvatars} />
        <LatestProjects />
        <HowItWorks />
        <Categories />
        <SocialProof />
        <RoleCards />
        <Faq />
      </div>
    </>
  );
}
