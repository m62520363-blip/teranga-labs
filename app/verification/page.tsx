import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, BadgeCheck, ShieldCheck } from "lucide-react";
import {
  VerificationForm,
  type VerificationRequestStatus,
} from "@/components/dev/verification-form";
import { getCurrentUser, createClient } from "@/lib/supabase/server";
import { isWaveConfigured } from "@/lib/payments/config";

export const metadata: Metadata = {
  title: "Vérification de profil",
  description:
    "Obtenez le badge Vérifié sur votre profil développeur TERANGA LABS grâce à une vérification d'identité et de portfolio effectuée par notre équipe.",
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

export default async function VerificationPage({
  searchParams,
}: {
  searchParams: Promise<{ request?: string; error?: string }>;
}) {
  const params = await searchParams;
  const paymentReturned = Boolean(params.request);
  const waveFailed = params.error === "wave";

  const user = await getCurrentUser();
  if (!user) redirect("/login?mode=signup&role=developer");

  const supabase = await createClient();
  if (!supabase) return notConfigured();

  const roleRes = await supabase.rpc("get_my_role");
  if (roleRes.data === "client") redirect("/client");

  const { data: dev } = await supabase
    .from("developers")
    .select("id, status, is_verified, first_name")
    .eq("id", user.id)
    .maybeSingle();

  if (!dev) {
    redirect("/inscription-developpeur");
  }

  const { data: price } = await supabase.rpc("get_verification_price");
  const { data: lastReq } = await supabase.rpc("get_my_verification_status");

  const waveConfigured = isWaveConfigured();

  const eligible = dev.status === "active" || dev.status === "verified";
  const verified = Boolean(dev.is_verified) || dev.status === "verified";
  const notYetApproved = ["pending", "changes_requested", "rejected", "suspended"].includes(
    dev.status
  );

  return (
    <div className="bg-surface py-14">
      <div className="container-tl">
        <header className="mx-auto max-w-3xl">
          <span className="chip gap-2 border-hairline bg-card">
            <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />
            VÉRIFICATION DE PROFIL
          </span>
          <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
            Obtenez le badge Vérifié
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            La vérification est une <span className="font-medium text-foreground">option payante</span>,
            distincte de la validation de votre inscription. Elle est effectuée par notre équipe
            après réception du paiement et distingue votre profil des autres développeurs.
          </p>
        </header>

        <div className="mt-8">
          {notYetApproved ? (
            <NotApproved status={dev.status} />
          ) : !eligible ? (
            <NotApproved status={dev.status} />
          ) : (
            <VerificationForm
              priceFcfa={typeof price === "number" ? price : null}
              waveConfigured={waveConfigured}
              isVerified={verified}
              lastRequest={(lastReq ?? null) as VerificationRequestStatus}
              paymentReturned={paymentReturned}
            />
          )}
          {waveFailed ? (
            <p className="mx-auto mt-6 max-w-lg rounded-xl border border-[var(--error)]/30 bg-[var(--error-soft)] px-4 py-3 text-sm text-[var(--error)]">
              Le paiement Wave n’a pas pu aboutir. Vous pouvez réessayer ou utiliser un autre moyen.
            </p>
          ) : null}
        </div>

        <footer className="mx-auto mt-12 max-w-3xl">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex items-start gap-3 rounded-2xl border border-hairline bg-card p-5">
              <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft">
                <BadgeCheck className="size-4 text-primary" aria-hidden="true" />
              </span>
              <p className="text-sm leading-relaxed text-muted-foreground">
                <span className="font-medium text-foreground">Paiement unique.</span> Wave ou
                Max It, en toute sécurité.
              </p>
            </div>
            <div className="flex items-start gap-3 rounded-2xl border border-hairline bg-card p-5">
              <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft">
                <ShieldCheck className="size-4 text-primary" aria-hidden="true" />
              </span>
              <p className="text-sm leading-relaxed text-muted-foreground">
                <span className="font-medium text-foreground">Revue humaine.</span> Identité,
                portfolio et coordonnées vérifiés par un membre de l’équipe.
              </p>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

function NotApproved({ status }: { status: string }) {
  const pendingReview = status === "pending" || status === "verification_pending";
  return (
    <div className="mx-auto max-w-lg">
      <div className="rounded-2xl border border-hairline bg-card p-8 text-center shadow-sm">
        <span className="mx-auto inline-flex size-14 items-center justify-center rounded-full bg-primary-soft">
          <ShieldCheck className="size-7 text-warning" aria-hidden="true" />
        </span>
        <h2 className="mt-5 text-xl font-bold tracking-tight">
          {pendingReview ? "En attente d’approbation" : "Compte non éligible"}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {pendingReview
            ? "Votre inscription développeur est en cours d’examen. Dès qu’elle sera approuvée, vous pourrez demander la vérification de votre profil."
            : "Votre compte doit être approuvé avant de pouvoir demander la vérification de profil."}
        </p>
        <div className="mt-6 flex flex-col gap-3">
          {status === "pending" || status === "changes_requested" || status === "rejected" ? (
            <Link href="/inscription-developpeur" className="btn btn-primary w-full">
              Compléter mon inscription
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          ) : (
            <Link href="/dashboard" className="btn btn-primary w-full">
              Ouvrir le dashboard
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}