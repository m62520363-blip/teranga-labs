import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, BadgeCheck, CheckCircle2 } from "lucide-react";
import {
  OnboardingForm,
  type OnboardingData,
} from "@/components/dev/onboarding-form";
import { RegisterFunnel } from "@/components/dev/register-funnel";
import { getCurrentUser, createClient } from "@/lib/supabase/server";
import { createAdminClient, isServiceConfigured } from "@/lib/supabase/admin";

export const metadata: Metadata = {
  title: "Inscription développeur",
  description:
    "Rejoignez Devmarket en tant que développeur : créez votre compte, vérifiez votre email et complétez votre profil professionnel à 100 % pour être immédiatement actif.",
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
        <h1 className="mt-5 text-xl font-bold tracking-tight">
          Votre profil développeur est actif
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Votre compte développeur est complet et actif. Vous pouvez consulter
          les projets publiés et démarrer des discussions avec les clients.
        </p>
        <div className="mt-6 flex flex-col gap-3">
          <Link href="/dashboard" className="btn btn-primary w-full">
            Accéder à mon espace développeur
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
          <Link
            href="/dashboard?tab=profil"
            className="btn btn-secondary w-full"
          >
            Modifier mon profil
          </Link>
        </div>
      </div>
    </div>
  );
}

export default async function InscriptionDeveloppeurPage() {
  const user = await getCurrentUser();

  /* Visiteur non connecté : parcours guidé complet (compte → vérification
     email → wizard profil). */
  if (!user) {
    return (
      <div className="bg-surface py-14">
        <div className="container-tl">
          <div className="mx-auto max-w-3xl text-center">
            <span className="chip gap-2 border-hairline bg-card">
              <span
                className="size-1.5 rounded-full bg-primary"
                aria-hidden="true"
              />
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
  let status = data?.status ?? null;

  // Activation immédiate si le dossier a été complété
  if (
    status &&
    status !== "active" &&
    status !== "verified" &&
    status !== "suspended" &&
    Boolean(data?.application)
  ) {
    if (isServiceConfigured()) {
      const admin = createAdminClient();
      if (admin) {
        await admin
          .from("developers")
          .update({
            status: "active",
            rejection_reason: null,
          })
          .eq("id", user.id);
      }
    }
    status = "active";
  }

  return (
    <div className="bg-surface py-14">
      <div className="container-tl">
        <header className="mx-auto max-w-3xl">
          <span className="chip gap-2 border-hairline bg-card">
            <span
              className="size-1.5 rounded-full bg-primary"
              aria-hidden="true"
            />
            INSCRIPTION DÉVELOPPEUR
          </span>
          <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
            Rejoignez Devmarket
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Complétez votre profil professionnel à 100 % en quelques minutes :
            votre compte développeur est{" "}
            <span className="font-medium text-foreground">
              activé automatiquement
            </span>{" "}
            dès validation du formulaire.
          </p>
        </header>

        {status === "active" || status === "verified" ? (
          <AlreadyValidated />
        ) : (
          <div className="mt-8">
            <OnboardingForm
              initial={data}
              email={user.email ?? ""}
              userId={user.id}
            />
          </div>
        )}

        <footer className="mx-auto mt-12 max-w-3xl">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex items-start gap-3 rounded-2xl border border-hairline bg-card p-5">
              <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft">
                <CheckCircle2
                  className="size-4 text-primary"
                  aria-hidden="true"
                />
              </span>
              <p className="text-sm leading-relaxed text-muted-foreground">
                <span className="font-medium text-foreground">
                  Activation immédiate à 100 %.
                </span>{" "}
                Dès que vos informations obligatoires sont complétées, vous êtes
                automatiquement développeur sur la plateforme.
              </p>
            </div>
            <div className="flex items-start gap-3 rounded-2xl border border-hairline bg-card p-5">
              <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft">
                <BadgeCheck
                  className="size-4 text-primary"
                  aria-hidden="true"
                />
              </span>
              <p className="text-sm leading-relaxed text-muted-foreground">
                <span className="font-medium text-foreground">
                  Portfolio recommandé.
                </span>{" "}
                Le portfolio reste optionnel mais recommandé pour inspirer
                confiance aux clients.
              </p>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
