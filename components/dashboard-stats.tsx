"use client";

import Link from "next/link";
import { Crown, MessageSquare, TrendingUp } from "lucide-react";
import { useBalance } from "@/components/balance-provider";
import { cn } from "cn";

export function DashboardStats({
  quota,
  unlocksCount,
}: {
  /** Quota serveur (get_my_subscription) — filet de sécurité du contexte live. */
  quota?: {
    plan_name_fr?: string;
    quota_used?: number;
    quota_limit?: number;
  } | null;
  unlocksCount: number;
}) {
  const { balance: ctxRemaining, quotaLimit, quotaUsed, planName, isSubscribed } =
    useBalance();

  const limit = quotaLimit ?? quota?.quota_limit ?? (isSubscribed ? 80 : 1);
  const used = quotaUsed ?? quota?.quota_used ?? 0;
  const remaining = ctxRemaining ?? Math.max(0, limit - used);

  const stats = [
    {
      icon: Crown,
      label: "Formule d’abonnement",
      value: planName ?? quota?.plan_name_fr ?? (isSubscribed ? "Pro" : "Découverte"),
      sub: isSubscribed
        ? "Abonnement actif · gérer sur Nos abonnements"
        : "Passez à Pro, Pro Max ou Agence",
      highlight: true,
      href: "/abonnement",
    },
    {
      icon: MessageSquare,
      label: "Contacts mensuels restants",
      value: `${remaining} / ${limit}`,
      sub:
        used > 0
          ? `${used} utilisé${used > 1 ? "s" : ""} sur la période en cours`
          : "Quota réinitialisé chaque mois",
      highlight: false,
      href: "/abonnement",
    },
    {
      icon: TrendingUp,
      label: "Projets contactés",
      value: String(unlocksCount),
      sub:
        unlocksCount === 0
          ? "Aucune proposition envoyée pour l’instant"
          : "Discussions clients ouvertes",
      highlight: false,
      href: "/briefs",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {stats.map((stat) => (
        <Link
          key={stat.label}
          href={stat.href}
          className={cn(
            "flex flex-col rounded-2xl border bg-card p-6 shadow-sm transition-colors outline-none hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-primary/50",
            stat.highlight ? "border-primary/40" : "border-hairline"
          )}
        >
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary-soft">
            <stat.icon className="size-4 text-primary" aria-hidden="true" />
          </span>
          <p className="mt-4 text-2xl font-semibold tracking-tight">
            {stat.value}
          </p>
          <p className="mt-0.5 text-sm font-medium">{stat.label}</p>
          <p className="mt-1 text-xs text-muted-foreground">{stat.sub}</p>
        </Link>
      ))}
    </div>
  );
}
