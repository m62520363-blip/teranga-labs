"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Clipboard,
  Gift,
  HelpCircle,
  Loader2,
  Plus,
  Send,
  ShieldCheck,
  Sparkles,
  Wand2,
  Wallet,
} from "lucide-react";
import type { AssistMode, BriefAssistResult } from "@/lib/ai/brief-assistant";
import { briefSchema, type BriefFormValues } from "@/lib/validations";
// ALL_REGION_ITEMS removed - no more region/city selection
import { useBalance } from "@/components/balance-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/ui/phone-input";
// RegionSelectContent removed - no longer needed
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

// cityItems removed - no longer needed

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
    hint: "Présenter votre boutique, salon, cabinet ou restaurant en ligne.",
    icon: "🏪",
    suggested: [80000, 150000, 300000],
  },
  {
    value: "e-commerce",
    label: "Boutique e-commerce",
    hint: "Vendre en ligne avec paiement mobile ou carte.",
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
  vitrine: "L’ordre de prix pour un site vitrine se situe entre 80 000 et 300 000 FCFA.",
  "e-commerce": "Une boutique e-commerce démarre généralement autour de 200 000 FCFA.",
  "landing page": "Une landing page se situe souvent entre 60 000 et 250 000 FCFA.",
  "app web": "Une application web sur mesure demande un budget plus conséquent (dès 300 000 FCFA).",
  refonte: "Une refonte repart souvent de 150 000 FCFA selon l’existant.",
};

const AI_ACTIONS: { mode: AssistMode; label: string }[] = [
  { mode: "generate", label: "Générer le brief" },
  { mode: "improve", label: "Améliorer" },
  { mode: "rewrite", label: "Réécrire" },
  { mode: "correct", label: "Corriger" },
  { mode: "simplify", label: "Simplifier" },
];

export function PosterForm({ initialType }: { initialType?: string } = {}) {
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
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [isPublishing, setIsPublishing] = React.useState(false);
  const [pending, setPending] = React.useState<BriefFormValues | null>(null);

  // État de l'assistant IA conversationnel (Section E)
  const [aiLoading, setAiLoading] = React.useState(false);
  const [aiActiveMode, setAiActiveMode] = React.useState<AssistMode>("generate");
  const [aiResult, setAiResult] = React.useState<BriefAssistResult | null>(null);
  const [aiAnswers, setAiAnswers] = React.useState<Record<string, string>>({});

  // Option payante de mise en avant du brief en tête de liste (0 = publication gratuite standard)
  const [boostDays, setBoostDays] = React.useState<0 | 7 | 14 | 30>(0);
  const [boosting, setBoosting] = React.useState(false);
  const [boostNotice, setBoostNotice] = React.useState<string | null>(null);

  const form = useForm<BriefFormValues>({
    resolver: zodResolver(briefSchema) as Resolver<BriefFormValues>,
    defaultValues: {
      client_name: "",
      client_whatsapp: "",
      client_city: "",
      project_type: (initialType ?? "vitrine") as BriefFormValues["project_type"],
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

  const runAiAssistant = async (mode: AssistMode = "generate") => {
    const raw = (watch("description") || "").trim();
    if (!raw) {
      toast.error("Expliquez d’abord votre projet avec quelques mots simples.");
      return;
    }
    setAiLoading(true);
    setAiActiveMode(mode);
    try {
      const res = await fetch("/api/ai/brief-assist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          description: raw,
          mode,
          answers: aiAnswers,
        }),
      });
      const data = (await res.json()) as BriefAssistResult & { message?: string };
      if (!res.ok || typeof data.description !== "string") {
        toast.error(data.message ?? "Impossible d’analyser la description.");
        return;
      }
      setValue("description", data.description, { shouldValidate: true });
      setAiResult(data);
      toast.success("Assistant IA appliqué — vous gardez le contrôle sur chaque champ.");
    } catch {
      toast.error("Service indisponible, réessayez dans un instant.");
    } finally {
      setAiLoading(false);
    }
  };

  const applyAiSuggestionsToForm = () => {
    if (!aiResult) return;
    if (aiResult.projectType) {
      setValue("project_type", aiResult.projectType, { shouldValidate: true });
    }
    if (aiResult.indicativeBudget?.suggested && !watch("budget")) {
      setValue("budget", aiResult.indicativeBudget.suggested, {
        shouldValidate: true,
      });
    }
    if (Array.isArray(aiResult.features) && aiResult.features.length > 0) {
      const merged = [
        ...new Set([...features, ...aiResult.features]),
      ].slice(0, 24);
      setValue("features", merged, { shouldValidate: true });
    }
    if (aiResult.indicativeDeadline?.days && !watch("deadline")) {
      const d = new Date();
      d.setDate(d.getDate() + aiResult.indicativeDeadline.days);
      setValue("deadline", d.toISOString().split("T")[0], {
        shouldValidate: true,
      });
    }
    toast.success("Catégorie, fonctionnalités, budget et délai indicatifs appliqués.");
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

  const onSubmit = (values: BriefFormValues) => {
    setFormError(null);
    setPending(values);
    setConfirmOpen(true);
  };

  const publishBrief = async (values: BriefFormValues) => {
    setFormError(null);

    if (honeypot) {
      toast.success("Projet publié !");
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
      error?: string;
    } | null = null;
    try {
      payload = await res.json();
    } catch {
      // corps illisible
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
          "Impossible de publier le projet pour le moment. Réessayez dans quelques secondes."
      );
      return;
    }

    if (payload?.accepted) {
      toast.success("Projet publié !");
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
    toast.success("Projet publié gratuitement !", {
      description:
        "Aucun frais de publication. Conservez votre lien de suivi pour gérer votre projet.",
    });
    void refreshBalance();

    if (boostDays > 0) {
      void startBoostCheckout(
        payload.id,
        payload.management_key,
        boostDays as 7 | 14 | 30
      );
    }
  };

  const startBoostCheckout = async (
    requestId: string,
    managementKey: string,
    days: 7 | 14 | 30
  ) => {
    setBoosting(true);
    setBoostNotice(null);
    try {
      const res = await fetch("/api/payments/brief-boost-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, days, managementKey }),
      });
      const data = (await res.json()) as {
        mode?: "redirect" | "invoice_pending";
        launchUrl?: string;
        message?: string;
      };
      if (!res.ok) {
        toast.error(data.message || "Impossible d’initialiser la mise en avant.");
        return;
      }
      if (data.mode === "redirect" && data.launchUrl) {
        window.location.assign(data.launchUrl);
        return;
      }
      setBoostNotice(
        data.message ||
          "Demande de mise en avant enregistrée. Votre projet passera en tête de liste dès confirmation serveur du règlement."
      );
    } catch {
      toast.error("Erreur réseau lors de la demande de mise en avant.");
    } finally {
      setBoosting(false);
    }
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
            <p className="font-semibold tracking-tight">Projet publié avec succès</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Votre projet est en ligne gratuitement et visible par les
              développeurs. Les propositions arrivent directement dans votre
              espace client.
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
            <Button
              type="button"
              variant="outline"
              className="h-10 shrink-0 rounded-xl"
              onClick={copy}
            >
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
            Ce lien vous permet de suivre les propositions reçues, de modifier le
            statut du projet et de laisser un avis.
          </p>
        </div>

        <div className="rounded-2xl border border-primary/30 bg-primary-soft/60 p-4 sm:p-5">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="size-4 text-primary" aria-hidden="true" />
            Mettre mon brief en avant en tête du marketplace (Optionnel)
          </p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Votre brief est déjà publié gratuitement. Vous pouvez payer une
            somme ponctuelle pour l’afficher en tête de liste avec le badge
            « Mis en avant » :
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {(
              [
                { days: 7 as const, price: 2500 },
                { days: 14 as const, price: 4500 },
                { days: 30 as const, price: 8000 },
              ]
            ).map((opt) => (
              <button
                key={opt.days}
                type="button"
                disabled={boosting}
                onClick={() =>
                  void startBoostCheckout(created.id, created.managementKey, opt.days)
                }
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-primary/40 bg-card px-3.5 text-xs font-semibold text-primary transition-colors hover:bg-primary hover:text-ink disabled:opacity-60"
              >
                {boosting ? (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                ) : null}
                Mettre en avant {opt.days} jours ·{" "}
                {opt.price.toLocaleString("fr-FR")} FCFA
              </button>
            ))}
          </div>
          {boostNotice ? (
            <p className="mt-3 text-xs font-medium text-primary">{boostNotice}</p>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-3">
          <Link href="/briefs" className="btn btn-secondary">
            Voir les projets
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
          <span>
            <strong>Publication 100 % gratuite — Aucun frais de publication. Sans engagement.</strong>{" "}
            Expliquez votre besoin avec des mots simples : notre assistant IA vous aide à structurer votre brief si vous le souhaitez.
          </span>
        </p>
      </div>

      {/* ---------------- ASSISTANT IA DE RÉDACTION DE BRIEF (SECTION E) ---------------- */}
      <FieldGroup
        label="Décrivez votre besoin (avec vos propres mots)"
        htmlFor="description"
        hint="Vous pouvez publier directement ou utiliser l’assistant IA gratuit."
      >
        <Textarea
          id="description"
          {...register("description")}
          className="min-h-32 rounded-xl"
          placeholder="Ex : Je vends des chaussures à Dakar, je veux un site pour présenter mes modèles, recevoir des commandes et être payé par Wave…"
          aria-invalid={Boolean(errors.description)}
        />
        {errors.description ? (
          <FieldError>{errors.description.message}</FieldError>
        ) : null}

        {/* Barre d'actions IA : Générer, Améliorer, Réécrire, Corriger, Simplifier */}
        <div
          className="mt-2 flex flex-wrap items-center gap-1.5"
          role="group"
          aria-label="Actions de l’assistant IA de rédaction"
        >
          {AI_ACTIONS.map((action) => {
            const busy = aiLoading && aiActiveMode === action.mode;
            return (
              <button
                key={action.mode}
                type="button"
                onClick={() => void runAiAssistant(action.mode)}
                disabled={aiLoading || isSubmitting}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:opacity-60",
                  action.mode === "generate"
                    ? "border-primary/40 bg-primary-soft text-primary hover:border-primary"
                    : "border-hairline bg-card text-foreground hover:border-primary/40"
                )}
              >
                {busy ? (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <Wand2 className="size-3.5 text-primary" aria-hidden="true" />
                )}
                {action.label}
              </button>
            );
          })}
        </div>

        {/* Panneau conversationnel de résultats de l'assistant IA */}
        {aiResult ? (
          <div className="mt-3 space-y-4 rounded-2xl border border-primary/30 bg-card p-4 sm:p-5">
            {/* Indicateur de progression */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-primary" aria-hidden="true" />
                <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                  Analyse IA du brief
                </span>
              </div>
              <span className="text-xs font-semibold text-foreground tabular-nums">
                Complétude : {aiResult.completenessScore ?? 75} %
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-border-strong">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{ width: `${aiResult.completenessScore ?? 75}%` }}
              />
            </div>

            {aiResult.title ? (
              <div className="rounded-xl border border-hairline bg-surface p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Titre professionnel suggéré
                </p>
                <p className="mt-1 text-sm font-semibold text-foreground">
                  {aiResult.title}
                </p>
                {aiResult.understanding ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {aiResult.understanding}
                  </p>
                ) : null}
              </div>
            ) : null}

            {/* Budget indicatif, Délai indicatif, Compétences & Livrables */}
            <div className="grid gap-3 sm:grid-cols-2">
              {aiResult.indicativeBudget ? (
                <div className="rounded-xl border border-hairline bg-surface p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Budget indicatif proposé
                  </p>
                  <p className="mt-1 text-sm font-bold text-primary">
                    {aiResult.indicativeBudget.suggested.toLocaleString("fr-FR")} FCFA
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {aiResult.indicativeBudget.label}
                  </p>
                </div>
              ) : null}

              {aiResult.indicativeDeadline ? (
                <div className="rounded-xl border border-hairline bg-surface p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Délai indicatif proposé
                  </p>
                  <p className="mt-1 text-sm font-bold text-foreground">
                    {aiResult.indicativeDeadline.label}
                  </p>
                </div>
              ) : null}
            </div>

            {aiResult.skills && aiResult.skills.length > 0 ? (
              <div>
                <p className="text-xs font-semibold text-muted-foreground">
                  Compétences techniques recommandées :
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {aiResult.skills.map((sk) => (
                    <span
                      key={sk}
                      className="rounded-full border border-primary/30 bg-primary-soft px-2.5 py-0.5 text-xs font-medium text-primary"
                    >
                      {sk}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            {aiResult.deliverables && aiResult.deliverables.length > 0 ? (
              <div>
                <p className="text-xs font-semibold text-muted-foreground">
                  Livrables attendus générés :
                </p>
                <ul className="mt-1.5 list-disc space-y-1 pl-4 text-xs text-muted-foreground">
                  {aiResult.deliverables.map((deliv) => (
                    <li key={deliv}>{deliv}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {aiResult.missingInfo && aiResult.missingInfo.length > 0 ? (
              <div className="rounded-xl border border-hairline bg-surface p-3">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <AlertCircle className="size-3.5 text-primary" aria-hidden="true" />
                  Informations à préciser (non inventées par l’IA)
                </p>
                <ul className="mt-1.5 list-disc space-y-1 pl-4 text-xs text-muted-foreground">
                  {aiResult.missingInfo.map((info) => (
                    <li key={info}>{info}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {/* Questions intelligentes interactives */}
            {aiResult.questions && aiResult.questions.length > 0 ? (
              <div className="space-y-2.5 rounded-xl border border-hairline bg-surface p-3.5">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <HelpCircle className="size-3.5 text-primary" aria-hidden="true" />
                  Questions pour affiner votre brief (optionnel)
                </p>
                {aiResult.questions.map((q) => (
                  <div key={q} className="space-y-1">
                    <label className="block text-xs text-muted-foreground">
                      {q}
                    </label>
                    <Input
                      value={aiAnswers[q] ?? ""}
                      onChange={(e) =>
                        setAiAnswers((prev) => ({ ...prev, [q]: e.target.value }))
                      }
                      placeholder="Votre réponse…"
                      className="h-8 rounded-lg text-xs"
                    />
                  </div>
                ))}
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => void runAiAssistant("generate")}
                    disabled={aiLoading}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-ink hover:bg-primary-hover"
                  >
                    Intégrer mes réponses au brief
                  </button>
                  <button
                    type="button"
                    onClick={applyAiSuggestionsToForm}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-primary/40 bg-primary-soft px-3 text-xs font-semibold text-primary hover:bg-primary/15"
                  >
                    Appliquer le type, les fonctionnalités et le budget indicatif
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </FieldGroup>

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
                  setValue("project_type", opt.value as BriefFormValues["project_type"], {
                    shouldValidate: true,
                  })
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
                <span className="text-xs leading-relaxed text-muted-foreground">
                  {opt.hint}
                </span>
              </button>
            );
          })}
        </div>
        {errors.project_type ? (
          <FieldError>{errors.project_type.message}</FieldError>
        ) : null}
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
                  checked
                    ? "border-success/40 bg-success-soft"
                    : "border-hairline bg-card hover:bg-muted"
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
            onChange={(e) =>
              setValue("deadline", e.target.value, { shouldValidate: true })
            }
          />
        </FieldGroup>
      </div>

      <FieldGroup
        label="Votre nom / structure"
        htmlFor="client_name"
        hint="Affiché aux développeurs pour identifier le projet."
      >
        <Input
          id="client_name"
          {...register("client_name")}
          className="h-10 rounded-xl"
          placeholder="Boutique Bazin HLM"
          aria-invalid={Boolean(errors.client_name)}
        />
        {errors.client_name ? (
          <FieldError>{errors.client_name.message}</FieldError>
        ) : null}
      </FieldGroup>

      <FieldGroup
        label="Votre WhatsApp"
        htmlFor="client_whatsapp"
        hint="Reste privé : les développeurs vous écrivent d’abord dans la messagerie interne."
      >
        <PhoneInput
          id="client_whatsapp"
          value={(watch("client_whatsapp") as string) ?? ""}
          onChange={(v) =>
            setValue("client_whatsapp", v, {
              shouldValidate: true,
              shouldDirty: true,
            })
          }
          className="h-10 rounded-xl"
          aria-invalid={Boolean(errors.client_whatsapp)}
        />
        {errors.client_whatsapp ? (
          <FieldError>{errors.client_whatsapp.message}</FieldError>
        ) : null}
      </FieldGroup>

      {formError && (
        <div className="rounded-xl border border-hairline bg-muted px-4 py-3 text-sm">
          <p role="alert" className="text-destructive">
            {formError}
          </p>
        </div>
      )}

      {/* Option de mise en avant payante lors de la publication (sans abonnement client) */}
      <div className="rounded-2xl border border-hairline bg-card p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2">
          <Label className="text-sm font-semibold">
            Visibilité de votre brief (Optionnel)
          </Label>
          <span className="rounded-full border border-primary/30 bg-primary-soft px-2.5 py-0.5 text-[11px] font-semibold text-primary">
            Sans abonnement
          </span>
        </div>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          La publication standard est 100 % gratuite. Vous pouvez optionnellement
          mettre votre brief en avant en tête de liste pour recevoir davantage de
          propositions rapidement :
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              days: 0 as const,
              title: "Publication standard",
              price: "0 FCFA (Gratuit)",
              note: "Visible dans l’annuaire des projets",
            },
            {
              days: 7 as const,
              title: "En avant · 7 jours",
              price: "2 500 FCFA",
              note: "Tête de liste + badge Mis en avant",
            },
            {
              days: 14 as const,
              title: "En avant · 14 jours",
              price: "4 500 FCFA",
              note: "Visibilité prioritaire 2 semaines",
            },
            {
              days: 30 as const,
              title: "En avant · 30 jours",
              price: "8 000 FCFA",
              note: "Visibilité maximale pendant 1 mois",
            },
          ].map((opt) => {
            const active = boostDays === opt.days;
            return (
              <button
                key={opt.days}
                type="button"
                onClick={() => setBoostDays(opt.days)}
                aria-pressed={active}
                className={cn(
                  "flex flex-col items-start rounded-xl border p-3 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                  active
                    ? "border-primary bg-primary-soft"
                    : "border-hairline bg-surface hover:border-primary/40"
                )}
              >
                <span className="text-xs font-semibold text-foreground">
                  {opt.title}
                </span>
                <span className="mt-1 text-sm font-bold text-primary">
                  {opt.price}
                </span>
                <span className="mt-0.5 text-[11px] text-muted-foreground">
                  {opt.note}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <p className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary-soft px-4 py-3 text-sm text-foreground/90">
        <ShieldCheck className="size-4 shrink-0 text-primary" aria-hidden="true" />
        Publication <strong>100 % gratuite</strong> — Aucun frais de publication. Sans engagement.
      </p>

      <Button type="submit" disabled={isSubmitting} className="h-11 rounded-xl">
        {isSubmitting ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <Send className="size-4" aria-hidden="true" />
        )}
        Vérifier mon projet
      </Button>

      <Dialog
        open={confirmOpen}
        onOpenChange={(open) => (open ? setConfirmOpen(true) : onCancel())}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmer la publication</DialogTitle>
            <DialogDescription>
              Vérifiez les informations ci-dessous avant la mise en ligne gratuite
              de votre projet.
            </DialogDescription>
          </DialogHeader>

          {pending ? (
            <dl className="flex flex-col gap-3 rounded-xl border border-border bg-muted/40 p-4 text-sm">
              <ReviewRow label="Type de projet" value={pending.project_type} />
              <ReviewRow
                label="Budget"
                value={`${pending.budget?.toLocaleString("fr-FR")} FCFA`}
              />
  
              <ReviewRow
                label="Deadline"
                value={pending.deadline || "Non précisée"}
              />
              <ReviewRow label="Description" value={pending.description} multiline />
              {pending.features.length > 0 ? (
                <ReviewRow
                  label="Fonctionnalités"
                  value={pending.features.join(", ")}
                  multiline
                />
              ) : null}
              <ReviewRow
                label="Contact"
                value={`${pending.client_name} · ${pending.client_whatsapp}`}
              />
            </dl>
          ) : null}

          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="size-4 shrink-0 text-primary" aria-hidden="true" />
            {formError ? (
              <span role="alert" className="text-destructive">
                {formError}
              </span>
            ) : (
              "Aucun frais de publication. Sans engagement."
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
              Publier mon projet gratuitement
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
      <dd
        className={cn(
          "text-foreground",
          multiline ? "whitespace-pre-wrap" : "truncate"
        )}
      >
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
