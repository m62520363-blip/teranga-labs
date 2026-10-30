"use client";

import { Link } from "@/i18n/navigation";
import { Crown } from "lucide-react";
import { useBalance } from "@/components/balance-provider";

/**
 * Badge d'abonnement et de quota mensuel de contacts de projets restants
 * pour l'espace développeur (remplace l'ancien indicateur de monnaie virtuelle).
 */
export function TokenBalance() {
  const { balance, quotaLimit, planName } = useBalance();

  const label =
    balance !== null && quotaLimit !== null
      ? `${planName ?? "Formule"} · ${balance}/${quotaLimit} contacts`
      : planName ?? "Mon abonnement";

  return (
    <Link
      href="/abonnement"
      title="Gérer mon abonnement et mon quota mensuel de propositions"
      className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-xs font-medium text-foreground transition-colors outline-none hover:border-primary/40 hover:bg-primary-soft focus-visible:ring-2 focus-visible:ring-primary/50"
      aria-label={label}
    >
      <Crown className="size-3.5 text-primary" aria-hidden="true" />
      <span className="truncate">{label}</span>
    </Link>
  );
}
