"use client";

import { useTranslations } from "next-intl";
import {
  BarChart3,
  Eye,
  MessageCircle,
  TrendingUp,
  UsersRound,
} from "lucide-react";
import { cn } from "cn";

export type DeveloperStats = {
  profile_views: number;
  profile_views_30d: number;
  contact_clicks: number;
  contact_clicks_30d: number;
  contacts: number;
  contacts_30d: number;
  conversion_rate: number;
  tracking_available: boolean;
};

/**
 * Panneau « Performance du profil » de l'espace développeur.
 * Les contacts ouverts viennent des conversations directes (données
 * réelles). Les vues et clics viennent du suivi analytics ; si la table
 * n'est pas encore active, le panneau reste lisible et l'indique.
 */
export function PerformancePanel({ stats }: { stats: DeveloperStats | null }) {
  const t = useTranslations("DevStats");

  const cards = [
    {
      key: "views",
      icon: Eye,
      label: t("views"),
      value: stats?.profile_views_30d ?? 0,
      total: stats?.profile_views ?? 0,
    },
    {
      key: "clicks",
      icon: MessageCircle,
      label: t("clicks"),
      value: stats?.contact_clicks_30d ?? 0,
      total: stats?.contact_clicks ?? 0,
    },
    {
      key: "contacts",
      icon: UsersRound,
      label: t("contacts"),
      value: stats?.contacts_30d ?? 0,
      total: stats?.contacts ?? 0,
    },
  ];

  return (
    <section
      className="rounded-2xl border border-hairline bg-card p-6 shadow-sm sm:p-8"
      aria-label={t("title")}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <BarChart3 className="size-5 text-primary" aria-hidden="true" />
            {t("title")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <span className="rounded-full border border-hairline bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
          {t("last30")}
        </span>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ key, icon: Icon, label, value, total }) => (
          <div key={key} className="rounded-xl bg-muted p-4">
            <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Icon className="size-3.5 text-primary" aria-hidden="true" />
              {label}
            </p>
            <p className="mt-2 text-2xl font-semibold tracking-tight">
              {value.toLocaleString("fr-FR")}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t("total", { count: total })}
            </p>
          </div>
        ))}

        <div className="rounded-xl bg-primary-soft p-4">
          <p className="flex items-center gap-1.5 text-xs font-medium text-primary">
            <TrendingUp className="size-3.5" aria-hidden="true" />
            {t("conversion")}
          </p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-primary">
            {(stats?.conversion_rate ?? 0).toLocaleString("fr-FR")} %
          </p>
          <p className="mt-0.5 text-xs text-primary/80">{t("conversionHint")}</p>
        </div>
      </div>

      {stats && !stats.tracking_available ? (
        <p
          className={cn(
            "mt-4 rounded-xl border border-hairline bg-surface-secondary p-3",
            "text-xs leading-relaxed text-muted-foreground"
          )}
        >
          {t("trackingOff")}
        </p>
      ) : null}
    </section>
  );
}
