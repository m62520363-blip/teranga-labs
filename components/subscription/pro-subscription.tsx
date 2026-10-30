"use client";

/**
 * Page « Abonnement PRO » — comparaison Gratuit / PRO.
 *
 * Fidélité à la réalité du code (migration 0046) :
 *   • une SEULE offre existe (contrainte `plan in ('pro')`) : pas de bascule
 *     mensuel/annuel, pas d'offres multiples, qui seraient inventées ;
 *   • le prix vient de `get_pro_prices` (app_settings), jamais d'une constante ;
 *   • PRO n'offre QUE le badge, sur le profil public et dans l'annuaire.
 *     Le classement de l'annuaire n'est PAS amélioré : seuls les profils
 *     sponsorisés passent en tête (`sponsored_profiles`). On ne promet donc
 *     rien d'autre que ce qui est réellement implémenté.
 */

import * as React from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  AlertTriangle,
  Check,
  Crown,
  Loader2,
  Minus,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { cn } from "cn";
import { createClient } from "@/lib/supabase/client";
import { formatFCFA, TOKEN_PRICE_FCFA } from "@/lib/formatting";
import { FaqItem } from "@/components/faq-item";

export type ProPrices = {
  price_tokens: number;
  duration_days: number;
};

export type ProStatus = {
  active: boolean;
  ends_at: string | null;
  plan: string | null;
};

export function ProSubscription({
  prices,
  configured,
  status,
  balance,
  isAuthenticated,
  username,
  justSubscribed,
}: {
  prices: ProPrices | null;
  configured: boolean;
  status: ProStatus | null;
  balance: number | null;
  isAuthenticated: boolean;
  username: string | null;
  justSubscribed: boolean;
}) {
  const t = useTranslations("Subscription");
  const supabase = React.useMemo(() => createClient(), []);

  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [current, setCurrent] = React.useState<ProStatus | null>(status);
  const [localBalance, setLocalBalance] = React.useState<number | null>(balance);

  const priceTokens = prices?.price_tokens ?? null;
  const durationDays = prices?.duration_days ?? null;
  const priceFcfa =
    priceTokens !== null ? priceTokens * TOKEN_PRICE_FCFA : null;

  const subscribe = async () => {
    setBusy(true);
    setError("");
    try {
      const { data, error: err } = await supabase.rpc("subscribe_pro");
      if (err) {
        setError(
          typeof err.message === "string" && err.message
            ? err.message
            : t("errors.generic")
        );
        return;
      }
      const d = data as { ends_at?: string; balance?: number } | null;
      setCurrent({
        active: true,
        ends_at: d?.ends_at ?? null,
        plan: "pro",
      });
      if (typeof d?.balance === "number") setLocalBalance(d.balance);
    } catch {
      setError(t("errors.generic"));
    } finally {
      setBusy(false);
    }
  };

  const endsLabel = current?.ends_at
    ? new Date(current.ends_at).toLocaleDateString()
    : "";

  const faq = t.raw("faq.items") as { q: string; a: string }[];

  return (
    <div className="mx-auto max-w-5xl">
      {/* ------------------------------ EN-TÊTE ------------------------------ */}
      <header className="text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
          {t("eyebrow")}
        </p>
        <h1 className="mt-3 font-headings text-3xl font-bold tracking-tight sm:text-4xl">
          {t("titleA")} <span className="text-primary">{t("titleB")}</span>
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
          {t("lead")}
        </p>
      </header>

      {/* ------------------------------- STATUT ------------------------------ */}
      {current?.active ? (
        <div
          role="status"
          className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/30 bg-primary-soft px-5 py-4"
        >
          <p className="flex items-center gap-2 text-sm font-medium text-primary">
            <ShieldCheck className="size-4 shrink-0" aria-hidden="true" />
            {t("status.active", { date: endsLabel })}
          </p>
          {typeof localBalance === "number" ? (
            <p className="text-xs text-muted-foreground">
              {t("status.balance", { count: localBalance })}
            </p>
          ) : null}
        </div>
      ) : justSubscribed ? (
        <div
          role="status"
          className="mt-8 flex items-center gap-2 rounded-2xl border border-primary/30 bg-primary-soft px-5 py-4 text-sm font-medium text-primary"
        >
          <Check className="size-4 shrink-0" aria-hidden="true" />
          {t("status.justSubscribed")}
        </div>
      ) : null}

      {/* ------------------------------- PRIX -------------------------------- */}
      {!configured ? (
        <div className="mt-10 rounded-2xl border border-hairline bg-card p-8 text-center">
          <AlertTriangle className="mx-auto size-6 text-muted-foreground" aria-hidden="true" />
          <p className="mt-3 text-sm text-muted-foreground">{t("notConfigured")}</p>
        </div>
      ) : !prices || priceTokens === null ? (
        <div className="mt-10 rounded-2xl border border-hairline bg-card p-8 text-center">
          <AlertTriangle className="mx-auto size-6 text-muted-foreground" aria-hidden="true" />
          <p className="mt-3 text-sm text-muted-foreground">{t("pricesUnavailable")}</p>
        </div>
      ) : (
        <section
          aria-label={t("offer.aria")}
          className="mt-10 grid gap-6 md:grid-cols-2"
        >
          {/* --- Colonne 1 : Gratuit --- */}
          <div className="flex min-w-0 flex-col rounded-2xl border border-hairline bg-card p-6">
            <h2 className="text-base font-semibold tracking-tight">
              {t("offer.free.title")}
            </h2>
            <p className="mt-4 font-headings text-4xl font-bold">
              {t("offer.free.price")}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("offer.free.note")}
            </p>
            <ul className="mt-6 flex flex-1 flex-col gap-3 text-sm">
              {(
                t.raw("offer.free.features") as { label: string; ok: boolean }[]
              ).map((f) => (
                <li key={f.label} className="flex items-start gap-2.5">
                  {f.ok ? (
                    <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                  ) : (
                    <Minus className="mt-0.5 size-4 shrink-0 text-muted-foreground/60" aria-hidden="true" />
                  )}
                  <span className={cn(!f.ok && "text-muted-foreground")}>
                    {f.label}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* --- Colonne 2 : PRO --- */}
          <div className="relative flex min-w-0 flex-col overflow-hidden rounded-2xl border border-primary/25 bg-primary-soft p-6">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_140%_at_100%_0%,color-mix(in_srgb,var(--primary)_16%,transparent),transparent_55%)]"
            />
            <div className="relative flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight">
                <Crown className="size-4 text-primary" aria-hidden="true" />
                {t("offer.pro.title")}
              </h2>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-background/60 px-2.5 py-1 text-[11px] font-semibold text-primary">
                <Sparkles className="size-3" aria-hidden="true" />
                {t("offer.pro.tag")}
              </span>
            </div>

            <p className="relative mt-4 font-headings text-4xl font-bold">
              {priceTokens}
              <span className="ml-2 text-base font-medium text-muted-foreground">
                {t("offer.pro.tokens", { count: priceTokens })}
              </span>
            </p>
            {priceFcfa !== null ? (
              <p className="relative mt-1 text-sm text-muted-foreground">
                {t("offer.pro.fcfa", { price: formatFCFA(priceFcfa) })}
              </p>
            ) : null}
            <p className="relative mt-2 text-sm text-muted-foreground">
              {durationDays !== null
                ? t("offer.pro.duration", { days: durationDays })
                : t("offer.pro.durationUnknown")}
            </p>

            <ul className="relative mt-6 flex flex-1 flex-col gap-3 text-sm">
              {(
                t.raw("offer.pro.features") as { label: string; ok: boolean }[]
              ).map((f) => (
                <li key={f.label} className="flex items-start gap-2.5">
                  {f.ok ? (
                    <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                  ) : (
                    <Minus className="mt-0.5 size-4 shrink-0 text-muted-foreground/60" aria-hidden="true" />
                  )}
                  <span className={cn(!f.ok && "text-muted-foreground")}>
                    {f.label}
                  </span>
                </li>
              ))}
            </ul>

            {/* ------------------------------ ACTION ----------------------------- */}
            <div className="relative mt-6">
              {!isAuthenticated ? (
                <Link
                  href="/login"
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-medium text-ink transition-colors outline-none hover:bg-primary-hover focus-visible:ring-2 focus-visible:ring-primary/50"
                >
                  <Crown className="size-4" aria-hidden="true" />
                  {t("cta.signIn")}
                </Link>
              ) : !username ? (
                <Link
                  href="/inscription-developpeur"
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-medium text-ink transition-colors outline-none hover:bg-primary-hover focus-visible:ring-2 focus-visible:ring-primary/50"
                >
                  <Crown className="size-4" aria-hidden="true" />
                  {t("cta.register")}
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => void subscribe()}
                  disabled={busy}
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-medium text-ink transition-colors outline-none hover:bg-primary-hover focus-visible:ring-2 focus-visible:ring-primary/50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {busy ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Crown className="size-4" aria-hidden="true" />
                  )}
                  {current?.active
                    ? t("cta.extend", { count: priceTokens })
                    : t("cta.activate", { count: priceTokens })}
                </button>
              )}

              <p className="mt-3 text-center text-xs text-muted-foreground">
                {t("cta.paidFromBalance")}
              </p>

              {typeof localBalance === "number" ? (
                <p className="mt-2 text-center text-xs text-muted-foreground">
                  {t("cta.yourBalance", { count: localBalance })}
                </p>
              ) : null}

              {error ? (
                <p
                  role="alert"
                  className="mt-3 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-center text-sm font-medium text-destructive"
                >
                  {error}
                </p>
              ) : null}
            </div>
          </div>
        </section>
      )}

      {/* ------------------------------ RÉSERVE ------------------------------ */}
      <p className="mx-auto mt-8 max-w-2xl text-center text-sm leading-relaxed text-muted-foreground">
        {t("honestyNote")}
      </p>

      {/* -------------------------------- FAQ -------------------------------- */}
      <section aria-label={t("faq.aria")} className="mt-16">
        <h2 className="font-headings text-2xl font-semibold tracking-tight">
          {t("faq.title")}
        </h2>
        <div className="mt-6 border-t border-hairline">
          {faq.map((item) => (
            <FaqItem key={item.q} question={item.q} answer={item.a} />
          ))}
        </div>
      </section>
    </div>
  );
}
