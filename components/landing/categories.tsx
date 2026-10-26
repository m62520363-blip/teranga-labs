import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  ArrowUpRight,
  BrainCircuit,
  Code2,
  Palette,
  ShoppingBag,
  Smartphone,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";

type Category = { label: string; hint: string };

/** Icônes associées, dans le même ordre que les traductions. */
const ICONS: LucideIcon[] = [
  Code2,
  ShoppingBag,
  Smartphone,
  Palette,
  TrendingUp,
  BrainCircuit,
];

/**
 * Catégories de métiers — le bloc « Des freelances pour tous vos projets »
 * de Codeur.com, adapté au périmètre Devmarket (projets web et digitaux).
 */
export function Categories() {
  const t = useTranslations("Landing.categories");
  const items = t.raw("items") as Category[];

  return (
    <section className="border-t border-hairline py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-5 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-hairline bg-card px-3 py-1 text-sm text-muted-foreground">
            <span className="size-2 rounded-full bg-primary" aria-hidden="true" />
            {t("badge")}
          </span>
          <h2 className="mt-4 font-headings text-3xl font-bold tracking-tight sm:text-4xl">
            {t("titleA")} <span className="text-primary">{t("titleB")}</span>
          </h2>
          <p className="mt-3 text-muted-foreground">{t("lead")}</p>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((category, index) => {
            const Icon = ICONS[index % ICONS.length];
            return (
              <Link
                key={category.label}
                href="/dev"
                className="group flex items-start gap-4 rounded-2xl border border-hairline bg-card p-5 transition-all duration-300 outline-none hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:ring-2 focus-visible:ring-primary/50"
              >
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 font-semibold tracking-tight">
                    {category.label}
                    <ArrowUpRight
                      className="size-4 text-muted-foreground transition-colors group-hover:text-primary"
                      aria-hidden="true"
                    />
                  </span>
                  <span className="mt-1 block text-sm text-muted-foreground">
                    {category.hint}
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
