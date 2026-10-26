import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  ArrowRight,
  BadgeCheck,
  Briefcase,
  CircleCheck,
  FileText,
  MessageCircle,
  Search,
  UserRound,
  Coins,
} from "lucide-react";

type Step = { title: string; text: string };

const CLIENT_ICONS = [FileText, MessageCircle, CircleCheck];
const DEVELOPER_ICONS = [UserRound, Search, Coins];

/**
 * Section « Comment ça marche » — la section F de la référence.
 *
 * Deux parcours côte à côte (client / développeur), trois étapes chacun,
 * plus un aperçu de profil dans la carte développeur. Aucune étape ne
 * dépend d'une donnée inventée.
 */
export function HowItWorks() {
  const t = useTranslations("Landing.process");
  const clientSteps = t.raw("client.steps") as Step[];
  const developerSteps = t.raw("developer.steps") as Step[];

  return (
    <section
      id="comment-ca-marche"
      className="scroll-mt-24 border-t border-hairline py-20 sm:py-28"
    >
      <div className="container-tl">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/[0.06] px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
            <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />
            {t("eyebrow")}
          </span>
          <h2 className="mt-5 text-balance font-headings text-3xl font-bold tracking-tight sm:text-4xl lg:text-[2.75rem]">
            {t("title")}
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
            {t("lead")}
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-7">
          <article className="flex flex-col rounded-[1.75rem] border border-hairline bg-card p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-2xl border border-hairline bg-background text-primary">
                <Briefcase className="size-5" aria-hidden="true" />
              </span>
              <h3 className="font-headings text-xl font-bold tracking-tight">
                {t("client.title")}
              </h3>
            </div>

            <ol className="mt-7 flex flex-1 flex-col gap-5">
              {clientSteps.map((step, index) => {
                const Icon = CLIENT_ICONS[index] ?? CircleCheck;
                return (
                  <li key={step.title} className="flex gap-3.5">
                    <span className="relative flex size-8 shrink-0 items-center justify-center rounded-full border border-primary/25 bg-primary-soft text-primary">
                      <Icon className="size-4" aria-hidden="true" />
                    </span>
                    <div className="pt-0.5">
                      <p className="text-sm font-semibold sm:text-base">
                        <span className="mr-1.5 font-headings text-xs font-bold text-primary tabular-nums">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        {step.title}
                      </p>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                        {step.text}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>

            <div className="mt-8">
              <Link
                href="/poster"
                className="btn-shine inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-ink transition-[filter] outline-none hover:brightness-110 active:brightness-95 focus-visible:ring-2 focus-visible:ring-primary/60"
              >
                {t("client.cta")}
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </div>
          </article>

          <article className="relative flex flex-col overflow-hidden rounded-[1.75rem] border border-primary/25 bg-primary/[0.035] p-6 sm:p-8">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-24 -top-24 size-64 rounded-full bg-[radial-gradient(closest-side,rgba(57,255,136,0.16),transparent)]"
            />
            <div className="relative flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-2xl border border-primary/25 bg-primary-soft text-primary">
                <UserRound className="size-5" aria-hidden="true" />
              </span>
              <h3 className="font-headings text-xl font-bold tracking-tight">
                {t("developer.title")}
              </h3>
            </div>

            <ol className="relative mt-7 flex flex-col gap-5">
              {developerSteps.map((step, index) => {
                const Icon = DEVELOPER_ICONS[index] ?? CircleCheck;
                return (
                  <li key={step.title} className="flex gap-3.5">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-primary/25 bg-primary-soft text-primary">
                      <Icon className="size-4" aria-hidden="true" />
                    </span>
                    <div className="pt-0.5">
                      <p className="text-sm font-semibold sm:text-base">
                        <span className="mr-1.5 font-headings text-xs font-bold text-primary tabular-nums">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        {step.title}
                      </p>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                        {step.text}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>

            <div className="relative mt-7 rounded-2xl border border-primary/20 bg-background/70 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {t("developer.preview")}
              </p>
              <div className="mt-3 flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className="flex size-10 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-gradient-to-br from-primary/25 to-primary/5 font-headings text-xs font-bold text-primary"
                >
                  <UserRound className="size-4" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    {t("developer.profileRole")}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {t("developer.profileMeta")}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                  <BadgeCheck className="size-3" aria-hidden="true" />
                  {t("developer.profileBadge")}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-success/25 bg-success/10 px-2 py-0.5 text-[10px] font-semibold text-success">
                  <span className="size-1.5 rounded-full bg-success" aria-hidden="true" />
                  {t("developer.profileAvailability")}
                </span>
              </div>
            </div>

            <div className="relative mt-7">
              <Link
                href="/briefs"
                className="inline-flex min-h-11 items-center gap-2 rounded-full border border-primary/30 bg-primary-soft px-5 py-2.5 text-sm font-semibold text-primary transition-colors outline-none hover:border-primary/60 hover:bg-primary/15 focus-visible:ring-2 focus-visible:ring-primary/60"
              >
                {t("developer.cta")}
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
