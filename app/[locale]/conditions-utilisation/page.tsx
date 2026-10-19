import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LegalPage } from "@/components/legal-page";
import { getLegal } from "@/i18n/legal";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Pages.legal.terms");
  return {
    title: t("metaTitle"),
    description: t("metaDesc"),
  };
}

export default async function ConditionsUtilisationPage() {
  const { t, rich } = await getLegal("Pages.legal.terms");

  return (
    <LegalPage
      title={t("title")}
      lead={t("lead")}
      updated={t("updated")}
      sections={[
        { heading: t("s1.h"), body: rich("s1.b") },
        { heading: t("s2.h"), body: rich("s2.b") },
        { heading: t("s3.h"), body: rich("s3.b") },
        { heading: t("s4.h"), body: rich("s4.b") },
        { heading: t("s5.h"), body: rich("s5.b") },
        { heading: t("s6.h"), body: rich("s6.b") },
        { heading: t("s7.h"), body: rich("s7.b") },
        { heading: t("s8.h"), body: rich("s8.b") },
        { heading: t("s9.h"), body: rich("s9.b") },
        { heading: t("s10.h"), body: rich("s10.b") },
        { heading: t("s11.h"), body: rich("s11.b") },
        { heading: t("s12.h"), body: rich("s12.b") },
      ]}
    />
  );
}
