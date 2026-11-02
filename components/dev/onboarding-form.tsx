"use client";

import * as React from "react";
import Link from "next/link";
import { useForm, useFieldArray, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Briefcase,
  Check,
  CheckCircle2,
  Loader2,
  Mail,
  MapPin,
  Plus,
  Send,
  Trash2,
  Upload,
  UserRound,
  X,
} from "lucide-react";
import {
  developerApplicationSchema,
  developerIdentitySchema,
  type DeveloperApplicationFormValues,
  type DeveloperIdentityFormValues,
} from "@/lib/validations";
import {
  AVAILABILITY_OPTIONS,
  DEVELOPER_SERVICES,
  EXPERIENCE_LEVELS,
  LINK_KINDS,
  PROJECT_TYPES,
} from "@/lib/tokens";
import {
  findWorldCountryByName,
  getWorldRegions,
  WORLD_COUNTRIES,
} from "@/lib/world-countries";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/ui/phone-input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "cn";

export type OnboardingData = {
  first_name?: string | null;
  last_name?: string | null;
  username?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  avatar_url?: string | null;
  bio?: string | null;
  skills?: string[] | null;
  languages?: string[] | null;
  experience_years?: number | null;
  status?: string | null;
  is_verified?: boolean | null;
  rejection_reason?: string | null;
  professional_title?: string | null;
  main_specialty?: string | null;
  availability?: string | null;
  rate_min_fcfa?: number | null;
  rate_max_fcfa?: number | null;
  projects_estimate?: number | null;
  experience_level?: string | null;
  services?: string[] | null;
  projects?: {
    id?: string;
    name?: string | null;
    description?: string | null;
    project_type?: string | null;
    technologies?: string[] | null;
    url?: string | null;
    screenshots?: string[] | null;
    role?: string | null;
  }[];
  documents?: {
    id?: string;
    kind?: string | null;
    name?: string | null;
    url?: string | null;
  }[];
  links?: {
    id?: string;
    kind?: string | null;
    label?: string | null;
    url?: string | null;
  }[];
  application?: {
    id?: string;
    status?: string | null;
    admin_message?: string | null;
    reviewed_at?: string | null;
    submitted_at?: string | null;
  } | null;
};

const SPECIALTY_SUGGESTIONS = [
  "Développeur web",
  "Full-stack",
  "Développeur mobile",
  "Intégrateur web",
  "Designer UI/UX",
  "E-commerce / Shopify / WooCommerce",
  "WordPress",
  "Chef de projet digital",
  "Rédacteur web & SEO",
];

/* Pays : value = nom français (c'est ce que stocke `developers.country`
   et ce que groupe le classement pays). Région : liste curée du pays choisi
   (périmètre ou référentiel monde), sinon champ libre — inscription ouverte
   au monde entier, sans exception. */
const COUNTRY_NAME_ITEMS: Record<string, string> = Object.fromEntries(
  WORLD_COUNTRIES.map((c) => [c.nameFr, c.nameFr])
);

export function OnboardingForm({
  initial,
  email,
  userId,
}: {
  initial: OnboardingData | null;
  email: string;
  userId: string;
}) {
  const [step, setStep] = React.useState<1 | 2>(1);
  const [submitted, setSubmitted] = React.useState(false);

  if (submitted) {
    return <SuccessPanel />;
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      <Stepper step={step} />

      {initial?.status === "changes_requested" || initial?.status === "rejected" ? (
        <div className="mt-6 flex items-start gap-3 rounded-2xl border border-warning/30 bg-primary-soft p-5">
          <span className="mt-1 size-2 shrink-0 rounded-full bg-warning" aria-hidden="true" />
          <div className="min-w-0 text-sm leading-relaxed">
            <p className="font-semibold">
              {initial.status === "changes_requested"
                ? "Notre équipe demande des modifications sur votre dossier"
                : "Votre inscription a été refusée"}
            </p>
            {initial.rejection_reason ? (
              <p className="mt-1 text-muted-foreground">{initial.rejection_reason}</p>
            ) : (
              <p className="mt-1 text-muted-foreground">
                Merci de corriger les informations ci-dessous puis de soumettre à nouveau.
              </p>
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              Toute nouvelle soumission repasse en attente d’approbation.
            </p>
          </div>
        </div>
      ) : null}

      <div className="mt-6">
        {step === 1 ? (
          <IdentityStep
            initial={initial}
            email={email}
            userId={userId}
            onContinue={() => setStep(2)}
          />
        ) : (
          <ProfessionalStep
            initial={initial}
            onBack={() => setStep(1)}
            onDone={() => setSubmitted(true)}
          />
        )}
      </div>
    </div>
  );
}

function Stepper({ step }: { step: 1 | 2 }) {
  const steps = [
    { n: 1, label: "Identité & coordonnées" },
    { n: 2, label: "Profil professionnel" },
  ];
  return (
    <ol className="flex items-center gap-3" aria-label="Avancement de l’inscription">
      {steps.map((s, i) => (
        <React.Fragment key={s.n}>
          <li className="flex items-center gap-2.5">
            <span
              className={cn(
                "flex size-8 items-center justify-center rounded-full border text-sm font-semibold transition-colors",
                step >= s.n
                  ? "border-primary bg-primary text-ink"
                  : "border-hairline bg-card text-muted-foreground"
              )}
              aria-current={step === s.n ? "step" : undefined}
            >
              {step > s.n ? (
                <Check className="size-4" aria-hidden="true" />
              ) : (
                s.n
              )}
            </span>
            <span
              className={cn(
                "hidden text-sm font-medium sm:block",
                step >= s.n ? "text-foreground" : "text-muted-foreground"
              )}
            >
              {s.label}
            </span>
          </li>
          {i < steps.length - 1 ? (
            <span
              className={cn(
                "h-px flex-1",
                step > s.n ? "bg-primary" : "bg-hairline"
              )}
              aria-hidden="true"
            />
          ) : null}
        </React.Fragment>
      ))}
    </ol>
  );
}

/* ------------------------------- ETAPE 1 ------------------------------ */

function IdentityStep({
  initial,
  email,
  userId,
  onContinue,
}: {
  initial: OnboardingData | null;
  email: string;
  userId: string;
  onContinue: () => void;
}) {
  const [formError, setFormError] = React.useState<string | null>(null);
  const [checkingUsername, setCheckingUsername] = React.useState(false);

  const form = useForm<DeveloperIdentityFormValues>({
    resolver: zodResolver(developerIdentitySchema) as Resolver<DeveloperIdentityFormValues>,
    mode: "onChange",
    defaultValues: {
      first_name: initial?.first_name ?? "",
      last_name: initial?.last_name ?? "",
      username: (initial?.username ?? "").toLowerCase(),
      phone: initial?.phone ?? "",
      whatsapp: initial?.whatsapp ?? "",
      address: initial?.address ?? "",
      country: initial?.country ?? "Sénégal",
      city: (initial?.city as DeveloperIdentityFormValues["city"]) ?? "Dakar",
      languages: initial?.languages ?? [],
    },
  });

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    getValues,
    formState: { errors, isSubmitting },
  } = form;

  /* Pays choisi → ISO2 → régions (périmètre lu dans lib/countries). */
  const countryName = (watch("country") as string) ?? "";
  const worldIso2 = findWorldCountryByName(countryName)?.iso2 ?? null;
  const worldRegions = getWorldRegions(worldIso2);
  const cityValue = (watch("city") as string) ?? "";
  /* Ville legacy hors liste (profil déjà rempli hors curé) → champ libre,
     pour ne jamais afficher un Select vide qui masquerait la valeur. */
  const showCitySelect =
    worldRegions.length > 0 && (cityValue === "" || worldRegions.includes(cityValue));
  const cityItems: Record<string, string> = Object.fromEntries(
    worldRegions.map((n) => [n, n])
  );

  const onSubmit = async (values: DeveloperIdentityFormValues) => {
    if (!isSupabaseConfigured()) {
      setFormError("Configuration Supabase manquante.");
      return;
    }
    setFormError(null);
    const supabase = createClient();

    const { data: taken } = await supabase.rpc("is_username_taken", {
      p_username: values.username,
    });
    if (taken) {
      setFormError("Ce pseudo est déjà utilisé par un autre profil. Choisissez-en un autre.");
      return;
    }

    const baseUpdate = {
      first_name: values.first_name.trim(),
      last_name: values.last_name.trim(),
      username: values.username.trim().toLowerCase(),
      phone: values.phone.trim() || null,
      whatsapp: values.whatsapp.trim(),
      address: values.address.trim() || null,
      country: values.country.trim(),
      city: values.city,
    };

    let { error } = await supabase
      .from("developers")
      .update({ ...baseUpdate, languages: values.languages })
      .eq("id", userId);

    if (
      error &&
      (error.code === "PGRST204" ||
        error.code === "42703" ||
        error.message?.includes("languages"))
    ) {
      toast.info(
        "Langues non enregistrées (migration en attente) — vos autres informations sont sauvegardées."
      );
      ({ error } = await supabase.from("developers").update(baseUpdate).eq("id", userId));
    }

    if (error) {
      if (error.message?.includes("developers_username_uidx")) {
        setFormError("Ce pseudo est déjà utilisé par un autre profil. Choisissez-en un autre.");
      } else {
        setFormError("Impossible d’enregistrer vos informations. Réessayez.");
      }
      return;
    }
    onContinue();
  };

  const availableSoon = async () => {
    setCheckingUsername(true);
    setFormError(null);
    const supabase = createClient();
    const username = (getValues("username") ?? "").trim().toLowerCase();
    if (!username || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(username)) {
      setCheckingUsername(false);
      setFormError("Renseignez d’abord un pseudo valide (minuscules, chiffres, tirets).");
      return;
    }
    const { data: taken } = await supabase.rpc("is_username_taken", {
      p_username: username,
    });
    setCheckingUsername(false);
    if (taken) {
      setFormError("Ce pseudo est déjà utilisé par un autre profil. Choisissez-en un autre.");
    } else {
      toast.success("Ce pseudo est disponible.");
    }
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="rounded-2xl border border-hairline bg-card p-6 shadow-sm sm:p-8"
      noValidate
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Qui êtes-vous ?</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Ces informations restent privées ; seul votre pseudo apparaît sur votre fiche publique.
          </p>
        </div>
        <span className="chip shrink-0 gap-1.5 border-hairline bg-surface">
          <Mail className="size-3.5 text-muted-foreground" aria-hidden="true" />
          {email}
        </span>
      </div>

      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <Field label="Prénom" error={errors.first_name?.message} htmlFor="oi-first">
          <div className="relative">
            <UserRound
              className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              id="oi-first"
              autoComplete="given-name"
              {...register("first_name")}
              className="h-11 rounded-xl border-hairline bg-background/70 pl-10"
              placeholder="Awa"
              aria-invalid={Boolean(errors.first_name)}
            />
          </div>
        </Field>

        <Field label="Nom" error={errors.last_name?.message} htmlFor="oi-last">
          <div className="relative">
            <UserRound
              className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              id="oi-last"
              autoComplete="family-name"
              {...register("last_name")}
              className="h-11 rounded-xl border-hairline bg-background/70 pl-10"
              placeholder="Diop"
              aria-invalid={Boolean(errors.last_name)}
            />
          </div>
        </Field>

        <Field
          label="Pseudo public"
          error={errors.username?.message}
          htmlFor="oi-username"
          hint="Ex : awa-diop. Visible sur /dev/awa-diop."
        >
          <div className="relative">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              @
            </span>
            <Input
              id="oi-username"
              autoComplete="off"
              spellCheck={false}
              {...register("username")}
              className="h-11 rounded-xl border-hairline bg-background/70 pl-3"
              placeholder="awa-diop"
              aria-invalid={Boolean(errors.username)}
            />
          </div>
          <button
            type="button"
            onClick={availableSoon}
            disabled={checkingUsername}
            className="text-xs font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary/50"
          >
            {checkingUsername ? "Vérification…" : "Vérifier la disponibilité"}
          </button>
        </Field>

        <Field label="Téléphone" error={errors.phone?.message} htmlFor="oi-phone">
          <PhoneInput
            id="oi-phone"
            value={(watch("phone") as string) ?? ""}
            onChange={(v) =>
              setValue("phone", v, { shouldValidate: true, shouldDirty: true })
            }
            autoComplete="tel"
            className="h-11 rounded-xl border-hairline bg-background/70"
            aria-invalid={Boolean(errors.phone)}
          />
        </Field>

        <Field label="WhatsApp" error={errors.whatsapp?.message} htmlFor="oi-whatsapp">
          <PhoneInput
            id="oi-whatsapp"
            value={(watch("whatsapp") as string) ?? ""}
            onChange={(v) =>
              setValue("whatsapp", v, { shouldValidate: true, shouldDirty: true })
            }
            autoComplete="tel"
            className="h-11 rounded-xl border-hairline bg-background/70"
            aria-invalid={Boolean(errors.whatsapp)}
          />
        </Field>

        <Field label="Pays" error={errors.country?.message} htmlFor="oi-country">
          <div className="relative">
            <MapPin
              className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Select
              value={(watch("country") as string) ?? ""}
              onValueChange={(v) => {
                if (!v || v === (watch("country") as string)) return;
                setValue("country", v, { shouldValidate: true, shouldDirty: true });
                setValue("city", "", { shouldValidate: true });
              }}
              items={COUNTRY_NAME_ITEMS}
            >
              <SelectTrigger
                id="oi-country"
                className="h-11 w-full rounded-xl border-hairline bg-background/70 pl-10 data-[size=default]:h-11"
              >
                <SelectValue placeholder="Choisir un pays" />
              </SelectTrigger>
              <SelectContent align="start" className="max-h-80">
                {WORLD_COUNTRIES.map((c) => (
                  <SelectItem key={c.iso2} value={c.nameFr}>
                    {c.nameFr}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </Field>

        {showCitySelect ? (
          <Field label="Région" error={errors.city?.message} htmlFor="oi-city">
            <div className="relative">
              <MapPin
                className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Select
                value={cityValue}
                onValueChange={(v) =>
                  v && setValue("city", v as DeveloperIdentityFormValues["city"], { shouldValidate: true })
                }
                items={cityItems}
              >
                <SelectTrigger
                  id="oi-city"
                  className="h-11 w-full rounded-xl border-hairline bg-background/70 pl-10 data-[size=default]:h-11"
                >
                  <SelectValue placeholder="Choisir une région" />
                </SelectTrigger>
                <SelectContent align="start" className="max-h-72">
                  {worldRegions.map((name) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </Field>
        ) : (
          <Field label="Ville / région" error={errors.city?.message} htmlFor="oi-city">
            <div className="relative">
              <MapPin
                className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                id="oi-city"
                autoComplete="address-level2"
                placeholder="Ex. Austin, Montréal, Nairobi…"
                {...register("city")}
                className="h-11 rounded-xl border-hairline bg-background/70 pl-10"
                aria-invalid={Boolean(errors.city)}
              />
            </div>
          </Field>
        )}

        <Field label="Adresse" error={errors.address?.message} htmlFor="oi-address">
          <div className="relative">
            <MapPin
              className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              id="oi-address"
              autoComplete="street-address"
              {...register("address")}
              className="h-11 rounded-xl border-hairline bg-background/70 pl-10"
              placeholder="Scat Urbam, Parcelles Assainies…(optionnel)"
              aria-invalid={Boolean(errors.address)}
            />
          </div>
        </Field>

        <div className="sm:col-span-2">
          <Field
            label="Langues parlées"
            error={errors.languages?.message}
            hint="Ex : Français, Anglais, Wolof… (10 maximum)"
          >
            <TagListInput
              values={watch("languages") ?? []}
              onChange={(next) => setValue("languages", next, { shouldValidate: true })}
              placeholder="Français, Anglais…"
              max={10}
            />
          </Field>
        </div>
      </div>

      {formError ? (
        <p role="alert" className="mt-5 flex items-start gap-2 rounded-xl border border-[var(--error)]/30 bg-[var(--error-soft)] px-4 py-3 text-sm leading-relaxed text-[var(--error)]">
          <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[var(--error)]" aria-hidden="true" />
          {formError}
        </p>
      ) : null}

      <div className="mt-7 flex items-center justify-between gap-3">
        <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/50">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Plus tard
        </Link>
        <button type="submit" disabled={isSubmitting} className="btn btn-primary">
          {isSubmitting ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <ArrowRight className="size-4" aria-hidden="true" />
          )}
          Continuer
        </button>
      </div>
    </form>
  );
}

/* ------------------------------- ETAPE 2 ------------------------------ */

function ProfessionalStep({
  initial,
  onBack,
  onDone,
}: {
  initial: OnboardingData | null;
  onBack: () => void;
  onDone: () => void;
}) {
  const [formError, setFormError] = React.useState<string | null>(null);
  const [skillInput, setSkillInput] = React.useState("");

  const uploadImage = async (file: File, onUrl: (url: string) => void) => {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Format accepté : JPG, PNG ou WebP.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image trop lourde (2 Mo max).");
      return;
    }
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/profile/avatar", {
        method: "POST",
        body: fd,
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        url?: string;
        message?: string;
      };
      if (!res.ok || !json.url) {
        toast.error(
          json.message ??
            "Téléversement indisponible — renseignez une URL."
        );
        return;
      }
      onUrl(json.url);
    } catch {
      toast.error("Téléversement indisponible — renseignez une URL.");
    }
  };

  const defaultProjects =
    initial?.projects?.map((p) => ({
      name: p.name ?? "",
      description: p.description ?? "",
      project_type: p.project_type ?? "",
      technologies: p.technologies ?? [],
      url: p.url ?? "",
      screenshots: p.screenshots ?? [],
      role: p.role ?? "",
    })) ?? [];
  const defaultDocuments =
    initial?.documents
      ?.map((d) => ({
        kind: ((d.kind as "cv" | "professional" | "other") ??
          "other") as DeveloperApplicationFormValues["documents"][number]["kind"],
        name: d.name ?? "",
        url: d.url ?? "",
      }))
      .filter((d) => d.url.trim().length > 0) ?? [];
  const defaultLinks =
    initial?.links
      ?.map((l) => ({
        kind: ((l.kind as "github" | "linkedin" | "other") ??
          "other") as DeveloperApplicationFormValues["links"][number]["kind"],
        label: l.label ?? "",
        url: l.url ?? "",
      }))
      .filter((l) => l.url.trim().length > 0) ?? [];

  const form = useForm<DeveloperApplicationFormValues>({
    resolver: zodResolver(developerApplicationSchema) as Resolver<DeveloperApplicationFormValues>,
    mode: "onChange",
    defaultValues: {
      professional_title: initial?.professional_title ?? "",
      main_specialty: initial?.main_specialty ?? "",
      experience_level: (initial?.experience_level as DeveloperApplicationFormValues["experience_level"]) ?? "intermediaire",
      experience_years: initial?.experience_years ?? 0,
      projects_estimate: initial?.projects_estimate ?? 0,
      availability: (initial?.availability as DeveloperApplicationFormValues["availability"]) ?? "available_now",
      rate_min_fcfa: initial?.rate_min_fcfa ?? 0,
      rate_max_fcfa: initial?.rate_max_fcfa ?? 0,
      bio: initial?.bio ?? "",
      avatar_url: initial?.avatar_url ?? "",
      services: (initial?.services?.length
        ? initial.services
        : DEVELOPER_SERVICES.slice(0, 2).map((s) => s)) as string[],
      skills: initial?.skills ?? [],
      projects: defaultProjects,
      documents: defaultDocuments,
      links: defaultLinks,
      terms_accepted: false as unknown as true,
    },
  });

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    getValues,
    control,
    formState: { errors, isSubmitting },
  } = form;

  const { fields: projectFields, ...projectArray } = useFieldArray({
    control,
    name: "projects",
  });
  const { fields: linkFields, ...linkArray } = useFieldArray({
    control,
    name: "links",
  });

  const skills = watch("skills");
  const services = watch("services");

  const toggleService = (label: string) => {
    const next = services.includes(label)
      ? services.filter((s) => s !== label)
      : [...services, label];
    setValue("services", next, { shouldValidate: true });
  };

  const addSkill = () => {
    const raw = skillInput.trim();
    if (!raw) return;
    const parts = raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .filter((s) => !skills.includes(s))
      .slice(0, 24);
    if (parts.length === 0) return;
    setValue("skills", [...skills, ...parts], { shouldValidate: true });
    setSkillInput("");
  };

  const removeSkill = (skill: string) => {
    setValue(
      "skills",
      skills.filter((s) => s !== skill),
      { shouldValidate: true }
    );
  };

  const onSubmit = async (values: DeveloperApplicationFormValues) => {
    if (!isSupabaseConfigured()) {
      setFormError("Configuration Supabase manquante.");
      return;
    }
    setFormError(null);
    const supabase = createClient();
    const payload = {
      professional_title: values.professional_title,
      main_specialty: values.main_specialty,
      bio: values.bio || null,
      avatar_url: values.avatar_url || null,
      experience_level: values.experience_level,
      experience_years: values.experience_years,
      projects_estimate: values.projects_estimate,
      availability: values.availability,
      rate_min_fcfa: values.rate_min_fcfa,
      rate_max_fcfa: values.rate_max_fcfa,
      terms_accepted: true,
      services: values.services,
      skills: values.skills,
      projects: values.projects
        .filter((p) => p.name.trim())
        .map((p) => ({
          name: p.name,
          description: p.description || null,
          project_type: p.project_type || null,
          technologies: p.technologies,
          url: p.url || null,
          screenshots: p.screenshots,
          role: p.role || null,
        })),
      documents: values.documents.filter((d) => d.url.trim()),
      links: values.links.filter((l) => l.url.trim()),
    };

    const { data, error } = await supabase.rpc("submit_developer_application", {
      p_payload: payload,
    });

    if (error) {
      setFormError(translateSubmitError(error.code ?? "", error.message));
      return;
    }
    if (!data || data.ok !== true) {
      setFormError("L’envoi a échoué. Réessayez dans un instant.");
      return;
    }

    // Attribution du code de parrainage (?ref= ou sessionStorage) maintenant
    // que le dossier développeur existe en base.
    try {
      const urlRef = new URLSearchParams(window.location.search).get("ref");
      const storedRef = window.sessionStorage.getItem("tl-dev-referral-code");
      const refCode = (urlRef || storedRef || "").trim().toUpperCase();
      if (refCode) {
        await supabase.rpc("attribute_referral", { p_code: refCode });
        window.sessionStorage.removeItem("tl-dev-referral-code");
      }
    } catch {
      /* échec non bloquant de l'attribution de parrainage */
    }

    try {
      await fetch("/api/dev/activate", { method: "POST" });
    } catch {
      /* activation non bloquante */
    }

    toast.success("Profil développeur activé !");
    onDone();
  };

  const rateMin = watch("rate_min_fcfa");
  const rateMax = watch("rate_max_fcfa");
  const hasRate = Number(rateMin) > 0 || Number(rateMax) > 0;

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="flex flex-col gap-6"
      noValidate
    >
      {/* Socle professionnel */}
      <section className="rounded-2xl border border-hairline bg-card p-6 shadow-sm sm:p-8">
        <h2 className="text-lg font-semibold tracking-tight">Votre profil professionnel</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Ce que les clients voient lorsqu’ils reçoivent vos candidatures.
        </p>

        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Titre professionnel" error={errors.professional_title?.message} htmlFor="oi-title">
              <Input
                id="oi-title"
                {...register("professional_title")}
                className="h-11 rounded-xl border-hairline bg-background/70"
                placeholder="Développeur full-stack, spécialiste Next.js"
                aria-invalid={Boolean(errors.professional_title)}
              />
            </Field>
          </div>

          <div className="sm:col-span-2">
            <Field label="Spécialité principale" error={errors.main_specialty?.message} htmlFor="oi-specialty">
              <Input
                id="oi-specialty"
                list="oi-specialty-suggestions"
                {...register("main_specialty")}
                className="h-11 rounded-xl border-hairline bg-background/70"
                placeholder="Développeur web"
                aria-invalid={Boolean(errors.main_specialty)}
              />
              <datalist id="oi-specialty-suggestions">
                {SPECIALTY_SUGGESTIONS.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </Field>
          </div>

          <Field label="Niveau d’expérience" error={errors.experience_level?.message} htmlFor="oi-experience">
            <Select
              value={(watch("experience_level") as string) ?? ""}
              onValueChange={(v) =>
                v && setValue("experience_level", v as DeveloperApplicationFormValues["experience_level"], { shouldValidate: true })
              }
            >
              <SelectTrigger
                id="oi-experience"
                className="h-11 w-full rounded-xl border-hairline bg-background/70 data-[size=default]:h-11"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="start">
                {EXPERIENCE_LEVELS.map((l) => (
                  <SelectItem key={l.value} value={l.value}>
                    {l.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Années d’expérience" error={errors.experience_years?.message} htmlFor="oi-years">
            <Input
              id="oi-years"
              type="number"
              min={0}
              step={1}
              {...register("experience_years")}
              className="h-11 rounded-xl border-hairline bg-background/70"
              aria-invalid={Boolean(errors.experience_years)}
            />
          </Field>

          <Field label="Projets réalisés" error={errors.projects_estimate?.message} htmlFor="oi-projects">
            <Input
              id="oi-projects"
              type="number"
              min={0}
              step={1}
              {...register("projects_estimate")}
              className="h-11 rounded-xl border-hairline bg-background/70"
              aria-invalid={Boolean(errors.projects_estimate)}
            />
          </Field>

          <Field label="Disponibilité" error={errors.availability?.message} htmlFor="oi-availability">
            <Select
              value={(watch("availability") as string) ?? ""}
              onValueChange={(v) =>
                v && setValue("availability", v as DeveloperApplicationFormValues["availability"], { shouldValidate: true })
              }
            >
              <SelectTrigger
                id="oi-availability"
                className="h-11 w-full rounded-xl border-hairline bg-background/70 data-[size=default]:h-11"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="start">
                {AVAILABILITY_OPTIONS.map((a) => (
                  <SelectItem key={a.value} value={a.value}>
                    {a.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Tarif minimum (FCFA)" error={errors.rate_min_fcfa?.message} htmlFor="oi-rate-min">
            <Input
              id="oi-rate-min"
              type="number"
              min={0}
              step={1000}
              {...register("rate_min_fcfa")}
              className="h-11 rounded-xl border-hairline bg-background/70"
              placeholder="100000"
              aria-invalid={Boolean(errors.rate_min_fcfa)}
            />
          </Field>

          <Field label="Tarif maximum (FCFA)" error={errors.rate_max_fcfa?.message} htmlFor="oi-rate-max">
            <Input
              id="oi-rate-max"
              type="number"
              min={0}
              step={1000}
              {...register("rate_max_fcfa")}
              className="h-11 rounded-xl border-hairline bg-background/70"
              placeholder="350000"
              aria-invalid={Boolean(errors.rate_max_fcfa)}
            />
          </Field>

          <div className="sm:col-span-2">
            <Field label="Présentation" error={errors.bio?.message} htmlFor="oi-bio">
              <Textarea
                id="oi-bio"
                rows={5}
                {...register("bio")}
                className="rounded-xl border-hairline bg-background/70 p-3 text-sm"
                placeholder="Parlez de votre parcours, vos technologies de prédilection, votre façon de travailler…"
                aria-invalid={Boolean(errors.bio)}
              />
            </Field>
          </div>

          <div className="sm:col-span-2">
            <Field label="Photo de profil (optionnelle, recommandée)" error={errors.avatar_url?.message} htmlFor="oi-avatar">
              <Input
                id="oi-avatar"
                type="url"
                {...register("avatar_url")}
                className="h-11 rounded-xl border-hairline bg-background/70"
                placeholder="https://…/ma-photo.jpg (optionnel)"
                aria-invalid={Boolean(errors.avatar_url)}
              />
              <label className="inline-flex h-9 w-fit cursor-pointer items-center gap-1.5 rounded-xl border border-hairline bg-surface px-3 text-xs font-medium text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/50">
                <Upload className="size-3.5" aria-hidden="true" />
                Téléverser une photo (JPG/PNG/WebP · 2 Mo max.)
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (file) {
                      void uploadImage(file, (url) =>
                        setValue("avatar_url", url, { shouldValidate: true })
                      );
                    }
                  }}
                />
              </label>
            </Field>
          </div>
        </div>

        {hasRate ? (
          <p className="mt-4 text-xs text-muted-foreground">
            Fourchette affichée : {rateMin.toLocaleString("fr-FR")} – {rateMax.toLocaleString("fr-FR")} FCFA (
            {(Number(rateMax) - Number(rateMin)).toLocaleString("fr-FR")} FCFA d’écart).
          </p>
        ) : null}
      </section>

      {/* Services */}
      <section className="rounded-2xl border border-hairline bg-card p-6 shadow-sm sm:p-8">
        <div className="flex items-center gap-2">
          <Briefcase className="size-5 text-primary" aria-hidden="true" />
          <h2 className="text-lg font-semibold tracking-tight">Services proposés</h2>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Sélectionnez au moins un service que vous proposez aux clients.
        </p>
        <div className="mt-5 flex flex-wrap gap-2" role="group" aria-label="Services proposés">
          {DEVELOPER_SERVICES.map((s) => {
            const active = services.includes(s);
            return (
              <button
                key={s}
                type="button"
                aria-pressed={active}
                onClick={() => toggleService(s)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                  active
                    ? "border-primary/60 bg-primary-soft text-primary-light"
                    : "border-hairline bg-surface text-muted-foreground hover:bg-muted"
                )}
              >
                {active ? <Check className="size-3.5" aria-hidden="true" /> : null}
                {s}
              </button>
            );
          })}
        </div>
        {errors.services ? (
          <p role="alert" className="mt-3 text-xs text-destructive">
            {errors.services.message}
          </p>
        ) : null}
      </section>

      {/* Compétences */}
      <section className="rounded-2xl border border-hairline bg-card p-6 shadow-sm sm:p-8">
        <h2 className="text-lg font-semibold tracking-tight">Compétences techniques</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Technologies et outils maîtrisés, séparés par des virgules.
        </p>
        <div className="mt-4 flex flex-col gap-3">
          <div className="flex gap-2">
            <Input
              value={skillInput}
              onChange={(e) => setSkillInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault();
                  addSkill();
                }
              }}
              className="h-11 flex-1 rounded-xl border-hairline bg-background/70"
              placeholder="Next.js, React, PostgreSQL, Figma…"
              aria-label="Ajouter une compétence"
            />
            <button
              type="button"
              onClick={addSkill}
              className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-xl border border-hairline bg-surface px-4 text-sm font-medium text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/50"
            >
              <Plus className="size-4" aria-hidden="true" />
              Ajouter
            </button>
          </div>
          {skills.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {skills.map((skill) => (
                <span
                  key={skill}
                  className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary-soft px-3 py-1.5 text-sm text-primary-light"
                >
                  {skill}
                  <button
                    type="button"
                    onClick={() => removeSkill(skill)}
                    className="text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/50"
                    aria-label={`Retirer ${skill}`}
                  >
                    <X className="size-3.5" aria-hidden="true" />
                  </button>
                </span>
              ))}
            </div>
          ) : null}
          {errors.skills ? (
            <p role="alert" className="text-xs text-destructive">
              {errors.skills.message}
            </p>
          ) : null}
        </div>
      </section>

      {/* Portfolio */}
      <section className="rounded-2xl border border-hairline bg-card p-6 shadow-sm sm:p-8">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">
              Portfolio (optionnel, recommandé)
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Vos réalisations récentes pour inspirer la confiance.
            </p>
          </div>
          {errors.projects ? (
            <p role="alert" className="text-xs text-destructive">
              {errors.projects.message}
            </p>
          ) : null}
        </div>

        <div className="mt-5 flex flex-col gap-5">
          {projectFields.map((field, i) => (
            <div
              key={field.id}
              className="rounded-2xl border border-hairline bg-surface p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-semibold text-muted-foreground">
                  Projet {i + 1}
                </p>
                <button
                  type="button"
                  onClick={() => projectArray.remove(i)}
                  className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-xs text-muted-foreground transition-colors outline-none hover:text-[var(--error)] focus-visible:ring-2 focus-visible:ring-primary/50"
                  aria-label={`Supprimer le projet ${i + 1}`}
                >
                  <Trash2 className="size-3.5" aria-hidden="true" />
                  Retirer
                </button>
              </div>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <Field label="Nom du projet" error={errors.projects?.[i]?.name?.message} htmlFor={`prj-name-${i}`}>
                  <Input
                    id={`prj-name-${i}`}
                    {...register(`projects.${i}.name`)}
                    className="h-10 rounded-xl border-hairline bg-background/70"
                    placeholder="Boutique de prêt-à-porter"
                    aria-invalid={Boolean(errors.projects?.[i]?.name)}
                  />
                </Field>
                <Field label="Type de projet" error={errors.projects?.[i]?.project_type?.message} htmlFor={`prj-type-${i}`}>
                  <Select
                    value={(getValues(`projects.${i}.project_type`) as string) ?? ""}
                    onValueChange={(v) =>
                      v &&
                      setValue(`projects.${i}.project_type`, v, { shouldValidate: true })
                    }
                  >
                    <SelectTrigger
                      id={`prj-type-${i}`}
                      className="h-10 w-full rounded-xl border-hairline bg-background/70 data-[size=default]:h-10"
                    >
                      <SelectValue placeholder="Choisir…" />
                    </SelectTrigger>
                    <SelectContent align="start">
                      {PROJECT_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Description" error={errors.projects?.[i]?.description?.message} htmlFor={`prj-desc-${i}`}>
                    <Textarea
                      id={`prj-desc-${i}`}
                      rows={3}
                      {...register(`projects.${i}.description`)}
                      className="rounded-xl border-hairline bg-background/70 p-3 text-sm"
                      placeholder="Ce que le projet accomplissait, vos apports…"
                    />
                  </Field>
                </div>
                <div className="sm:col-span-2">
                  <Field
                    label="Mon rôle sur ce projet"
                    hint="Ex : Lead développeur, Frontend, Design… (optionnel)"
                    htmlFor={`prj-role-${i}`}
                  >
                    <Input
                      id={`prj-role-${i}`}
                      {...register(`projects.${i}.role`)}
                      className="h-10 rounded-xl border-hairline bg-background/70"
                      placeholder="Lead développeur"
                    />
                  </Field>
                </div>
                <div className="sm:col-span-2">
                  <Field
                    label="Technologies"
                    error={undefined}
                    hint="Séparées par des virgules"
                  >
                    <TagListInput
                      values={getValues(`projects.${i}.technologies`) ?? []}
                      onChange={(next) => setValue(`projects.${i}.technologies`, next, { shouldValidate: true })}
                      placeholder="Next.js, Supabase, Vercel"
                      max={20}
                    />
                  </Field>
                </div>
                <div className="sm:col-span-2">
                  <Field
                    label="Lien du projet"
                    error={errors.projects?.[i]?.url?.message}
                    htmlFor={`prj-url-${i}`}
                  >
                    <Input
                      id={`prj-url-${i}`}
                      type="url"
                      {...register(`projects.${i}.url`)}
                      className="h-10 rounded-xl border-hairline bg-background/70"
                      placeholder="https://… (optionnel)"
                      aria-invalid={Boolean(errors.projects?.[i]?.url)}
                    />
                  </Field>
                </div>
                <div className="sm:col-span-2">
                  <Field
                    label="Captures d’écran"
                    error={undefined}
                    hint="Jusqu’à 10 images (JPG, PNG ou WebP, 2 Mo max. chacune)."
                  >
                    <div className="flex flex-col gap-2">
                      <TagListInput
                        values={getValues(`projects.${i}.screenshots`) ?? []}
                        onChange={(next) =>
                          setValue(`projects.${i}.screenshots`, next, { shouldValidate: true })
                        }
                        placeholder="https://…/capture.png"
                        max={10}
                      />
                      <label className="inline-flex h-9 w-fit cursor-pointer items-center gap-1.5 rounded-xl border border-hairline bg-surface px-3 text-xs font-medium text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/50">
                        <Upload className="size-3.5" aria-hidden="true" />
                        Téléverser une image
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className="sr-only"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            e.target.value = "";
                            if (file) {
                              void uploadImage(file, (url) => {
                                const current = getValues(`projects.${i}.screenshots`) ?? [];
                                if (current.length >= 10) {
                                  toast.error("10 captures maximum.");
                                  return;
                                }
                                setValue(`projects.${i}.screenshots`, [...current, url], {
                                  shouldValidate: true,
                                });
                              });
                            }
                          }}
                        />
                      </label>
                    </div>
                  </Field>
                </div>
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() =>
            projectArray.append({
              name: "",
              description: "",
              project_type: "",
              technologies: [],
              url: "",
              screenshots: [],
              role: "",
            })
          }
          className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl border border-hairline bg-surface px-4 text-sm font-medium text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/50"
        >
          <Plus className="size-4" aria-hidden="true" />
          Ajouter un projet
        </button>
      </section>

      {/* Liens */}
      <section className="rounded-2xl border border-hairline bg-card p-6 shadow-sm sm:p-8">
        <h2 className="text-lg font-semibold tracking-tight">Liens professionnels</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          GitHub, LinkedIn, portfolio ou autre présence en ligne.
        </p>

        <div className="mt-5 flex flex-col gap-4">
          {linkFields.map((field, i) => (
            <div key={field.id} className="grid items-end gap-4 sm:grid-cols-[180px_1fr_1fr_auto]">
              <Field label="Type" error={undefined}>
                <Select
                  value={(getValues(`links.${i}.kind`) as string) ?? "other"}
                  onValueChange={(v) =>
                    v &&
                    setValue(
                      `links.${i}.kind`,
                      v as DeveloperApplicationFormValues["links"][number]["kind"],
                      { shouldValidate: true }
                    )
                  }
                >
                  <SelectTrigger className="h-10 w-full rounded-xl border-hairline bg-background/70 data-[size=default]:h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent align="start">
                    {LINK_KINDS.map((k) => (
                      <SelectItem key={k.value} value={k.value}>
                        {k.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Libellé" error={undefined}>
                <Input
                  {...register(`links.${i}.label`)}
                  className="h-10 rounded-xl border-hairline bg-background/70"
                  placeholder="Mon GitHub"
                />
              </Field>
              <Field label="Lien" error={errors.links?.[i]?.url?.message}>
                <Input
                  type="url"
                  {...register(`links.${i}.url`)}
                  className="h-10 rounded-xl border-hairline bg-background/70"
                  placeholder="https://github.com/…"
                  aria-invalid={Boolean(errors.links?.[i]?.url)}
                />
              </Field>
              <button
                type="button"
                onClick={() => linkArray.remove(i)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-hairline bg-surface text-muted-foreground transition-colors outline-none hover:text-[var(--error)] focus-visible:ring-2 focus-visible:ring-primary/50"
                aria-label="Supprimer le lien"
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => linkArray.append({ kind: "github", label: "", url: "" })}
          className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl border border-hairline bg-surface px-4 text-sm font-medium text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/50"
        >
          <Plus className="size-4" aria-hidden="true" />
          Ajouter un lien
        </button>
      </section>

      {/* Accord */}
      <section className="rounded-2xl border border-hairline bg-card p-6 shadow-sm sm:p-8">
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={Boolean(watch("terms_accepted"))}
            onChange={(e) => setValue("terms_accepted", e.target.checked as unknown as true, { shouldValidate: true })}
            className="mt-0.5 size-4 shrink-0 accent-primary"
          />
          <span className="text-sm leading-relaxed text-muted-foreground">
            Je certifie l’exactitude des informations fournies et j’accepte les{" "}
            <Link href="/conditions-utilisation" className="font-medium text-primary underline-offset-4 hover:underline">
              conditions d’utilisation
            </Link>{" "}
            de Devmarket. Mon profil développeur sera activé automatiquement.
          </span>
        </label>
        {errors.terms_accepted ? (
          <p role="alert" className="mt-2 text-xs text-destructive">
            {errors.terms_accepted.message}
          </p>
        ) : null}
      </section>

      {formError ? (
        <p role="alert" className="flex items-start gap-2 rounded-xl border border-[var(--error)]/30 bg-[var(--error-soft)] px-4 py-3 text-sm leading-relaxed text-[var(--error)]">
          <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[var(--error)]" aria-hidden="true" />
          {formError}
        </p>
      ) : null}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-hairline bg-surface px-5 py-2.5 text-sm font-medium text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/50"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Étape 1
        </button>
        <button type="submit" disabled={isSubmitting} className="btn btn-primary btn-lg">
          {isSubmitting ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Send className="size-4" aria-hidden="true" />
          )}
          {isSubmitting ? "Envoi de l’inscription…" : "Envoyer ma candidature"}
        </button>
      </div>
    </form>
  );
}

function SuccessPanel() {
  return (
    <div className="mx-auto max-w-lg">
      <div className="rounded-2xl border border-success/40 bg-success-soft p-8 text-center shadow-sm">
        <span className="mx-auto inline-flex size-14 items-center justify-center rounded-full bg-emerald-500/15">
          <CheckCircle2 className="size-7 text-success" aria-hidden="true" />
        </span>
        <h2 className="mt-5 text-xl font-bold tracking-tight">Votre profil développeur est actif !</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Votre profil est complet et{" "}
          <span className="font-medium text-foreground">automatiquement activé</span>.
          Vous pouvez dès maintenant consulter les projets publiés et prendre en charge des missions.
        </p>
        <div className="mt-6 flex flex-col gap-3">
          <Link href="/dashboard" className="btn btn-primary w-full">
            Accéder à mon espace développeur
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </div>
  );
}

function TagListInput({
  values,
  onChange,
  placeholder,
  max = 20,
}: {
  values: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
  max?: number;
}) {
  const [input, setInput] = React.useState("");
  const add = () => {
    const parts = input
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean)
      .filter((v) => !values.includes(v));
    if (parts.length === 0) return;
    onChange([...values, ...parts].slice(0, max));
    setInput("");
  };
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add();
            }
          }}
          className="h-10 flex-1 rounded-xl border-hairline bg-background/70"
          placeholder={placeholder}
        />
        <button
          type="button"
          onClick={add}
          className="inline-flex h-10 shrink-0 items-center gap-1 rounded-xl border border-hairline bg-surface px-3 text-sm text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/50"
        >
          <Plus className="size-4" aria-hidden="true" />
        </button>
      </div>
      {values.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {values.map((v) => (
            <span
              key={v}
              className="inline-flex items-center gap-1 rounded-full border border-hairline bg-muted px-2.5 py-1 text-xs text-foreground"
            >
              {v}
              <button
                type="button"
                onClick={() => onChange(values.filter((x) => x !== v))}
                className="text-muted-foreground transition-colors outline-none hover:text-foreground"
                aria-label={`Retirer ${v}`}
              >
                <X className="size-3" aria-hidden="true" />
              </button>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function Field({
  label,
  error,
  hint,
  htmlFor,
  children,
}: {
  label: string;
  error?: string | null;
  hint?: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      {label ? <Label htmlFor={htmlFor}>{label}</Label> : null}
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function translateSubmitError(code: string, message: string): string {
  switch (code) {
    case "TLNAU":
      return "Vous devez être connecté pour envoyer votre inscription.";
    case "TLNOD":
      return "Profil développeur introuvable. Reconnectez-vous puis réessayez.";
    case "TLRJC":
      return "Votre compte est déjà actif, vérifié ou en cours de vérification.";
    case "TLDUP":
      return "Votre inscription est déjà en cours d’examen par notre équipe.";
    case "TLBAD":
      return message || "Certaines informations sont invalides. Vérifiez le formulaire.";
    default:
      return message || "L’envoi a échoué. Réessayez dans un instant.";
  }
}