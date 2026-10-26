"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  ArrowRight,
  ArrowUpRight,
  BrainCircuit,
  Code2,
  Megaphone,
  Palette,
  Server,
  ShoppingBag,
  type LucideIcon,
} from "lucide-react";
import { cn } from "cn";

type CategoryItem = { label: string; hint: string; query: string };
type CategoryGroup = { items: CategoryItem[] };
type TabKey = number;

const TAB_ICONS: LucideIcon[] = [
  Code2,
  ShoppingBag,
  Palette,
  Megaphone,
  Server,
  BrainCircuit,
];

/**
 * Section « Tous les métiers du digital » — la section G de la référence.
 *
 * Six onglets accessibles (pattern WAI-ARIA tabs, flèches gauche/droite,
 * Home/End) et 24 métiers, chacun relié à la vraie recherche de l'annuaire
 * (`/dev?q=`).
 */
export function Categories() {
  const t = useTranslations("Landing.categories");
  const tabs = t.raw("tabs") as string[];
  const groups = t.raw("groups") as CategoryGroup[];
  const [active, setActive] = React.useState<TabKey>(0);
  const tabRefs = React.useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const last = tabs.length - 1;
    let next = active;
    if (event.key === "ArrowRight") next = active === last ? 0 : active + 1;
    else if (event.key === "ArrowLeft") next = active === 0 ? last : active - 1;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = last;
    else return;
    event.preventDefault();
    setActive(next);
    tabRefs.current[next]?.focus();
  };

  const items = groups[active]?.items ?? [];

  return (
    <section id="categories" className="scroll-mt-24 border-t border-hairline py-20 sm:py-28">
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

        <div
          role="tablist"
          aria-label={t("eyebrow")}
          onKeyDown={onKeyDown}
          className="mt-10 flex snap-x items-center gap-2 overflow-x-auto pb-2 [scrollbar-width:none] sm:flex-wrap sm:justify-center sm:overflow-visible [&::-webkit-scrollbar]:hidden"
        >
          {tabs.map((tab, index) => {
            const Icon = TAB_ICONS[index] ?? Code2;
            const selected = index === active;
            return (
              <button
                key={tab}
                ref={(el) => {
                  tabRefs.current[index] = el;
                }}
                type="button"
                role="tab"
                id={`category-tab-${index}`}
                aria-selected={selected}
                aria-controls="category-panel"
                tabIndex={selected ? 0 : -1}
                onClick={() => setActive(index)}
                className={cn(
                  "inline-flex h-10 shrink-0 snap-start items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
                  selected
                    ? "border-primary/60 bg-primary text-ink"
                    : "border-hairline bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
                )}
              >
                <Icon className="size-4" aria-hidden="true" />
                {tab}
              </button>
            );
          })}
        </div>

        <div
          role="tabpanel"
          id="category-panel"
          aria-labelledby={`category-tab-${active}`}
          tabIndex={0}
          className="mt-7 outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        >
          <ul key={active} className="animate-rise grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {items.map((item) => (
              <li key={item.label}>
                <Link
                  href={`/dev?q=${encodeURIComponent(item.query)}`}
                  className="group flex h-full items-start gap-3 rounded-2xl border border-hairline bg-card p-4 transition-all duration-300 outline-none hover:-translate-y-0.5 hover:border-primary/40 hover:bg-surface-secondary focus-visible:ring-2 focus-visible:ring-primary/50"
                >
                  <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
                    <ArrowUpRight className="size-4" aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-headings text-sm font-semibold tracking-tight">
                      {item.label}
                    </span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                      {item.hint}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-9 flex justify-center">
          <Link
            href="/dev"
            className="btn-shine inline-flex min-h-11 items-center gap-2 rounded-full border border-primary/30 bg-primary-soft px-6 py-2.5 text-sm font-semibold text-primary transition-colors outline-none hover:border-primary/60 hover:bg-primary/15 focus-visible:ring-2 focus-visible:ring-primary/50"
          >
            {t("cta")}
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}
