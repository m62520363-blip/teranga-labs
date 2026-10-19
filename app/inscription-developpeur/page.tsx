import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, BadgeCheck, CheckCircle2, Clock3 } from "lucide-react";
import { OnboardingForm, type OnboardingData } from "@/components/dev/onboarding-form";
import { RegisterFunnel } from "@/components/dev/register-funnel";
import { getCurrentUser, createClient } from "@/lib/supabase/server";
import { Scene3D } from "@/components/landing/scene-3d";

export const metadata: Metadata = {
  title: "Inscription développeur",
  description:
    "Rejoignez TERANGA LABS en tant que développeur : créez votre compte, vérifiez votre email, complétez votre profil professionnel. Chaque dossier est examiné avant activation.",
  robots: { index: false, follow: false },
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
      <div className="rounded-2xl border border-success/40 bg-success-soft p-8 text-center shadow-sm">
        <span className="mx-auto inline-flex size-14 items-center justify-center rounded-full bg-emerald-500/15">
          <BadgeCheck className="size-7 text-success" aria-hidden="true" />
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
      <div className="rounded-2xl border border-hairline bg-card p-8 text-center shadow-sm">
        <span className="mx-auto inline-flex size-14 items-center justify-center rounded-full bg-primary-soft">
          <Clock3 className="size-7 text-warning" aria-hidden="true" />
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

  /* Visiteur non connecté : parcours guidé complet (compte → vérification
     email → wizard profil), calqué sur la démonstration Montaaj. */
  if (!user) {
    return (
      <div className="bg-surface py-14">
        <div className="container-tl">
          <div className="mx-auto max-w-3xl text-center">
            <span className="chip gap-2 border-hairline bg-card">
              <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />
              INSCRIPTION DÉVELOPPEUR
            </span>
          </div>
          <div className="mt-8">
            <RegisterFunnel />
          </div>
        </div>
      </div>
    );
  }

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
        <header className="mx-auto grid max-w-4xl items-center gap-6 lg:grid-cols-[1fr_auto]">
          <div>
            <span className="chip gap-2 border-hairline bg-card">
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
          </div>
          <Scene3D variant="team" className="hidden lg:block" />
        </header>

        {status === "active" || status === "verified" ? (
          <AlreadyValidated />
        ) : status === "verification_pending" ||
          (status === "pending" && data?.application) ? (
          <VerificationInProgress />
        ) : (
          <div className="mt-8">
            <OnboardingForm initial={data} email={user.email ?? ""} userId={user.id} />
          </div>
        )}

        <footer className="mx-auto mt-12 max-w-3xl">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex items-start gap-3 rounded-2xl border border-hairline bg-card p-5">
              <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft">
                <CheckCircle2 className="size-4 text-primary" aria-hidden="true" />
              </span>
              <p className="text-sm leading-relaxed text-muted-foreground">
                <span className="font-medium text-foreground">Approbation manuelle.</span>{" "}
                Chaque dossier est lu par notre équipe avant d’activer le compte.
              </p>
            </div>
            <div className="flex items-start gap-3 rounded-2xl border border-hairline bg-card p-5">
              <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft">
                <BadgeCheck className="size-4 text-primary" aria-hidden="true" />
              </span>
              <p className="text-sm leading-relaxed text-muted-foreground">
                <span className="font-medium text-foreground">
                  Badge Vérifié — bientôt.
                </span>{" "}
                La vérification d’identité et les avis arrivent bientôt sur les
                profils.
              </p>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}