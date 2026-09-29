import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, BadgeCheck, CheckCircle2, Clock3 } from "lucide-react";
import { OnboardingForm, type OnboardingData } from "@/components/dev/onboarding-form";
import { getCurrentUser, createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Inscription développeur",
  description:
    "Complétez votre profil développeur en deux étapes : vos coordonnées, puis votre profil professionnel. TERANGA LABS valide chaque dossier avant activation.",
};

export const dynamic = "force-dynamic";

function notConfigured() {
  return (
    <div className="bg-surface py-16">
      <div className="container-tl mx-auto max-w-md text-center">
        <h1 className="text-2xl font-semibold">Configuration requise</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Connexion à Supabase manquante. Renseignez les variables
          d’environnement, appliquez les migrations puis reconnectez-vous.
        </p>
        <Link href="/" className="mt-6 inline-block text-sm font-medium underline">
          Retour à l’accueil
        </Link>
      </div>
    </div>
  );
}

function AlreadyValidated() {
  return (
    <div className="container-tl mx-auto max-w-lg py-20">
      <div className="rounded-2xl border border-[#166534]/60 bg-[#0F2E18] p-8 text-center shadow-sm">
        <span className="mx-auto inline-flex size-14 items-center justify-center rounded-full bg-emerald-500/15">
          <BadgeCheck className="size-7 text-[#4ADE80]" aria-hidden="true" />
        </span>
        <h1 className="mt-5 text-xl font-bold tracking-tight">Votre dossier est validé</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Votre compte développeur est approuvé. Vous pouvez débloquer des briefs
          et démarrer des discussions avec les clients.
        </p>
        <div className="mt-6 flex flex-col gap-3">
          <Link href="/briefs" className="btn btn-primary w-full">
            Voir les briefs
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
          <Link href="/dashboard" className="btn btn-secondary w-full">
            Ouvrir le dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

function VerificationInProgress() {
  return (
    <div className="container-tl mx-auto max-w-lg py-20">
      <div className="rounded-2xl border border-hairline bg-[#141414] p-8 text-center shadow-sm">
        <span className="mx-auto inline-flex size-14 items-center justify-center rounded-full bg-[#2A1A10]">
          <Clock3 className="size-7 text-[#E8A33D]" aria-hidden="true" />
        </span>
        <h1 className="mt-5 text-xl font-bold tracking-tight">Vérification en cours</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Votre profil est en cours de vérification par TERANGA LABS.
          Une notification sera envoyée dès la fin de l’examen.
        </p>
        <Link href="/dashboard" className="btn btn-secondary mt-6 w-full">
          Retour au dashboard
        </Link>
      </div>
    </div>
  );
}

export default async function InscriptionDeveloppeurPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?mode=signup");

  const supabase = await createClient();
  if (!supabase) return notConfigured();

  const roleRes = await supabase.rpc("get_my_role");
  if (roleRes.data === "client") redirect("/client");

  const appRes = await supabase.rpc("get_my_developer_application");
  const data = (appRes.data ?? null) as OnboardingData | null;
  const status = data?.status ?? null;

  return (
    <div className="bg-surface py-14">
      <div className="container-tl">
        <header className="mx-auto max-w-3xl">
          <span className="chip gap-2 border-hairline bg-[#141414]">
            <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />
            INSCRIPTION DÉVELOPPEUR
          </span>
          <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
            Rejoignez TERANGA LABS
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Deux étapes, quelques minutes. Votre dossier est examiné par notre équipe
            <span className="font-medium text-foreground"> avant activation</span> —
            garantie zéro spam pour les clients.
          </p>
        </header>

        {status === "active" || status === "verified" ? (
          <AlreadyValidated />
        ) : status === "verification_pending" ? (
          <VerificationInProgress />
        ) : (
          <div className="mt-8">
            <OnboardingForm initial={data} email={user.email ?? ""} userId={user.id} />
          </div>
        )}

        <footer className="mx-auto mt-12 max-w-3xl">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex items-start gap-3 rounded-2xl border border-hairline bg-[#141414] p-5">
              <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#2A1A10]">
                <CheckCircle2 className="size-4 text-primary" aria-hidden="true" />
              </span>
              <p className="text-sm leading-relaxed text-muted-foreground">
                <span className="font-medium text-foreground">Approbation manuelle.</span>{" "}
                Chaque dossier est lu par notre équipe avant d’activer le compte.
              </p>
            </div>
            <div className="flex items-start gap-3 rounded-2xl border border-hairline bg-[#141414] p-5">
              <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#2A1A10]">
                <BadgeCheck className="size-4 text-primary" aria-hidden="true" />
              </span>
              <p className="text-sm leading-relaxed text-muted-foreground">
                <span className="font-medium text-foreground">Badge Vérifié.</span>{" "}
                Une fois actif, vous pouvez faire vérifier votre profil pour gagner la confiance des clients.
              </p>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}