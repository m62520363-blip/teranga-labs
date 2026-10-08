"use client";

import React from "react";
import { Loader2, Star } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "cn";

type Prices = { profile_per_day: number; brief_per_day: number };

const DURATION_OPTIONS = [
  { days: 7, label: "7 jours" },
  { days: 14, label: "14 jours" },
  { days: 30, label: "30 jours" },
];

export default function SponsorPanel() {
  const [prices, setPrices] = React.useState<Prices | null>(null);
  const [days, setDays] = React.useState(7);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [success, setSuccess] = React.useState("");

  const supabase = createClient();

  React.useEffect(() => {
    supabase.rpc("get_sponsoring_prices").then(({ data }) => {
      const p = data as Prices | null;
      if (p && typeof p.profile_per_day === "number") setPrices(p);
    });
  }, [supabase]);

  const buy = async () => {
    setBusy(true);
    setError("");
    setSuccess("");
    const { data, error: err } = await supabase.rpc("sponsor_dev_profile", {
      p_days: days,
    });
    setBusy(false);
    if (err) {
      setError(
        typeof err.message === "string" && err.message
          ? err.message
          : "Une erreur est survenue."
      );
      return;
    }
    const d = data as { ends_at?: string; price?: number; balance?: number } | null;
    const ends = d?.ends_at ? new Date(d.ends_at) : null;
    setSuccess(
      `Votre profil est mis en avant${ends ? ` jusqu'au ${ends.toLocaleDateString("fr-FR")}` : ""} (${d?.price ?? ""} Tokens).`
    );
  };

  if (!prices) return null;

  return (
    <div className="rounded-2xl border border-hairline bg-card p-5">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <Star className="size-4 text-primary" aria-hidden="true" />
        Mettre mon profil en avant
      </h3>
      <p className="mt-2 text-sm text-muted-foreground">
        Votre profil apparaît en tête de l&apos;annuaire pendant la durée choisie :
        {prices.profile_per_day} Tokens / jour.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {DURATION_OPTIONS.map((o) => (
          <button
            key={o.days}
            type="button"
            onClick={() => setDays(o.days)}
            className={cn(
              "inline-flex h-9 items-center rounded-lg border px-3 text-sm font-medium transition-colors",
              days === o.days
                ? "border-primary bg-primary-soft text-primary"
                : "border-hairline bg-background text-muted-foreground hover:text-foreground"
            )}
          >
            {o.label}
          </button>
        ))}
        <span className="ml-auto text-sm font-semibold">
          {prices.profile_per_day * days} Tokens
        </span>
      </div>

      <button
        type="button"
        onClick={() => void buy()}
        disabled={busy}
        className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-medium text-ink transition-colors hover:bg-primary-hover disabled:opacity-60"
      >
        {busy ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <Star className="size-4" aria-hidden="true" />
        )}
        Promouvoir mon profil
      </button>

      {error ? (
        <p className="mt-3 text-sm font-medium text-destructive">{error}</p>
      ) : null}
      {success ? (
        <p className="mt-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-700">
          {success}
        </p>
      ) : null}
    </div>
  );
}