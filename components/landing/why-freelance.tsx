import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  ArrowRight,
  BadgeCheck,
  Banknote,
  CalendarDays,
  Lightbulb,
  Zap,
  type LucideIcon,
} from "lucide-react";

type Item = { title: string; text: string };

const ICONS: LucideIcon[] = [BadgeCheck, Banknote, CalendarDays, Lightbulb, Zap];

/**
 * Section « Pourquoi un freelance ? » — la section I bis de la référence.
 * Cinq arguments factuels, plus une tuile d'action qui complète la grille.
 */
export function WhyFreelance() {
  const t = useTranslations("Landing.why");
  const items = t.raw("items") as Item[];

  return (
    <section
      id="pourquoi-freelance"
      className="scroll-mt-24 border-t border-hairline bg-surface py-20 sm:py-28"
    >
      <div className="container-tl">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-hairline bg-card px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />
            {t("eyebrow")}
          </span>
          <h2 className="mt-5 text-balance font-headings text-3xl font-bold tracking-tight sm:text-4xl lg:text-[2.75rem]">
            {t("title")}
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
            {t("lead")}
          </p>
        </div>

        <ul className="mt-11 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item, index) => {
            const Icon = ICONS[index] ?? BadgeCheck;
            return (
              <li
                key={item.title}
                className="rounded-2xl border border-hairline bg-card p-6"
              >
                <span className="flex size-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <h3 className="mt-4 font-headings text-base font-semibold tracking-tight">
                  {item.title}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {item.text}
                </p>
              </li>
            );
          })}

          <li className="flex flex-col justify-between gap-6 rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/[0.14] via-primary/[0.07] to-transparent p-6">
            <div>
              <span className="flex size-10 items-center justify-center rounded-xl border border-primary/25 bg-primary/15 text-primary">
                <Zap className="size-5" aria-hidden="true" />
              </span>
              <p className="mt-4 font-headings text-base font-semibold tracking-tight">
                {t("lead")}
              </p>
            </div>
            <Link
              href="/poster"
              className="btn-shine inline-flex min-h-11 w-fit items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-ink transition-[filter] outline-none hover:brightness-110 active:brightness-95 focus-visible:ring-2 focus-visible:ring-primary/60"
            >
              {t("cta")}
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </li>
        </ul>
      </div>
    </section>
  );
}
