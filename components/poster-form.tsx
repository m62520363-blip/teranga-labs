"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  Check,
  CheckCircle2,
  Clipboard,
  Gift,
  Loader2,
  Plus,
  Send,
  ShieldCheck,
  Sparkles,
  Wallet,
} from "lucide-react";
import { briefSchema, type BriefFormValues } from "@/lib/validations";
import { SENEGAL_REGIONS } from "@/lib/tokens";
import { useBalance } from "@/components/balance-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "cn";

const cityItems: Record<string, string> = Object.fromEntries(
  SENEGAL_REGIONS.map((c) => [c, c])
);

const TYPE_OPTIONS: {
  value: string;
  label: string;
  hint: string;
  icon: string;
  suggested: number[];
}[] = [
  {
    value: "vitrine",
    label: "Site vitrine",
    hint: "Présenter votre boutique, saloon ou restaurant en ligne.",
    icon: "🏪",
    suggested: [80000, 150000, 300000],
  },
  {
    value: "e-commerce",
    label: "Boutique e-commerce",
    hint: "Vendre en ligne avec paiement Orange Money, Wave ou Max It.",
    icon: "🛒",
    suggested: [200000, 400000, 800000],
  },
  {
    value: "landing page",
    label: "Landing page",
    hint: "Une page unique pour promouvoir une offre ou lancer un produit.",
    icon: "🚀",
    suggested: [60000, 120000, 250000],
  },
  {
    value: "app web",
    label: "Application web",
    hint: "Un outil sur mesure : réservation, suivi, espace client…",
    icon: "🧩",
    suggested: [300000, 600000, 1200000],
  },
  {
    value: "refonte",
    label: "Refonte de site",
    hint: "Moderniser un site existant, lui redonner vie et performance.",
    icon: "🔧",
    suggested: [150000, 350000, 700000],
  },
];

const FEATURE_OPTIONS = [
  "Galerie photos / vidéos",
  "Paiement mobile (Orange Money, Wave, Max It)",
  "Réservation / prise de rendez-vous",
  "Formulaire de contact",
  "Bouton WhatsApp",
  "Multilingue (français / wolof)",
  "Adresse & plan d’accès",
  "Espace administrateur simple",
  "SEO local (Google)",
  "Liste de prix / menu",
  "Historique / blog",
  "Refonte de mon site existant",
] as const;

const BUDGET_HINTS: Record<string, string> = {
  vitrine: "L’ordre de prix au Sénégal pour un site vitrine se situe entre 80 000 et 300 000 FCFA.",
  "e-commerce": "Une boutique payante démarre généralement autour de 200 000 FCFA.",
  "landing page": "Une landing page se situe souvent entre 60 000 et 250 000 FCFA.",
  "app web": "Une application web sur mesure demande un budget plus conséquent (dès 300 000 FCFA).",
  refonte: "Une refonte repart souvent de 150 000 FCFA selon l’existant.",
};

export function PosterForm() {
  const router = useRouter();
  const { refresh: refreshBalance } = useBalance();
  const [formError, setFormError] = React.useState<string | null>(null);
  const [honeypot, setHoneypot] = React.useState("");
  const [created, setCreated] = React.useState<{
    id: string;
    managementKey: string;
  } | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [customFeatures, setCustomFeatures] = React.useState("");

  const form = useForm<BriefFormValues>({
    resolver: zodResolver(briefSchema) as Resolver<BriefFormValues>,
    defaultValues: {
      client_name: "",
      client_whatsapp: "",
      client_city: "Dakar",
      project_type: "vitrine",
      budget: undefined,
      description: "",
      features: [],
      deadline: "",
    },
  });

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = form;

  const projectType = watch("project_type");
  const features = watch("features");

  const toggleFeature = (label: string, checked: boolean) => {
    const next = checked
      ? [...features, label]
      : features.filter((f) => f !== label);
    setValue("features", next, { shouldValidate: true });
  };

  const addCustomFeatures = () => {
    const raw = customFeatures
      .split(",")
      .map((f) => f.trim())
      .filter((f) => f.length > 0);
    if (raw.length === 0) return;
    const next = [...features, ...raw.filter((f) => !features.includes(f))].slice(0, 24);
    setValue("features", next, { shouldValidate: true });
    setCustomFeatures("");
  };

  const today = new Date();
  today.setDate(today.getDate() + 1);
  const minDate = today.toISOString().split("T")[0];

  const onSubmit = async (values: BriefFormValues) => {
    setFormError(null);

    if (honeypot) {
      toast.success("Brief publié !");
      router.push("/briefs");
      router.refresh();
      return;
    }

    let res: Response;
    try {
      res = await fetch("/api/briefs/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, website_confirm: honeypot }),
      });
    } catch {
      setFormError("Impossible de joindre le serveur. Réessayez.");
      return;
    }

    let payload: { id?: string; management_key?: string; accepted?: boolean; error?: string } | null = null;
    try {
      payload = await res.json();
    } catch {
      // corps illisible : on gère via le statut HTTP
    }

    if (res.status === 503) {
      setFormError(
        payload?.error ??
          "Configuration Supabase manquante. Renseignez les variables d’environnement puis relancez."
      );
      return;
    }

    if (!res.ok) {
      setFormError(
        payload?.error ??
          "Impossible de publier le brief pour le moment. Réessayez dans quelques secondes."
      );
      return;
    }

    if (payload?.accepted) {
      toast.success("Brief publié !");
      router.push("/briefs");
      router.refresh();
      return;
    }

    if (!payload?.id || !payload.management_key) {
      setFormError("Une erreur est survenue. Réessayez.");
      return;
    }

    setCreated({ id: payload.id, managementKey: payload.management_key });
    toast.success("Brief publié !", {
      description: "1 Token a été déduit de votre solde. Conservez votre lien de suivi : il vous sert à gérer votre projet.",
    });
    void refreshBalance();
  };

  if (created) {
    const managementUrl = `${window.location.origin}/brief/${created.id}?key=${created.managementKey}`;

    const copy = async () => {
      try {
        await navigator.clipboard.writeText(managementUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        toast.error("Impossible de copier automatiquement.");
      }
    };

    return (
      <div className="flex flex-col gap-5">
        <div className="flex items-start gap-3 rounded-2xl border border-[#3DD68C]/25 bg-[#122A1C] p-4 sm:p-5">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-[#3DD68C]" aria-hidden="true" />
          <div>
            <p className="font-semibold tracking-tight">Brief publié avec succès</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Votre projet est en ligne et visible par les développeurs. Les
              premières propositions arrivent dans votre espace client.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="mgmt-link" className="text-sm font-medium">
            Votre lien de gestion (à conserver précieusement)
          </Label>
          <div className="flex gap-2">
            <Input
              id="mgmt-link"
              readOnly
              value={managementUrl}
              onFocus={(e) => e.currentTarget.select()}
              className="h-10 rounded-xl font-mono text-xs"
            />
            <Button type="button" variant="outline" className="h-10 shrink-0 rounded-xl" onClick={copy}>
              {copied ? (
                <CheckCircle2 className="size-4 text-[#3DD68C]" aria-hidden="true" />
              ) : (
                <Clipboard className="size-4" aria-hidden="true" />
              )}
              {copied ? "Copié" : "Copier"}
            </Button>
          </div>
          <p className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-[#E86A2C]" aria-hidden="true" />
            Ce lien vous permet de suivre les développeurs qui ont débloqué votre
            contact, de changer le statut du projet et de laisser un avis. Ne le
            partagez pas.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link href="/briefs" className="btn btn-secondary">
            Voir les briefs
          </Link>
          <Link href="/client" className="btn btn-primary">
            Mon espace client
            <Send className="size-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5" noValidate>
      {/* Honeypot anti-spam */}
      <div className="hidden" aria-hidden="true">
        <label htmlFor="website_confirm">Ne pas remplir ce champ</label>
        <input
          id="website_confirm"
          tabIndex={-1}
          autoComplete="off"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
        />
      </div>

      <div className="rounded-2xl border border-[#E86A2C]/20 bg-[#2A1A10] p-4 sm:p-5">
        <p className="flex items-start gap-3 text-sm leading-relaxed text-foreground/90">
          <Sparkles className="mt-0.5 size-5 shrink-0 text-[#E86A2C]" aria-hidden="true" />
          Publier un brief coûte <strong>1 Token</strong>. Un assistant calcule
          avec vous les besoins et le budget réaliste de votre projet.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Label className="text-sm font-medium">Quel type de projet ?</Label>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {TYPE_OPTIONS.map((opt) => {
            const selected = projectType === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() =>
                  setValue("project_type", opt.value as BriefFormValues["project_type"], { shouldValidate: true })
                }
                aria-pressed={selected}
                className={cn(
                  "relative flex flex-col items-start gap-2 rounded-2xl border p-4 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#E86A2C]/50",
                  selected
                    ? "border-[#E86A2C]/60 bg-[#2A1A10]"
                    : "border-[#2A2A2A] bg-[#141414] hover:bg-[#1E1E1E]"
                )}
              >
                {selected ? (
                  <span className="absolute right-3 top-3 flex size-5 items-center justify-center rounded-full bg-[#E86A2C] text-[#0D0D0D]">
                    <Check className="size-3.5" aria-hidden="true" />
                  </span>
                ) : null}
                <span className="text-2xl" aria-hidden="true">
                  {opt.icon}
                </span>
                <span className="text-sm font-semibold">{opt.label}</span>
                <span className="text-xs leading-relaxed text-muted-foreground">{opt.hint}</span>
              </button>
            );
          })}
        </div>
        {errors.project_type ? <FieldError>{errors.project_type.message}</FieldError> : null}
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <Label className="text-sm font-medium">Budget estimé (FCFA)</Label>
          <span className="text-xs text-muted-foreground">Fourchettes indicatives</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {TYPE_OPTIONS.find((o) => o.value === projectType)?.suggested.map((val) => (
            <button
              key={val}
              type="button"
              onClick={() => setValue("budget", val, { shouldValidate: true })}
              className={cn(
                "rounded-xl border px-4 py-2 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#E86A2C]/50",
                watch("budget") === val
                  ? "border-[#E86A2C]/60 bg-[#2A1A10] text-[#F2F2F2]"
                  : "border-[#2A2A2A] bg-[#141414] text-muted-foreground hover:bg-[#1E1E1E]"
              )}
            >
              {val.toLocaleString("fr-FR")}
            </button>
          ))}
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {BUDGET_HINTS[projectType]}
        </p>
        <div className="mt-1 flex items-center gap-3 rounded-xl border border-[#2A2A2A] bg-[#141414] px-4 py-2.5">
          <Wallet className="size-4 shrink-0 text-[#E86A2C]" aria-hidden="true" />
          <Input
            type="number"
            inputMode="numeric"
            min={10000}
            step={1000}
            placeholder="Ou saisissez le montant exact (ex. 150000)"
            {...register("budget")}
            className="h-auto border-0 bg-transparent p-0 text-sm shadow-none outline-none placeholder:text-muted-foreground"
            aria-invalid={Boolean(errors.budget)}
          />
        </div>
        {errors.budget ? <FieldError>{errors.budget.message}</FieldError> : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label className="text-sm font-medium">De quoi avez-vous besoin ?</Label>
        <div className="grid gap-2 sm:grid-cols-2">
          {FEATURE_OPTIONS.map((feat) => {
            const checked = features.includes(feat);
            return (
              <label
                key={feat}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition-colors",
                  checked ? "border-[#3DD68C]/40 bg-[#122A1C]" : "border-[#2A2A2A] bg-[#141414] hover:bg-[#1E1E1E]"
                )}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => toggleFeature(feat, e.target.checked)}
                  className="mt-0.5 size-4 shrink-0 accent-[#3DD68C]"
                />
                <span className="text-sm">{feat}</span>
              </label>
            );
          })}
        </div>
        <div className="flex gap-2">
          <Input
            value={customFeatures}
            onChange={(e) => setCustomFeatures(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addCustomFeatures();
              }
            }}
            placeholder="Ajouter vos propres besoins (séparés par des virgules)"
            className="h-10 rounded-xl"
          />
          <Button
            type="button"
            variant="outline"
            className="h-10 shrink-0 rounded-xl"
            onClick={addCustomFeatures}
          >
            <Plus className="size-4" aria-hidden="true" />
            Ajouter
          </Button>
        </div>
        {features.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {features.map((feat) => (
              <span
                key={feat}
                className="inline-flex items-center gap-1 rounded-full bg-[#122A1C] px-2.5 py-1 text-xs text-[#3DD68C]"
              >
                <Gift className="size-3" aria-hidden="true" />
                {feat}
                <button
                  type="button"
                  aria-label={`Retirer ${feat}`}
                  onClick={() => toggleFeature(feat, false)}
                  className="ml-0.5 text-[#3DD68C]/60 hover:text-[#3DD68C]"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        ) : null}
        {errors.features ? <FieldError>{errors.features.message}</FieldError> : null}
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <FieldGroup label="Région" htmlFor="client_city">
          <Select
            value={watch("client_city")}
            onValueChange={(v) => v && setValue("client_city", v as BriefFormValues["client_city"], { shouldValidate: true })}
            items={cityItems}
          >
            <SelectTrigger className="h-10 w-full rounded-xl" aria-label="Région">
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
          {errors.client_city ? <FieldError>{errors.client_city.message}</FieldError> : null}
        </FieldGroup>

        <FieldGroup
          label="Deadline souhaitée"
          htmlFor="deadline"
          hint="Optionnel — la date limite de livraison."
        >
          <Input
            id="deadline"
            type="date"
            min={minDate}
            {...register("deadline")}
            className="h-10 rounded-xl"
            onChange={(e) => setValue("deadline", e.target.value, { shouldValidate: true })}
          />
        </FieldGroup>
      </div>

      <FieldGroup label="Votre nom / structure" htmlFor="client_name" hint="Affiché aux développeurs pour identifier le projet.">
        <Input
          id="client_name"
          {...register("client_name")}
          className="h-10 rounded-xl"
          placeholder="Boutique Bazin HLM"
          aria-invalid={Boolean(errors.client_name)}
        />
        {errors.client_name ? <FieldError>{errors.client_name.message}</FieldError> : null}
      </FieldGroup>

      <FieldGroup label="Votre WhatsApp" htmlFor="client_whatsapp" hint="Reste privé tant que vous n’acceptez pas une proposition : les développeurs vous écrivent d’abord dans la messagerie interne.">
        <Input
          id="client_whatsapp"
          type="tel"
          {...register("client_whatsapp")}
          className="h-10 rounded-xl"
          placeholder="+22177..."
          aria-invalid={Boolean(errors.client_whatsapp)}
        />
        {errors.client_whatsapp ? <FieldError>{errors.client_whatsapp.message}</FieldError> : null}
      </FieldGroup>

      <FieldGroup label="Décrivez votre besoin" htmlFor="description" hint="Ce que vous vendez, vos objectifs, ce qu’il faut absolument que le projet fasse.">
        <Textarea
          id="description"
          {...register("description")}
          className="min-h-32 rounded-xl"
          placeholder="Ex : Je vends des chaussures à HLM, je veux un site pour présenter mes articles, recevoir des commandes et payer par Wave…"
          aria-invalid={Boolean(errors.description)}
        />
        {errors.description ? <FieldError>{errors.description.message}</FieldError> : null}
      </FieldGroup>

      {formError && (
        <div className="rounded-xl border border-[#2A2A2A] bg-[#1E1E1E] px-4 py-3 text-sm">
          <p role="alert" className="text-destructive">
            {formError}
          </p>
          {formError.includes("Tokens insuffisants") && (
            <Link href="/tokens" className="mt-2 inline-flex font-medium text-[#E86A2C] underline underline-offset-4 hover:text-[#f59348]">
              Recharger mes Tokens
            </Link>
          )}
        </div>
      )}

      <p className="flex items-center gap-2 rounded-xl border border-[#E86A2C]/20 bg-[#2A1A10] px-4 py-3 text-sm text-foreground/90">
        <ShieldCheck className="size-4 shrink-0 text-[#E86A2C]" aria-hidden="true" />
        La publication consomme <strong>1 Token</strong> sur votre solde.
      </p>

      <Button type="submit" disabled={isSubmitting} className="h-11 rounded-xl">
        {isSubmitting ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <Send className="size-4" aria-hidden="true" />
        )}
        Publier mon brief
      </Button>
    </form>
  );
}

function FieldGroup({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <Label htmlFor={htmlFor} className={cn("text-sm font-medium")}>
          {label}
        </Label>
        {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
      </div>
      {children}
    </div>
  );
}

function FieldError({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="text-xs text-destructive">
      {children}
    </p>
  );
}