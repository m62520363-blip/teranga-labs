import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import {
  BadgeCheck,
  Briefcase,
  Building2,
  Crown,
  ExternalLink,
  Globe,
  MapPin,
  ShieldCheck,
  Star,
  Lock,
  CheckCircle2,
} from "lucide-react";
import { createClient, getCurrentRole, getCurrentUser } from "@/lib/supabase/server";
import { formatFCFA, formatDate } from "@/lib/formatting";
import { ShareProfileButton } from "@/components/dev/share-profile-button";
import { ScoreBreakdown } from "@/components/dev/score-breakdown";
import { ReportButton } from "@/components/report-button";
import { ContactButton } from "@/components/dev/contact-dialog";
import { ProfileViewTracker } from "@/components/dev/profile-view-tracker";
import { availabilityInfo, experienceLabel } from "@/lib/dev-labels";
import { projectTypeLabel, formatProjectDate } from "@/lib/dev-missions-labels";
import {
  REVIEW_CRITERIA,
  REVIEW_QUESTIONS,
  reviewCriteriaLabel,
  reviewQuestionLabel,
} from "@/lib/reviews-labels";
import type { DeveloperReviewStats, PublicDeveloperProfile } from "@/types/database";
import { asAgencyBadge } from "@/types/agency";
import Link from "next/link";
import { cn } from "cn";
import { absoluteUrl } from "@/lib/utils";
import { ReportReviewButton } from "@/components/review/report-review-button";

export const dynamic = "force-dynamic";

function initialsOf(name: string | null): string {
  if (!name) return "D";
  const parts = name.split(/\s+/).filter(Boolean);
  return parts
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() ?? "")
    .join("") || "D";
}

function formatResponse(minutes: number): string {
  if (minutes < 1) return "moins d’1 min";
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const hours = minutes / 60;
  if (hours < 24) return `${Math.round(hours)}h`;
  return `${Math.round(hours / 24)} j`;
}

async function getProfile(
  identifier: string,
  viewerRole?: string | null
): Promise<PublicDeveloperProfile | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("get_public_developer_profile", {
    p_identifier: identifier,
    p_viewer_role: viewerRole || undefined,
  });
  if (error || !data) return null;
  return data as unknown as PublicDeveloperProfile;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  const profile = await getProfile(username);
  if (!profile) return { title: "Développeur introuvable · Devmarket" };
  return {
    title: `${profile.full_name ?? "Développeur"}${profile.city ? ` · ${profile.city}` : ""} · Devmarket`,
    description:
      profile.bio ??
      `Développeur ${profile.city ?? "en Afrique de l’Ouest francophone"} — consultez le portfolio et contactez directement.`,
  };
}

export default async function DeveloperProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;

  const [currentUser, role] = await Promise.all([
    getCurrentUser(),
    getCurrentRole(),
  ]);

  const profile = await getProfile(username, role);
  if (!profile) notFound();

  const supabase = await createClient();

  const statsRes = supabase
    ? await supabase.rpc("get_developer_reviews", { p_developer: profile.id })
    : { data: null };
  const reviewStats = statsRes?.data as unknown as DeveloperReviewStats | null;
  const visibleReviews = reviewStats?.reviews ?? [];

  const agencyRes = supabase
    ? await supabase.rpc("get_agency_by_developer", { p_developer_id: profile.id })
    : { data: null };
  const agencyBadge = asAgencyBadge(agencyRes?.data);

  const proRes = supabase
    ? await supabase.rpc("get_pro_status", { p_developer_id: profile.id })
    : { data: null };
  const proStatus = proRes?.data as { active?: boolean; ends_at?: string } | null;
  const isPro = Boolean(proStatus?.active);

  const name = profile.full_name ?? "Développeur Devmarket";
  const roundAverage = Math.round(profile.review_average);
  const shareUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/dev/${profile.username ?? username}`;
  const availability = availabilityInfo(profile.availability);
  const rate =
    profile.rate_min_fcfa != null && profile.rate_max_fcfa != null
      ? `${profile.rate_min_fcfa.toLocaleString("fr-FR")} – ${profile.rate_max_fcfa.toLocaleString("fr-FR")} FCFA`
      : profile.rate_min_fcfa != null
        ? `À partir de ${profile.rate_min_fcfa.toLocaleString("fr-FR")} FCFA`
        : null;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Person",
            name: profile.full_name ?? profile.username,
            jobTitle: profile.professional_title ?? profile.main_specialty ?? "Développeur",
            url: absoluteUrl(`/dev/${profile.username ?? profile.id}`),
            address: profile.city
              ? { "@type": "PostalAddress", addressLocality: profile.city, addressCountry: profile.country }
              : undefined,
            image: profile.avatar_url ?? undefined,
            aggregateRating:
              profile.review_average && profile.review_count
                ? {
                    "@type": "AggregateRating",
                    ratingValue: profile.review_average,
                    reviewCount: profile.review_count,
                  }
                : undefined,
          }),
        }}
      />
      <div className="bg-background py-14 md:py-20">
      <div className="container-tl">
        <ProfileViewTracker developerId={profile.id} />
        <div className="rounded-3xl border border-hairline bg-gradient-to-b from-card via-surface to-surface-secondary p-6 md:p-10">
          <header className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-5">
              <div className="relative shrink-0">
                {profile.avatar_url ? (
                  <Image
                    src={profile.avatar_url}
                    alt=""
                    width={96}
                    height={96}
                    unoptimized
                    className="size-20 rounded-2xl border border-hairline object-cover md:size-24"
                  />
                ) : (
                  <div className="flex size-20 items-center justify-center rounded-2xl border border-hairline bg-gradient-to-br from-primary to-primary-hover text-2xl font-bold text-ink md:size-24">
                    {initialsOf(name)}
                  </div>
                )}
                {profile.is_verified ? (
                  <span
                    className="absolute -bottom-1.5 -right-1.5 flex size-7 items-center justify-center rounded-full border border-background bg-success-soft"
                    title="Développeur vérifié"
                  >
                    <BadgeCheck className="size-4 text-success" aria-hidden="true" />
                  </span>
                ) : null}
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
                    {name}
                  </h1>
                  {profile.is_verified ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-success/40 bg-success-soft px-2.5 py-1 text-xs font-medium text-success">
                      <BadgeCheck className="size-3.5" aria-hidden="true" />
                      Développeur vérifié
                    </span>
                  ) : null}
                  {isPro ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary-soft px-2.5 py-1 text-xs font-medium text-primary">
                      <Crown className="size-3.5" aria-hidden="true" />
                      PRO
                    </span>
                  ) : null}
                  {agencyBadge ? (
                    <Link
                      href={`/agences/${agencyBadge.slug}`}
                      className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary-soft px-2.5 py-1 text-xs font-medium text-primary transition-colors hover:border-primary"
                    >
                      <Building2 className="size-3.5" aria-hidden="true" />
                      {agencyBadge.name}
                    </Link>
                  ) : null}
                </div>
                <p className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  {profile.professional_title || profile.main_specialty ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Briefcase className="size-4 text-primary" aria-hidden="true" />
                      {profile.professional_title ??
                        experienceLabel(profile.main_specialty)}
                    </span>
                  ) : null}
                  {profile.city ? (
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="size-4 text-primary" aria-hidden="true" />
                      {profile.city}
                      {profile.country ? `, ${profile.country}` : ""}
                    </span>
                  ) : null}
                  {profile.experience_years > 0 ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Briefcase className="size-4 text-primary" aria-hidden="true" />
                      {profile.experience_years} an{profile.experience_years > 1 ? "s" : ""} d’expérience
                    </span>
                  ) : null}
                  <span className={availability.badge}>{availability.label}</span>
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm">
                  {profile.response_rate != null && profile.response_rate > 0 ? (
                    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                      <span className="size-1.5 rounded-full bg-success" aria-hidden="true" />
                      Répond en moyenne à {profile.response_rate}% des demandes
                      {profile.avg_response_minutes != null && profile.avg_response_minutes > 0
                        ? ` sous ${formatResponse(profile.avg_response_minutes)}`
                        : ""}
                    </span>
                  ) : null}
                  <span className="inline-flex items-center gap-1.5">
                    <span className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <Star
                          key={n}
                          className={cn(
                            "size-4",
                            n <= roundAverage
                              ? "fill-primary text-primary"
                              : "fill-none text-border-strong"
                          )}
                          aria-hidden="true"
                        />
                      ))}
                    </span>
                    <span className="font-medium">
                      {profile.review_count > 0 ? profile.review_average.toFixed(1) : "—"}
                    </span>
                    <span className="text-muted-foreground">
                      ({profile.review_count} avis)
                    </span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                    <ShieldCheck className="size-4 text-success" aria-hidden="true" />
                    Réputation{" "}
                    <span className="font-semibold text-foreground">
                      {profile.reputation_score}/100
                    </span>
                    <span className="rounded-full border border-success/40 bg-success-soft px-2 py-0.5 text-[11px] font-medium text-success">
                      {profile.reputation_level}
                    </span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                    <Briefcase className="size-4 text-primary" aria-hidden="true" />
                    {profile.completed_projects_count} projet
                    {profile.completed_projects_count > 1 ? "s terminés" : " terminé"}
                  </span>
                  {profile.penalty > 0 ? (
                    <span className="inline-flex items-center gap-1.5 text-error">
                      <span className="size-1.5 rounded-full bg-error" aria-hidden="true" />
                      Pénalité de modération : -{profile.penalty} pts
                    </span>
                  ) : null}
                  {profile.created_at ? (
                    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                      Membre depuis le {formatDate(profile.created_at)}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="flex shrink-0 flex-col gap-2.5 sm:flex-row md:flex-col lg:flex-row">
              <ContactButton
                developer={{
                  id: profile.id,
                  username: profile.username,
                  full_name: profile.full_name,
                  professional_title: profile.professional_title ?? profile.main_specialty,
                  main_specialty: profile.main_specialty,
                  city: profile.city,
                }}
                role={role}
                authed={Boolean(currentUser)}
                className="h-10 px-5"
              />
              <ShareProfileButton url={shareUrl} />
              <ReportButton targetType="developer" targetId={profile.id} />
            </div>
          </header>

          <ScoreBreakdown identifier={profile.id} />

          <section className="mt-8 border-t border-hairline pt-8" aria-label="Contact">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Contact
            </h2>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <div className="max-w-md rounded-2xl border border-hairline bg-card p-4 text-sm">
                <p className="text-muted-foreground">
                  Coordonnées masquées — elles ne sont révélées qu’après attribution
                  d’un projet. Le contact direct est{" "}
                  <span className="font-semibold text-primary">100 % gratuit</span>
                  {" "}pour les clients.
                </p>
                {profile.phone_masked || profile.email_masked ? (
                  <ul className="mt-3 flex flex-col gap-1.5 text-xs text-muted-foreground">
                    {profile.phone_masked ? (
                      <li>{"\u2022"} {profile.phone_masked}</li>
                    ) : null}
                    {profile.email_masked ? (
                      <li>{"\u2022"} {profile.email_masked}</li>
                    ) : null}
                  </ul>
                ) : null}
              </div>
              {rate ? (
                <div className="rounded-2xl border border-hairline bg-card p-4 text-sm">
                  <p className="text-muted-foreground">Tarifs indicatifs</p>
                  <p className="mt-1 font-semibold">{rate}</p>
                </div>
              ) : null}
            </div>
          </section>

          {profile.bio ? (
            <section className="mt-8 border-t border-hairline pt-8" aria-label="Présentation">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                À propos
              </h2>
              <p className="mt-3 max-w-2xl text-base leading-relaxed text-foreground">
                {profile.bio}
              </p>
            </section>
          ) : null}

          {profile.skills && profile.skills.length > 0 ? (
            <section className="mt-8 border-t border-hairline pt-8" aria-label="Compétences">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Spécialités
              </h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {profile.skills.map((skill) => (
                  <span
                    key={skill}
                    className="rounded-full border border-primary/25 bg-primary-soft px-3 py-1 text-sm text-primary-light"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </section>
          ) : null}

          {profile.languages && profile.languages.length > 0 ? (
            <section className="mt-8 border-t border-hairline pt-8" aria-label="Langues">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Langues
              </h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {profile.languages.map((lang) => (
                  <span
                    key={lang}
                    className="rounded-full border border-hairline bg-muted px-3 py-1 text-sm text-muted-foreground"
                  >
                    {lang}
                  </span>
                ))}
              </div>
            </section>
          ) : null}

          {profile.portfolio_links.length > 0 ? (
            <section className="mt-8 border-t border-hairline pt-8" aria-label="Portfolio">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Projets réalisés
              </h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {profile.portfolio_links.map((link, i) => (
                  <a
                    key={`${link.url}-${i}`}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group rounded-2xl border border-hairline bg-card p-5 transition-colors hover:border-primary/50"
                  >
                    {link.image_url ? (
                      <Image
                        src={link.image_url}
                        alt=""
                        loading="lazy"
                        width={640}
                        height={256}
                        unoptimized
                        className="mb-4 h-32 w-full rounded-xl border border-hairline object-cover"
                      />
                    ) : (
                      <div className="mb-4 flex h-32 w-full items-center justify-center rounded-xl border border-hairline bg-muted">
                        <Globe className="size-8 text-primary" aria-hidden="true" />
                      </div>
                    )}
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-medium leading-snug">{link.title}</h3>
                      <ExternalLink
                        className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary"
                        aria-hidden="true"
                      />
                    </div>
                    {link.description ? (
                      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                        {link.description}
                      </p>
                    ) : null}
                  </a>
                ))}
              </div>
            </section>
          ) : null}

          {profile.projects.length > 0 ? (
            <section className="mt-8 border-t border-hairline pt-8" aria-label="Missions réalisées">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Missions réalisées
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Des projets concrets, vérifiés par Devmarket lorsque la mention
                est affichée.
              </p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {profile.projects.map((mission) => {
                  const confidential = mission.client_authorization === "confidential";
                  const shot = mission.screenshots[0];
                  const externalUrl = confidential ? mission.demo_url : mission.url;
                  const buttonLabel = confidential ? "Voir la présentation" : "Voir le projet";
                  return (
                    <article
                      key={mission.id}
                      className="flex flex-col rounded-2xl border border-hairline bg-card p-5"
                    >
                      {shot ? (
                        <Image
                          src={shot}
                          alt=""
                          loading="lazy"
                          width={640}
                          height={256}
                          unoptimized
                          className="mb-4 h-32 w-full rounded-xl border border-hairline object-cover"
                        />
                      ) : (
                        <div className="mb-4 flex h-32 w-full items-center justify-center rounded-xl border border-hairline bg-muted">
                          {confidential ? (
                            <Lock className="size-8 text-primary" aria-hidden="true" />
                          ) : (
                            <Globe className="size-8 text-primary" aria-hidden="true" />
                          )}
                        </div>
                      )}
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-medium leading-snug">{mission.name}</h3>
                        <span className="shrink-0 rounded-full border border-primary/25 bg-primary-soft px-2.5 py-0.5 text-xs text-primary-light">
                          {projectTypeLabel(mission.project_type)}
                        </span>
                      </div>
                      {mission.description ? (
                        <p className="mt-2 text-sm leading-relaxed text-muted-foreground line-clamp-3">
                          {mission.description}
                        </p>
                      ) : null}
                      {mission.technologies.length > 0 ? (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {mission.technologies.slice(0, 6).map((tech) => (
                            <span
                              key={tech}
                              className="rounded-full border border-hairline bg-surface px-2.5 py-0.5 text-xs text-muted-foreground"
                            >
                              {tech}
                            </span>
                          ))}
                          {mission.technologies.length > 6 ? (
                            <span className="rounded-full border border-hairline bg-surface px-2.5 py-0.5 text-xs text-muted-foreground">
                              +{mission.technologies.length - 6}
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                      {mission.role ? (
                        <p className="mt-3 text-xs text-muted-foreground">
                          Rôle&nbsp;:{" "}
                          <span className="font-medium text-foreground">{mission.role}</span>
                        </p>
                      ) : null}
                      <p className="mt-3 text-xs text-muted-foreground">
                        {formatProjectDate(mission.completion_date)}
                        {mission.duration ? ` · ${mission.duration}` : ""}
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {mission.via_teranga_labs ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-success/40 bg-success-soft px-2.5 py-1 text-[11px] font-medium text-success">
                            <CheckCircle2 className="size-3" aria-hidden="true" />
                            Réalisée via Devmarket
                          </span>
                        ) : confidential ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary-soft px-2.5 py-1 text-[11px] font-medium text-primary-light">
                            <Lock className="size-3" aria-hidden="true" />
                            Projet confidentiel
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-success/40 bg-success-soft px-2.5 py-1 text-[11px] font-medium text-success">
                            <CheckCircle2 className="size-3" aria-hidden="true" />
                            Mission vérifiée par Devmarket
                          </span>
                        )}
                        {mission.mission_ref ? (
                          <span className="text-[11px] font-medium text-muted-foreground">
                            {mission.mission_ref}
                          </span>
                        ) : null}
                      </div>
                      {externalUrl ? (
                        <a
                          href={externalUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-4 inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-hairline bg-surface px-4 text-sm font-medium text-foreground transition-colors outline-none hover:border-primary/50 hover:text-primary focus-visible:ring-2 focus-visible:ring-primary/50"
                        >
                          {buttonLabel}
                          <ExternalLink className="size-3.5" aria-hidden="true" />
                        </a>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            </section>
          ) : null}

          <section className="mt-8 border-t border-hairline pt-8" aria-label="Avis clients">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Avis clients
              </h2>
              {reviewStats && reviewStats.total > 0 ? (
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-card px-2.5 py-1">
                    <Star className="size-3.5 fill-primary text-primary" aria-hidden="true" />
                    {reviewStats.average}/5 · {reviewStats.total} avis
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-success/40 bg-success-soft px-2.5 py-1 text-success">
                    {reviewStats.satisfaction} % de clients satisfaits
                  </span>
                </div>
              ) : null}
            </div>

            {reviewStats && reviewStats.total > 0 ? (
              <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2.5 rounded-2xl border border-hairline bg-card p-4 sm:grid-cols-4">
                {REVIEW_CRITERIA.map((c) => {
                  const value = reviewStats.average_criteria?.[c.key];
                  return (
                    <div key={c.key}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-xs text-muted-foreground">
                          {c.label}
                        </span>
                        <span className="shrink-0 text-xs font-semibold">
                          {value != null ? `${value}/5` : "—"}
                        </span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-hairline">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{
                            width: `${Math.max(0, Math.min(100, ((value ?? 0) / 5) * 100))}%`,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}

            {visibleReviews.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Aucun avis publié pour le moment.
              </p>
            ) : (
              <ul className="mt-4 grid gap-4 md:grid-cols-2">
                {visibleReviews.map((review) => (
                  <li
                    key={review.id}
                    className="flex flex-col rounded-2xl border border-hairline bg-card p-5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">
                          {review.client_name ?? "Client"}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {projectTypeLabel(review.request_type)}
                          {review.request_budget
                            ? ` · ${formatFCFA(review.request_budget)}`
                            : ""}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <Star
                            key={n}
                            className={cn(
                              "size-3.5",
                              n <= review.rating
                                ? "fill-primary text-primary"
                                : "fill-none text-border-strong"
                            )}
                            aria-hidden="true"
                          />
                        ))}
                      </div>
                    </div>

                    {Object.keys(review.criteria ?? {}).length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {REVIEW_CRITERIA.filter(
                          (c) => review.criteria[c.key] !== undefined && review.criteria[c.key] !== null
                        ).map((c) => (
                          <span
                            key={c.key}
                            className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground"
                            title={reviewCriteriaLabel(c.key)}
                          >
                            {reviewCriteriaLabel(c.key)}
                            <span className="font-semibold text-foreground">
                              {review.criteria[c.key]}★
                            </span>
                          </span>
                        ))}
                      </div>
                    ) : null}

                    {review.comment ? (
                      <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                        {review.comment}
                      </p>
                    ) : null}

                    {Object.keys(review.questions ?? {}).length > 0 ? (
                      <dl className="mt-3 flex flex-col gap-1 rounded-xl bg-surface p-3 text-xs">
                        {REVIEW_QUESTIONS.map((q) =>
                          review.questions?.[q.key] ? (
                            <div
                              key={q.key}
                              className="flex items-start justify-between gap-3"
                            >
                              <dt className="text-muted-foreground">
                                {reviewQuestionLabel(q.key)}
                              </dt>
                              <dd className="shrink-0 font-medium">
                                {String(review.questions[q.key])
                                  .charAt(0)
                                  .toUpperCase() +
                                  String(review.questions[q.key]).slice(1)}
                              </dd>
                            </div>
                          ) : null
                        )}
                      </dl>
                    ) : null}

                    {review.assets && review.assets.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {review.assets.map((url, i) => (
                          <a
                            key={`${url}-${i}`}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-lg border border-hairline bg-muted px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
                          >
                            Preuve {i + 1}
                          </a>
                        ))}
                      </div>
                    ) : null}

                    {review.response ? (
                      <div className="mt-3 flex items-start gap-2.5 rounded-xl bg-muted p-3">
                        <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
                          <ShieldCheck className="size-3.5" aria-hidden="true" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Réponse du développeur
                          </p>
                          <p className="mt-0.5 text-sm leading-relaxed">
                            {review.response}
                          </p>
                        </div>
                      </div>
                    ) : null}

                    <div className="mt-auto flex items-center justify-between gap-3 pt-4">
                      <p className="text-xs text-muted-foreground">
                        {formatDate(review.created_at)}
                      </p>
                      <ReportReviewButton
                        reviewId={review.id}
                        reviewAuthor={review.client_name}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Profil présenté par Devmarket — mise en relation directe entre
          clients et développeurs en Afrique de l’Ouest francophone.
        </p>
      </div>
    </div>
    </>
  );
}