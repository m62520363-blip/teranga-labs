import type { Metadata } from "next";
import { createClient, getCurrentRole, getCurrentUser } from "@/lib/supabase/server";
import { DirectoryPage } from "@/components/dev/directory-page";
import type { ApprovedDeveloper, DirectoryFilters } from "@/types/database";

export const metadata: Metadata = {
  title: "Trouver un développeur",
  description:
    "Parcourez l’annuaire des développeurs vérifiés de Teranga Labs, filtrez par spécialité, ville et technologies, puis contactez-les directement.",
};

export const dynamic = "force-dynamic";

const PAGE_SIZE = 12;

export default async function DirectoryPageRoute({
  searchParams,
}: {
  searchParams: Promise<{ city?: string }>;
}) {
  const sp = await searchParams;
  // Deep-link géographique : ?city=Dakar ou ?city=Sénégal (exact, borné).
  const cityParam =
    typeof sp.city === "string" && sp.city.trim()
      ? sp.city.trim().slice(0, 60)
      : "";

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

  const [listRes, costRes, filtersRes] = await Promise.all([
    supabase.rpc("list_approved_developers", {
      p_query: undefined,
      p_city: cityParam || undefined,
      p_limit: PAGE_SIZE,
      p_offset: 0,
    }),
    supabase.rpc("get_contact_cost"),
    supabase.rpc("get_directory_filters"),
  ]);

  const developers = ((listRes.data ?? []) as ApprovedDeveloper[]).filter((d) => Boolean(d?.id));
  const contactCost =
    typeof costRes.data === "number" && costRes.data > 0 ? costRes.data : 1;
  const filters = (filtersRes.data ?? {}) as Partial<DirectoryFilters>;

  return (
    <div className="bg-surface py-6 md:py-10">
      <div className="container-tl">
        <div className="mb-6">
          <h1 className="text-3xl font-semibold leading-tight tracking-tight">
            Trouve ton développeur
          </h1>
        </div>

        <DirectoryPage
          initial={developers}
          initialCity={cityParam}
          filters={{
            specialties: filters.specialties ?? [],
            cities: filters.cities ?? [],
            services: filters.services ?? [],
            project_types: filters.project_types ?? [],
          }}
          contactCost={contactCost}
          role={role}
          authed={Boolean(user)}
        />
      </div>
    </div>
  );
}