"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  Clock3,
  CreditCard,
  Loader2,
  Phone,
  ReceiptText,
  RotateCcw,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import { toast } from "sonner";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { formatFCFA, formatDate } from "@/lib/formatting";
import { cn } from "cn";

export type VerificationRequestStatus = {
  id?: string;
  amount_fcfa?: number;
  method?: string | null;
  payment_status?: string;
  verification_status?: string;
  paid_at?: string | null;
  rejection_reason?: string | null;
  created_at?: string;
} | null;

const METHOD_LABELS: Record<string, string> = {
  wave: "Wave",
  max_it: "Max It",
};

function methodLabel(method?: string | null): string {
  return METHOD_LABELS[method ?? ""] ?? (method || "paiement mobile");
}

export function VerificationForm({
  priceFcfa,
  waveConfigured,
  isVerified,
  lastRequest,
  paymentReturned,
}: {
  priceFcfa: number | null;
  waveConfigured: boolean;
  isVerified: boolean;
  lastRequest: VerificationRequestStatus;
  paymentReturned: boolean;
}) {
  const router = useRouter();
  const [method, setMethod] = React.useState<"wave" | "max_it">("wave");
  const [busy, setBusy] = React.useState<"wave" | "manual" | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [reRequesting, setReRequesting] = React.useState(false);

  const price = typeof priceFcfa === "number" && priceFcfa > 0 ? priceFcfa : null;

  const supabaseReady = isSupabaseConfigured();

  const startWave = async () => {
    if (!supabaseReady) {
      setActionError("Configuration Supabase manquante.");
      return;
    }
    setBusy("wave");
    setActionError(null);
    try {
      const res = await fetch("/api/verification/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method }),
      });
      const json = (await res.json()) as { launchUrl?: string; message?: string };
      if (!res.ok || !json.launchUrl) {
        setActionError(json.message ?? "Impossible d’initier le paiement.");
        setBusy(null);
        return;
      }
      window.location.href = json.launchUrl;
    } catch {
      setActionError("Problème de connexion. Réessayez.");
      setBusy(null);
    }
  };

  const startManual = async () => {
    if (!supabaseReady) {
      setActionError("Configuration Supabase manquante.");
      return;
    }
    setBusy("manual");
    setActionError(null);
    const supabase = createClient();
    const { data, error } = await supabase.rpc("submit_verification_request", {
      p_method: method,
    });
    setBusy(null);
    if (error) {
      setActionError(translateRequestError(error.code ?? "", error.message));
      return;
    }
    if (!data || data.ok !== true) {
      setActionError("La demande n’a pas abouti. Réessayez.");
      return;
    }
    toast.success("Demande de vérification enregistrée.");
    router.refresh();
  };

  const showOffer = reRequesting || !lastRequest || lastRequest.verification_status === "rejected";

  if (isVerified) {
    return (
      <Panel tone="success" icon={<BadgeCheck className="size-7 text-[#4ADE80]" />}>
        <h2 className="text-xl font-bold tracking-tight">Badge Vérifié obtenu</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Votre profil a été vérifié par TERANGA LABS. Votre fiche publique affiche
          désormais le badge vérifié qui rassure les clients.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link href="/dashboard" className="btn btn-primary flex-1">
            Ouvrir le dashboard
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
          <Link href="/briefs" className="btn btn-secondary flex-1">
            Voir les briefs
          </Link>
        </div>
      </Panel>
    );
  }

  if (
    !showOffer &&
    lastRequest?.payment_status === "confirmed" &&
    lastRequest.verification_status === "pending"
  ) {
    return (
      <Panel tone="info" icon={<Clock3 className="size-7 text-[#E8A33D]" />}>
        <h2 className="text-xl font-bold tracking-tight">Vérification en cours</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Paiement confirmé le{" "}
          <span className="font-medium text-foreground">
            {formatDate(lastRequest.paid_at ?? lastRequest.created_at ?? new Date().toISOString())}
          </span>{" "}
          via {methodLabel(lastRequest.method ?? method)}. Notre équipe examine votre dossier.
          Une notification sera envoyée dès la fin de l’examen.
        </p>
        <div className="mt-6">
          <Link href="/dashboard" className="btn btn-secondary w-full sm:w-auto">
            Retour au dashboard
          </Link>
        </div>
      </Panel>
    );
  }

  if (
    !showOffer &&
    lastRequest &&
    (lastRequest.verification_status === "pending" || !lastRequest.verification_status) &&
    lastRequest.payment_status !== "confirmed"
  ) {
    // Paiement en attente (dont retour Wave sans confirmation webhook).
    return (
      <Panel icon={<ReceiptText className="size-7 text-muted-foreground" />}>
        <h2 className="text-xl font-bold tracking-tight">Paiement de la vérification en attente</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Vous avez demandé la vérification via{" "}
          <span className="font-medium text-foreground">
            {methodLabel(lastRequest.method ?? method)}
          </span>{" "}
          : un paiement de{" "}
          <span className="font-medium text-foreground">
            {formatFCFA(lastRequest.amount_fcfa ?? price ?? 0)}
          </span>{" "}
          doit être confirmé pour lancer l’examen.
        </p>

        {paymentReturned ? (
          <p className="mt-4 flex items-start gap-2 rounded-xl border border-[#E8A33D]/30 bg-[#2A1A10] px-4 py-3 text-sm text-[#E8A33D]">
            <Clock3 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            Votre paiement est en cours de confirmation — cela peut prendre quelques instants.
            Rechargez la page dans un instant.
          </p>
        ) : null}

        {actionError ? <ErrorBanner message={actionError} /> : null}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          {waveConfigured ? (
            <button
              type="button"
              onClick={startWave}
              disabled={busy !== null}
              className="btn btn-primary flex-1"
            >
              {busy === "wave" ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Smartphone className="size-4" aria-hidden="true" />
              )}
              {busy === "wave" ? "Redirection Wave…" : "Relancer le paiement Wave"}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => router.refresh()}
            disabled={busy !== null}
            className="btn btn-secondary flex-1"
          >
            <RotateCcw className="size-4" aria-hidden="true" />
            Recharger l’état
          </button>
        </div>
        <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
          Vous avez payé par un autre moyen ?{" "}
          <Link href="/contact" className="font-medium text-primary underline-offset-4 hover:underline">
            Contactez notre équipe
          </Link>{" "}
          en joignant votre reçu : la confirmation manuelle prend généralement moins d’une journée.
        </p>
      </Panel>
    );
  }

  if (
    !showOffer &&
    lastRequest?.verification_status === "rejected"
  ) {
    return (
      <div className="flex flex-col gap-6">
        <Panel tone="error" icon={<Clock3 className="size-7 text-[var(--error)]" />}>
          <h2 className="text-xl font-bold tracking-tight">Vérification refusée</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Paiement confirmé, mais notre équipe a refusé la vérification de votre profil.
          </p>
          {lastRequest.rejection_reason ? (
            <blockquote className="mt-4 rounded-xl border border-[var(--error)]/30 bg-[var(--error-soft)] px-4 py-3 text-sm text-[var(--error)]">
              {lastRequest.rejection_reason}
            </blockquote>
          ) : null}
          <div className="mt-6">
            <button
              type="button"
              onClick={() => setReRequesting(true)}
              className="btn btn-secondary w-full sm:w-auto"
            >
              <RotateCcw className="size-4" aria-hidden="true" />
              Relancer une demande
            </button>
          </div>
        </Panel>
      </div>
    );
  }

  // Offre d’inscription à la vérification (aucune demande, ou relance).
  return (
    <div className="flex flex-col gap-6">
      {!waveConfigured ? (
        <p className="flex items-start gap-2 rounded-xl border border-[#E8A33D]/30 bg-[#2A1A10] px-4 py-3 text-sm leading-relaxed text-[#E8A33D]">
          <Phone className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          Le paiement en ligne n’est pas encore activé : envoyez votre paiement par
          mobile money puis suivez les instructions affichées pour la confirmation manuelle.
        </p>
      ) : null}

      <div className="rounded-2xl border border-hairline bg-[#141414] p-6 shadow-sm sm:p-8">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-5 text-primary" aria-hidden="true" />
          <h2 className="text-lg font-semibold tracking-tight">Vérification de votre profil</h2>
        </div>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          Le badge vérifié distingue votre profil dans les résultats de recherche et rassure
          les clients pendant vos candidatures. La vérification est faite par notre équipe
          après confirmation du paiement.
        </p>

        <div className="mt-6 flex items-end justify-between gap-4 rounded-2xl border border-hairline bg-surface p-5">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Tarif unique de vérification
            </p>
            <p className="mt-1 text-3xl font-bold tracking-tight">
              {price ? formatFCFA(price) : "—"}
            </p>
          </div>
          <p className="max-w-[220px] pb-1 text-xs leading-relaxed text-muted-foreground">
            Paiement unique, aucun abonnement. Résultat sous 24–48 h ouvrées.
          </p>
        </div>

        <div className="mt-6">
          <p className="text-sm font-medium">Moyen de paiement</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Moyen de paiement">
            {(["wave", "max_it"] as const).map((m) => {
              const active = method === m;
              return (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setMethod(m)}
                  className={cn(
                    "flex items-center justify-between gap-3 rounded-xl border px-4 py-3.5 text-left text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                    active
                      ? "border-primary/60 bg-[#2A1A10] text-foreground"
                      : "border-hairline bg-surface text-muted-foreground hover:bg-[#1E1E1E]"
                  )}
                >
                  <span className="inline-flex items-center gap-2.5">
                    <Smartphone className="size-4 text-primary" aria-hidden="true" />
                    {METHOD_LABELS[m]}
                  </span>
                  {active ? <CheckCircle2 className="size-4 text-primary" aria-hidden="true" /> : null}
                </button>
              );
            })}
          </div>
        </div>

        {actionError ? <ErrorBanner message={actionError} /> : null}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          {waveConfigured && method === "wave" ? (
            <button
              type="button"
              onClick={startWave}
              disabled={busy !== null || !price}
              className="btn btn-primary flex-1"
            >
              {busy === "wave" ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Smartphone className="size-4" aria-hidden="true" />
              )}
              {busy === "wave" ? "Redirection Wave…" : `Payer via ${methodLabel(method)}`}
            </button>
          ) : (
            <button
              type="button"
              onClick={startManual}
              disabled={busy !== null || !price}
              className="btn btn-primary flex-1"
            >
              {busy === "manual" ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <CreditCard className="size-4" aria-hidden="true" />
              )}
              {busy === "manual"
                ? "Enregistrement…"
                : `Je paie via ${methodLabel(method)} (manuellement)`}
            </button>
          )}
          <Link href="/dashboard" className="btn btn-secondary sm:w-auto">
            Plus tard
          </Link>
        </div>

        {!waveConfigured && method === "wave" ? (
          <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
            Le paiement Wave automatisé n’est pas disponible pour l’instant. Choisissez
            « Je paie manuellement » et suivez les consignes de confirmation.
          </p>
        ) : null}

        {method === "max_it" ? (
          <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
            Après enregistrement de votre demande, vous recevrez les consignes de paiement
            Max It et de transmission du reçu pour la confirmation manuelle.
          </p>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex items-start gap-3 rounded-2xl border border-hairline bg-[#141414] p-5">
          <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#2A1A10]">
            <BadgeCheck className="size-4 text-primary" aria-hidden="true" />
          </span>
          <p className="text-sm leading-relaxed text-muted-foreground">
            <span className="font-medium text-foreground">Badge Vérifié.</span> Affiché sur
            votre fiche publique et dans vos candidatures.
          </p>
        </div>
        <div className="flex items-start gap-3 rounded-2xl border border-hairline bg-[#141414] p-5">
          <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#2A1A10]">
            <ShieldCheck className="size-4 text-primary" aria-hidden="true" />
          </span>
          <p className="text-sm leading-relaxed text-muted-foreground">
            <span className="font-medium text-foreground">Revue humaine.</span> Vérification
            de votre identité, portfolio et coordonnées par un membre de l’équipe.
          </p>
        </div>
      </div>
    </div>
  );
}

function Panel({
  tone,
  icon,
  children,
}: {
  tone?: "success" | "info" | "error";
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "mx-auto max-w-lg rounded-2xl border p-8 text-center shadow-sm",
        tone === "success"
          ? "border-[#166534]/60 bg-[#0F2E18]"
          : tone === "error"
            ? "border-[var(--error)]/40 bg-[#1A0F0F]"
            : "border-hairline bg-[#141414]"
      )}
    >
      <span
        className={cn(
          "mx-auto inline-flex size-14 items-center justify-center rounded-full",
          tone === "success"
            ? "bg-emerald-500/15"
            : tone === "error"
              ? "bg-[var(--error)]/10"
              : "bg-[#2A1A10]"
        )}
      >
        {icon}
      </span>
      {children}
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <p
      role="alert"
      className="mt-5 flex items-start gap-2 rounded-xl border border-[var(--error)]/30 bg-[var(--error-soft)] px-4 py-3 text-sm leading-relaxed text-[var(--error)]"
    >
      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[var(--error)]" aria-hidden="true" />
      {message}
    </p>
  );
}

function translateRequestError(code: string, message: string): string {
  switch (code) {
    case "TLNAU":
      return "Vous devez être connecté pour demander la vérification.";
    case "TLNOD":
      return "Profil développeur introuvable. Reconnectez-vous puis réessayez.";
    case "TLPEN":
      return "Votre compte doit d’abord être approuvé avant de demander la vérification.";
    case "TLRJC":
      return "Votre compte ne permet pas de demander la vérification pour le moment.";
    case "TLDUP":
      return "Une demande de vérification est déjà en cours.";
    case "TLBAD":
      return message || "Méthode de paiement invalide.";
    case "TLNOP":
      return "La vérification est indisponible pour le moment.";
    default:
      return message || "La demande n’a pas abouti. Réessayez dans un instant.";
  }
}