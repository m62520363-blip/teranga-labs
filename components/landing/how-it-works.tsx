"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import {
  CircleCheck,
  FileText,
  MessageCircle,
  Search,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  search: Search,
  "file-text": FileText,
  "shield-check": ShieldCheck,
  "message-circle": MessageCircle,
  "circle-check": CircleCheck,
};

type Step = { num: string; title: string; text: string; icon: string };

/**
 * Section « Comment ça marche » : cartes empilées en sticky stacking
 * (chaque carte reste collée sous la précédente pendant le scroll).
 */
export function HowItWorks() {
  const t = useTranslations("Landing.howItWorks");
  const steps = t.raw("steps") as Step[];
  const last = steps.length - 1;

  return (
    <section
      id="comment-ca-marche"
      className="relative z-10 scroll-mt-24 rounded-t-[2.5rem] bg-background py-20 sm:py-28"
    >
      <div className="mx-auto max-w-6xl px-5 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 px-3 py-1 text-sm text-foreground">
            <ShieldCheck className="size-4 text-primary" aria-hidden="true" />
            {t("badge")}
          </span>
          <h2 className="mt-4 font-headings text-3xl font-bold tracking-tight sm:text-4xl">
            {t("titleA")} <span className="text-primary">{t("titleB")}</span>
          </h2>
          <p className="mt-4 text-muted-foreground">{t("lead")}</p>
        </div>

        <div className="mt-12 lg:mt-16">
          <div className="mx-auto max-w-2xl">
            {steps.map((step, i) => {
              const Icon = ICONS[step.icon] ?? Search;
              return (
                <div
                  key={step.num}
                  data-stack-card="true"
                  className="sticky stack-card"
                  style={{
                    top: `calc(6rem + ${(i * 0.75).toFixed(2).replace(/\.?0+$/, "")}rem)`,
                    marginBottom: i === last ? 0 : "2rem",
                    zIndex: i + 1,
                  }}
                >
                  <div className="flex items-start gap-4 rounded-card border border-hairline bg-card p-6 shadow-lg shadow-black/5 sm:gap-5 sm:p-8">
                    <div className="flex flex-col items-center gap-2">
                      <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <Icon className="size-5" aria-hidden="true" />
                      </span>
                      <span className="font-headings text-sm font-bold text-muted-foreground tabular-nums">
                        {step.num}
                      </span>
                    </div>
                    <div className="pt-1">
                      <h3 className="font-headings text-lg font-semibold tracking-tight sm:text-xl">
                        {step.title}
                      </h3>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">
                        {step.text}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Révélation progressive des cartes empilées au scroll */}
      <StackCardObserver />
    </section>
  );
}

/** Ajoute `.is-in` aux cartes empilées quand elles entrent dans le viewport. */
function StackCardObserver() {
  const rootRef = React.useRef<HTMLElement>(null);

  React.useEffect(() => {
    const root = rootRef.current?.closest("section");
    if (!root) return;
    const cards = Array.from(root.querySelectorAll<HTMLElement>("[data-stack-card]"));
    if (typeof IntersectionObserver === "undefined") {
      cards.forEach((c) => c.classList.add("is-in"));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-in");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );
    cards.forEach((c) => observer.observe(c));
    return () => observer.disconnect();
  }, []);

  return <span ref={rootRef} hidden />;
}
