import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  BadgeCheck,
  Briefcase,
  ExternalLink,
  Globe,
  MapPin,
  MessagesSquare,
  ShieldCheck,
  Star,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { waLink } from "@/lib/tokens";
import { formatDate } from "@/lib/formatting";
import { ShareProfileButton } from "@/components/dev/share-profile-button";
import { ReportButton } from "@/components/report-button";
import type { PublicDeveloperProfile } from "@/types/database";
import { cn } from "cn";

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

async function getProfile(identifier: string): Promise<PublicDeveloperProfile | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("get_public_developer_profile", {
    p_identifier: identifier,
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
  if (!profile) return { title: "Développeur introuvable · Teranga Labs" };
  return {
    title: `${profile.full_name ?? "Développeur"}${profile.city ? ` · ${profile.city}` : ""} · Teranga Labs`,
    description:
      profile.bio ??
      `Développeur ${profile.city ?? "au Sénégal"} — consultez le portfolio et contactez directement.`,
  };
}

export default async function DeveloperProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const profile = await getProfile(username);
  if (!profile) notFound();

  const name = profile.full_name ?? "Développeur Teranga Labs";
  const roundAverage = Math.round(profile.review_average);
  const shareUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/dev/${profile.username ?? username}`;
  const waHref = profile.whatsapp
    ? `${waLink(profile.whatsapp)}?text=${encodeURIComponent(
        "Bonjour, je vous contacte depuis votre profil Teranga Labs."
      )}`
    : null;

  return (
    <div className="bg-[#0A0A0A] py-14 md:py-20">
      <div className="container-tl">
        <div className="rounded-3xl border border-[#2A2A2A] bg-gradient-to-b from-[#141414] via-[#131210] to-[#0F0F0F] p-6 md:p-10">
          <header className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-5">
              <div className="relative shrink-0">
                {profile.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={profile.avatar_url}
                    alt=""
                    className="size-20 rounded-2xl border border-[#2A2A2A] object-cover md:size-24"
                  />
                ) : (
                  <div className="flex size-20 items-center justify-center rounded-2xl border border-[#2A2A2A] bg-gradient-to-br from-[#E86A2C] to-[#B34A14] text-2xl font-bold text-[#0D0D0D] md:size-24">
                    {initialsOf(name)}
                  </div>
                )}
                {profile.is_verified ? (
                  <span
                    className="absolute -bottom-1.5 -right-1.5 flex size-7 items-center justify-center rounded-full border border-[#0A0A0A] bg-[#14532D]"
                    title="Développeur vérifié"
                  >
                    <BadgeCheck className="size-4 text-[#4ADE80]" aria-hidden="true" />
                  </span>
                ) : null}
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
                    {name}
                  </h1>
                  {profile.is_verified ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#166534]/60 bg-[#0F2E18] px-2.5 py-1 text-xs font-medium text-[#4ADE80]">
                      <BadgeCheck className="size-3.5" aria-hidden="true" />
                      Développeur vérifié
                    </span>
                  ) : null}
                </div>
                <p className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  {profile.city ? (
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="size-4 text-[#E86A2C]" aria-hidden="true" />
                      {profile.city}, Sénégal
                    </span>
                  ) : null}
                  {profile.experience_years > 0 ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Briefcase className="size-4 text-[#E86A2C]" aria-hidden="true" />
                      {profile.experience_years} an{profile.experience_years > 1 ? "s" : ""} d’expérience
                    </span>
                  ) : null}
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm">
                  {profile.response_rate != null && profile.response_rate > 0 ? (
                    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                      <span className="size-1.5 rounded-full bg-[#4ADE80]" aria-hidden="true" />
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
                              ? "fill-[#E86A2C] text-[#E86A2C]"
                              : "fill-none text-[#3A3A3A]"
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
                    <ShieldCheck className="size-4 text-[#4ADE80]" aria-hidden="true" />
                    Réputation{" "}
                    <span className="font-semibold text-[#E8E8E8]">
                      {profile.reputation_score}/100
                    </span>
                    <span className="rounded-full border border-[#166534]/60 bg-[#0F2E18] px-2 py-0.5 text-[11px] font-medium text-[#4ADE80]">
                      {profile.reputation_level}
                    </span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                    <Briefcase className="size-4 text-[#E86A2C]" aria-hidden="true" />
                    {profile.completed_projects_count} projet
                    {profile.completed_projects_count > 1 ? "s terminés" : " terminé"}
                  </span>
                  {profile.penalty > 0 ? (
                    <span className="inline-flex items-center gap-1.5 text-[#F87171]">
                      <span className="size-1.5 rounded-full bg-[#F87171]" aria-hidden="true" />
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
              {waHref ? (
                <a
                  href={waHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#E86A2C] px-5 text-sm font-medium text-[#0D0D0D] transition-colors outline-none hover:bg-[#d95c1f] focus-visible:ring-2 focus-visible:ring-[#E86A2C]/50"
                >
                  <MessagesSquare className="size-4" aria-hidden="true" />
                  Contacter sur WhatsApp
                </a>
              ) : null}
              <ShareProfileButton url={shareUrl} />
              <ReportButton targetType="developer" targetId={profile.id} />
            </div>
          </header>

          {profile.bio ? (
            <section className="mt-8 border-t border-[#2A2A2A] pt-8" aria-label="Présentation">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                À propos
              </h2>
              <p className="mt-3 max-w-2xl text-base leading-relaxed text-[#E8E8E8]">
                {profile.bio}
              </p>
            </section>
          ) : null}

          {profile.skills && profile.skills.length > 0 ? (
            <section className="mt-8 border-t border-[#2A2A2A] pt-8" aria-label="Compétences">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Spécialités
              </h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {profile.skills.map((skill) => (
                  <span
                    key={skill}
                    className="rounded-full border border-[#3A2A20] bg-[#1C1210] px-3 py-1 text-sm text-[#F2D8C6]"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </section>
          ) : null}

          {profile.portfolio_links.length > 0 ? (
            <section className="mt-8 border-t border-[#2A2A2A] pt-8" aria-label="Portfolio">
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
                    className="group rounded-2xl border border-[#2A2A2A] bg-[#141414] p-5 transition-colors hover:border-[#E86A2C]/50"
                  >
                    {link.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={link.image_url}
                        alt=""
                        loading="lazy"
                        className="mb-4 h-32 w-full rounded-xl border border-[#2A2A2A] object-cover"
                      />
                    ) : (
                      <div className="mb-4 flex h-32 w-full items-center justify-center rounded-xl border border-[#2A2A2A] bg-[#1E1E1E]">
                        <Globe className="size-8 text-[#E86A2C]" aria-hidden="true" />
                      </div>
                    )}
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-medium leading-snug">{link.title}</h3>
                      <ExternalLink
                        className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-[#E86A2C]"
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

          <section className="mt-8 border-t border-[#2A2A2A] pt-8" aria-label="Avis clients">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Avis clients
            </h2>
            {profile.reviews.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Aucun avis publié pour le moment.
              </p>
            ) : (
              <ul className="mt-4 grid gap-4 md:grid-cols-2">
                {profile.reviews.map((review) => (
                  <li
                    key={review.id}
                    className="rounded-2xl border border-[#2A2A2A] bg-[#141414] p-5"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold">
                        {review.request_name ?? "Projet"}
                      </p>
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <Star
                            key={n}
                            className={cn(
                              "size-3.5",
                              n <= review.rating
                                ? "fill-[#E86A2C] text-[#E86A2C]"
                                : "fill-none text-[#3A3A3A]"
                            )}
                            aria-hidden="true"
                          />
                        ))}
                      </div>
                    </div>
                    {review.comment ? (
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                        {review.comment}
                      </p>
                    ) : null}
                    <p className="mt-2 text-xs text-muted-foreground">
                      {formatDate(review.created_at)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Profil présenté par Teranga Labs — mise en relation directe entre
          clients et développeurs au Sénégal.
        </p>
      </div>
    </div>
  );
}