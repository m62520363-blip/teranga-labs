import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  ArrowRight,
  BadgeCheck,
  Banknote,
  Coins,
  Headphones,
  LayoutGrid,
  Mail,
  MessageCircle,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from "lucide-react";

type Card = { title: string; text: string };
type Tool = { title: string; text: string };

const CARD_ICONS: LucideIcon[] = [LayoutGrid, Wallet, Headphones];
const TOOL_ICONS: LucideIcon[] = [
  MessageCircle,
  Coins,
  BadgeCheck,
  TrendingUp,
  Banknote,
  Mail,
];

/**
 * Section « Une plateforme adaptée à tous vos projets » — la section I.
 * Trois promesses concrètes, puis les six outils réellement disponibles
 * dans l'espace Devmarket.
 */
export function Platform() {
  const t = useTranslations("Landing.platform");
  const cards = t.raw("cards") as Card[];
  const tools = t.raw("tools") as Tool[];

  return (
    <section id="plateforme" className="scroll-mt-24 border-t border-hairline py-20 sm:py-28">
      <div className="container-tl">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/[0.06] px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
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

        <ul className="mt-11 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {cards.map((card, index) => {
            const Icon = CARD_ICONS[index] ?? LayoutGrid;
            return (
              <li
                key={card.title}
                className="group rounded-2xl border border-hairline bg-card p-6 transition-colors duration-300 hover:border-primary/40"
              >
                <span className="flex size-11 items-center justify-center rounded-xl bg-primary-soft text-primary transition-transform duration-300 group-hover:-translate-y-0.5">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <h3 className="mt-4 font-headings text-base font-semibold tracking-tight">
                  {card.title}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {card.text}
                </p>
              </li>
            );
          })}
        </ul>

        <div className="mt-14 rounded-[1.75rem] border border-hairline bg-surface p-6 sm:p-9">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <h3 className="max-w-md font-headings text-xl font-bold tracking-tight sm:text-2xl">
              {t("toolsTitle")}
            </h3>
            <Link
              href="/signup"
              className="btn-shine inline-flex min-h-11 w-fit items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-ink transition-[filter] outline-none hover:brightness-110 active:brightness-95 focus-visible:ring-2 focus-visible:ring-primary/60"
            >
              {t("cta")}
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </div>

          <ul className="mt-8 grid grid-cols-1 gap-x-8 gap-y-7 sm:grid-cols-2 lg:grid-cols-3">
            {tools.map((tool, index) => {
              const Icon = TOOL_ICONS[index] ?? BadgeCheck;
              return (
                <li key={tool.title} className="flex gap-3.5">
                  <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg border border-hairline bg-card text-primary">
                    <Icon className="size-4" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="font-headings text-sm font-semibold tracking-tight">
                      {tool.title}
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      {tool.text}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}
