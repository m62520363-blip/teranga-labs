import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  ArrowRight,
  BadgeCheck,
  Check,
  FileText,
  MessageSquare,
  UserRound,
} from "lucide-react";

type Step = { num: string; title: string; text: string };
type Profile = { role: string; detail: string };

/**
 * Section « Recevez des offres sur-mesure » — la section E de la référence.
 *
 * À gauche : le parcours client en 3 étapes. À droite : un aperçu de
 * l'interface Devmarket (profils + proposition reçue), sans chiffre ni
 * témoignage inventé.
 */
export function CustomOffers() {
  const t = useTranslations("Landing.offers");
  const steps = t.raw("steps") as Step[];
  const profiles = t.raw("profiles") as Profile[];

  return (
    <section
      id="offres-sur-mesure"
      className="relative scroll-mt-24 overflow-hidden border-t border-hairline bg-surface py-20 sm:py-28"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-40 top-1/3 size-[34rem] rounded-full bg-[radial-gradient(closest-side,rgba(57,255,136,0.10),transparent)]"
      />
      <div className="container-tl relative">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-[1.02fr_0.98fr] lg:gap-16">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/[0.06] px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
              <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />
              {t("eyebrow")}
            </span>
            <h2 className="mt-5 text-balance font-headings text-3xl font-bold tracking-tight sm:text-4xl lg:text-[2.75rem] lg:leading-[1.08]">
              {t("title")}
            </h2>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              {t("lead")}
            </p>

            <ol className="mt-9 flex flex-col gap-6">
              {steps.map((step, index) => (
                <li key={step.num} className="relative flex gap-4">
                  {index < steps.length - 1 ? (
                    <span
                      aria-hidden="true"
                      className="absolute left-[1.1rem] top-11 h-[calc(100%-1.25rem)] w-px bg-gradient-to-b from-primary/40 to-transparent"
                    />
                  ) : null}
                  <span className="relative z-10 flex size-9 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-primary-soft font-headings text-sm font-bold text-primary">
                    {step.num}
                  </span>
                  <div className="pt-0.5">
                    <h3 className="font-headings text-base font-semibold tracking-tight sm:text-lg">
                      {step.title}
                    </h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                      {step.text}
                    </p>
                  </div>
                </li>
              ))}
            </ol>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/poster"
                className="btn-shine inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-ink transition-[filter] outline-none hover:brightness-110 active:brightness-95 focus-visible:ring-2 focus-visible:ring-primary/60"
              >
                {t("ctaPrimary")}
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
              <Link
                href="/briefs"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-hairline bg-card px-6 py-3 text-sm font-medium text-foreground transition-colors outline-none hover:border-primary/40 hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary/50"
              >
                {t("ctaSecondary")}
              </Link>
            </div>
          </div>

          {/* Aperçu produit : profils + carte de proposition. */}
          <div className="relative mx-auto w-full max-w-md lg:max-w-none">
            <div
              aria-hidden="true"
              className="absolute -inset-4 rounded-[2rem] bg-[radial-gradient(60%_60%_at_60%_10%,rgba(57,255,136,0.16),transparent)] blur-2xl"
            />
            <div className="card-elevate relative rounded-[1.75rem] border border-hairline bg-card/95 p-4 shadow-[0_40px_100px_-45px_rgba(0,0,0,0.9)] backdrop-blur sm:p-5">
              <div className="flex items-center justify-between gap-3 border-b border-hairline pb-4">
                <div className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-error/70" aria-hidden="true" />
                  <span className="size-2 rounded-full bg-warning/70" aria-hidden="true" />
                  <span className="size-2 rounded-full bg-primary/70" aria-hidden="true" />
                </div>
                <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  {t("profileNote")}
                </p>
                <UserRound className="size-4 text-muted-foreground" aria-hidden="true" />
              </div>

              <ul className="mt-4 flex flex-col gap-2.5">
                {profiles.map((profile, index) => (
                  <li
                    key={profile.role}
                    className="flex items-center gap-3 rounded-xl border border-hairline bg-background/60 px-3 py-2.5"
                  >
                    <span
                      aria-hidden="true"
                      className="flex size-9 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-primary-soft font-headings text-[11px] font-bold text-primary"
                    >
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">
                        {profile.role}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {profile.detail}
                      </span>
                    </span>
                    <BadgeCheck
                      className="ml-auto size-4 shrink-0 text-primary"
                      aria-hidden="true"
                    />
                  </li>
                ))}
              </ul>

              <div className="mt-4 rounded-xl border border-primary/20 bg-primary/[0.06] p-4">
                <div className="flex items-center gap-2">
                  <MessageSquare className="size-4 text-primary" aria-hidden="true" />
                  <p className="font-headings text-sm font-semibold">
                    {t("steps.1.title")}
                  </p>
                  <span className="ml-auto inline-flex items-center gap-1 rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                    <Check className="size-3" aria-hidden="true" />
                    1 Token
                  </span>
                </div>
                <ul className="mt-3 flex flex-col gap-1.5 text-xs text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <FileText className="size-3.5 text-primary" aria-hidden="true" />
                    {t("steps.1.title")}
                  </li>
                  <li className="flex items-center gap-2">
                    <BadgeCheck className="size-3.5 text-primary" aria-hidden="true" />
                    {t("steps.2.title")}
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
