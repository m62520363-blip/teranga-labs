import type { Metadata } from "next";
import { ArrowRight, Coins, FileSearch, ShieldCheck } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { TOKEN_RULE } from "@/lib/formatting";
import { Scene3D } from "@/components/landing/scene-3d";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Pages.about");
  return {
    title: t("metaTitle"),
    description: t("metaDesc"),
  };
}

const VALUE_ICONS = [FileSearch, Coins, ShieldCheck];

export default async function AProposPage() {
  const t = await getTranslations("Pages.about");
  const values = (
    t.raw("values") as { title: string; text: string }[]
  ).map((value, index) => ({
    ...value,
    text: t(`values.${index}.text`, { tokenRule: TOKEN_RULE }),
    icon: VALUE_ICONS[index],
  }));

  return (
    <div className="bg-surface py-16 md:py-24">
      <div className="container-tl">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
            {t("h1")}
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
            <span className="font-semibold text-foreground">
              {t("leadBold")}
            </span>{" "}
            {t("leadRest")}
          </p>

          <div className="mt-10 flex justify-center">
            <Scene3D variant="marketplace" />
          </div>

          <div className="mt-12 grid gap-6 sm:grid-cols-3">
            {values.map((value) => (
              <div
                key={value.title}
                className="rounded-2xl border border-hairline bg-card p-6"
              >
                <value.icon className="size-5 text-primary" aria-hidden="true" />
                <h2 className="mt-4 font-semibold tracking-tight">{value.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {value.text}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-12 rounded-2xl bg-muted p-8 text-white sm:p-10">
            <h2 className="text-xl font-semibold tracking-tight">
              {t("ctaTitle")}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-white/70">
              {t("ctaText")}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/poster" className="btn btn-invert">
                {t("ctaPrimary")}
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
              <Link href="/briefs" className="btn btn-invert">
                {t("ctaSecondary")}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
