import type { Metadata } from "next";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { createClient, getCurrentRole, getCurrentUser } from "@/lib/supabase/server";
import { DirectoryPage } from "@/components/dev/directory-page";
import type { ApprovedDeveloper, DirectoryFilters } from "@/types/database";

export const metadata: Metadata = {
  title: "Trouver un développeur",
  description:
    "Parcourez l’annuaire des développeurs vérifiés de Devmarket, filtrez par pays, spécialité, compétences et classement, puis contactez-les directement.",
};

export const dynamic = "force-dynamic";

const PAGE_SIZE = 12;

function readParam(value: unknown, max = 60): string {
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, max)
    : "";
}

export default async function DirectoryPageRoute({
  searchParams,
}: {
  searchParams: Promise<{
    country?: string;
    city?: string;
    q?: string;
    skill?: string;
    ranking?: string;
  }>;
}) {
  const sp = await searchParams;
  // Deep-link géographique : /dev?country=Sénégal (exact, borné).
  // `city` reste accepté pour les anciens liens (?city=Sénégal = pays).
  const countryParam = readParam(sp.country) || readParam(sp.city);
  // Recherche depuis le hero / les catégories de la landing : /dev?q=…
  const queryParam = readParam(sp.q, 80);
  const skillParam = readParam(sp.skill, 60);
  const rankingParam = readParam(sp.ranking, 10);

  const supabase = await createClient();
  if (!supabase) {
    return (
      <div className="bg-surface py-16">
        <div className="container-tl mx-auto max-w-md text-center">
          <h1 className="text-2xl font-semibold">Configuration requise</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Connexion à Supabase manquante.
          </p>
        </div>
      </div>
    );
  }

  const user = await getCurrentUser();
  const role = await getCurrentRole();

  // « Trouver un développeur » : réservé aux clients (et aux visiteurs).
  if (role === "developer") redirect({ href: "/dashboard", locale: await getLocale() });

  const [listRes, filtersRes] = await Promise.all([
    supabase.rpc("list_approved_developers", {
      p_query: queryParam || undefined,
      p_country: countryParam || undefined,
      p_technologies: skillParam ? [skillParam] : undefined,
      p_min_points:
        rankingParam && rankingParam !== "0" ? Number(rankingParam) : undefined,
      p_limit: PAGE_SIZE,
      p_offset: 0,
    }),
    supabase.rpc("get_directory_filters"),
  ]);

  const developers = ((listRes.data ?? []) as ApprovedDeveloper[]).filter((d) => Boolean(d?.id));
  const filters = (filtersRes.data ?? {}) as Partial<DirectoryFilters>;

  return (
    <div className="bg-surface py-6 md:py-10">
      <div className="container-tl">
        <div className="mb-6">
          <h1 className="text-3xl font-semibold leading-tight tracking-tight">
            Trouve ton développeur
          </h1>
          <p className="mt-2 text-muted-foreground">
            Parcourez l&apos;annuaire des développeurs vérifiés, filtrez par pays,
            spécialité, compétences et classement.
          </p>
        </div>

        <DirectoryPage
          initial={developers}
          initialCountry={countryParam}
          initialSkill={skillParam}
          initialRanking={rankingParam || "0"}
          initialQuery={queryParam}
          filters={{
            specialties: filters.specialties ?? [],
            countries: filters.countries ?? [],
            cities: [],
            skills: filters.skills ?? [],
            services: filters.services ?? [],
            project_types: filters.project_types ?? [],
          }}
          role={role}
          authed={Boolean(user)}
        />
      </div>
    </div>
  );
}
