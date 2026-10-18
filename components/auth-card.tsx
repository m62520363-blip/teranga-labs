"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowLeft,
  Briefcase,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Phone,
  Store,
} from "lucide-react";
import { z } from "zod";
import {
  clientSignupSchema,
  loginSchema,
  parseSkills,
  signupSchema,
  type ClientSignupFormValues,
  type LoginFormValues,
  type SignupFormValues,
} from "@/lib/validations";
import {
  COUNTRIES,
  getFlagUrl,
  getRegionsByCountry,
} from "@/lib/countries";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { PhoneOtpForm } from "@/components/phone-otp-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/ui/phone-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "cn";
import Image from "next/image";

export type AuthMode = "login" | "signup";
export type AuthRole = "developer" | "client";

type AuthInput = LoginFormValues &
  Partial<SignupFormValues> &
  Partial<ClientSignupFormValues> & {
    confirm_password?: string;
    accept_terms?: boolean;
  };

/* Styles partagés, calqués sur la référence Montaaj : champ `rounded-xl`
   sur surface sombre, focus bordure primaire + anneau léger. */
const inputClass =
  "h-11 min-h-11 w-full rounded-xl border border-border bg-surface px-4 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30 disabled:opacity-50 disabled:cursor-not-allowed";

/* Champ téléphone : deux sous-champs en flex (indicatif + numéro) — pas de
   `w-full` (sinon l'indicatif `shrink-0` déborde du conteneur). */
const phoneFieldClass =
  "h-11 min-h-11 data-[size=default]:h-11 rounded-xl border border-border bg-surface px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30 disabled:opacity-50 disabled:cursor-not-allowed";

const submitClass =
  "inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-[filter] outline-none hover:brightness-110 active:brightness-95 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-primary/50";

const secondaryClass =
  "flex w-full items-center justify-center gap-2.5 rounded-full border border-border bg-surface px-5 py-3 text-sm font-medium text-foreground transition-colors outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary/50";

/* Select du formulaire d'inscription : même gabarit que les champs texte. */
const selectTriggerClass =
  "h-11 min-h-11 data-[size=default]:h-11 w-full rounded-xl border border-border bg-surface px-4 text-sm text-foreground outline-none transition-colors focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30";

/* Inscription client : on choisit d'abord le PAYS, ensuite la RÉGION — la
   liste de régions se réduit aux frontières du pays choisi. Le champ stocké
   reste `city` = nom de région (le pays est dérivé par lib/geography.ts). */
const DEFAULT_COUNTRY = "SN";

const COUNTRY_ITEMS: Record<string, string> = Object.fromEntries(
  COUNTRIES.map((c) => [c.code, c.nameFr])
);

function FlagImg({ code }: { code: string }) {
  return (
    <Image
      src={getFlagUrl(code, 20)}
      alt=""
      width={20}
      height={14}
      className="h-3.5 w-5 shrink-0 rounded-[2px] object-cover"
    />
  );
}

function translateAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) {
    return "Email ou mot de passe incorrect.";
  }
  if (m.includes("email not confirmed")) {
    return "Votre email n'est pas encore confirmé. Vérifiez votre boîte mail.";
  }
  if (m.includes("user already registered")) {
    return "Un compte existe déjà avec cet email.";
  }
  if (m.includes("tlwa") || m.includes("duplicate key value violates unique constraint")) {
    return "Ce numéro WhatsApp est déjà associé à un autre compte. Chaque compte possède un email et un numéro uniques.";
  }
  if (m.includes("password")) return "Le mot de passe est invalide.";
  return message;
}

function passwordStrength(pw: string): { score: 0 | 1 | 2 | 3; label: string } {
  let score = 0;
  if (pw.length >= 8) score += 1;
  if (/[A-Z]/.test(pw) || /\d/.test(pw)) score += 1;
  if (/[^a-zA-Z0-9]/.test(pw) && pw.length >= 10) score += 1;
  const label =
    score === 0 ? "Très court" : score === 1 ? "Faible" : score === 2 ? "Moyen" : "Fort";
  return { score: score as 0 | 1 | 2 | 3, label };
}

/**
 * Schéma d'inscription = schéma métier (inchangé) + les deux champs propres
 * au formulaire : confirmation du mot de passe et acceptation des CGU.
 * Le champ WhatsApp client « optionnel » accepte la saisie vide (zod v4
 * rejette `""` sur une regex) — traité ici pour ne pas toucher au schéma
 * partagé par les tests.
 */
function buildSignupResolver(role: AuthRole): Resolver<AuthInput> {
  const shared = {
    confirm_password: z.string().min(1, "Confirmez votre mot de passe."),
    accept_terms: z.boolean().refine((v) => v, {
      message:
        "Vous devez accepter les conditions d'utilisation et la politique de confidentialité.",
    }),
  };
  const crossField = {
    message: "Les mots de passe ne correspondent pas.",
    path: ["confirm_password"],
  };
  // Les deux branches sont construites séparément : TypeScript ne peut pas
  // appeler `.refine()` à travers l'union des deux types de schémas.
  const schema =
    role === "client"
      ? clientSignupSchema
          .extend({
            ...shared,
            whatsapp: z.preprocess(
              (v) => (v === "" || v === undefined ? undefined : v),
              clientSignupSchema.shape.whatsapp
            ),
          })
          .refine((values) => values.confirm_password === values.password, crossField)
      : signupSchema
          .extend(shared)
          .refine((values) => values.confirm_password === values.password, crossField);
  return zodResolver(schema) as unknown as Resolver<AuthInput>;
}

export function AuthCard({
  mode,
  initialRole = "client",
  next = null,
}: {
  mode: AuthMode;
  initialRole?: AuthRole;
  next?: string | null;
}) {
  if (mode === "login") return <LoginForm next={next} />;
  return <SignupForm initialRole={initialRole} />;
}

/* -------------------------------- LOGIN -------------------------------- */

function LoginForm({ next = null }: { next?: string | null }) {
  const router = useRouter();
  const [formError, setFormError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [resetMode, setResetMode] = React.useState(false);
  const [resetEmail, setResetEmail] = React.useState("");
  const [sendingReset, setSendingReset] = React.useState(false);
  const [resetSent, setResetSent] = React.useState(false);
  const [showPw, setShowPw] = React.useState(false);
  // Le SMS est une option COMPLEMENTAIRE : l'email reste le chemin par défaut.
  const [usePhone, setUsePhone] = React.useState(false);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema) as Resolver<LoginFormValues>,
    mode: "onChange",
    defaultValues: { email: "", password: "" },
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = form;

  const onSubmit = async (values: LoginFormValues) => {
    if (!isSupabaseConfigured()) {
      setFormError("Configuration Supabase manquante. Renseignez les variables d'environnement.");
      return;
    }
    setFormError(null);
    setNotice(null);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    });
    if (error) {
      setFormError(translateAuthError(error.message));
      return;
    }
    const signupRole = data.user?.user_metadata?.role;
    router.push(next ?? (signupRole === "client" ? "/client" : "/dashboard"));
    router.refresh();
  };

  const sendResetLink = async () => {
    if (!isSupabaseConfigured()) return;
    setSendingReset(true);
    setResetSent(false);
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: `${window.location.origin}/auth/update-password`,
    });
    setSendingReset(false);
    if (error) {
      setFormError(translateAuthError(error.message));
      return;
    }
    setResetSent(true);
    setFormError(null);
  };

  if (resetMode) {
    return (
      <ResetForm
        resetEmail={resetEmail}
        onEmailChange={setResetEmail}
        sending={sendingReset}
        sent={resetSent}
        error={formError}
        onSend={sendResetLink}
        onBack={() => {
          setResetMode(false);
          setFormError(null);
        }}
      />
    );
  }

  if (usePhone) {
    return <PhoneOtpForm onBack={() => setUsePhone(false)} />;
  }

  return (
    <>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        <Field label="Email" htmlFor="login-email" required error={errors.email?.message}>
          <Input
            id="login-email"
            type="email"
            autoComplete="email"
            required
            {...register("email")}
            className={inputClass}
            aria-invalid={Boolean(errors.email)}
          />
        </Field>

        <Field
          label="Mot de passe"
          htmlFor="login-password"
          required
          error={errors.password?.message}
        >
          <div className="relative">
            <Input
              id="login-password"
              type={showPw ? "text" : "password"}
              autoComplete="current-password"
              required
              {...register("password")}
              className={cn(inputClass, "pl-10")}
              aria-invalid={Boolean(errors.password)}
            />
            <RevealButton shown={showPw} onToggle={() => setShowPw((v) => !v)} />
          </div>
        </Field>

        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={() => {
              setResetMode(true);
              setFormError(null);
            }}
            className="text-sm font-medium text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/50"
          >
            Mot de passe oublié ?
          </button>
        </div>

        <AuthAlert kind="error" message={formError} />
        <AuthAlert kind="notice" message={notice} />

        <button type="submit" disabled={isSubmitting} className={submitClass}>
          {isSubmitting ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : null}
          {isSubmitting ? "Connexion en cours…" : "Se connecter"}
        </button>
      </form>

      <div className="my-5 flex items-center gap-3" aria-hidden="true">
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">ou</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <button
        type="button"
        onClick={() => {
          setUsePhone(true);
          setFormError(null);
        }}
        className={secondaryClass}
      >
        <Phone className="size-4 text-primary" aria-hidden="true" />
        Recevoir un code par SMS
      </button>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Pas encore de compte ?{" "}
        <Link
          href="/signup"
          className="font-semibold text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary/50"
        >
          S&apos;inscrire
        </Link>
      </p>
    </>
  );
}

/* -------------------------------- SIGN UP ------------------------------- */

function SignupForm({ initialRole }: { initialRole: AuthRole }) {
  const router = useRouter();
  const [formError, setFormError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [role, setRole] = React.useState<AuthRole>(initialRole);
  const [showPw, setShowPw] = React.useState(false);
  const [showConfirm, setShowConfirm] = React.useState(false);

  const resolver = React.useMemo(() => buildSignupResolver(role), [role]);

  const form = useForm<AuthInput>({
    resolver,
    mode: "onChange",
    defaultValues:
      role === "client"
        ? {
            full_name: "",
            company_name: "",
            email: "",
            password: "",
            confirm_password: "",
            city: "Dakar",
            whatsapp: "",
            accept_terms: false,
          }
        : {
            full_name: "",
            email: "",
            password: "",
            confirm_password: "",
            whatsapp: "",
            skills: "",
            accept_terms: false,
          },
  });

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = form;

  /* Pays d'abord, région ensuite (UI seule : `city` garde le nom de région). */
  const [countryCode, setCountryCode] = React.useState<string>(DEFAULT_COUNTRY);
  const regionItems = React.useMemo(() => {
    const items: Record<string, string> = {};
    for (const region of getRegionsByCountry(countryCode)) items[region.name] = region.name;
    return items;
  }, [countryCode]);

  const onSubmit = async (values: AuthInput) => {
    if (!isSupabaseConfigured()) {
      setFormError("Configuration Supabase manquante. Renseignez les variables d'environnement.");
      return;
    }
    setFormError(null);
    setNotice(null);
    const supabase = createClient();
    const isClient = role === "client";
    const whatsappValue = (values.whatsapp ?? "").trim();
    if (whatsappValue) {
      const { data: taken } = await supabase.rpc("is_phone_taken", {
        p_phone: whatsappValue,
      });
      if (taken) {
        setFormError(
          "Ce numéro WhatsApp est déjà associé à un autre compte. Chaque compte possède un email et un numéro uniques."
        );
        return;
      }
    }
    const { data, error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        data: {
          role: isClient ? "client" : "developer",
          full_name: values.full_name,
          company_name: isClient ? (values.company_name ?? "") : undefined,
          city: isClient ? (values.city ?? "") : undefined,
          whatsapp: isClient ? (values.whatsapp ?? "") : values.whatsapp,
          skills: isClient ? undefined : parseSkills(values.skills ?? ""),
        },
        emailRedirectTo: `${window.location.origin}/auth/confirm?next=${isClient ? "/client" : "/inscription-developpeur"}`,
      },
    });
    if (error) {
      setFormError(translateAuthError(error.message));
      return;
    }
    if (data.session) {
      router.push(isClient ? "/client" : "/inscription-developpeur");
      router.refresh();
      return;
    }
    setNotice(
      isClient
        ? "Compte client créé. Vérifiez votre boîte mail et confirmez votre adresse, puis connectez-vous pour publier votre projet."
        : "Compte développeur créé. Vérifiez votre boîte mail et confirmez votre adresse, puis connectez-vous pour compléter votre inscription."
    );
  };

  const strength = passwordStrength(watch("password") ?? "");
  const passwordVal = watch("password") ?? "";

  return (
    <>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        <h1 className="text-center font-headings text-[1.75rem]! font-bold tracking-tight">
          Créez votre compte
        </h1>

        <div
          className="grid grid-cols-2 gap-1 rounded-full border border-border bg-surface p-1"
          role="group"
          aria-label="Type de compte"
        >
          <button
            type="button"
            aria-pressed={role === "client"}
            onClick={() => setRole("client")}
            className={cn(
              "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-2 py-2 text-[13px] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary/50 sm:gap-2 sm:px-3 sm:text-sm",
              role === "client"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Store className="size-4" aria-hidden="true" />
            Je suis client
          </button>
          <button
            type="button"
            aria-pressed={role === "developer"}
            onClick={() => setRole("developer")}
            className={cn(
              "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-2 py-2 text-[13px] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary/50 sm:gap-2 sm:px-3 sm:text-sm",
              role === "developer"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Briefcase className="size-4" aria-hidden="true" />
            Je suis développeur
          </button>
        </div>

        <Field
          label={role === "client" ? "Votre nom" : "Nom complet"}
          htmlFor="signup-name"
          required
          error={errors.full_name?.message}
        >
          <Input
            id="signup-name"
            {...register("full_name")}
            autoComplete="name"
            required
            className={inputClass}
            aria-invalid={Boolean(errors.full_name)}
          />
        </Field>

        {role === "client" && (
          <Field
            label="Nom de votre structure (optionnel)"
            htmlFor="signup-company"
            error={errors.company_name?.message}
          >
            <Input
              id="signup-company"
              {...register("company_name")}
              autoComplete="organization"
              className={inputClass}
              aria-invalid={Boolean(errors.company_name)}
            />
          </Field>
        )}

        {role === "client" && (
          <Field label="Pays" htmlFor="signup-country" required>
            <Select
              value={countryCode}
              onValueChange={(v) => {
                if (!v || v === countryCode) return;
                setCountryCode(v);
                setValue("city", "", { shouldDirty: true });
              }}
              items={COUNTRY_ITEMS}
            >
              <SelectTrigger id="signup-country" className={selectTriggerClass}>
                <FlagImg code={countryCode} />
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="start" className="max-h-72">
                {COUNTRIES.map((country) => (
                  <SelectItem key={country.code} value={country.code}>
                    <FlagImg code={country.code} />
                    {country.nameFr}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}

        {role === "client" && (
          <Field label="Région" htmlFor="signup-city" required error={errors.city?.message}>
            <Select
              value={(watch("city") as string) ?? ""}
              onValueChange={(v) =>
                v &&
                setValue("city", v as ClientSignupFormValues["city"], {
                  shouldValidate: true,
                })
              }
              items={regionItems}
            >
              <SelectTrigger id="signup-city" className={selectTriggerClass}>
                <SelectValue placeholder="Choisir une région" />
              </SelectTrigger>
              <SelectContent align="start" className="max-h-72">
                {getRegionsByCountry(countryCode).map((region) => (
                  <SelectItem key={region.code} value={region.name}>
                    {region.name}
                    {region.note ? " — (à confirmer)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}

        <Field label="Email" htmlFor="signup-email" required error={errors.email?.message}>
          <Input
            id="signup-email"
            type="email"
            {...register("email")}
            autoComplete="email"
            required
            className={inputClass}
            aria-invalid={Boolean(errors.email)}
          />
        </Field>

        <Field
          label="Mot de passe"
          htmlFor="signup-password"
          required
          error={errors.password?.message}
          hint={
            <>
              <p className="text-sm text-muted-foreground">
                8 caractères minimum, avec une lettre et un chiffre.
              </p>
              {passwordVal.length > 0 && (
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
              )}
            </>
          }
        >
          <div className="relative">
            <Input
              id="signup-password"
              type={showPw ? "text" : "password"}
              {...register("password")}
              autoComplete="new-password"
              required
              className={cn(inputClass, "pl-10")}
              aria-invalid={Boolean(errors.password)}
            />
            <RevealButton shown={showPw} onToggle={() => setShowPw((v) => !v)} />
          </div>
        </Field>

        <Field
          label="Confirmer le mot de passe"
          htmlFor="signup-confirm"
          required
          error={errors.confirm_password?.message}
        >
          <div className="relative">
            <Input
              id="signup-confirm"
              type={showConfirm ? "text" : "password"}
              {...register("confirm_password")}
              autoComplete="new-password"
              required
              className={cn(inputClass, "pl-10")}
              aria-invalid={Boolean(errors.confirm_password)}
            />
            <RevealButton shown={showConfirm} onToggle={() => setShowConfirm((v) => !v)} />
          </div>
        </Field>

        <Field
          label={role === "client" ? "WhatsApp (optionnel)" : "WhatsApp"}
          htmlFor="signup-whatsapp"
          required={role === "developer"}
          error={errors.whatsapp?.message}
        >
          <PhoneInput
            id="signup-whatsapp"
            value={(watch("whatsapp") as string) ?? ""}
            onChange={(v) =>
              setValue("whatsapp", v, {
                shouldValidate: true,
                shouldDirty: true,
              })
            }
            autoComplete="tel"
            invalid={Boolean(errors.whatsapp)}
            fieldClassName={phoneFieldClass}
          />
        </Field>

        {role === "developer" && (
          <Field
            label="Compétences (séparées par des virgules)"
            htmlFor="signup-skills"
            error={errors.skills?.message}
          >
            <Input
              id="signup-skills"
              {...register("skills")}
              className={inputClass}
              aria-invalid={Boolean(errors.skills)}
            />
          </Field>
        )}

        <div className="flex flex-col gap-1.5">
          <label className="flex cursor-pointer items-start gap-2 text-sm">
            <input
              type="checkbox"
              {...register("accept_terms")}
              className="mt-0.5 size-4 shrink-0 rounded border-border accent-primary outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
              aria-invalid={Boolean(errors.accept_terms)}
            />
            <span className="text-muted-foreground">
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

        <AuthAlert kind="error" message={formError} />
        <AuthAlert kind="notice" message={notice} />

        <button type="submit" disabled={isSubmitting} className={submitClass}>
          {isSubmitting ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : null}
          {isSubmitting ? "Création du compte…" : "Créer mon compte"}
        </button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Déjà un compte ?{" "}
        <Link
          href="/login"
          className="font-semibold text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary/50"
        >
          Se connecter
        </Link>
      </p>
    </>
  );
}

/* ----------------------------- Sous-composants ---------------------------- */

function ResetForm({
  resetEmail,
  onEmailChange,
  sending,
  sent,
  error,
  onSend,
  onBack,
}: {
  resetEmail: string;
  onEmailChange: (v: string) => void;
  sending: boolean;
  sent: boolean;
  error: string | null;
  onSend: () => void;
  onBack: () => void;
}) {
  return (
    <div>
      <div>
        <h2 className="font-headings text-xl! font-bold tracking-tight">Mot de passe oublié</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Saisissez votre email, nous vous envoyons un lien de réinitialisation.
        </p>
      </div>

      {sent ? (
        <div className="mt-6 flex items-start gap-3 rounded-xl border border-border bg-surface p-4">
          <CheckCircle2
            className="mt-0.5 size-4 shrink-0 text-[var(--success)]"
            aria-hidden="true"
          />
          <div className="text-sm leading-relaxed text-foreground">
            Si un compte existe pour cette adresse, un lien de réinitialisation
            vient d&apos;être envoyé.
          </div>
        </div>
      ) : (
        <form
          className="mt-6 flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            onSend();
          }}
        >
          <Field label="Email" htmlFor="reset-email" required>
            <Input
              id="reset-email"
              type="email"
              autoComplete="email"
              required
              value={resetEmail}
              onChange={(e) => onEmailChange(e.target.value)}
              className={inputClass}
            />
          </Field>

          <AuthAlert kind="error" message={error} />

          <button type="submit" disabled={sending} className={submitClass}>
            {sending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
            Envoyer le lien
          </button>

          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center justify-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/50"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Retour à la connexion
          </button>
        </form>
      )}
    </div>
  );
}

function Field({
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

function RevealButton({ shown, onToggle }: { shown: boolean; onToggle: () => void }) {
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

function AuthAlert({ kind, message }: { kind: "error" | "notice"; message: string | null }) {
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
        <span className="mt-0.5 size-1.5 shrink-0 rounded-full bg-[var(--error)]" aria-hidden="true" />
      ) : (
        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[var(--success)]" aria-hidden="true" />
      )}
      {message}
    </p>
  );
}
