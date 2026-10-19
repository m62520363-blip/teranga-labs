import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LegalPage } from "@/components/legal-page";
import { getLegal } from "@/i18n/legal";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Pages.legal.cookies");
  return {
    title: t("metaTitle"),
    description: t("metaDesc"),
  };
}

export default async function CookiesPage() {
  const { t, rich } = await getLegal("Pages.legal.cookies");
  const cookieGroups = t.raw("groups") as { name: string; description: string }[];

  return (
    <LegalPage
      title={t("title")}
      lead={t("lead")}
      updated={t("updated")}
      sections={[
        { heading: t("s1.h"), body: rich("s1.b") },
        {
          heading: t("s2.h"),
          body: (
            <div className="space-y-4">
              {cookieGroups.map((group) => (
                <div
                  key={group.name}
                  className="rounded-xl border border-hairline bg-card p-4"
                >
                  <h3 className="text-sm font-semibold tracking-tight text-foreground">
                    {group.name}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                    {group.description}
                  </p>
                </div>
              ))}
            </div>
          ),
        },
        { heading: t("s3.h"), body: rich("s3.b") },
        { heading: t("s4.h"), body: rich("s4.b") },
        { heading: t("s5.h"), body: rich("s5.b") },
      ]}
    />
  );
}
