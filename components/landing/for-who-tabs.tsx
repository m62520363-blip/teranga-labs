"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Check } from "lucide-react";
import { SectionHeader } from "@/components/landing/section";
import { cn } from "cn";

const TAB_KEYS = ["client", "developer", "agency"] as const;
type TabKey = (typeof TAB_KEYS)[number];

/**
 * Section « Pour qui ? » : 3 onglets (Client / Développeur / Agence).
 * Accessible selon le pattern WAI-ARIA tabs (roving tabindex, rôles
 * tablist/tab/tabpanel, flèches gauche/droite).
 */
export function ForWhoTabs() {
  const t = useTranslations("Landing.forWho");
  const [active, setActive] = React.useState<TabKey>("client");
  const tabRefs = React.useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const idx = TAB_KEYS.indexOf(active);
    let next = idx;
    if (e.key === "ArrowRight") next = (idx + 1) % TAB_KEYS.length;
    else if (e.key === "ArrowLeft") next = (idx - 1 + TAB_KEYS.length) % TAB_KEYS.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = TAB_KEYS.length - 1;
    else return;
    e.preventDefault();
    const key = TAB_KEYS[next];
    setActive(key);
    tabRefs.current[next]?.focus();
  };

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

        <div
          role="tablist"
          aria-label={t("badge")}
          onKeyDown={onKeyDown}
          className="mx-auto mt-10 flex w-fit max-w-full gap-1 overflow-x-auto rounded-full border border-hairline bg-card p-1"
        >
          {TAB_KEYS.map((key, i) => (
            <button
              key={key}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              role="tab"
              id={`forwho-tab-${key}`}
              aria-selected={active === key}
              aria-controls={`forwho-panel-${key}`}
              tabIndex={active === key ? 0 : -1}
              onClick={() => setActive(key)}
              className={cn(
                "inline-flex min-h-9 shrink-0 items-center rounded-full px-4 py-1.5 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                active === key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t(`tabs.${i}.label`)}
            </button>
          ))}
        </div>

        {TAB_KEYS.map((key) => (
          <div
            key={key}
            role="tabpanel"
            id={`forwho-panel-${key}`}
            aria-labelledby={`forwho-tab-${key}`}
            hidden={active !== key}
            className="mx-auto mt-8 max-w-3xl"
          >
            <PanelContent tabKey={key} />
          </div>
        ))}
      </div>
    </section>
  );
}

function PanelContent({ tabKey }: { tabKey: TabKey }) {
  const t = useTranslations("Landing.forWho");
  const bullets = t.raw(`${tabKey}.bullets`) as string[];
  const ctaLabel = t(`${tabKey}.cta.label`);
  const ctaHref = t(`${tabKey}.cta.href`);
  return (
    <div className="rounded-card border border-hairline bg-card p-6 sm:p-8">
      <h3 className="font-headings text-2xl font-bold tracking-tight">
        {t(`${tabKey}.title`)}
      </h3>
      <p className="mt-3 text-muted-foreground">{t(`${tabKey}.text`)}</p>
      <ul className="mt-6 flex flex-col gap-3">
        {bullets.map((b) => (
          <li key={b} className="flex items-start gap-2 text-sm">
            <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
            {b}
          </li>
        ))}
      </ul>
      <div className="mt-8">
        <Link
          href={ctaHref}
          className="btn-shine inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-[filter] outline-none hover:brightness-110 active:brightness-95 focus-visible:ring-2 focus-visible:ring-primary/50"
        >
          {ctaLabel}
        </Link>
      </div>
    </div>
  );
}
