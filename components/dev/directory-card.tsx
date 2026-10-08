import Link from "next/link";
import Image from "next/image";
import {
  BadgeCheck,
  Briefcase,
  Crown,
  FolderKanban,
  MapPin,
  ShieldCheck,
  Star,
  Zap,
} from "lucide-react";
import type { ApprovedDeveloper } from "@/types/database";
import { availabilityInfo, experienceLabel } from "@/lib/dev-labels";
import { formatFCFA } from "@/lib/formatting";
import { ContactButton } from "@/components/dev/contact-dialog";

export function DirectoryCard({
  developer,
  contactCost,
  role,
  authed,
}: {
  developer: ApprovedDeveloper;
  contactCost: number;
  role: string | null;
  authed: boolean;
}) {
  const availability = availabilityInfo(developer.availability);
  const rating =
    typeof developer.rating_avg === "number" && developer.rating_avg > 0
      ? developer.rating_avg
      : null;
  const reviews = developer.review_count ?? 0;
  const completed = developer.completed_projects_count ?? 0;
  const satisfaction =
    typeof developer.satisfaction_pct === "number" ? Math.round(developer.satisfaction_pct) : null;
  const responseRate =
    typeof developer.response_rate === "number" ? Math.round(developer.response_rate) : null;

  const skills = (developer.skills ?? []).filter(Boolean).slice(0, 5);
  const services = (developer.services ?? []).filter(Boolean).slice(0, 3);
  const rate =
    developer.rate_min_fcfa != null && developer.rate_max_fcfa != null
      ? `${formatFCFA(developer.rate_min_fcfa)} – ${formatFCFA(developer.rate_max_fcfa)}`
      : developer.rate_min_fcfa != null
        ? `À partir de ${formatFCFA(developer.rate_min_fcfa)}`
        : null;

  return (
    <article className="flex h-full flex-col rounded-2xl border border-hairline bg-card p-5 transition-colors hover:border-primary/40">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-hairline">
            {developer.avatar_url ? (
              <Image
                src={developer.avatar_url}
                alt={`Avatar de ${developer.full_name ?? developer.username ?? "développeur"}`}
                width={48}
                height={48}
                unoptimized
                className="size-full object-cover"
              />
            ) : (
              <span className="text-lg font-bold text-primary">
                {(developer.full_name ?? developer.username ?? "?")
                  .trim()
                  .slice(0, 1)
                  .toUpperCase()}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 truncate font-semibold tracking-tight">
              {developer.full_name ?? developer.username ?? "Développeur"}
              {developer.is_pro ? (
                <Crown
                  className="size-4 shrink-0 text-primary"
                  aria-label="Profil PRO"
                />
              ) : null}
              {developer.is_verified ? (
                <BadgeCheck className="size-4 shrink-0 text-primary" aria-label="Profil vérifié" />
              ) : null}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {developer.professional_title ??
                developer.main_specialty ??
                experienceLabel(developer.experience_level)}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {developer.city ? (
          <span className="inline-flex items-center gap-1">
            <MapPin className="size-3" aria-hidden="true" />
            {developer.city}
            {developer.country ? `, ${developer.country}` : ""}
          </span>
        ) : null}
        {developer.experience_years != null ? (
          <span className="inline-flex items-center gap-1">
            <Briefcase className="size-3" aria-hidden="true" />
            {developer.experience_years} an{developer.experience_years > 1 ? "s" : ""} d’expérience
          </span>
        ) : null}
        <span className={availability.badge}>{availability.label}</span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Stat
          icon={<Star className="size-3.5" aria-hidden="true" />}
          label={rating != null ? rating.toFixed(1) : "—"}
          hint={reviews > 0 ? `${reviews} avis` : "avis"}
        />
        <Stat
          icon={<FolderKanban className="size-3.5" aria-hidden="true" />}
          label={completed > 0 ? String(completed) : "—"}
          hint="projets réalisés"
        />
        {satisfaction != null ? (
          <Stat
            icon={<ShieldCheck className="size-3.5" aria-hidden="true" />}
            label={`${satisfaction} %`}
            hint="satisfaction"
          />
        ) : null}
        {responseRate != null ? (
          <Stat
            icon={<Zap className="size-3.5" aria-hidden="true" />}
            label={`${responseRate} %`}
            hint="taux de réponse"
          />
        ) : null}
      </div>

      {skills.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {skills.map((s) => (
            <span
              key={s}
              className="rounded-lg border border-hairline bg-muted px-2 py-1 text-xs text-muted-foreground"
            >
              {s}
            </span>
          ))}
          {(developer.skills ?? []).length > skills.length ? (
            <span className="rounded-lg border border-hairline px-2 py-1 text-xs text-muted-foreground">
              +{(developer.skills ?? []).length - skills.length}
            </span>
          ) : null}
        </div>
      ) : null}

      {services.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {services.map((s) => (
            <span key={s} className="badge badge-muted">
              {s}
            </span>
          ))}
        </div>
      ) : null}

      {developer.bio ? (
        <p className="mt-4 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
          {developer.bio}
        </p>
      ) : null}

      <div className="mt-4 flex flex-col gap-1.5 border-t border-hairline pt-4 text-xs text-muted-foreground">
        {rate ? (
          <p className="font-medium text-foreground">Tarif : {rate}</p>
        ) : null}
        {developer.phone_masked ? (
          <p>{"\u2022"} {developer.phone_masked}</p>
        ) : null}
        {developer.email_masked ? (
          <p>{"\u2022"} {developer.email_masked}</p>
        ) : null}
      </div>

      <div className="mt-4 flex items-center gap-2 pt-1">
        <Link
          href={`/dev/${developer.username ?? developer.id}`}
          className="inline-flex h-10 flex-1 items-center justify-center rounded-xl border border-hairline text-sm font-medium transition-colors outline-none hover:border-primary/40 hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/50"
        >
          Voir le profil
        </Link>
        <ContactButton
          developer={{
            id: developer.id,
            username: developer.username,
            full_name: developer.full_name,
            professional_title: developer.professional_title,
            main_specialty: developer.main_specialty,
            city: developer.city,
          }}
          contactCost={contactCost}
          role={role}
          authed={authed}
        />
      </div>
    </article>
  );
}

function Stat({
  icon,
  label,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  hint: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-hairline bg-muted px-3 py-2">
      <span className="text-primary">{icon}</span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold leading-tight">{label}</span>
        <span className="block truncate text-[10px] text-muted-foreground">{hint}</span>
      </span>
    </div>
  );
}