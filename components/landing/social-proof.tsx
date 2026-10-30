import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import {
  ArrowRight,
  BadgeCheck,
  Crown,
  FileCheck2,
  MapPin,
  MessageSquare,
  ShieldCheck,
  Star,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { ApprovedDeveloper } from "@/types/database";

type Stat = { value: string; label: string };

/**
 * Section « Une plateforme pensée pour la confiance » — porte l'ancre `#confiance`.
 *
 * Conformément aux règles de transparence :
 *   - Aucun témoignage fictif ni fausse évaluation n'est affiché.
 *   - Le processus de vérification des développeurs et les modalités de contact
 *     sont expliqués étape par étape.
 *   - Les profils présentés proviennent directement de `list_approved_developers`.
 */
export async function SocialProof() {
  const t = await getTranslations("Landing.socialProof");
  const locale = await getLocale();
  const isEn = locale === "en";
  const stats = t.raw("stats") as Stat[];

  const supabase = await createClient();
  let developers: ApprovedDeveloper[] = [];

  if (supabase) {
    const { data } = await supabase.rpc("list_approved_developers", {
      p_limit: 3,
      p_offset: 0,
    });
    developers = ((Array.isArray(data) ? data : []) as ApprovedDeveloper[]).filter(
      (d) => Boolean(d?.id)
    );
  }

  const verificationSteps = isEn
    ? [
        {
          icon: FileCheck2,
          title: "1. Manual application & portfolio review",
          text: "Every developer completes a structured application (skills, experience, portfolio links). Our team reviews the profile before it appears in the directory.",
        },
        {
          icon: BadgeCheck,
          title: "2. Identity verification & real reviews",
          text: "The Verified badge is only granted after identity validation. Reviews and ratings are only published from real missions completed on the platform.",
        },
        {
          icon: MessageSquare,
          title: "3. Direct contact & 0% commission",
          text: "Clients publish for free and can contact a developer from the directory. Developers unlock a project contact for 1 Token (first contact free) and get paid directly.",
        },
      ]
    : [
        {
          icon: FileCheck2,
          title: "1. Examen manuel du dossier & portfolio",
          text: "Chaque développeur dépose son dossier complet (compétences, expérience, réalisations). L’équipe examine le profil avant son activation dans l’annuaire.",
        },
        {
          icon: BadgeCheck,
          title: "2. Vérification d’identité & avis authentiques",
          text: "Le badge Vérifié n’est accordé qu’après contrôle des pièces justificatives. Les notes et avis proviennent exclusivement de missions réelles.",
        },
        {
          icon: MessageSquare,
          title: "3. Contact direct & 0 % de commission",
          text: "Le client publie gratuitement et échange en direct. Le développeur débloque un contact pour 1 Token (1er contact offert) et facture directement sans commission.",
        },
      ];

  return (
    <section
      id="confiance"
      className="scroll-mt-24 border-t border-hairline bg-surface py-20 sm:py-28"
    >
      <div className="container-tl">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-hairline bg-card px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            <span
              className="size-1.5 rounded-full bg-primary"
              aria-hidden="true"
            />
            {t("eyebrow")}
          </span>
          <h2 className="mt-5 text-balance font-headings text-3xl font-bold tracking-tight sm:text-4xl lg:text-[2.75rem]">
            {t("title")}
          </h2>
        </div>

        <div className="mt-11 grid grid-cols-1 gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="relative overflow-hidden rounded-[1.75rem] border border-primary/25 bg-card p-7 sm:p-9">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-20 -top-20 size-56 rounded-full bg-[radial-gradient(closest-side,rgba(57,255,136,0.18),transparent)]"
            />
            <span className="flex size-11 items-center justify-center rounded-full border border-primary/25 bg-primary-soft text-primary">
              <ShieldCheck className="size-5" aria-hidden="true" />
            </span>
            <p className="mt-6 font-headings text-6xl font-extrabold tracking-tight text-primary sm:text-7xl">
              {t("bigValue")}
            </p>
            <p className="mt-2 font-headings text-lg font-semibold tracking-tight">
              {t("bigLabel")}
            </p>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
              {t("bigText")}
            </p>
          </div>

          <dl className="grid grid-cols-2 gap-4">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="flex flex-col justify-center rounded-2xl border border-hairline bg-card p-5 sm:p-6"
              >
                <dt className="font-headings text-2xl font-extrabold tracking-tight text-primary sm:text-3xl">
                  {stat.value}
                </dt>
                <dd className="mt-1.5 text-xs leading-relaxed text-muted-foreground sm:text-sm">
                  {stat.label}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Vérification des développeurs et modalités de contact */}
        <div className="mt-16">
          <div className="mx-auto max-w-2xl text-center">
            <h3 className="font-headings text-2xl font-bold tracking-tight sm:text-3xl">
              {isEn
                ? "How developer verification and direct contact work"
                : "Vérification des développeurs et modalités de contact"}
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
              {isEn
                ? "Transparent rules for both clients and developers, with zero fake ratings or hidden fees."
                : "Des règles claires pour les clients comme pour les développeurs, sans faux avis ni frais cachés."}
            </p>
          </div>

          <ul className="mt-9 grid grid-cols-1 gap-4 md:grid-cols-3">
            {verificationSteps.map((step) => {
              const Icon = step.icon;
              return (
                <li
                  key={step.title}
                  className="flex flex-col rounded-2xl border border-hairline bg-card p-5 sm:p-6"
                >
                  <span className="flex size-10 items-center justify-center rounded-xl border border-primary/25 bg-primary-soft text-primary">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <h4 className="mt-4 font-headings text-base font-semibold tracking-tight">
                    {step.title}
                  </h4>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                    {step.text}
                  </p>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Profils réellement approuvés dans l'annuaire */}
        {developers.length > 0 ? (
          <div className="mt-14">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h3 className="font-headings text-xl font-bold tracking-tight sm:text-2xl">
                  {isEn
                    ? "Approved developers in the directory"
                    : "Développeurs approuvés dans l’annuaire"}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {isEn
                    ? "Real profiles active on Devmarket."
                    : "Profils réels actuellement actifs sur Devmarket."}
                </p>
              </div>
              <Link
                href="/dev"
                className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-primary/30 bg-primary-soft px-4 text-xs font-semibold text-primary transition-colors outline-none hover:border-primary/60 focus-visible:ring-2 focus-visible:ring-primary/50"
              >
                {isEn ? "Browse the directory" : "Parcourir l’annuaire"}
                <ArrowRight className="size-3.5" aria-hidden="true" />
              </Link>
            </div>

            <ul className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
              {developers.map((dev) => {
                const name = dev.full_name ?? dev.username ?? "Développeur";
                const rating =
                  typeof dev.rating_avg === "number" && dev.rating_avg > 0
                    ? dev.rating_avg
                    : null;
                const skills = (dev.skills ?? []).filter(Boolean).slice(0, 3);
                return (
                  <li
                    key={dev.id}
                    className="flex flex-col rounded-2xl border border-hairline bg-card p-5 transition-colors hover:border-primary/40"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        aria-hidden="true"
                        className="flex size-10 shrink-0 items-center justify-center rounded-full border border-primary/25 bg-primary-soft font-headings text-xs font-bold text-primary"
                      >
                        {initials(name)}
                      </span>
                      <div className="min-w-0">
                        <p className="flex items-center gap-1.5 truncate text-sm font-semibold">
                          {name}
                          {dev.is_pro ? (
                            <Crown
                              className="size-3.5 shrink-0 text-primary"
                              aria-label="PRO"
                            />
                          ) : null}
                          {dev.is_verified ? (
                            <BadgeCheck
                              className="size-3.5 shrink-0 text-primary"
                              aria-label={isEn ? "Verified" : "Vérifié"}
                            />
                          ) : null}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {dev.professional_title ??
                            dev.main_specialty ??
                            (isEn ? "Developer" : "Développeur")}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      {dev.city ? (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="size-3 text-primary" aria-hidden="true" />
                          {dev.city}
                          {dev.country ? `, ${dev.country}` : ""}
                        </span>
                      ) : null}
                      {rating !== null ? (
                        <span className="inline-flex items-center gap-1 font-medium text-foreground">
                          <Star className="size-3 text-primary" aria-hidden="true" />
                          {rating.toFixed(1)} ({dev.review_count ?? 0})
                        </span>
                      ) : null}
                    </div>

                    {skills.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {skills.map((s) => (
                          <span
                            key={s}
                            className="rounded-md border border-hairline bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    ) : null}

                    <div className="mt-auto pt-4">
                      <Link
                        href={`/dev/${dev.username ?? dev.id}`}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary/50"
                      >
                        {isEn ? "View public profile" : "Voir le profil public"}
                        <ArrowRight className="size-3.5" aria-hidden="true" />
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function initials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("") || "DM"
  );
}
