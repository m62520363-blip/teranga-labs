"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowLeft,
  Briefcase,
  Building2,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  Store,
  UserRound,
} from "lucide-react";
import {
  clientSignupSchema,
  loginSchema,
  parseSkills,
  signupSchema,
  type ClientSignupFormValues,
  type LoginFormValues,
  type SignupFormValues,
} from "@/lib/validations";
import { SENEGAL_REGIONS } from "@/lib/tokens";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { PhoneOtpForm } from "@/components/phone-otp-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "cn";

type AuthMode = "login" | "signup";
type SignupRole = "developer" | "client";

type AuthInput = LoginFormValues &
  Partial<SignupFormValues> &
  Partial<ClientSignupFormValues> & { confirm_password?: string };

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

export function AuthCard({ initialMode = "login" }: { initialMode?: AuthMode }) {
  const [mode, setMode] = React.useState<AuthMode>(initialMode);
  const trackRef = React.useRef<HTMLDivElement>(null);

  return (
    <div
      className={cn(
        "overflow-hidden rounded-[1.75rem] border border-white/10 bg-surface/90 shadow-[0_50px_120px_-40px_rgba(0,0,0,0.9)] backdrop-blur-xl",
        "ring-1 ring-black/40"
      )}
    >
      <div
        ref={trackRef}
        className="flex w-[200%] will-change-transform transition-transform duration-[600ms] [transition-timing-function:var(--ease-spring)]"
        style={{ transform: mode === "login" ? "translateX(0)" : "translateX(-50%)" }}
        aria-live="polite"
      >
        <LoginPane
          active={mode === "login"}
          inert={mode !== "login"}
          onModeChange={() => setMode("signup")}
        />
        <SignupPane
          active={mode === "signup"}
          inert={mode !== "signup"}
          onModeChange={() => setMode("login")}
        />
      </div>
    </div>
  );
}

/* -------------------------------- LOGIN -------------------------------- */

function LoginPane({
  active,
  inert,
  onModeChange,
}: {
  active: boolean;
  inert: boolean;
  onModeChange: () => void;
}) {
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
    router.push(signupRole === "client" ? "/client" : "/dashboard");
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

  return (
    <section
      inert={inert ? true : undefined}
      aria-hidden={inert}
      className="grid min-w-0 w-1/2 md:grid-cols-2"
    >
      {/* Intro mobile compacte */}
      <div className="px-6 pt-8 md:hidden">
        <span className="chip gap-2 bg-card/80 border-hairline backdrop-blur">
          <span className="size-1.5 rounded-full bg-emerald-400" aria-hidden="true" />
          TERANGA LABS
        </span>
        <h2
          key={`mobile-login-${String(active)}`}
          className={cn("mt-3 text-3xl font-bold tracking-tight", active && "tl-blur-in")}
        >
          Bienvenue
          <br />
          à nouveau.
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Se connecter à votre espace TERANGA LABS.
        </p>
      </div>

      {/* Colonne formulaire */}
      <div className="order-2 p-6 sm:p-8 md:order-none md:p-10">
        <div
          key={`form-login-${String(active)}`}
          className={cn(active && "tl-slide-in-right")}
        >
          {resetMode ? (
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
          ) : usePhone ? (
            <PhoneOtpForm onBack={() => setUsePhone(false)} />
          ) : (
            <>
              <div>
                <h2 className="text-xl font-bold tracking-tight">Se connecter</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Reconnectez-vous en 10 secondes.
                </p>
              </div>

              <form
                onSubmit={handleSubmit(onSubmit)}
                className="mt-6 flex flex-col gap-4"
                noValidate
              >
                <Field error={errors.email?.message}>
                  <Label htmlFor="login-email">Email</Label>
                  <div className="relative">
                    <Mail
                      className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <Input
                      id="login-email"
                      type="email"
                      autoComplete="email"
                      {...register("email")}
                      className="h-11 rounded-xl border-hairline bg-background/70 pl-10 transition-[border-color,box-shadow] duration-200 focus-visible:border-primary/60 focus-visible:shadow-[0_0_0_3px_rgba(232,106,44,0.14)]"
                      placeholder="vous@exemple.com"
                      aria-invalid={Boolean(errors.email)}
                    />
                  </div>
                </Field>

                <Field error={errors.password?.message}>
                  <Label htmlFor="login-password">Mot de passe</Label>
                  <div className="relative">
                    <Lock
                      className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <Input
                      id="login-password"
                      type={showPw ? "text" : "password"}
                      autoComplete="current-password"
                      {...register("password")}
                      className="h-11 rounded-xl border-hairline bg-background/70 pl-10 pr-10 transition-[border-color,box-shadow] duration-200 focus-visible:border-primary/60 focus-visible:shadow-[0_0_0_3px_rgba(232,106,44,0.14)]"
                      placeholder="••••••••"
                      aria-invalid={Boolean(errors.password)}
                    />
                    <RevealButton shown={showPw} onToggle={() => setShowPw((v) => !v)} />
                  </div>
                </Field>

                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                    <ShieldCheck className="size-3.5 text-primary" aria-hidden="true" />
                    Session sécurisée de 30 jours
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setResetMode(true);
                      setFormError(null);
                    }}
                    className="text-xs font-medium text-muted-foreground underline-offset-4 transition-colors outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-primary/50"
                  >
                    Mot de passe oublié ?
                  </button>
                </div>

                <AuthAlert kind="error" message={formError} />
                <AuthAlert kind="notice" message={notice} />

                <button type="submit" disabled={isSubmitting} className="btn btn-primary btn-lg w-full">
                  {isSubmitting ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  ) : null}
                  {isSubmitting ? "Connexion en cours…" : "Se connecter"}
                </button>

                <div className="flex items-center gap-3" aria-hidden="true">
                  <span className="h-px flex-1 bg-hairline" />
                  <span className="text-xs text-muted-foreground">ou</span>
                  <span className="h-px flex-1 bg-hairline" />
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setUsePhone(true);
                    setFormError(null);
                  }}
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-hairline bg-background/70 text-sm font-medium transition-colors outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary/50"
                >
                  <Phone className="size-4 text-primary" aria-hidden="true" />
                  Recevoir un code par SMS
                </button>

                <p className="text-center text-sm text-muted-foreground">
                  Pas encore de compte ?{" "}
                  <button
                    type="button"
                    onClick={onModeChange}
                    className="font-semibold text-primary underline-offset-4 outline-none hover:text-primary-light hover:underline focus-visible:ring-2 focus-visible:ring-primary/50"
                  >
                    Créer un compte
                  </button>
                </p>
              </form>
            </>
          )}
        </div>
      </div>

      <VisualPanel mode="login" active={active} />
    </section>
  );
}

/* -------------------------------- SIGN UP ------------------------------- */

function SignupPane({
  active,
  inert,
  onModeChange,
}: {
  active: boolean;
  inert: boolean;
  onModeChange: () => void;
}) {
  const router = useRouter();
  const [formError, setFormError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [role, setRole] = React.useState<SignupRole>("developer");
  const [showPw, setShowPw] = React.useState(false);
  const [showConfirm, setShowConfirm] = React.useState(false);

  const resolver = (() => {
    if (role === "client") return zodResolver(clientSignupSchema);
    return zodResolver(signupSchema);
  })() as Resolver<AuthInput>;

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
          }
        : {
            full_name: "",
            email: "",
            password: "",
            confirm_password: "",
            whatsapp: "",
            skills: "",
          },
  });

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = form;

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
    <section
      inert={inert ? true : undefined}
      aria-hidden={inert}
      className="grid min-w-0 w-1/2 md:grid-cols-2"
    >
      {/* Intro mobile compacte */}
      <div className="px-6 pt-8 md:hidden">
        <span className="chip gap-2 bg-card/80 border-hairline backdrop-blur">
          <span className="size-1.5 rounded-full bg-emerald-400" aria-hidden="true" />
          TERANGA LABS
        </span>
        <h2
          key={`mobile-signup-${String(active)}`}
          className={cn("mt-3 text-3xl font-bold tracking-tight", active && "tl-blur-in")}
        >
          Bienvenue
          <br />
          parmi nous.
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Créez votre compte client ou développeur.
        </p>
      </div>

      {/* Panneau visuel (miroir : les panneaux permutent) */}
      <div className="hidden md:block md:order-first">
        <VisualPanel mode="signup" active={active} />
      </div>

      {/* Colonne formulaire */}
      <div className="order-2 p-6 sm:p-8 md:order-none md:p-10">
        <div
          key={`form-signup-${String(active)}`}
          className={cn(active && "tl-slide-in-right")}
        >
          <div>
            <h2 className="text-xl font-bold tracking-tight">Créer un compte</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Choisissez votre rôle. Gratuit à la création.
            </p>
          </div>

          <form
            onSubmit={handleSubmit(onSubmit)}
            className="mt-6 flex flex-col gap-4"
            noValidate
          >
            <div>
              <Label>Vous êtes…</Label>
              <div className="mt-2 grid grid-cols-2 gap-3">
                <RoleCard
                  selected={role === "client"}
                  onSelect={() => setRole("client")}
                  icon={<Store className="size-4" aria-hidden="true" />}
                  title="Client"
                  hint="Je cherche un développeur"
                />
                <RoleCard
                  selected={role === "developer"}
                  onSelect={() => setRole("developer")}
                  icon={<Briefcase className="size-4" aria-hidden="true" />}
                  title="Développeur"
                  hint="Je réponds aux briefs"
                />
              </div>
            </div>

            <Field error={errors.full_name?.message}>
              <Label htmlFor="signup-name">
                {role === "client" ? "Votre nom" : "Nom complet"}
              </Label>
              <div className="relative">
                <UserRound
                  className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  id="signup-name"
                  {...register("full_name")}
                  autoComplete="name"
                  className="h-11 rounded-xl border-hairline bg-background/70 pl-10 transition-[border-color,box-shadow] duration-200 focus-visible:border-primary/60 focus-visible:shadow-[0_0_0_3px_rgba(232,106,44,0.14)]"
                  placeholder={role === "client" ? "Awa Ndiaye" : "Awa Diop"}
                  aria-invalid={Boolean(errors.full_name)}
                />
              </div>
            </Field>

            {role === "client" && (
              <Field error={errors.company_name?.message}>
                <Label htmlFor="signup-company">Nom de votre structure (optionnel)</Label>
                <div className="relative">
                  <Building2
                    className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <Input
                    id="signup-company"
                    {...register("company_name")}
                    autoComplete="organization"
                    className="h-11 rounded-xl border-hairline bg-background/70 pl-10 transition-[border-color,box-shadow] duration-200 focus-visible:border-primary/60 focus-visible:shadow-[0_0_0_3px_rgba(232,106,44,0.14)]"
                    placeholder="Boutique Bazin HLM"
                    aria-invalid={Boolean(errors.company_name)}
                  />
                </div>
              </Field>
            )}

            {role === "client" && (
              <Field error={errors.city?.message}>
                <Label htmlFor="signup-city">Région</Label>
                <div className="relative">
                  <MapPin
                    className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <Select
                    value={(watch("city") as string) ?? ""}
                    onValueChange={(v) =>
                      v && setValue("city", v as ClientSignupFormValues["city"], { shouldValidate: true })
                    }
                    items={Object.fromEntries(SENEGAL_REGIONS.map((c) => [c, c]))}
                  >
                    <SelectTrigger
                      id="signup-city"
                      className="h-11 w-full rounded-xl border-hairline bg-background/70 pl-10 transition-[border-color,box-shadow] duration-200 focus-visible:border-primary/60 focus-visible:shadow-[0_0_0_3px_rgba(232,106,44,0.14)]"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent align="start">
                      {SENEGAL_REGIONS.map((city) => (
                        <SelectItem key={city} value={city}>
                          {city}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </Field>
            )}

            <Field error={errors.email?.message}>
              <Label htmlFor="signup-email">Email</Label>
              <div className="relative">
                <Mail
                  className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  id="signup-email"
                  type="email"
                  {...register("email")}
                  autoComplete="email"
                  className="h-11 rounded-xl border-hairline bg-background/70 pl-10 transition-[border-color,box-shadow] duration-200 focus-visible:border-primary/60 focus-visible:shadow-[0_0_0_3px_rgba(232,106,44,0.14)]"
                  placeholder="vous@exemple.com"
                  aria-invalid={Boolean(errors.email)}
                />
              </div>
            </Field>

            <Field error={errors.password?.message}>
              <Label htmlFor="signup-password">Mot de passe</Label>
              <div className="relative">
                <Lock
                  className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  id="signup-password"
                  type={showPw ? "text" : "password"}
                  {...register("password")}
                  autoComplete="new-password"
                  className="h-11 rounded-xl border-hairline bg-background/70 pl-10 pr-10 transition-[border-color,box-shadow] duration-200 focus-visible:border-primary/60 focus-visible:shadow-[0_0_0_3px_rgba(232,106,44,0.14)]"
                  placeholder="••••••••"
                  aria-invalid={Boolean(errors.password)}
                />
                <RevealButton shown={showPw} onToggle={() => setShowPw((v) => !v)} />
              </div>
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
            </Field>

            <Field error={errors.confirm_password?.message}>
              <Label htmlFor="signup-confirm">Confirmer le mot de passe</Label>
              <div className="relative">
                <Lock
                  className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  id="signup-confirm"
                  type={showConfirm ? "text" : "password"}
                  {...register("confirm_password", {
                    validate: (v) => !v || v === watch("password") || "Les mots de passe ne correspondent pas.",
                  })}
                  autoComplete="new-password"
                  className="h-11 rounded-xl border-hairline bg-background/70 pl-10 pr-10 transition-[border-color,box-shadow] duration-200 focus-visible:border-primary/60 focus-visible:shadow-[0_0_0_3px_rgba(232,106,44,0.14)]"
                  placeholder="••••••••"
                  aria-invalid={Boolean(errors.confirm_password)}
                />
                <RevealButton shown={showConfirm} onToggle={() => setShowConfirm((v) => !v)} />
              </div>
            </Field>

            <Field error={errors.whatsapp?.message}>
              <Label htmlFor="signup-whatsapp">
                {role === "client" ? "WhatsApp (optionnel)" : "WhatsApp"}
              </Label>
              <div className="relative">
                <Phone
                  className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  id="signup-whatsapp"
                  type="tel"
                  {...register("whatsapp")}
                  autoComplete="tel"
                  className="h-11 rounded-xl border-hairline bg-background/70 pl-10 transition-[border-color,box-shadow] duration-200 focus-visible:border-primary/60 focus-visible:shadow-[0_0_0_3px_rgba(232,106,44,0.14)]"
                  placeholder="+221 7X XX XX XX"
                  aria-invalid={Boolean(errors.whatsapp)}
                />
              </div>
            </Field>

            {role === "developer" && (
              <Field error={errors.skills?.message}>
                <Label htmlFor="signup-skills">Compétences (séparées par des virgules)</Label>
                <Input
                  id="signup-skills"
                  {...register("skills")}
                  className="h-11 rounded-xl border-hairline bg-background/70 transition-[border-color,box-shadow] duration-200 focus-visible:border-primary/60 focus-visible:shadow-[0_0_0_3px_rgba(232,106,44,0.14)]"
                  placeholder="Next.js, Supabase, UI/UX"
                />
              </Field>
            )}

            <AuthAlert kind="error" message={formError} />
            <AuthAlert kind="notice" message={notice} />

            <button type="submit" disabled={isSubmitting} className="btn btn-primary btn-lg w-full">
              {isSubmitting ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : null}
              {isSubmitting ? "Création du compte…" : "Créer mon compte"}
            </button>

            <p className="text-center text-sm text-muted-foreground">
              Déjà inscrit ?{" "}
              <button
                type="button"
                onClick={onModeChange}
                className="font-semibold text-primary underline-offset-4 outline-none hover:text-primary-light hover:underline focus-visible:ring-2 focus-visible:ring-primary/50"
              >
                Se connecter
              </button>
            </p>
          </form>
        </div>
      </div>
    </section>
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
        <h2 className="text-xl font-bold tracking-tight">Mot de passe oublié</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Saisissez votre email, nous vous envoyons un lien de réinitialisation.
        </p>
      </div>

      {sent ? (
        <div className="mt-6 flex items-start gap-3 rounded-xl border border-hairline bg-muted p-4">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[var(--success)]" aria-hidden="true" />
          <div className="text-sm leading-relaxed text-foreground">
            Si un compte existe pour cette adresse, un lien de réinitialisation
            vient d’être envoyé.
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
          <Field error={null}>
            <Label htmlFor="reset-email">Email</Label>
            <div className="relative">
              <Mail
                className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                id="reset-email"
                type="email"
                autoComplete="email"
                required
                value={resetEmail}
                onChange={(e) => onEmailChange(e.target.value)}
                className="h-11 rounded-xl border-hairline bg-background/70 pl-10 transition-[border-color,box-shadow] duration-200 focus-visible:border-primary/60 focus-visible:shadow-[0_0_0_3px_rgba(232,106,44,0.14)]"
                placeholder="vous@exemple.com"
              />
            </div>
          </Field>

          <AuthAlert kind="error" message={error} />

          <button type="submit" disabled={sending} className="btn btn-primary btn-lg w-full">
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

function VisualPanel({ mode, active }: { mode: AuthMode; active: boolean }) {
  const isLogin = mode === "login";
  return (
    <aside
      className="tl-grain relative hidden min-h-full overflow-hidden md:flex md:flex-col md:justify-center md:px-12"
      aria-hidden="true"
    >
      {/* fond sombre vert/noir émeraude */}
      <div className="absolute inset-0 bg-[radial-gradient(120%_120%_at_85%_15%,#0b3b2a_0%,#05231a_38%,#030d0a_72%,#010603_100%)]" />
      <div className="absolute -right-16 -top-16 size-64 rounded-full bg-emerald-500/15 blur-3xl" />
      <div className="absolute -bottom-20 -left-16 size-72 rounded-full bg-emerald-400/10 blur-3xl" />
      <div className="absolute inset-0 opacity-[0.35] [background-image:linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] [background-size:44px_44px] [mask-image:radial-gradient(80%_80%_at_50%_40%,black,transparent)]" />

      <div key={`visual-${mode}-${String(active)}`} className="relative">
        <span className="chip gap-2 border-emerald-300/15 bg-emerald-500/10 text-emerald-200">
          <span className="size-1.5 rounded-full bg-emerald-400" aria-hidden="true" />
          TERANGA LABS
        </span>
        <h2
          className={cn(
            "mt-5 text-4xl font-bold leading-[1.05] tracking-tight text-white",
            active && "tl-blur-in"
          )}
        >
          {isLogin ? (
            <>
              Bon
              <br />
              retour.
            </>
          ) : (
            <>
              Bien
              <br />
              arrivé.
            </>
          )}
        </h2>
        <p className="mt-4 max-w-xs text-sm leading-relaxed text-emerald-100/60">
          {isLogin
            ? "Votre espace client ou développeur vous attend. Publiez un brief, débloquez un contact."
            : "Créez votre compte. 1 Token pour publier votre besoin, 1 Token pour ouvrir la discussion."}
        </p>
        <ul className="mt-7 space-y-2.5 text-sm text-emerald-50/80">
          {["Zéro commission sur les projets", "Messages privés en direct", "2 500 F par Token"].map((f) => (
            <li key={f} className="flex items-center gap-2.5">
              <CheckCircle2 className="size-4 shrink-0 text-emerald-400" aria-hidden="true" />
              {f}
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}

function RoleCard({
  selected,
  onSelect,
  icon,
  title,
  hint,
}: {
  selected: boolean;
  onSelect: () => void;
  icon: React.ReactNode;
  title: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "flex flex-col items-start gap-2 rounded-2xl border p-4 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
        selected
          ? "border-primary/60 bg-primary-soft"
          : "border-hairline bg-card hover:bg-muted"
      )}
    >
      <span
        className={cn(
          "flex size-8 items-center justify-center rounded-lg",
          selected ? "bg-primary text-ink" : "bg-hairline text-foreground"
        )}
      >
        {icon}
      </span>
      <span className="text-sm font-semibold">{title}</span>
      <span className="text-xs leading-relaxed text-muted-foreground">{hint}</span>
    </button>
  );
}

function Field({ error, children }: { error?: string | null; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      {children}
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function RevealButton({ shown, onToggle }: { shown: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="absolute right-2 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/50"
      aria-label={shown ? "Masquer le mot de passe" : "Afficher le mot de passe"}
    >
      {shown ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
    </button>
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
          : "border-hairline bg-muted text-foreground"
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