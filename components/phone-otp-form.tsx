"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, MessageSquare, ShieldCheck } from "lucide-react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/ui/phone-input";
import { phoneOtpSchema } from "@/lib/validations";

type Step = "phone" | "code";

/**
 * Connexion par code SMS, en complément de l'email (jamais à la place).
 *
 * Volontairement `shouldCreateUser: false` : un compte doit d'abord exister,
 * car le trigger handle_new_user() construit le profil (rôle, prénom, pseudo)
 * à partir des metadata d'inscription. Créer un compte depuis le seul numéro
 * produirait un profil développeur vide et non validé.
 */
export function PhoneOtpForm({ onBack }: { onBack: () => void }) {
  const router = useRouter();
  const [step, setStep] = React.useState<Step>("phone");
  const [phone, setPhone] = React.useState("");
  const [code, setCode] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [resendIn, setResendIn] = React.useState(0);

  React.useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const routeByRole = async () => {
    const supabase = createClient();
    const { data } = await supabase.rpc("get_my_role");
    router.push(data === "client" ? "/client" : "/dashboard");
    router.refresh();
  };

  const requestCode = async () => {
    if (!isSupabaseConfigured()) {
      setError("Configuration Supabase manquante. Renseignez les variables d'environnement.");
      return;
    }
    const parsed = phoneOtpSchema.safeParse({ phone });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Numéro invalide.");
      return;
    }

    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: otpError } = await supabase.auth.signInWithOtp({
      phone: parsed.data.phone,
      options: { shouldCreateUser: false },
    });
    setBusy(false);

    if (otpError) {
      setError(readableOtpError(otpError.message));
      return;
    }

    setStep("code");
    setResendIn(30);
    setNotice(
      `Code envoyé au ${maskPhone(parsed.data.phone)}. Il est valable quelques minutes.`
    );
  };

  const sendCode = (e: React.FormEvent) => {
    e.preventDefault();
    void requestCode();
  };

  const verifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSupabaseConfigured()) return;

    const clean = code.replace(/\D/g, "");
    if (clean.length < 6) {
      setError("Le code comporte 6 chiffres.");
      return;
    }

    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: verifyError } = await supabase.auth.verifyOtp({
      phone,
      token: clean,
      type: "sms",
    });
    setBusy(false);

    if (verifyError) {
      setError(
        verifyError.message.toLowerCase().includes("expired")
          ? "Code expiré. Demandez-en un nouveau."
          : "Code incorrect. Vérifiez les 6 chiffres et réessayez."
      );
      return;
    }

    await routeByRole();
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-xl font-bold tracking-tight">
          {step === "phone" ? "Connexion par SMS" : "Saisir le code"}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {step === "phone"
            ? "Recevez un code à 6 chiffres sur votre téléphone."
            : "Nous avons envoyé un code au numéro indiqué."}
        </p>
      </div>

      {step === "phone" ? (
        <form onSubmit={sendCode} className="flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-2">
            <Label htmlFor="otp-phone">Numéro de téléphone</Label>
            <PhoneInput
              id="otp-phone"
              value={phone}
              onChange={setPhone}
              autoComplete="tel"
              aria-invalid={Boolean(error)}
            />
            <p className="text-xs text-muted-foreground">
              Choisissez votre pays puis saisissez votre numéro (format
              international).
            </p>
          </div>

          {error ? (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          ) : null}

          <button type="submit" disabled={busy} className="btn btn-primary btn-lg w-full">
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
            {busy ? "Envoi en cours…" : "Recevoir le code"}
          </button>

          <p className="text-xs leading-relaxed text-muted-foreground">
            Aucun compte avec ce numéro ?{" "}
            <Link
              href="/signup"
              className="font-medium text-primary underline underline-offset-4 hover:text-primary-light"
            >
              Créez votre compte
            </Link>{" "}
            d&apos;abord : le numéro est ajouté à un compte existant, il ne le
            remplace pas.
          </p>
        </form>
      ) : (
        <form onSubmit={verifyCode} className="flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-2">
            <Label htmlFor="otp-code">Code à 6 chiffres</Label>
            <Input
              id="otp-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="000000"
              className="h-14 rounded-xl border-hairline bg-background/70 text-center font-mono text-2xl tracking-[0.4em]"
              aria-invalid={Boolean(error)}
            />
          </div>

          {error ? (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          ) : notice ? (
            <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <MessageSquare className="size-3.5 text-primary" aria-hidden="true" />
              {notice}
            </p>
          ) : null}

          <button type="submit" disabled={busy} className="btn btn-primary btn-lg w-full">
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
            {busy ? "Vérification…" : "Valider le code"}
          </button>

          <div className="flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={() => {
                setStep("phone");
                setCode("");
                setError(null);
                setNotice(null);
              }}
              className="font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              Changer de numéro
            </button>
            <button
              type="button"
              disabled={busy || resendIn > 0}
              onClick={() => {
                void requestCode();
              }}
              className="font-medium text-primary underline-offset-4 disabled:text-muted-foreground disabled:no-underline hover:underline"
            >
              {resendIn > 0 ? `Renvoyer dans ${resendIn}s` : "Renvoyer le code"}
            </button>
          </div>
        </form>
      )}

      <p className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden="true" />
        La validation par SMS est un moyen de connexion supplémentaire :
        l&apos;email et le mot de passe continuent de fonctionner.
      </p>

      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 self-start text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
      >
        <ArrowLeft className="size-3.5" aria-hidden="true" />
        Revenir à la connexion par email
      </button>
    </div>
  );
}

/** Jamais d'echo brut de l'erreur Supabase : le provider peut ne pas être configure. */
function readableOtpError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("signups not allowed") || m.includes("not found")) {
    return "Aucun compte n'est associé à ce numéro. Créez votre compte, puis ajoutez ce numéro.";
  }
  if (m.includes("provider") || m.includes("sms") || m.includes("twilio") || m.includes("message")) {
    return "La validation par SMS n'est pas encore disponible. Utilisez votre email et mot de passe.";
  }
  if (m.includes("rate") || m.includes("too many")) {
    return "Trop de demandes. Patientez quelques minutes avant de réessayer.";
  }
  return "Impossible d'envoyer le code pour le moment. Réessayez dans quelques instants.";
}

function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 6) return phone;
  return `${phone.slice(0, phone.length - 6)}••••${digits.slice(-2)}`;
}