import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Coins } from "lucide-react";
import { SectionHeader } from "@/components/landing/section";

type Use = { title: string; text: string };

/** Section Token : prix unique + les 3 usages, avec CTA vers /tokens. */
export function TokenSection() {
  const t = useTranslations("Landing.token");
  const uses = t.raw("uses") as Use[];
  return (
    <section className="border-t border-hairline py-16 sm:py-20">
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

        <div className="mx-auto mt-12 flex max-w-md flex-col items-center rounded-card border border-primary/20 bg-primary-soft p-8 text-center">
          <Coins className="size-8 text-primary" aria-hidden="true" />
          <p className="mt-4 font-headings text-5xl font-bold">{t("price")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t("priceUnit")}</p>
        </div>

        <div className="mx-auto mt-8 grid max-w-4xl gap-6 sm:grid-cols-3">
          {uses.map((use) => (
            <div
              key={use.title}
              className="rounded-card border border-hairline bg-card p-6"
            >
              <h3 className="font-headings text-lg font-semibold">{use.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {use.text}
              </p>
            </div>
          ))}
        </div>

        <p className="mx-auto mt-8 max-w-2xl text-center text-sm text-muted-foreground">
          {t("note")}
        </p>

        <div className="mt-8 text-center">
          <Link
            href={t("ctaHref")}
            className="btn-shine inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-[filter] outline-none hover:brightness-110 active:brightness-95 focus-visible:ring-2 focus-visible:ring-primary/50"
          >
            {t("cta")}
          </Link>
        </div>
      </div>
    </section>
  );
}
