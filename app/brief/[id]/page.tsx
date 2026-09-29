import type { Metadata } from "next";
import Link from "next/link";
import { BriefManager, type BriefManagementData } from "@/components/brief-manager";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Mon espace client",
  description:
    "Suivez votre brief : développeurs en contact, statut du projet et avis.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function BriefManagementPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ key?: string }>;
}) {
  const { id } = await params;
  const { key } = await searchParams;
  const supabase = await createClient();

  let data: BriefManagementData | null = null;
  let errorMessage: string | null = null;

  if (supabase && key) {
    const { data: result, error } = await supabase.rpc("get_brief_management", {
      p_management_key: key,
    });
    if (error) {
      errorMessage = "Lien de gestion invalide ou expiré.";
    } else {
      const row = result as BriefManagementData | null;
      if (row && row.id === id) data = row;
      else errorMessage = "Ce lien ne correspond pas à ce brief.";
    }
  } else {
    errorMessage = !supabase
      ? "Configuration Supabase manquante : le projet n’est pas encore relié à la base."
      : "Paramètre de gestion manquant.";
  }

  return (
    <div className="bg-surface py-16 md:py-24">
      <div className="container-tl">
        <div className="mx-auto max-w-3xl">
          {data ? (
            <div>
              <div>
                <h1 className="text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
                  Mon espace client
                </h1>
                <p className="mt-3 text-base leading-relaxed text-muted-foreground">
                  Suivez les développeurs qui ont débloqué votre contact et
                  pilotez le statut de votre projet.
                </p>
              </div>

              <div className="mt-10">
                <BriefManager data={data} managementKey={key ?? ""} />
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-hairline bg-[#141414] p-8 text-center shadow-sm">
              <h1 className="text-2xl font-semibold tracking-tight">
                {errorMessage ?? "Lien invalide"}
              </h1>
              <p className="mt-3 text-sm text-muted-foreground">
                Vérifiez le lien reçu après la publication de votre brief.
              </p>
              <Link href="/poster" className="btn btn-primary mt-6">
                Publier un nouveau brief
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}