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
  Wand2,
  Wallet,
} from "lucide-react";
import { briefSchema, type BriefFormValues } from "@/lib/validations";
import { ALL_REGION_ITEMS } from "@/lib/countries";
import { useBalance } from "@/components/balance-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/ui/phone-input";
import { RegionSelectContent } from "@/components/ui/region-select";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "cn";

const cityItems: Record<string, string> = ALL_REGION_ITEMS;

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
    hint: "Vendre en ligne avec paiement Wave ou Max It.",
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
  "Paiement mobile (Wave, Max It)",
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
  // Dernière étape : récapitulatif avant le débit du Token.
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [isPublishing, setIsPublishing] = React.useState(false);
  const [pending, setPending] = React.useState<BriefFormValues | null>(null);
  const [aiLoading, setAiLoading] = React.useState(false);
  const [aiSuggestions, setAiSuggestions] = React.useState<string[]>([]);

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

  const improveDescription = async () => {
    const raw = (watch("description") || "").trim();
    if (!raw) {
      toast.error("Écrivez d'abord une petite description.");
      return;
    }
    setAiLoading(true);
    setAiSuggestions([]);
    try {
      const res = await fetch("/api/ai/brief-assist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ description: raw }),
      });
      const data = (await res.json()) as {
        description?: string;
        suggestions?: string[];
        message?: string;
      };
      if (!res.ok || typeof data.description !== "string") {
        toast.error(data.message ?? "Impossible d'améliorer la description.");
        return;
      }
      setValue("description", data.description, { shouldValidate: true });
      setAiSuggestions(data.suggestions ?? []);
      toast.success("Description affinée.");
    } catch {
      toast.error("Service indisponible, réessayez plus tard.");
    } finally {
      setAiLoading(false);
    }
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

  // L'utilisateur valide d'abord le formulaire, puis CONFIRME dans la
  // modale. Aucun appel réseau et aucun débit avant cette confirmation :
  // c'est le dernier écran avant l'engagement de 1 Token.
  const onSubmit = (values: BriefFormValues) => {
    setFormError(null);
    setPending(values);
    setConfirmOpen(true);
  };

  const publishBrief = async (values: BriefFormValues) => {
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

    let payload: {
      id?: string;
      management_key?: string;
      accepted?: boolean;
      gift?: boolean;
      error?: string;
    } | null = null;
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

    setConfirmOpen(false);
    setCreated({ id: payload.id, managementKey: payload.management_key });
    if (payload.gift) {
      toast.success("Brief publié !", {
        description:
          "Votre première publication est offerte : aucun Token n’a été débité.",
      });
    } else {
      toast.success("Brief publié !", {
        description: "1 Token a été déduit de votre solde. Conservez votre lien de suivi : il vous sert à gérer votre projet.",
      });
    }
    void refreshBalance();
  };

  const onConfirm = handleSubmit(async (values) => {
    setIsPublishing(true);
    await publishBrief(values);
    setIsPublishing(false);
  });

  const onCancel = () => {
    if (isPublishing) return;
    setConfirmOpen(false);
    setPending(null);
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
        <div className="flex items-start gap-3 rounded-2xl border border-success/25 bg-success-soft p-4 sm:p-5">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" aria-hidden="true" />
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
                <CheckCircle2 className="size-4 text-success" aria-hidden="true" />
              ) : (
                <Clipboard className="size-4" aria-hidden="true" />
              )}
              {copied ? "Copié" : "Copier"}
            </Button>
          </div>
          <p className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden="true" />
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

      <div className="rounded-2xl border border-primary/20 bg-primary-soft p-4 sm:p-5">
        <p className="flex items-start gap-3 text-sm leading-relaxed text-foreground/90">
          <Sparkles className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
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
                  "relative flex flex-col items-start gap-2 rounded-2xl border p-4 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                  selected
                    ? "border-primary/60 bg-primary-soft"
                    : "border-hairline bg-card hover:bg-muted"
                )}
              >
                {selected ? (
                  <span className="absolute right-3 top-3 flex size-5 items-center justify-center rounded-full bg-primary text-ink">
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
                "rounded-xl border px-4 py-2 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                watch("budget") === val
                  ? "border-primary/60 bg-primary-soft text-foreground"
                  : "border-hairline bg-card text-muted-foreground hover:bg-muted"
              )}
            >
              {val.toLocaleString("fr-FR")}
            </button>
          ))}
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {BUDGET_HINTS[projectType]}
        </p>
        <div className="mt-1 flex items-center gap-3 rounded-xl border border-hairline bg-card px-4 py-2.5">
          <Wallet className="size-4 shrink-0 text-primary" aria-hidden="true" />
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
                  checked ? "border-success/40 bg-success-soft" : "border-hairline bg-card hover:bg-muted"
                )}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => toggleFeature(feat, e.target.checked)}
                  className="mt-0.5 size-4 shrink-0 accent-success"
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
                className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2.5 py-1 text-xs text-success"
              >
                <Gift className="size-3" aria-hidden="true" />
                {feat}
                <button
                  type="button"
                  aria-label={`Retirer ${feat}`}
                  onClick={() => toggleFeature(feat, false)}
                  className="ml-0.5 text-success/60 hover:text-success"
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
            <RegionSelectContent />
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
        <PhoneInput
          id="client_whatsapp"
          value={(watch("client_whatsapp") as string) ?? ""}
          onChange={(v) =>
            setValue("client_whatsapp", v, { shouldValidate: true, shouldDirty: true })
          }
          className="h-10 rounded-xl"
          aria-invalid={Boolean(errors.client_whatsapp)}
        />
        {errors.client_whatsapp ? <FieldError>{errors.client_whatsapp.message}</FieldError> : null}
      </FieldGroup>

      <FieldGroup label="Décrivez votre besoin" htmlFor="description" hint="Ce que vous vendez, vos objectifs, ce qu’il faut absolument que le projet fasse.">
        <div className="mb-2 flex items-center justify-end">
          <button
            type="button"
            onClick={() => void improveDescription()}
            disabled={aiLoading || isSubmitting}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-primary/30 bg-primary-soft px-3 text-xs font-medium text-primary transition-colors hover:border-primary disabled:opacity-60"
          >
            {aiLoading ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Wand2 className="size-3.5" aria-hidden="true" />
            )}
            {aiLoading ? "Amélioration…" : "Améliorer avec l’IA"}
          </button>
        </div>
        <Textarea
          id="description"
          {...register("description")}
          className="min-h-32 rounded-xl"
          placeholder="Ex : Je vends des chaussures à HLM, je veux un site pour présenter mes articles, recevoir des commandes et payer par Wave…"
          aria-invalid={Boolean(errors.description)}
        />
        {errors.description ? <FieldError>{errors.description.message}</FieldError> : null}
        {aiSuggestions.length > 0 ? (
          <div className="mt-2 rounded-xl border border-hairline bg-muted p-3">
            <p className="text-xs font-semibold text-muted-foreground">
              Suggestions de notre assistant
            </p>
            <ul className="mt-1.5 list-disc space-y-1 pl-4 text-xs leading-relaxed text-muted-foreground">
              {aiSuggestions.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </FieldGroup>

      {formError && (
        <div className="rounded-xl border border-hairline bg-muted px-4 py-3 text-sm">
          <p role="alert" className="text-destructive">
            {formError}
          </p>
          {formError.includes("Tokens insuffisants") && (
            <Link href="/tokens" className="mt-2 inline-flex font-medium text-primary underline underline-offset-4 hover:text-primary-light">
              Recharger mes Tokens
            </Link>
          )}
        </div>
      )}

      <p className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary-soft px-4 py-3 text-sm text-foreground/90">
        <ShieldCheck className="size-4 shrink-0 text-primary" aria-hidden="true" />
        La publication consomme <strong>1 Token</strong> sur votre solde.
      </p>

      <Button type="submit" disabled={isSubmitting} className="h-11 rounded-xl">
        {isSubmitting ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <Send className="size-4" aria-hidden="true" />
        )}
        Vérifier mon brief
      </Button>

      <Dialog open={confirmOpen} onOpenChange={(open) => (open ? setConfirmOpen(true) : onCancel())}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmer la publication</DialogTitle>
            <DialogDescription>
              Vérifiez les informations ci-dessous. Elles seront visibles par les
              développeurs une fois le brief publié.
            </DialogDescription>
          </DialogHeader>

          {pending ? (
            <dl className="flex flex-col gap-3 rounded-xl border border-border bg-muted/40 p-4 text-sm">
              <ReviewRow label="Type de projet" value={pending.project_type} />
              <ReviewRow label="Budget" value={`${pending.budget?.toLocaleString("fr-FR")} FCFA`} />
              <ReviewRow label="Région" value={pending.client_city} />
              <ReviewRow label="Deadline" value={pending.deadline || "Non précisée"} />
              <ReviewRow label="Description" value={pending.description} multiline />
              {pending.features.length > 0 ? (
                <ReviewRow label="Fonctionnalités" value={pending.features.join(", ")} multiline />
              ) : null}
              <ReviewRow label="Contact" value={`${pending.client_name} · ${pending.client_whatsapp}`} />
            </dl>
          ) : null}

          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="size-4 shrink-0 text-primary" aria-hidden="true" />
            {formError ? (
              <span role="alert" className="text-destructive">
                {formError}
              </span>
            ) : (
              "La publication consomme 1 Token sur votre solde."
            )}
          </p>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="h-10 rounded-xl"
              onClick={onCancel}
              disabled={isPublishing}
            >
              Modifier
            </Button>
            <Button
              type="button"
              className="h-10 rounded-xl"
              onClick={onConfirm}
              disabled={isPublishing}
            >
              {isPublishing ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Send className="size-4" aria-hidden="true" />
              )}
              Publier et déduire 1 Token
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </form>
  );
}

function ReviewRow({
  label,
  value,
  multiline,
}: {
  label: string;
  value: string;
  multiline?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className={cn("text-foreground", multiline ? "whitespace-pre-wrap" : "truncate")}>
        {value}
      </dd>
    </div>
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