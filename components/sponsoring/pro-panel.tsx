"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight, BadgeCheck, Crown, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type ProPrices = { price_tokens: number; duration_days: number };
type ProStatus = { active: boolean; ends_at: string | null; plan: string | null };

export default function ProPanel() {
  const [prices, setPrices] = React.useState<ProPrices | null>(null);
  const [status, setStatus] = React.useState<ProStatus | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");

  const supabase = createClient();

  React.useEffect(() => {
    void supabase.rpc("get_pro_status").then(({ data }) => {
      const s = data as ProStatus | null;
      if (s && typeof s.active === "boolean") setStatus(s);
    });
    void supabase.rpc("get_pro_prices").then(({ data }) => {
      const p = data as ProPrices | null;
      if (p && typeof p.price_tokens === "number") setPrices(p);
    });
  }, [supabase]);

  const subscribe = async () => {
    setBusy(true);
    setError("");
    const { data, error: err } = await supabase.rpc("subscribe_pro");
    setBusy(false);
    if (err) {
      setError(
        typeof err.message === "string" && err.message
          ? err.message
          : "Une erreur est survenue."
      );
      return;
    }
    const d = data as ProStatus | { ends_at?: string } | null;
    const ends = (d as { ends_at?: string } | null)?.ends_at;
    setStatus({
      active: true,
      ends_at: ends ?? null,
      plan: "pro",
    });
  };

  if (!prices) return null;

  const endsLabel = status?.ends_at
    ? new Date(status.ends_at).toLocaleDateString("fr-FR")
    : "";

  return (
    <div className="rounded-2xl border border-hairline bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Crown className="size-4 text-primary" aria-hidden="true" />
            Abonnement PRO
          </h3>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            Votre profil affiche le badge PRO sur votre fiche publique et dans
            l&apos;annuaire des développeurs. {prices.duration_days} jours pour{" "}
            {prices.price_tokens} Tokens, renouvelable à tout moment.
          </p>
        </div>

        <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary-soft px-3 py-1 text-xs font-semibold text-primary">
          <Crown className="size-3.5" aria-hidden="true" />
          {status?.active ? `Actif jusqu'au ${endsLabel}` : "Non actif"}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void subscribe()}
          disabled={busy}
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-medium text-ink transition-colors hover:bg-primary-hover disabled:opacity-60"
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : status?.active ? (
            <BadgeCheck className="size-4" aria-hidden="true" />
          ) : (
            <Crown className="size-4" aria-hidden="true" />
          )}
          {status?.active
            ? "Prolonger l'abonnement"
            : `Activer PRO (${prices.price_tokens} Tokens)`}
        </button>

        <Link
          href="/abonnement"
          className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-hairline bg-background/60 px-4 text-sm font-medium text-foreground transition-colors outline-none hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-primary/50"
        >
          Comparer Gratuit et PRO
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </div>

      {error ? (
        <p className="mt-3 text-sm font-medium text-destructive">{error}</p>
      ) : null}
    </div>
  );
}