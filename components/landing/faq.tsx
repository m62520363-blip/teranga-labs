"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Briefcase, Plus, UsersRound } from "lucide-react";
import { cn } from "cn";

type FaqItem = { q: string; a: string };
type ColumnKey = "clients" | "developers";

const COLUMNS: { key: ColumnKey; icon: typeof UsersRound }[] = [
  { key: "clients", icon: UsersRound },
  { key: "developers", icon: Briefcase },
];

/**
 * Section FAQ — la section K de la référence.
 *
 * Deux colonnes (clients / développeurs) et un accordéon fluide : le panneau
 * s'ouvre via `grid-template-rows` (0fr → 1fr), sans saut de page ni hauteur
 * codée en dur. Chaque bouton expose `aria-expanded` / `aria-controls`.
 */
export function Faq() {
  const t = useTranslations("Landing.faq");
  const [open, setOpen] = React.useState<Record<ColumnKey, number | null>>({
    clients: 0,
    developers: 0,
  });

  const toggle = (column: ColumnKey, index: number) => {
    setOpen((previous) => ({
      ...previous,
      [column]: previous[column] === index ? null : index,
    }));
  };

  return (
    <section id="faq" className="scroll-mt-24 border-t border-hairline py-20 sm:py-28">
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

        <div className="mt-11 grid grid-cols-1 gap-x-8 gap-y-10 lg:grid-cols-2">
          {COLUMNS.map(({ key, icon: Icon }) => {
            const items = t.raw(`${key}.items`) as FaqItem[];
            return (
              <div key={key}>
                <h3 className="flex items-center gap-2.5 font-headings text-lg font-bold tracking-tight">
                  <span className="flex size-8 items-center justify-center rounded-lg border border-primary/25 bg-primary-soft text-primary">
                    <Icon className="size-4" aria-hidden="true" />
                  </span>
                  {t(`${key}.title`)}
                </h3>

                <div className="mt-5 flex flex-col gap-2.5">
                  {items.map((item, index) => {
                    const isOpen = open[key] === index;
                    const buttonId = `faq-${key}-${index}-button`;
                    const panelId = `faq-${key}-${index}-panel`;
                    return (
                      <div
                        key={item.q}
                        className={cn(
                          "rounded-xl border bg-card transition-colors duration-200",
                          isOpen ? "border-primary/30" : "border-hairline"
                        )}
                      >
                        <h4>
                          <button
                            type="button"
                            id={buttonId}
                            aria-expanded={isOpen}
                            aria-controls={panelId}
                            onClick={() => toggle(key, index)}
                            className="flex w-full items-center justify-between gap-4 rounded-xl px-4 py-4 text-left outline-none transition-colors hover:bg-white/[0.03] focus-visible:ring-2 focus-visible:ring-primary/50 sm:px-5"
                          >
                            <span className="text-sm font-semibold leading-snug sm:text-[15px]">
                              {item.q}
                            </span>
                            <span
                              aria-hidden="true"
                              className={cn(
                                "flex size-7 shrink-0 items-center justify-center rounded-full border border-hairline bg-background text-muted-foreground transition-transform duration-300",
                                isOpen && "rotate-45 border-primary/40 text-primary"
                              )}
                            >
                              <Plus className="size-4" />
                            </span>
                          </button>
                        </h4>
                        <div
                          id={panelId}
                          role="region"
                          aria-labelledby={buttonId}
                          aria-hidden={!isOpen}
                          className={cn(
                            "grid transition-[grid-template-rows,opacity] duration-300 ease-out",
                            isOpen
                              ? "grid-rows-[1fr] opacity-100"
                              : "pointer-events-none grid-rows-[0fr] opacity-0"
                          )}
                        >
                          <div className="overflow-hidden">
                            <p className="px-4 pb-4 text-sm leading-relaxed text-muted-foreground sm:px-5">
                              {item.a}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
