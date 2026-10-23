import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Building2, Globe, MapPin, ShieldCheck, UsersRound } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { asAgencyDetail } from "@/types/agency";

export const dynamic = "force-dynamic";

async function loadAgency(slug: string) {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("get_agency", { p_slug: slug });
  if (error) return null;
  return asAgencyDetail(data);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const agency = await loadAgency(slug.slice(0, 60));
  if (!agency) return { title: "Agence introuvable" };
  return {
    title: `${agency.name} — Agence`,
    description:
      agency.bio?.slice(0, 160) ||
      `Agence ${agency.name} sur Devmarket (${agency.members_count} développeurs).`,
  };
}

export default async function AgencyPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const agency = await loadAgency(slug.slice(0, 60));
  if (!agency) notFound();

  const location = [agency.city, agency.country].filter(Boolean).join(", ");

  return (
    <div className="bg-surface py-10 md:py-14">
      <div className="container-tl">
        <div className="rounded-2xl border border-hairline bg-card p-6 md:p-8">
          <div className="flex flex-wrap items-start gap-5">
            <div className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-hairline text-2xl font-semibold">
              {agency.name.charAt(0).toUpperCase()}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold md:text-3xl">
                  {agency.name}
                </h1>
                {agency.verified ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold text-primary">
                    <ShieldCheck className="size-3.5" aria-hidden="true" />
                    Vérifiée
                  </span>
                ) : null}
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <MapPin className="size-4" aria-hidden="true" />
                  {location || "Afrique"}
                </span>
                <span className="inline-flex items-center gap-1">
                  <UsersRound className="size-4" aria-hidden="true" />
                  {agency.members_count} membre
                  {agency.members_count > 1 ? "s" : ""}
                </span>
                {agency.website ? (
                  <a
                    href={agency.website}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    <Globe className="size-4" aria-hidden="true" />
                    Site web
                  </a>
                ) : null}
              </div>

              {agency.bio ? (
                <p className="mt-4 max-w-3xl text-sm leading-relaxed text-muted-foreground md:text-base">
                  {agency.bio}
                </p>
              ) : null}
            </div>

            <Link
              href="/dev"
              className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-ink transition-colors hover:bg-primary-hover"
            >
              <Building2 className="size-4" aria-hidden="true" />
              Trouver un développeur
            </Link>
          </div>
        </div>

        <section className="mt-8" aria-label="Membres de l'agence">
          <h2 className="text-lg font-semibold">
            L&apos;équipe ({agency.members.length})
          </h2>

          {agency.members.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Aucun membre publié pour le moment.
            </p>
          ) : (
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {agency.members.map((m) => (
                <div
                  key={m.developer_id}
                  className="flex items-center gap-3 rounded-2xl border border-hairline bg-card p-4"
                >
                  {m.avatar_url ? (
                    <Image
                      src={m.avatar_url}
                      alt=""
                      width={48}
                      height={48}
                      unoptimized
                      className="size-12 shrink-0 rounded-full border border-hairline object-cover"
                    />
                  ) : (
                    <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-hairline text-lg font-semibold">
                      {(m.full_name || m.username || "?").charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    {m.username ? (
                      <Link
                        href={`/dev/${m.username}`}
                        className="block truncate font-medium hover:text-primary"
                      >
                        {m.full_name || m.username}
                      </Link>
                    ) : (
                      <p className="truncate font-medium">{m.full_name ?? "Développeur"}</p>
                    )}
                    <p className="truncate text-xs text-muted-foreground">
                      {m.main_specialty || "Développeur"}
                      {typeof m.reputation_score === "number"
                        ? ` · Score ${m.reputation_score}`
                        : ""}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}