import type { Metadata } from "next";
import Link from "next/link";
import { Building2, MapPin, ShieldCheck, UsersRound } from "lucide-react";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import AgencyManager from "@/components/agency/agency-manager";
import { asAgencyList, type AgencyListItem } from "@/types/agency";

export const metadata: Metadata = {
  title: "Agences",
  description:
    "Découvrez les agences de développement vérifiées de Devmarket ou créez votre propre agence avec un abonnement PRO.",
};

export const dynamic = "force-dynamic";

export default async function AgenciesPageRoute() {
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
  let isDeveloper = false;
  if (user) {
    const roleRes = await supabase.rpc("get_my_role");
    isDeveloper = roleRes.data === "developer";
  }

  const { data } = await supabase.rpc("list_agencies", {
    p_limit: 60,
    p_offset: 0,
  });
  const agencies: AgencyListItem[] = asAgencyList(data);

  return (
    <div className="bg-surface py-10 md:py-14">
      <div className="container-tl space-y-12">
        <div className="grid items-center gap-8 lg:grid-cols-[1fr_auto]">
          <div className="max-w-2xl">
            <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary-soft px-3 py-1 text-xs font-semibold text-primary">
              <Building2 className="size-3.5" aria-hidden="true" />
              Agences Devmarket
            </p>
            <h1 className="text-3xl font-semibold leading-tight tracking-tight md:text-4xl">
              Agences publiées &{" "}
              <span className="text-primary">création d&apos;agence</span>
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground md:text-base">
              Découvrez les agences de développement déjà créées sur la
              plateforme ou créez la vôtre si vous disposez d&apos;un abonnement
              PRO.
            </p>
          </div>
        </div>

        {isDeveloper ? (
          <section
            aria-label="Mon agence"
            className="rounded-2xl border border-hairline bg-card/60 p-6 sm:p-8"
          >
            <AgencyManager />
          </section>
        ) : null}

        <section aria-label="Agences publiées">
          <h2 className="mb-5 text-xl font-semibold tracking-tight">
            Agences déjà publiées
          </h2>
          {agencies.length === 0 ? (
            <div className="rounded-2xl border border-hairline bg-card p-8 text-center">
              <p className="text-sm text-muted-foreground">
                Aucune agence publiée pour le moment.
              </p>
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {agencies.map((a) => (
                <Link
                  key={a.id}
                  href={`/agences/${a.slug}`}
                  className="group flex flex-col gap-3 rounded-2xl border border-hairline bg-card p-5 transition-colors hover:border-primary/50"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-hairline text-lg font-semibold">
                      {a.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-semibold group-hover:text-primary">
                        {a.name}
                      </p>
                      <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
                        <MapPin
                          className="size-3.5 shrink-0"
                          aria-hidden="true"
                        />
                        {[a.city, a.country].filter(Boolean).join(", ") ||
                          "Afrique"}
                      </p>
                    </div>
                  </div>

                  {a.bio ? (
                    <p className="line-clamp-3 text-sm text-muted-foreground">
                      {a.bio}
                    </p>
                  ) : null}

                  <div className="mt-auto flex items-center justify-between pt-2 text-xs">
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <UsersRound className="size-3.5" aria-hidden="true" />
                      {a.members_count} membre{a.members_count > 1 ? "s" : ""}
                    </span>
                    {a.verified ? (
                      <span className="inline-flex items-center gap-1 font-semibold text-primary">
                        <ShieldCheck className="size-3.5" aria-hidden="true" />
                        Vérifiée
                      </span>
                    ) : null}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
