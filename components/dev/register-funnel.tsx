"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowLeft,
  Briefcase,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  Lightbulb,
  Loader2,
  MailCheck,
  Store,
} from "lucide-react";
import { z } from "zod";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "cn";

/**
 * Parcours d'inscription développeur guidé, calqué sur la démonstration de la
 * référence Montaaj :
 *   1. « Crée ton compte »   — email, mot de passe (+ jauge), confirmation, CGU ;
 *   2. « Vérifie ton email » — code à 6 chiffres envoyé par Supabase
 *      (`signInWithOtp` / `verifyOtp`), renvoi avec délai, essais limités,
 *      repli sur le lien de confirmation reçu par email ;
 *   3. le wizard profil existant (`OnboardingForm`) prend le relais dès que la
 *      session est établie — géré côté serveur par la page de la route.
 *
 * La progression (étape + email) est reprise après un rafraîchissement via
 * `sessionStorage`. Aucune donnée n'est enregistrée avant la vérification.
 */

const STORAGE_KEY = "tl-dev-register-funnel";
const SENT_STORAGE_KEY = "tl-dev-register-funnel-sent";
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN = 60;
const CONFIRM_NEXT = "/inscription-developpeur";

/* Styles partagés avec les pages d'auth (mêmes constantes que auth-card). */
const inputClass =
  "h-11 min-h-11 w-full rounded-xl border border-border bg-surface px-4 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30 disabled:opacity-50 disabled:cursor-not-allowed";

const submitClass =
  "inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-[filter] outline-none hover:brightness-110 active:brightness-95 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-primary/50";

const secondaryClass =
  "flex w-full items-center justify-center gap-2.5 rounded-full border border-border bg-surface px-5 py-3 text-sm font-medium text-foreground transition-colors outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary/50";

const accountSchema = z
  .object({
    email: z.string().email("Adresse email invalide."),
    password: z
      .string()
      .min(8, "Au moins 8 caractères.")
      .max(72, "Mot de passe trop long.")
      .regex(/[A-Za-z]/, "Au moins une lettre.")
      .regex(/\d/, "Au moins un chiffre."),
    confirm_password: z.string().min(1, "Confirmez votre mot de passe."),
    accept_terms: z.boolean().refine((v) => v, {
      message:
        "Vous devez accepter les conditions d'utilisation et la politique de confidentialité.",
    }),
  })
  .refine((values) => values.confirm_password === values.password, {
    message: "Les mots de passe ne correspondent pas.",
    path: ["confirm_password"],
  });

type AccountFormValues = z.infer<typeof accountSchema>;

function passwordStrength(pw: string): { score: 0 | 1 | 2 | 3; label: string } {
  let score = 0;
  if (pw.length >= 8) score += 1;
  if (/[A-Z]/.test(pw) || /\d/.test(pw)) score += 1;
  if (/[^a-zA-Z0-9]/.test(pw) && pw.length >= 10) score += 1;
  const label =
    score === 0 ? "Très court" : score === 1 ? "Faible" : score === 2 ? "Moyen" : "Fort";
  return { score: score as 0 | 1 | 2 | 3, label };
}

function translateAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("user already registered")) {
    return "Un compte existe déjà avec cet email.";
  }
  if (m.includes("password")) return "Le mot de passe est invalide.";
  if (m.includes("rate") || m.includes("security purposes") || m.includes("too many")) {
    return "Trop de tentatives. Attends quelques instants puis réessaie.";
  }
  if (m.includes("signup") && m.includes("disabled")) {
    return "L'inscription est temporairement désactivée. Réessaie plus tard.";
  }
  return "La création du compte a échoué. Réessaie.";
}

function translateSendError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("rate") || m.includes("security purposes") || m.includes("too many")) {
    return "Trop de demandes. Attends quelques instants avant de redemander un code.";
  }
  return "L'envoi du code a échoué. Réessaie.";
}

function translateVerifyError(message: string, remaining: number): string {
  const m = message.toLowerCase();
  if (m.includes("expired")) {
    return "Ce code a expiré. Demande un nouveau code.";
  }
  if (m.includes("invalid") || m.includes("not found")) {
    return remaining > 0
      ? `Ce code est incorrect. Il te reste ${remaining} essai${remaining > 1 ? "s" : ""}.`
      : "Trop de tentatives. Demande un nouveau code.";
  }
  if (m.includes("rate") || m.includes("security purposes") || m.includes("too many")) {
    return "Trop de tentatives. Attends un moment avant de réessayer.";
  }
  return "Vérification impossible. Réessaie.";
}

/* ------------------------------ Indicateur ------------------------------- */

type FunnelStep = "account" | "verify";

function FunnelProgress({ current }: { current: FunnelStep }) {
  const steps = [
    { key: "account" as const, label: "Compte" },
    { key: "verify" as const, label: "Vérification" },
    { key: "profile" as const, label: "Profil" },
  ];
  const currentIndex = steps.findIndex((s) => s.key === current);
  return (
    <ol
      className="mx-auto flex items-center justify-center gap-2"
      aria-label="Progression de l'inscription"
    >
      {steps.map((s, i) => {
        const done = i < currentIndex;
        const active = i === currentIndex;
        return (
          <li
            key={s.key}
            aria-current={active ? "step" : undefined}
            className="flex items-center gap-2"
          >
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
                active
                  ? "border-primary/40 bg-primary-soft text-primary"
                  : done
                    ? "border-primary/20 text-foreground"
                    : "border-hairline text-muted-foreground"
              )}
            >
              <span
                className={cn(
                  "inline-flex size-4 items-center justify-center rounded-full text-[10px]",
                  done
                    ? "bg-primary text-primary-foreground"
                    : active
                      ? "bg-primary/20 text-primary"
                      : "bg-hairline text-muted-foreground"
                )}
                aria-hidden="true"
              >
                {done ? <Check className="size-3" /> : i + 1}
              </span>
              {s.label}
            </span>
            {i < steps.length - 1 ? (
              <span className="h-px w-6 bg-hairline" aria-hidden="true" />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

/* ------------------------------ Étape compte ------------------------------ */

function AccountStep({
  initialEmail,
  onAccountCreated,
}: {
  initialEmail: string;
  onAccountCreated: (email: string, sendCodeNow: boolean) => void;
}) {
  const [formError, setFormError] = React.useState<string | null>(null);
  const [accountExists, setAccountExists] = React.useState(false);
  const [showPw, setShowPw] = React.useState(false);
  const [showConfirm, setShowConfirm] = React.useState(false);
  const [resendingExisting, setResendingExisting] = React.useState(false);

  const form = useForm<AccountFormValues>({
    resolver: zodResolver(accountSchema) as unknown as Resolver<AccountFormValues>,
    mode: "onChange",
    defaultValues: {
      email: initialEmail,
      password: "",
      confirm_password: "",
      accept_terms: false,
    },
  });

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = form;

  const onSubmit = async (values: AccountFormValues) => {
    if (!isSupabaseConfigured()) {
      setFormError(
        "Configuration Supabase manquante. Renseignez les variables d'environnement."
      );
      return;
    }
    setFormError(null);
    setAccountExists(false);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        data: { role: "developer" },
        emailRedirectTo: `${window.location.origin}/auth/confirm?next=${CONFIRM_NEXT}`,
      },
    });
    if (error) {
      if (error.message.toLowerCase().includes("user already registered")) {
        setFormError("Un compte existe déjà avec cet email.");
        setAccountExists(true);
        return;
      }
      setFormError(translateAuthError(error.message));
      return;
    }
    /* Certains projets Supabase (auto-confirm) renvoient une session dès la
       création : on la clôt localement pour imposer réellement l'étape de
       vérification par code — le wizard ne s'ouvre qu'après `verifyOtp`. */
    if (data.session) {
      await supabase.auth.signOut({ scope: "local" });
    }
    onAccountCreated(values.email, true);
  };

  const resendForExisting = async () => {
    const email = watch("email");
    if (!email || !isSupabaseConfigured()) return;
    setResendingExisting(true);
    setFormError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/confirm?next=${CONFIRM_NEXT}`,
      },
    });
    setResendingExisting(false);
    if (error) {
      setFormError(translateSendError(error.message));
      return;
    }
    try {
      window.sessionStorage.setItem(SENT_STORAGE_KEY, String(Date.now()));
    } catch {
      /* stockage illisible : cooldown mémoire seul */
    }
    onAccountCreated(email, false);
  };

  const passwordVal = watch("password") ?? "";
  const strength = passwordStrength(passwordVal);

  return (
    <div className="mx-auto w-full max-w-sm">
      <FunnelProgress current="account" />

      <div className="mt-6 text-center">
        <h1 className="font-headings text-[1.75rem]! font-bold tracking-tight">
          Crée ton compte
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          rejoins Devmarket en tant que développeur. Gratuit, 2 minutes.
        </p>
      </div>

      <div
        className="mt-5 grid grid-cols-2 gap-1 rounded-full border border-border bg-surface p-1"
        role="group"
        aria-label="Type de compte"
      >
        <span
          aria-current="true"
          className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-full bg-primary px-3 py-2 text-sm font-medium text-primary-foreground sm:gap-2"
        >
          <Briefcase className="size-4" aria-hidden="true" />
          Je suis développeur
        </span>
        <Link
          href="/signup?role=client"
          className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-3 py-2 text-sm font-medium text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/50 sm:gap-2"
        >
          <Store className="size-4" aria-hidden="true" />
          Je suis client
        </Link>
      </div>

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="mt-4 flex flex-col gap-4"
        noValidate
      >
        <FunnelField
          label="Email"
          htmlFor="devreg-email"
          required
          error={errors.email?.message}
        >
          <Input
            id="devreg-email"
            type="email"
            autoComplete="email"
            required
            {...register("email")}
            className={inputClass}
            aria-invalid={Boolean(errors.email)}
          />
        </FunnelField>

        <FunnelField
          label="Mot de passe"
          htmlFor="devreg-password"
          required
          error={errors.password?.message}
          hint={
            <>
              <p className="text-sm text-muted-foreground">
                8 caractères minimum, avec une lettre et un chiffre.
              </p>
              {passwordVal.length > 0 ? (
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex flex-1 gap-1">
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className={cn(
                          "h-1 flex-1 rounded-full transition-colors duration-300",
                          i < strength.score
                            ? strength.score === 1
                              ? "bg-[var(--warning)]"
                              : strength.score === 2
                                ? "bg-[color-mix(in_oklab,var(--warning),var(--success)_40%)]"
                                : "bg-[var(--success)]"
                            : "bg-hairline"
                        )}
                      />
                    ))}
                  </div>
                  <span className="text-xs font-medium text-muted-foreground">
                    {strength.label}
                  </span>
                </div>
              ) : null}
            </>
          }
        >
          <div className="relative">
            <Input
              id="devreg-password"
              type={showPw ? "text" : "password"}
              autoComplete="new-password"
              required
              {...register("password")}
              className={cn(inputClass, "pl-10")}
              aria-invalid={Boolean(errors.password)}
            />
            <FunnelReveal shown={showPw} onToggle={() => setShowPw((v) => !v)} />
          </div>
        </FunnelField>

        <FunnelField
          label="Confirmer le mot de passe"
          htmlFor="devreg-confirm"
          required
          error={errors.confirm_password?.message}
        >
          <div className="relative">
            <Input
              id="devreg-confirm"
              type={showConfirm ? "text" : "password"}
              autoComplete="new-password"
              required
              {...register("confirm_password")}
              className={cn(inputClass, "pl-10")}
              aria-invalid={Boolean(errors.confirm_password)}
            />
            <FunnelReveal shown={showConfirm} onToggle={() => setShowConfirm((v) => !v)} />
          </div>
        </FunnelField>

        <div className="flex flex-col gap-1.5">
          <label className="flex cursor-pointer items-start gap-2 text-sm">
            <input
              id="devreg-terms"
              type="checkbox"
              {...register("accept_terms")}
              className="mt-0.5 size-4 shrink-0 rounded border-border accent-primary outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
              aria-invalid={Boolean(errors.accept_terms)}
            />
            <span>
              J&apos;accepte les{" "}
              <a
                href="/conditions-utilisation"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline"
              >
                conditions d&apos;utilisation
              </a>{" "}
              et la{" "}
              <a
                href="/politique-de-confidentialite"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline"
              >
                politique de confidentialité
              </a>
              .
            </span>
          </label>
          {errors.accept_terms?.message ? (
            <p role="alert" className="text-sm text-[var(--error)]">
              {errors.accept_terms.message}
            </p>
          ) : null}
        </div>

        <FunnelAlert kind="error" message={formError} />

        {accountExists ? (
          <div className="flex flex-col gap-2">
            <Link href="/login?next=/inscription-developpeur" className={submitClass}>
              Se connecter pour continuer
            </Link>
            <button
              type="button"
              onClick={resendForExisting}
              disabled={resendingExisting}
              className={secondaryClass}
            >
              {resendingExisting ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <MailCheck className="size-4 text-primary" aria-hidden="true" />
              )}
              Renvoyer un code de vérification
            </button>
          </div>
        ) : (
          <button type="submit" disabled={isSubmitting} className={submitClass}>
            {isSubmitting ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : null}
            {isSubmitting ? "Création du compte…" : "Créer mon compte"}
          </button>
        )}
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Déjà un compte ?{" "}
        <Link
          href="/login?next=/inscription-developpeur"
          className="font-semibold text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary/50"
        >
          Se connecter
        </Link>
      </p>
    </div>
  );
}

/* ----------------------------- Étape vérification ---------------------------- */

function VerifyEmailStep({
  email,
  autoSend,
  onVerified,
  onBack,
}: {
  email: string;
  autoSend: boolean;
  onVerified: () => void;
  onBack: () => void;
}) {
  const [digits, setDigits] = React.useState<string[]>(["", "", "", "", "", ""]);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [sending, setSending] = React.useState(false);
  const [verifying, setVerifying] = React.useState(false);
  /* Cooldown persistant (reprise après rafraîchissement) : évite de
     re-solliciter l'envoi à chaque montage (rate limit Supabase). */
  const [cooldown, setCooldown] = React.useState(() => {
    try {
      const last = Number(window.sessionStorage.getItem(SENT_STORAGE_KEY) || 0);
      const left = RESEND_COOLDOWN - Math.floor((Date.now() - last) / 1000);
      return left > 0 ? left : 0;
    } catch {
      return 0;
    }
  });
  const [attempts, setAttempts] = React.useState(MAX_ATTEMPTS);
  const refs = React.useRef<(HTMLInputElement | null)[]>([]);
  const autoSentRef = React.useRef(false);

  const code = digits.join("");

  /* Le lien de confirmation (email) peut être cliqué dans un autre onglet :
     la session apparaît alors côté client — on finalise automatiquement
     au lieu de laisser l'utilisateur bloqué sur les cases. */
  React.useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const supabase = createClient();
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      try {
        window.sessionStorage.removeItem(STORAGE_KEY);
      } catch {
        /* ignoré */
      }
      onVerified();
    };
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) finish();
    });
    const recheck = () => {
      void supabase.auth.getSession().then(({ data }) => {
        if (data.session) finish();
      });
    };
    window.addEventListener("focus", recheck);
    document.addEventListener("visibilitychange", recheck);
    return () => {
      sub.subscription.unsubscribe();
      window.removeEventListener("focus", recheck);
      document.removeEventListener("visibilitychange", recheck);
    };
  }, [onVerified]);

  React.useEffect(() => {
    if (cooldown <= 0) return;
    const t = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(t);
  }, [cooldown]);

  const sendCode = React.useCallback(
    async (isAuto: boolean) => {
      if (!isSupabaseConfigured()) {
        setFormError(
          "Configuration Supabase manquante. Renseignez les variables d'environnement."
        );
        return;
      }
      setSending(true);
      setFormError(null);
      setNotice(null);
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/confirm?next=${CONFIRM_NEXT}`,
        },
      });
      setSending(false);
      if (error) {
        setFormError(translateSendError(error.message));
        return;
      }
      setAttempts(MAX_ATTEMPTS);
      setDigits(["", "", "", "", "", ""]);
      setCooldown(RESEND_COOLDOWN);
      try {
        window.sessionStorage.setItem(SENT_STORAGE_KEY, String(Date.now()));
      } catch {
        /* stockage illisible : cooldown mémoire seul */
      }
      setNotice(
        isAuto
          ? "Code envoyé. Vérifie ta boîte mail."
          : "Nouveau code envoyé. Vérifie ta boîte mail."
      );
    },
    [email]
  );

  React.useEffect(() => {
    if (!autoSend || autoSentRef.current) return;
    autoSentRef.current = true;
    /* Envoi déjà effectué récemment (reprise après rafraîchissement) :
       on ne renvoie pas de code, le cooldown en cours en témoigne. */
    try {
      const last = Number(window.sessionStorage.getItem(SENT_STORAGE_KEY) || 0);
      if (Date.now() - last < RESEND_COOLDOWN * 1000) return;
    } catch {
      /* stockage illisible : on envoie */
    }
    void sendCode(true);
  }, [autoSend, sendCode]);

  const setDigit = (index: number, value: string) => {
    const char = value.replace(/\D/g, "").slice(-1);
    setDigits((prev) => {
      const next = [...prev];
      next[index] = char;
      return next;
    });
    if (char && index < 5) refs.current[index + 1]?.focus();
  };

  const onKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      refs.current[index - 1]?.focus();
    }
    if (e.key === "ArrowLeft" && index > 0) refs.current[index - 1]?.focus();
    if (e.key === "ArrowRight" && index < 5) refs.current[index + 1]?.focus();
  };

  const onPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!text) return;
    e.preventDefault();
    setDigits((prev) => {
      const next = [...prev];
      for (let i = 0; i < 6; i += 1) next[i] = text[i] ?? "";
      return next;
    });
    refs.current[Math.min(text.length, 5)]?.focus();
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length < 6 || verifying) return;
    if (!isSupabaseConfigured()) {
      setFormError(
        "Configuration Supabase manquante. Renseignez les variables d'environnement."
      );
      return;
    }
    setVerifying(true);
    setFormError(null);
    setNotice(null);
    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({ email, token: code, type: "email" });
    setVerifying(false);
    if (error) {
      const remaining = attempts - 1;
      setAttempts(Math.max(remaining, 0));
      setFormError(translateVerifyError(error.message, remaining));
      if (remaining <= 0) {
        setDigits(["", "", "", "", "", ""]);
        setCooldown(0);
      }
      return;
    }
    window.sessionStorage.removeItem(STORAGE_KEY);
    onVerified();
  };

  return (
    <div className="mx-auto w-full max-w-sm">
      <FunnelProgress current="verify" />

      <div className="mt-6 text-center">
        <span className="mx-auto inline-flex size-12 items-center justify-center rounded-full bg-primary-soft">
          <MailCheck className="size-6 text-primary" aria-hidden="true" />
        </span>
        <h1 className="mt-4 font-headings text-[1.75rem]! font-bold tracking-tight">
          Vérifie ton email
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          On vient d&apos;envoyer un code à{" "}
          <span className="font-medium text-foreground">{email}</span>
        </p>
      </div>

      <form onSubmit={verify} className="mt-6 flex flex-col gap-4">
        <div
          className="flex justify-center gap-2"
          role="group"
          aria-label="Code de vérification à 6 chiffres"
          onPaste={onPaste}
        >
          {digits.map((d, i) => (
            <Input
              key={i}
              ref={(el: HTMLInputElement | null) => {
                refs.current[i] = el;
              }}
              id={`devreg-otp-${i}`}
              value={d}
              onChange={(e) => setDigit(i, e.target.value)}
              onKeyDown={(e) => onKeyDown(i, e)}
              onFocus={(e) => e.currentTarget.select()}
              inputMode="numeric"
              autoComplete={i === 0 ? "one-time-code" : "off"}
              maxLength={1}
              aria-label={`Chiffre ${i + 1} sur 6`}
              className={cn(inputClass, "h-12 w-11 px-0 text-center text-lg font-semibold")}
            />
          ))}
        </div>

        <FunnelAlert kind="error" message={formError} />
        <FunnelAlert kind="notice" message={notice} />

        <button
          type="submit"
          disabled={code.length < 6 || verifying || sending}
          className={submitClass}
        >
          {verifying ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : null}
          {verifying ? "Vérification…" : "Vérifier"}
        </button>

        <p className="text-center text-sm text-muted-foreground">
          Code non reçu ?{" "}
          <button
            type="button"
            onClick={() => void sendCode(false)}
            disabled={sending || cooldown > 0}
            className="font-semibold text-primary outline-none hover:underline disabled:opacity-50 disabled:hover:no-underline focus-visible:ring-2 focus-visible:ring-primary/50"
          >
            {cooldown > 0 ? `Renvoyer dans ${cooldown} s` : "Renvoie le code"}
          </button>
        </p>

        <div className="flex items-start gap-2.5 rounded-xl border border-border bg-surface px-4 py-3 text-sm leading-relaxed text-muted-foreground">
          <Lightbulb className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
          <p>
            Astuce : ouvre directement le lien de confirmation reçu par email —
            cela fonctionne aussi.{" "}
            <span className="text-foreground">Le lien expire dans 10 minutes.</span>
          </p>
        </div>

        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center justify-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/50"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Retour
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Déjà un compte ?{" "}
        <Link
          href="/login?next=/inscription-developpeur"
          className="font-semibold text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary/50"
        >
          Se connecter
        </Link>
      </p>
    </div>
  );
}

/* ------------------------------ Sous-composants ------------------------------ */

function FunnelField({
  label,
  htmlFor,
  required,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  error?: string | null;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={htmlFor} className="mb-1 gap-0 text-foreground">
        {label}
        {required ? (
          <span className="text-[var(--error)]" aria-hidden="true">
            *
          </span>
        ) : null}
      </Label>
      {children}
      {hint}
      {error ? (
        <p role="alert" className="text-sm text-[var(--error)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function FunnelReveal({ shown, onToggle }: { shown: boolean; onToggle: () => void }) {
  return (
    <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
      <button
        type="button"
        onClick={onToggle}
        className="pointer-events-auto inline-flex size-6 items-center justify-center rounded text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/50"
        aria-label={shown ? "Masquer le mot de passe" : "Afficher le mot de passe"}
      >
        {shown ? (
          <EyeOff className="size-4" aria-hidden="true" />
        ) : (
          <Eye className="size-4" aria-hidden="true" />
        )}
      </button>
    </span>
  );
}

function FunnelAlert({ kind, message }: { kind: "error" | "notice"; message: string | null }) {
  if (!message) return null;
  return (
    <p
      role={kind === "error" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2 rounded-xl border px-4 py-3 text-sm leading-relaxed",
        kind === "error"
          ? "border-[var(--error)]/30 bg-[var(--error-soft)] text-[var(--error)]"
          : "border-border bg-surface text-foreground"
      )}
    >
      {kind === "error" ? (
        <span
          className="mt-0.5 size-1.5 shrink-0 rounded-full bg-[var(--error)]"
          aria-hidden="true"
        />
      ) : (
        <CheckCircle2
          className="mt-0.5 size-4 shrink-0 text-[var(--success)]"
          aria-hidden="true"
        />
      )}
      {message}
    </p>
  );
}

/* ------------------------------ Orchestrateur ------------------------------ */

export function RegisterFunnel() {
  const router = useRouter();
  const [step, setStep] = React.useState<FunnelStep>("account");
  const [email, setEmail] = React.useState("");
  const [autoSend, setAutoSend] = React.useState(true);
  const [hydrated, setHydrated] = React.useState(false);

  React.useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as { step?: string; email?: string };
        if (saved.email) setEmail(saved.email);
        if (saved.step === "verify" && saved.email) {
          setStep("verify");
          setAutoSend(true);
        }
      }
    } catch {
      /* stockage illisible : on repart de l'étape compte */
    }
    setHydrated(true);
  }, []);

  React.useEffect(() => {
    if (!hydrated) return;
    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ step, email }));
    } catch {
      /* quota / mode privé : la reprise n'est pas garantie */
    }
  }, [step, email, hydrated]);

  const clearStorage = React.useCallback(() => {
    try {
      window.sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignoré */
    }
  }, []);

  const handleSession = React.useCallback(() => {
    clearStorage();
    router.refresh();
  }, [clearStorage, router]);

  const handleAccountCreated = React.useCallback(
    (createdEmail: string, sendCodeNow: boolean) => {
      setEmail(createdEmail);
      setAutoSend(sendCodeNow);
      setStep("verify");
    },
    []
  );

  return (
    <>
      {step === "account" ? (
        <AccountStep
          initialEmail={email}
          onAccountCreated={handleAccountCreated}
        />
      ) : (
        <VerifyEmailStep
          email={email}
          autoSend={autoSend}
          onVerified={handleSession}
          onBack={() => setStep("account")}
        />
      )}
    </>
  );
}
