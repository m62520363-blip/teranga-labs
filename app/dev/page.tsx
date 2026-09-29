import type { Metadata } from "next";
import { UsersRound, ShieldCheck, Sparkles } from "lucide-react";
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

export default async function DirectoryPageRoute() {
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
    <div className="bg-surface py-10 md:py-14">
      <div className="container-tl">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-[#2A1A10] px-3 py-1 text-xs font-semibold text-primary">
              <UsersRound className="size-3.5" aria-hidden="true" />
              Annuaire des développeurs
            </p>
            <h1 className="text-3xl font-semibold leading-tight tracking-tight md:text-4xl">
              Trouvez le développeur
              <span className="text-primary"> qu’il vous faut</span>
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground md:text-base">
              Des profils vérifiés avec leurs réalisations, leur disponibilité et leurs
              tarifs. Contactez directement celui qui correspond à votre projet pour{" "}
              {contactCost} Token.
            </p>
          </div>

          <div className="flex flex-col gap-2 text-xs text-muted-foreground">
            <p className="inline-flex items-center gap-2">
              <ShieldCheck className="size-3.5 text-primary" aria-hidden="true" />
              Coordonnées masquées jusqu’au contact.
            </p>
            <p className="inline-flex items-center gap-2">
              <Sparkles className="size-3.5 text-primary" aria-hidden="true" />
              1 contact = 1 conversation, sans engagement.
            </p>
          </div>
        </div>

        <DirectoryPage
          initial={developers}
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