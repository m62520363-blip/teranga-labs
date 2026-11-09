import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/guards";
import { ShareButton } from "@/components/share-button";
import { Users, Gift } from "lucide-react";

export const metadata: Metadata = {
  title: "Parrainage",
  description: "Invitez vos amis développeurs et gagnez des contacts bonus.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ReferralPage() {
  await requireUser();
  const supabase = await createClient();
  if (!supabase) redirect("/");

  const roleRes = await supabase.rpc("get_my_role");
  if (roleRes.data !== "developer") redirect("/client");

  const { data: referral } = await supabase.rpc("get_my_referral_summary");

  const ref = referral as { code?: string; total_signups?: number; converted?: number; points?: number; points_per_conversion?: number } | null;
  const code = ref?.code ?? null;
  const totalSignups = ref?.total_signups ?? 0;
  const converted = ref?.converted ?? 0;
  const points = ref?.points ?? 0;
  const pointsPerConversion = ref?.points_per_conversion ?? 50;

  const referralUrl = code ? `/signup?ref=${code}` : null;

  return (
    <div className="bg-surface py-6 md:py-10">
      <div className="container-tl max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight">Parrainage</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Invitez vos amis développeurs. Pour chaque filleul qui s&apos;abonne, vous
          gagnez {pointsPerConversion} contacts bonus.
        </p>

        {/* Lien de parrainage */}
        <div className="mt-8 rounded-2xl border border-hairline bg-card p-6">
          <h2 className="text-base font-semibold">Votre lien de parrainage</h2>
          {code ? (
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
              <code className="flex-1 rounded-xl border border-hairline bg-muted px-4 py-3 text-sm font-mono text-foreground">
                {typeof window !== "undefined" ? window.location.origin : ""}
                {referralUrl}
              </code>
              {referralUrl ? (
                <ShareButton
                  url={referralUrl}
                  title="Rejoins Devmarket !"
                  text={`Utilise mon lien de parrainage pour rejoindre Devmarket : ${code}`}
                />
              ) : null}
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">
              Chargement de votre code de parrainage...
            </p>
          )}
        </div>

        {/* Statistiques */}
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-hairline bg-card p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="size-4 text-primary" aria-hidden="true" />
              Inscrits
            </div>
            <p className="mt-2 text-2xl font-semibold">{totalSignups}</p>
          </div>
          <div className="rounded-2xl border border-hairline bg-card p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Gift className="size-4 text-primary" aria-hidden="true" />
              Convertis
            </div>
            <p className="mt-2 text-2xl font-semibold">{converted}</p>
          </div>
          <div className="rounded-2xl border border-hairline bg-card p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Gift className="size-4 text-primary" aria-hidden="true" />
              Contacts bonus
            </div>
            <p className="mt-2 text-2xl font-semibold">{points}</p>
          </div>
        </div>

        {/* Comment ça marche */}
        <div className="mt-8 rounded-2xl border border-hairline bg-card p-6">
          <h2 className="text-base font-semibold">Comment ça marche</h2>
          <ol className="mt-4 space-y-3 text-sm text-muted-foreground">
            <li className="flex gap-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary">
                1
              </span>
              Partagez votre lien de parrainage avec vos amis développeurs.
            </li>
            <li className="flex gap-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary">
                2
              </span>
              Votre ami s&apos;inscrit et complète son profil développeur.
            </li>
            <li className="flex gap-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary">
                3
              </span>
              Quand il souscrit un abonnement, vous recevez {pointsPerConversion} contacts bonus.
            </li>
            <li className="flex gap-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary">
                4
              </span>
              Les contacts bonus s&apos;ajoutent à votre quota mensuel.
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
}
