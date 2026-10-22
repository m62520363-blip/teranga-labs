import { useTranslations } from "next-intl";
import { SectionHeader } from "@/components/landing/section";

type Stat = { value: string; label: string };

/** Bandeau de preuve sociale : 4 chiffres clés + note de réassurance. */
export function SocialProof() {
  const t = useTranslations("Landing.socialProof");
  const stats = t.raw("stats") as Stat[];
  return (
    <section className="border-t border-hairline bg-surface py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-5 sm:px-6">
        <SectionHeader
          eyebrow={t("badge")}
          title={
            <>
              {t("titleA")} <span className="text-primary">{t("titleB")}</span>
            </>
          }
          lead={t("lead")}
        />
        <dl className="mt-12 grid grid-cols-2 gap-6 lg:grid-cols-4">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-card border border-hairline bg-card p-6 text-center"
            >
              <dt className="font-headings text-3xl font-bold text-primary sm:text-4xl">
                {stat.value}
              </dt>
              <dd className="mt-2 text-sm text-muted-foreground">{stat.label}</dd>
            </div>
          ))}
        </dl>
        <p className="mx-auto mt-8 max-w-2xl text-center text-sm text-muted-foreground">
          {t("note")}
        </p>
      </div>
    </section>
  );
}
