"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight, BadgeCheck, Crown, Star } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatFCFA } from "@/lib/formatting";

type SubInfo = {
  active: boolean;
  status: string;
  plan_id: string;
  plan_name_fr: string;
  badge_label: string | null;
  ranking_stars: number;
  billing_cycle: string;
  ends_at: string | null;
  cancel_at_period_end: boolean;
  quota_limit: number;
  quota_used: number;
  quota_remaining: number;
  quota_pct: number;
};

export default function ProPanel() {
  const [sub, setSub] = React.useState<SubInfo | null>(null);
  const supabase = React.useMemo(() => createClient(), []);

  React.useEffect(() => {
    void supabase.rpc("get_my_subscription").then(({ data }) => {
      if (data && typeof data === "object") {
        setSub(data as unknown as SubInfo);
      }
    });
  }, [supabase]);

  const endsLabel = sub?.ends_at
    ? new Date(sub.ends_at).toLocaleDateString("fr-FR")
    : "";

  return (
    <div className="rounded-2xl border border-hairline bg-card p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-base font-semibold">
            <Crown className="size-4 text-primary" aria-hidden="true" />
            Mon abonnement & quotas mensuels
          </h3>
          <p className="mt-1.5 max-w-xl text-sm text-muted-foreground">
            Choisissez votre formule mensuelle ou annuelle : Pro (2 500 FCFA/mois
            · 80 contacts), Pro Max (7 000 FCFA/mois · 200 contacts) ou Agence
            (15 000 FCFA/mois · 400 contacts).
          </p>
        </div>

        <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary-soft px-3 py-1 text-xs font-semibold text-primary">
          <Crown className="size-3.5" aria-hidden="true" />
          {sub?.active
            ? `Formule ${sub.plan_name_fr}${endsLabel ? ` · jusqu’au ${endsLabel}` : ""}`
            : "Formule Découverte (Gratuit)"}
        </span>
      </div>

      {sub ? (
        <div className="mt-5 rounded-xl border border-hairline bg-surface p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="font-medium">
              Contacts de projets utilisés ce mois-ci
            </span>
            <span className="font-semibold text-primary tabular-nums">
              {sub.quota_used} / {sub.quota_limit} ({sub.quota_remaining} restants)
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-border-strong">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${Math.min(100, sub.quota_pct ?? 0)}%` }}
            />
          </div>
        </div>
      ) : null}

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {[
          {
            name: "Pro",
            price: 2500,
            quota: "80 contacts/mois",
            badge: "Badge Pro · 1 étoile",
          },
          {
            name: "Pro Max",
            price: 7000,
            quota: "200 contacts/mois",
            badge: "Badge Pro+ · 2 étoiles · Recommandé",
            highlight: true,
          },
          {
            name: "Agence",
            price: 15000,
            quota: "400 contacts/mois",
            badge: "Badge Pro++ · 3 étoiles · Équipe",
          },
        ].map((plan) => (
          <div
            key={plan.name}
            className={
              plan.highlight
                ? "rounded-xl border border-primary/40 bg-primary-soft p-4"
                : "rounded-xl border border-hairline bg-surface p-4"
            }
          >
            <div className="flex items-center justify-between">
              <p className="font-semibold">{plan.name}</p>
              <Star className="size-3.5 text-primary" aria-hidden="true" />
            </div>
            <p className="mt-1 text-lg font-bold text-primary">
              {formatFCFA(plan.price)}
              <span className="text-xs font-normal text-muted-foreground">
                /mois
              </span>
            </p>
            <p className="mt-1 text-xs font-medium text-foreground">
              {plan.quota}
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {plan.badge}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Link
          href="/abonnement"
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-ink transition-colors hover:bg-primary-hover"
        >
          {sub?.active ? (
            <BadgeCheck className="size-4" aria-hidden="true" />
          ) : (
            <Crown className="size-4" aria-hidden="true" />
          )}
          {sub?.active ? "Gérer ou changer ma formule" : "Choisir mon abonnement"}
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}
