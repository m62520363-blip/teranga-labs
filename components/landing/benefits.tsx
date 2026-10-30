import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import {
  ArrowRight,
  BadgeCheck,
  Check,
  Crown,
  ShieldCheck,
  Wallet,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatFCFA, TOKEN_PRICE_FCFA } from "@/lib/formatting";

type Benefit = { title: string; text: string };
type Row = { label: string; value: string };

const ICONS: LucideIcon[] = [BadgeCheck, Wallet, Zap];

/**
 * Section « Un service simple, rapide et transparent » — porte l'ancre `#tarifs`.
 *
 * Tous les montants proviennent de la configuration réelle de l'application :
 *   - Publication d'un projet client : 0 FCFA
 *   - Commission sur les missions : 0 % (paiement direct entre client et développeur)
 *   - Ouverture d'un contact : 1 Token = TOKEN_PRICE_FCFA (2 500 FCFA)
 *   - Abonnement PRO optionnel : lu depuis la RPC publique `get_pro_prices`
 */
export async function Benefits() {
  const t = await getTranslations("Landing.benefits");
  const locale = await getLocale();
  const isEn = locale === "en";
  const items = t.raw("items") as Benefit[];
  const rows = t.raw("visual.rows") as Row[];

  const supabase = await createClient();
  let proPriceTokens: number | null = null;
  let proDurationDays: number | null = null;

  if (supabase) {
    const { data, error } = await supabase.rpc("get_pro_prices");
    if (!error && data && typeof data === "object") {
      const p = data as { price_tokens?: unknown; duration_days?: unknown };
      if (
        typeof p.price_tokens === "number" &&
        typeof p.duration_days === "number"
      ) {
        proPriceTokens = p.price_tokens;
        proDurationDays = p.duration_days;
      }
    }
  }

  return (
    <section
      id="tarifs"
      className="relative scroll-mt-24 overflow-hidden border-t border-hairline bg-surface py-20 sm:py-28"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-32 top-1/4 size-[30rem] rounded-full bg-[radial-gradient(closest-side,rgba(57,255,136,0.10),transparent)]"
      />
      <div className="container-tl relative grid grid-cols-1 items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-hairline bg-card px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            <span
              className="size-1.5 rounded-full bg-primary"
              aria-hidden="true"
            />
            {t("eyebrow")}
          </span>
          <h2 className="mt-5 text-balance font-headings text-3xl font-bold tracking-tight sm:text-4xl lg:text-[2.75rem] lg:leading-[1.08]">
            {t("title")}
          </h2>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            {t("lead")}
          </p>

          <ul className="mt-9 flex flex-col gap-5">
            {items.map((item, index) => {
              const Icon = ICONS[index] ?? ShieldCheck;
              return (
                <li key={item.title} className="flex gap-4">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary-soft text-primary">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <div>
                    <h3 className="font-headings text-base font-semibold tracking-tight">
                      {item.title}
                    </h3>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      {item.text}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link
              href="/poster"
              className="btn-shine inline-flex min-h-12 items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-ink transition-[filter] outline-none hover:brightness-110 active:brightness-95 focus-visible:ring-2 focus-visible:ring-primary/60"
            >
              {t("cta")}
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
            <Link
              href="/abonnement"
              className="inline-flex min-h-12 items-center gap-2 rounded-full border border-primary/30 bg-primary-soft px-5 py-3 text-sm font-semibold text-primary transition-colors outline-none hover:border-primary/60 hover:bg-primary/15 focus-visible:ring-2 focus-visible:ring-primary/60"
            >
              <Crown className="size-4" aria-hidden="true" />
              {isEn ? "Compare Free & PRO" : "Comparer Gratuit & PRO"}
            </Link>
          </div>
          <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
            {t("note")}
          </p>
        </div>

        <div className="relative mx-auto w-full max-w-md lg:max-w-none">
          <div
            aria-hidden="true"
            className="absolute -inset-3 rounded-[2rem] bg-[radial-gradient(60%_60%_at_50%_0%,rgba(57,255,136,0.16),transparent)] blur-2xl"
          />
          <div className="card-elevate relative overflow-hidden rounded-[1.75rem] border border-primary/25 bg-card p-6 shadow-[0_40px_100px_-50px_rgba(0,0,0,0.9)] sm:p-8">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-headings text-5xl font-extrabold tracking-tight text-primary sm:text-6xl">
                  {t("visual.value")}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t("visual.label")}
                </p>
              </div>
              <span className="flex size-11 items-center justify-center rounded-full border border-primary/25 bg-primary-soft text-primary">
                <ShieldCheck className="size-5" aria-hidden="true" />
              </span>
            </div>

            <dl className="mt-7 divide-y divide-hairline border-y border-hairline">
              {rows.map((row) => (
                <div
                  key={row.label}
                  className="flex items-center justify-between gap-4 py-3.5"
                >
                  <dt className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Check
                      className="size-4 shrink-0 text-primary"
                      aria-hidden="true"
                    />
                    {row.label}
                  </dt>
                  <dd className="text-right font-headings text-sm font-bold text-foreground">
                    {row.value}
                  </dd>
                </div>
              ))}

              <div className="flex items-center justify-between gap-4 py-3.5">
                <dt className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Check
                    className="size-4 shrink-0 text-primary"
                    aria-hidden="true"
                  />
                  {isEn ? "1 Token rate (contact unlock)" : "Cours d’un Token (contact direct)"}
                </dt>
                <dd className="text-right font-headings text-sm font-bold text-foreground">
                  {formatFCFA(TOKEN_PRICE_FCFA)}
                </dd>
              </div>

              {proPriceTokens !== null && proDurationDays !== null ? (
                <div className="flex items-center justify-between gap-4 py-3.5">
                  <dt className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Crown
                      className="size-4 shrink-0 text-primary"
                      aria-hidden="true"
                    />
                    {isEn
                      ? `Optional PRO badge (${proDurationDays} days)`
                      : `Badge PRO optionnel (${proDurationDays} jours)`}
                  </dt>
                  <dd className="text-right font-headings text-sm font-bold text-primary">
                    {proPriceTokens} Tokens ({formatFCFA(proPriceTokens * TOKEN_PRICE_FCFA)})
                  </dd>
                </div>
              ) : null}
            </dl>

            <p className="mt-5 flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
              <ShieldCheck
                className="mt-0.5 size-3.5 shrink-0 text-primary"
                aria-hidden="true"
              />
              {isEn
                ? "Direct payment between client and developer: Devmarket takes 0% commission on your projects."
                : "Paiement direct entre le client et le développeur : Devmarket ne prélève aucune commission sur vos missions."}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
