import type { Metadata } from "next";
import {
  ArrowRight,
  HelpCircle,
  MessageCircle,
  UserPlus,
  Wallet,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { FaqSearchableList } from "@/components/faq-searchable-list";
import { Reveal } from "@/components/reveal";
import { TOKEN_LABEL_PRICED } from "@/lib/formatting";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Pages.faq");
  return {
    title: t("metaTitle"),
    description: t("metaDesc"),
  };
}

const GROUP_ICONS = [UserPlus, Wallet, MessageCircle];
const GROUP_HREFS = ["/poster", "/briefs", "/login"];

export default async function FaqPage() {
  const t = await getTranslations("Pages.faq");
  const groups = (
    t.raw("groups") as { title: string; text: string; cta: string }[]
  ).map((group, index) => ({
    ...group,
    icon: GROUP_ICONS[index],
    href: GROUP_HREFS[index],
  }));
  const faqs = t.raw("faqs") as { q: string; a: string }[];
  const resolvedFaqs = faqs.map((f, index) => ({
    q: f.q,
    a: t(`faqs.${index}.a`, { token: TOKEN_LABEL_PRICED }),
  }));

  return (
    <div className="bg-surface py-16 md:py-24">
      <div className="container-tl">
        <div className="mx-auto max-w-3xl">
          <span className="chip gap-2 bg-card/85 border-hairline backdrop-blur">
            <HelpCircle className="size-3.5 text-primary" aria-hidden="true" />
            FAQ
          </span>
          <h1 className="mt-6 text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
            {t("h1")}
          </h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground">
            {t("intro")}
          </p>
        </div>

        <div className="mx-auto mt-12 max-w-3xl">
          <div className="grid gap-4 sm:grid-cols-3">
            {groups.map((group) => (
              <Reveal key={group.title}>
                <div className="card-elevate flex h-full flex-col rounded-2xl border border-hairline bg-card p-5">
                  <group.icon
                    className="size-5 text-primary"
                    aria-hidden="true"
                  />
                  <h2 className="mt-3 font-semibold tracking-tight">
                    {group.title}
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {group.text}
                  </p>
                  <Link
                    href={group.href}
                    className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary-light"
                  >
                    {group.cta}
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </Link>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal className="mt-12">
            <FaqSearchableList
              items={resolvedFaqs}
              placeholder={t("searchPlaceholder")}
              ariaLabel={t("searchAria")}
              emptyLabel={t("searchEmpty")}
            />
          </Reveal>

          <div className="mt-12 flex flex-col items-start justify-between gap-4 rounded-2xl bg-muted p-6 sm:flex-row sm:items-center sm:p-8">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">
                {t("notFoundTitle")}
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-white/70">
                {t("notFoundText")}
              </p>
            </div>
            <Link href="/contact" className="btn btn-invert">
              {t("notFoundCta")}
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
