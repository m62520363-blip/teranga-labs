"use client";

import * as React from "react";
import { useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  AlertTriangle,
  BadgeCheck,
  Building2,
  Calendar,
  Check,
  Crown,
  FileText,
  Loader2,
  Minus,
  ShieldCheck,
  Sparkles,
  Star,
  Zap,
} from "lucide-react";
import { cn } from "cn";
import { createClient } from "@/lib/supabase/client";
import { formatFCFA } from "@/lib/formatting";
import { FaqItem } from "@/components/faq-item";

export type SubscriptionPlanRow = {
  id: string;
  name_fr: string;
  name_en: string;
  description_fr: string;
  description_en: string;
  price_monthly_fcfa: number;
  price_annual_fcfa: number;
  annual_discount_pct: number;
  monthly_contacts_quota: number;
  badge_label: string | null;
  ranking_stars: number;
  client_coordinates_access: boolean;
  premium_email_alerts: boolean;
  enhanced_visibility: boolean;
  suggested_profile: boolean;
  team_management: boolean;
  recommended: boolean;
  is_active: boolean;
  sort_order: number;
  features_fr: string[];
  features_en: string[];
};

export type DeveloperSubscriptionSummary = {
  active: boolean;
  status: string;
  plan_id: string;
  plan_name_fr: string;
  plan_name_en: string;
  badge_label: string | null;
  ranking_stars: number;
  billing_cycle: "monthly" | "annual";
  started_at: string | null;
  ends_at: string | null;
  grace_until: string | null;
  cancel_at_period_end: boolean;
  quota_limit: number;
  quota_used: number;
  quota_remaining: number;
  quota_pct: number;
  quota_reset_at: string | null;
  invoices: Array<{
    id: string;
    invoice_number: string;
    plan_id: string;
    billing_cycle: string;
    amount_fcfa: number;
    status: string;
    created_at: string;
    confirmed_at?: string | null;
  }>;
  usage_history: Array<{
    id: string;
    request_id: string;
    created_at: string;
    client_name: string | null;
    client_city: string | null;
    project_type: string | null;
    budget: number | null;
  }>;
};

const DEFAULT_PLANS: SubscriptionPlanRow[] = [
  {
    id: "free",
    name_fr: "Découverte",
    name_en: "Starter Free",
    description_fr:
      "Pour créer votre profil public, présenter votre portfolio et découvrir les briefs ouverts.",
    description_en:
      "Build your public profile, showcase your portfolio and browse open projects.",
    price_monthly_fcfa: 0,
    price_annual_fcfa: 0,
    annual_discount_pct: 0,
    monthly_contacts_quota: 1,
    badge_label: null,
    ranking_stars: 0,
    client_coordinates_access: false,
    premium_email_alerts: false,
    enhanced_visibility: false,
    suggested_profile: false,
    team_management: false,
    recommended: false,
    is_active: true,
    sort_order: 1,
    features_fr: [
      "Profil public complet et portfolio",
      "Présence dans l’annuaire des développeurs",
      "1 contact de projet d’essai offert",
      "Réception des demandes directes des clients",
    ],
    features_en: [
      "Complete public profile and portfolio",
      "Listed in the developer directory",
      "1 trial project contact included",
      "Receive direct client inquiries",
    ],
  },
  {
    id: "pro",
    name_fr: "Pro",
    name_en: "Pro",
    description_fr:
      "Pour les développeurs freelances réguliers qui répondent aux projets chaque semaine.",
    description_en:
      "For regular freelance developers responding to projects every week.",
    price_monthly_fcfa: 2500,
    price_annual_fcfa: 24000,
    annual_discount_pct: 20,
    monthly_contacts_quota: 80,
    badge_label: "Pro",
    ranking_stars: 1,
    client_coordinates_access: false,
    premium_email_alerts: false,
    enhanced_visibility: false,
    suggested_profile: false,
    team_management: false,
    recommended: false,
    is_active: true,
    sort_order: 2,
    features_fr: [
      "80 contacts de projets mensuels",
      "Badge Pro sur le profil et dans l’annuaire",
      "1 étoile de classement",
      "Messagerie directe et envoi de devis",
      "Sans engagement, résiliable à tout moment",
    ],
    features_en: [
      "80 monthly project contacts",
      "Pro badge on profile and directory",
      "1 ranking star",
      "Direct messaging and quote submission",
      "No commitment, cancel anytime",
    ],
  },
  {
    id: "pro_max",
    name_fr: "Freelance Pro Max",
    name_en: "Freelance Pro Max",
    description_fr:
      "La formule recommandée pour décrocher un maximum de missions avec une visibilité prioritaire.",
    description_en:
      "Our recommended plan to win more missions with priority visibility.",
    price_monthly_fcfa: 7000,
    price_annual_fcfa: 67200,
    annual_discount_pct: 20,
    monthly_contacts_quota: 200,
    badge_label: "Pro+",
    ranking_stars: 2,
    client_coordinates_access: true,
    premium_email_alerts: true,
    enhanced_visibility: true,
    suggested_profile: false,
    team_management: false,
    recommended: true,
    is_active: true,
    sort_order: 3,
    features_fr: [
      "200 contacts de projets mensuels",
      "Badge Pro+ distinctif",
      "2 étoiles de classement",
      "Coordonnées clients accessibles selon les paramètres de partage",
      "Alertes email premium en temps réel",
      "Visibilité améliorée dans l’annuaire",
    ],
    features_en: [
      "200 monthly project contacts",
      "Distinctive Pro+ badge",
      "2 ranking stars",
      "Client contact details accessible per sharing settings",
      "Real-time premium email alerts",
      "Enhanced visibility in the directory",
    ],
  },
  {
    id: "agency",
    name_fr: "Agence",
    name_en: "Agency",
    description_fr:
      "Conçu pour les studios, collectifs et agences digitales à fort volume de projets.",
    description_en:
      "Built for studios, collectives and digital agencies handling high project volume.",
    price_monthly_fcfa: 15000,
    price_annual_fcfa: 144000,
    annual_discount_pct: 20,
    monthly_contacts_quota: 400,
    badge_label: "Pro++",
    ranking_stars: 3,
    client_coordinates_access: true,
    premium_email_alerts: true,
    enhanced_visibility: true,
    suggested_profile: true,
    team_management: true,
    recommended: false,
    is_active: true,
    sort_order: 4,
    features_fr: [
      "400 contacts de projets mensuels",
      "Badge Pro++ Agence",
      "3 étoiles de classement",
      "Coordonnées clients accessibles selon les paramètres de partage",
      "Alertes email premium prioritaires",
      "Profil suggéré auprès des clients",
      "Gestion des collaborateurs et espace agence",
    ],
    features_en: [
      "400 monthly project contacts",
      "Pro++ Agency badge",
      "3 ranking stars",
      "Client contact details accessible per sharing settings",
      "Priority premium email alerts",
      "Suggested profile to clients",
      "Team & collaborator management",
    ],
  },
];

export function ProSubscription({
  plans: serverPlans,
  subscription: initialSub,
  isAuthenticated,
  hasDeveloperProfile,
  pendingInvoice,
}: {
  plans: SubscriptionPlanRow[];
  subscription: DeveloperSubscriptionSummary | null;
  isAuthenticated: boolean;
  hasDeveloperProfile: boolean;
  pendingInvoice?: string | null;
}) {
  const locale = useLocale();
  const isEn = locale === "en";

  const plans = serverPlans.length >= 3 ? serverPlans : DEFAULT_PLANS;
  const paidPlans = plans.filter((p) => p.id !== "free");
  const freePlan = plans.find((p) => p.id === "free") ?? DEFAULT_PLANS[0];

  const [cycle, setCycle] = React.useState<"monthly" | "annual">("monthly");
  const [busyPlan, setBusyPlan] = React.useState<string | null>(null);
  const [cancelling, setCancelling] = React.useState(false);
  const [error, setError] = React.useState("");
  const [notice, setNotice] = React.useState(
    pendingInvoice
      ? isEn
        ? `Invoice ${pendingInvoice} recorded. Your subscription will activate automatically upon server confirmation of the payment.`
        : `Facture ${pendingInvoice} enregistrée. Votre abonnement sera activé automatiquement dès la confirmation serveur du paiement.`
      : ""
  );
  const [sub, setSub] = React.useState<DeveloperSubscriptionSummary | null>(
    initialSub
  );

  const maxDiscount = Math.max(
    20,
    ...paidPlans.map((p) => p.annual_discount_pct || 20)
  );

  const handleSubscribe = async (planId: string) => {
    setBusyPlan(planId);
    setError("");
    setNotice("");
    try {
      const res = await fetch("/api/payments/subscription-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, billingCycle: cycle }),
      });
      const data = (await res.json()) as {
        mode?: "redirect" | "invoice_pending";
        launchUrl?: string;
        invoiceNumber?: string;
        amountFcfa?: number;
        message?: string;
      };
      if (!res.ok) {
        setError(
          data.message ||
            (isEn
              ? "Unable to start subscription checkout."
              : "Impossible d’initialiser la souscription.")
        );
        return;
      }
      if (data.mode === "redirect" && data.launchUrl) {
        window.location.assign(data.launchUrl);
        return;
      }
      setNotice(
        data.message ||
          (isEn
            ? `Invoice ${data.invoiceNumber ?? ""} generated (${formatFCFA(data.amountFcfa ?? 0)}). Activation occurs automatically once payment is confirmed server-side.`
            : `Facture ${data.invoiceNumber ?? ""} générée (${formatFCFA(data.amountFcfa ?? 0)}). L’activation est automatique dès confirmation serveur du règlement.`)
      );
      const supabase = createClient();
      const { data: refreshed } = await supabase.rpc("get_my_subscription");
      if (refreshed && typeof refreshed === "object") {
        setSub(refreshed as unknown as DeveloperSubscriptionSummary);
      }
    } catch {
      setError(
        isEn
          ? "Network error. Please try again."
          : "Erreur réseau. Réessayez dans un instant."
      );
    } finally {
      setBusyPlan(null);
    }
  };

  const handleCancel = async () => {
    setCancelling(true);
    setError("");
    try {
      const supabase = createClient();
      const { data, error: err } = await supabase.rpc(
        "cancel_my_subscription",
        { p_immediate: false }
      );
      if (err) {
        setError(err.message || "Impossible d’enregistrer la résiliation.");
        return;
      }
      if (data && typeof data === "object") {
        setSub(data as unknown as DeveloperSubscriptionSummary);
        setNotice(
          isEn
            ? "Cancellation scheduled at the end of your current period. Your benefits remain active until then."
            : "Résiliation enregistrée pour la fin de votre période en cours. Vos avantages restent actifs jusque-là."
        );
      }
    } finally {
      setCancelling(false);
    }
  };

  const faqItems = isEn
    ? [
        {
          q: "How are monthly project contacts counted?",
          a: "Each distinct project to which you send a proposal counts as 1 contact during your monthly period. Sending follow-up messages on the same project is never counted twice. Your quota resets automatically every month.",
        },
        {
          q: "What happens if I reach my monthly limit?",
          a: "You are never charged any automatic overage fee. We notify you at 80%, 90% and 100% of your quota, and you can upgrade to a higher plan (Pro Max or Agency) whenever you wish.",
        },
        {
          q: "What are the advantages of annual billing?",
          a: `Annual billing gives you a ${maxDiscount}% discount compared to 12 monthly payments, continuous visibility without interruption, and automatic monthly quota resets (80, 200 or 400 contacts every 30 days).`,
        },
        {
          q: "Is project posting really free for clients?",
          a: "Yes, 100% free. Clients create an account, use the AI brief assistant, publish projects, receive proposals and message developers with zero subscription or commission.",
        },
        {
          q: "How do cancellation and plan changes work?",
          a: "All plans are no-commitment. You can cancel in one click from this page: your subscription remains active until the end of the paid period and will not renew.",
        },
      ]
    : [
        {
          q: "Comment sont décomptés les contacts de projets mensuels ?",
          a: "Chaque projet distinct auquel vous envoyez une proposition consomme 1 contact sur votre quota mensuel. Les messages suivants sur un même projet ne sont jamais comptabilisés deux fois. Le quota est réinitialisé automatiquement chaque mois.",
        },
        {
          q: "Que se passe-t-il lorsque j’atteins ma limite mensuelle ?",
          a: "Aucun supplément n’est jamais facturé automatiquement sans votre consentement. Vous recevez une alerte à 80 %, 90 % et 100 % de votre quota et pouvez passer à une formule supérieure (Pro Max ou Agence) à tout moment.",
        },
        {
          q: "Quels sont les avantages de l’abonnement annuel ?",
          a: `Le paiement annuel vous fait économiser ${maxDiscount} % par rapport à 12 mensualités, garantit une visibilité continue dans l’annuaire et réinitialise automatiquement votre quota de 80, 200 ou 400 contacts tous les 30 jours.`,
        },
        {
          q: "La publication de projets est-elle vraiment gratuite pour les clients ?",
          a: "Oui, intégralement gratuite. Les clients publient leurs briefs avec l’assistant IA, consultent les propositions et échangent avec les développeurs sans aucun abonnement ni commission.",
        },
        {
          q: "Comment fonctionnent le changement de formule et la résiliation ?",
          a: "Nos formules sont sans engagement. Vous pouvez changer de formule ou résilier en un clic depuis votre espace : vos avantages restent actifs jusqu’à la fin de la période payée, sans reconduction.",
        },
      ];

  return (
    <div className="mx-auto max-w-6xl">
      {/* ------------------------------ EN-TÊTE ------------------------------ */}
      <header className="mx-auto max-w-3xl text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/[0.08] px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
          <Crown className="size-3.5" aria-hidden="true" />
          {isEn ? "Developer plans · 0% commission" : "Formules développeurs · 0 % commission"}
        </span>
        <h1 className="mt-4 font-headings text-3xl font-extrabold tracking-tight sm:text-5xl">
          {isEn ? "Our subscriptions" : "Nos abonnements"}
        </h1>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
          {isEn
            ? "Choose the plan tailored to your activity: clear monthly project contact quotas, ranking stars, priority alerts and direct payment with clients."
            : "Choisissez la formule adaptée à votre rythme : quotas clairs de contacts de projets mensuels, étoiles de classement, alertes prioritaires et paiement direct avec les clients."}
        </p>

        {/* Sélecteur Mensuel / Annuel */}
        <div
          role="group"
          aria-label={isEn ? "Billing cycle" : "Périodicité de facturation"}
          className="mt-7 inline-flex items-center gap-1 rounded-full border border-hairline bg-card p-1.5 shadow-sm"
        >
          <button
            type="button"
            onClick={() => setCycle("monthly")}
            aria-pressed={cycle === "monthly"}
            className={cn(
              "rounded-full px-5 py-2 text-xs font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary/50 sm:text-sm",
              cycle === "monthly"
                ? "bg-primary text-ink"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {isEn ? "Monthly" : "Mensuel"}
          </button>
          <button
            type="button"
            onClick={() => setCycle("annual")}
            aria-pressed={cycle === "annual"}
            className={cn(
              "inline-flex items-center gap-2 rounded-full px-5 py-2 text-xs font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary/50 sm:text-sm",
              cycle === "annual"
                ? "bg-primary text-ink"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <span>{isEn ? "Annual" : "Annuel"}</span>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[11px] font-bold",
                cycle === "annual"
                  ? "bg-ink/15 text-ink"
                  : "bg-primary-soft text-primary"
              )}
            >
              -{maxDiscount} %
            </span>
          </button>
        </div>
      </header>

      {/* --------------------- NOTIFICATIONS / ÉTAT ACTIF -------------------- */}
      {notice ? (
        <div
          role="status"
          className="mt-8 flex items-start gap-3 rounded-2xl border border-primary/35 bg-primary-soft px-5 py-4 text-sm text-foreground"
        >
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
          <p>{notice}</p>
        </div>
      ) : null}

      {error ? (
        <div
          role="alert"
          className="mt-8 flex items-start gap-3 rounded-2xl border border-destructive/40 bg-destructive/10 px-5 py-4 text-sm text-destructive"
        >
          <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <p>{error}</p>
        </div>
      ) : null}

      {/* Tableau de bord du quota et de l'abonnement pour le développeur connecté */}
      {isAuthenticated && sub ? (
        <section
          aria-label={isEn ? "Your current subscription and quota" : "Votre abonnement et quota en cours"}
          className="mt-8 rounded-2xl border border-hairline bg-card p-6"
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary-soft px-3 py-1 text-xs font-semibold text-primary">
                  <Crown className="size-3.5" aria-hidden="true" />
                  {isEn ? sub.plan_name_en : sub.plan_name_fr}
                </span>
                {sub.badge_label ? (
                  <span className="rounded-full border border-hairline bg-surface px-2.5 py-0.5 text-xs font-semibold">
                    Badge {sub.badge_label}
                  </span>
                ) : null}
                {sub.ranking_stars > 0 ? (
                  <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-primary">
                    {Array.from({ length: sub.ranking_stars }).map((_, idx) => (
                      <Star key={idx} className="size-3.5 fill-primary text-primary" aria-hidden="true" />
                    ))}
                  </span>
                ) : null}
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {sub.active && sub.ends_at
                  ? isEn
                    ? `Active until ${new Date(sub.ends_at).toLocaleDateString("en-US")}${sub.cancel_at_period_end ? " (cancellation scheduled at period end)" : ""}`
                    : `Actif jusqu’au ${new Date(sub.ends_at).toLocaleDateString("fr-FR")}${sub.cancel_at_period_end ? " (résiliation programmée à échéance)" : ""}`
                  : isEn
                    ? "Free starter tier · upgrade anytime to unlock 80, 200 or 400 monthly contacts."
                    : "Formule Découverte active · passez à Pro, Pro Max ou Agence pour débloquer 80, 200 ou 400 contacts mensuels."}
              </p>
            </div>

            {sub.active && !sub.cancel_at_period_end ? (
              <button
                type="button"
                onClick={() => void handleCancel()}
                disabled={cancelling}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-hairline bg-surface px-3.5 text-xs font-medium text-muted-foreground transition-colors outline-none hover:border-destructive/40 hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/50"
              >
                {cancelling ? (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                ) : null}
                {isEn ? "Cancel at period end" : "Résilier à échéance"}
              </button>
            ) : null}
          </div>

          <div className="mt-4 rounded-xl border border-hairline bg-surface p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm">
              <span className="font-medium">
                {isEn
                  ? "Monthly project contacts used"
                  : "Quota de contacts de projets ce mois-ci"}
              </span>
              <span className="font-semibold text-primary tabular-nums">
                {sub.quota_used} / {sub.quota_limit} ({sub.quota_remaining}{" "}
                {isEn ? "remaining" : "restants"})
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-border-strong">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{ width: `${Math.min(100, sub.quota_pct)}%` }}
              />
            </div>
          </div>
        </section>
      ) : null}

      {/* ----------- LES 3 CARTES CÔTE À CÔTE (PRO, PRO MAX, AGENCE) --------- */}
      <section
        aria-label={isEn ? "Developer subscription plans" : "Formules d’abonnement développeur"}
        className="mt-10 grid grid-cols-1 items-stretch gap-6 lg:grid-cols-3"
      >
        {paidPlans.map((plan) => {
          const isProMax = plan.id === "pro_max" || plan.recommended;
          const isAgency = plan.id === "agency";
          const monthlyEquivalent =
            cycle === "annual"
              ? Math.round(plan.price_annual_fcfa / 12)
              : plan.price_monthly_fcfa;
          const annualSavings =
            plan.price_monthly_fcfa * 12 - plan.price_annual_fcfa;
          const features = isEn ? plan.features_en : plan.features_fr;
          const isCurrentPlan =
            sub?.active &&
            sub.plan_id === plan.id &&
            sub.billing_cycle === cycle;

          return (
            <article
              key={plan.id}
              className={cn(
                "relative flex flex-col rounded-[1.75rem] border p-6 transition-all duration-300 sm:p-8",
                isProMax
                  ? "border-primary bg-[linear-gradient(160deg,rgba(57,255,136,0.14),rgba(15,46,36,0.55)_40%,rgba(11,19,43,0.98))] shadow-[0_32px_90px_-35px_rgba(57,255,136,0.4)] lg:-my-2"
                  : "border-hairline bg-card hover:border-primary/40"
              )}
            >
              {isProMax ? (
                <div className="mb-4 flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-ink">
                    <Sparkles className="size-3.5" aria-hidden="true" />
                    {isEn ? "Recommended" : "Recommandé"}
                  </span>
                  {plan.badge_label ? (
                    <span className="rounded-full border border-primary/40 bg-background/70 px-2.5 py-0.5 text-xs font-semibold text-primary">
                      Badge {plan.badge_label}
                    </span>
                  ) : null}
                </div>
              ) : (
                <div className="mb-4 flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {isAgency ? (
                      <Building2 className="size-4 text-primary" aria-hidden="true" />
                    ) : (
                      <Zap className="size-4 text-primary" aria-hidden="true" />
                    )}
                    {isEn ? plan.name_en : plan.name_fr}
                  </span>
                  {plan.badge_label ? (
                    <span className="rounded-full border border-hairline bg-surface px-2.5 py-0.5 text-xs font-semibold text-primary">
                      Badge {plan.badge_label}
                    </span>
                  ) : null}
                </div>
              )}

              <div className="flex items-center justify-between gap-2">
                <h2 className="font-headings text-2xl font-bold tracking-tight">
                  {isEn ? plan.name_en : plan.name_fr}
                </h2>
                <span
                  className="inline-flex items-center gap-0.5 text-primary"
                  title={`${plan.ranking_stars} ${isEn ? "ranking stars" : "étoiles de classement"}`}
                >
                  {Array.from({ length: plan.ranking_stars }).map((_, i) => (
                    <Star
                      key={i}
                      className="size-4 fill-primary text-primary"
                      aria-hidden="true"
                    />
                  ))}
                </span>
              </div>

              <p className="mt-2 min-h-[2.5rem] text-sm leading-relaxed text-muted-foreground">
                {isEn ? plan.description_en : plan.description_fr}
              </p>

              {/* Prix très visible */}
              <div className="mt-6 border-y border-hairline py-5">
                <div className="flex items-baseline gap-1.5">
                  <span className="font-headings text-4xl font-extrabold tracking-tight text-foreground sm:text-[2.5rem]">
                    {formatFCFA(monthlyEquivalent)}
                  </span>
                  <span className="text-sm font-medium text-muted-foreground">
                    /{isEn ? "month" : "mois"}
                  </span>
                </div>
                {cycle === "annual" ? (
                  <p className="mt-1.5 text-xs font-medium text-primary">
                    {isEn
                      ? `Billed ${formatFCFA(plan.price_annual_fcfa)}/year · Save ${formatFCFA(annualSavings)}`
                      : `Facturé ${formatFCFA(plan.price_annual_fcfa)}/an · Économisez ${formatFCFA(annualSavings)}`}
                  </p>
                ) : (
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {isEn
                      ? `Or ${formatFCFA(Math.round(plan.price_annual_fcfa / 12))}/month billed annually (-${plan.annual_discount_pct}%)`
                      : `Ou ${formatFCFA(Math.round(plan.price_annual_fcfa / 12))}/mois en facturation annuelle (-${plan.annual_discount_pct} %)`}
                  </p>
                )}
              </div>

              {/* Quota mis en avant */}
              <div className="mt-5 flex items-center justify-between rounded-xl border border-primary/25 bg-primary/[0.07] px-3.5 py-2.5 text-xs font-semibold text-primary">
                <span>
                  {plan.monthly_contacts_quota}{" "}
                  {isEn ? "project contacts / month" : "contacts de projets / mois"}
                </span>
                <span>
                  {plan.ranking_stars}{" "}
                  {isEn
                    ? `star${plan.ranking_stars > 1 ? "s" : ""}`
                    : `étoile${plan.ranking_stars > 1 ? "s" : ""}`}
                </span>
              </div>

              {/* Liste des avantages avec icônes */}
              <ul className="mt-5 flex flex-1 flex-col gap-3 text-sm">
                {features.map((feat) => (
                  <li key={feat} className="flex items-start gap-2.5">
                    <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                      <Check className="size-3" aria-hidden="true" />
                    </span>
                    <span className="leading-snug text-foreground/90">{feat}</span>
                  </li>
                ))}
              </ul>

              {/* Bouton S'abonner + mention sans engagement */}
              <div className="mt-7">
                {!isAuthenticated ? (
                  <Link
                    href="/login"
                    className={cn(
                      "inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-all outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                      isProMax
                        ? "btn-shine bg-primary text-ink hover:brightness-110"
                        : "border border-primary/40 bg-primary-soft text-primary hover:bg-primary/15"
                    )}
                  >
                    <Crown className="size-4" aria-hidden="true" />
                    {isEn ? "Subscribe" : "S’abonner"}
                  </Link>
                ) : !hasDeveloperProfile ? (
                  <Link
                    href="/inscription-developpeur"
                    className={cn(
                      "inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-all outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                      isProMax
                        ? "btn-shine bg-primary text-ink hover:brightness-110"
                        : "border border-primary/40 bg-primary-soft text-primary hover:bg-primary/15"
                    )}
                  >
                    <Crown className="size-4" aria-hidden="true" />
                    {isEn ? "Create developer profile" : "Créer mon profil développeur"}
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => void handleSubscribe(plan.id)}
                    disabled={busyPlan !== null}
                    className={cn(
                      "inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-all outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:cursor-not-allowed disabled:opacity-60",
                      isProMax
                        ? "btn-shine bg-primary text-ink hover:brightness-110"
                        : "border border-primary/40 bg-primary-soft text-primary hover:bg-primary/15"
                    )}
                  >
                    {busyPlan === plan.id ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    ) : isCurrentPlan ? (
                      <BadgeCheck className="size-4" aria-hidden="true" />
                    ) : (
                      <Crown className="size-4" aria-hidden="true" />
                    )}
                    {isCurrentPlan
                      ? isEn
                        ? "Renew / Extend"
                        : "Prolonger ma formule"
                      : isEn
                        ? "Subscribe"
                        : "S’abonner"}
                  </button>
                )}

                <p className="mt-2.5 text-center text-[11px] text-muted-foreground">
                  {cycle === "monthly"
                    ? isEn
                      ? "No commitment · Cancel anytime in 1 click"
                      : "Sans engagement · Résiliable en 1 clic à tout moment"
                    : isEn
                      ? `Annual billing · ${plan.annual_discount_pct}% discount included`
                      : `Facturation annuelle · ${plan.annual_discount_pct} % d’économie immédiate`}
                </p>
              </div>
            </article>
          );
        })}
      </section>

      {/* --------------------- 4e FORMULE : DÉCOUVERTE (0 F) ------------------ */}
      <section
        aria-label={isEn ? "Starter Free tier" : "Formule Découverte gratuite"}
        className="mt-6 rounded-2xl border border-hairline bg-card p-6 sm:flex sm:items-center sm:justify-between sm:gap-6"
      >
        <div>
          <div className="flex items-center gap-2.5">
            <h3 className="font-headings text-lg font-bold tracking-tight">
              {isEn ? freePlan.name_en : freePlan.name_fr} — {formatFCFA(0)}/
              {isEn ? "month" : "mois"}
            </h3>
            <span className="rounded-full border border-hairline bg-surface px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
              {isEn ? "Included by default" : "Inclus à l’inscription"}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {isEn ? freePlan.description_en : freePlan.description_fr}
          </p>
        </div>
        <Link
          href={isAuthenticated ? "/dashboard" : "/inscription-developpeur"}
          className="mt-4 inline-flex min-h-10 shrink-0 items-center justify-center rounded-full border border-hairline bg-surface px-5 text-xs font-semibold text-foreground transition-colors outline-none hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-primary/50 sm:mt-0"
        >
          {isAuthenticated
            ? isEn
              ? "Open my dashboard"
              : "Accéder à mon dashboard"
            : isEn
              ? "Start for free"
              : "Commencer gratuitement"}
        </Link>
      </section>

      {/* ----------------- AVANTAGES DU PAIEMENT ANNUEL ----------------------- */}
      <section
        aria-label={isEn ? "Annual billing advantages" : "Avantages de l’abonnement annuel"}
        className="mt-14 grid gap-4 rounded-2xl border border-primary/25 bg-primary/[0.04] p-6 sm:grid-cols-3 sm:p-8"
      >
        <div>
          <span className="inline-flex size-9 items-center justify-center rounded-xl bg-primary-soft text-primary">
            <Calendar className="size-4" aria-hidden="true" />
          </span>
          <h3 className="mt-3 font-headings text-base font-bold">
            {isEn ? `Save ${maxDiscount}% immediately` : `${maxDiscount} % d’économie immédiate`}
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {isEn
              ? "Get over 2 months free compared to monthly billing across Pro, Pro Max and Agency."
              : "Plus de 2 mois offerts par rapport au paiement mensuel sur les formules Pro, Pro Max et Agence."}
          </p>
        </div>
        <div>
          <span className="inline-flex size-9 items-center justify-center rounded-xl bg-primary-soft text-primary">
            <Zap className="size-4" aria-hidden="true" />
          </span>
          <h3 className="mt-3 font-headings text-base font-bold">
            {isEn ? "Monthly quota auto-reset" : "Quota réinitialisé chaque mois"}
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {isEn
              ? "Your 80, 200 or 400 project contacts renew automatically every 30 days throughout the year."
              : "Vos 80, 200 ou 400 contacts de projets sont recrédités automatiquement tous les 30 jours."}
          </p>
        </div>
        <div>
          <span className="inline-flex size-9 items-center justify-center rounded-xl bg-primary-soft text-primary">
            <FileText className="size-4" aria-hidden="true" />
          </span>
          <h3 className="mt-3 font-headings text-base font-bold">
            {isEn ? "Single annual invoice" : "Facture unique & visibilité continue"}
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {isEn
              ? "Simplified accounting with a single invoice and uninterrupted badge & ranking stars."
              : "Une seule facture annuelle dans votre espace et un maintien continu de votre badge et de vos étoiles."}
          </p>
        </div>
      </section>

      {/* ------------------- TABLEAU COMPARATIF DÉTAILLÉ ---------------------- */}
      <section
        aria-label={isEn ? "Detailed plan comparison" : "Comparaison détaillée des formules"}
        className="mt-16"
      >
        <h2 className="text-center font-headings text-2xl font-bold tracking-tight sm:text-3xl">
          {isEn ? "Detailed comparison of plans" : "Comparaison détaillée des formules"}
        </h2>

        <div className="mt-8 overflow-x-auto rounded-2xl border border-hairline bg-card">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-hairline bg-surface">
                <th className="px-5 py-4 font-headings font-semibold">
                  {isEn ? "Features" : "Fonctionnalités"}
                </th>
                <th className="px-4 py-4 text-center font-headings font-semibold">
                  {isEn ? "Free" : "Découverte"}
                </th>
                <th className="px-4 py-4 text-center font-headings font-semibold">
                  Pro
                </th>
                <th className="bg-primary-soft px-4 py-4 text-center font-headings font-bold text-primary">
                  Pro Max
                </th>
                <th className="px-4 py-4 text-center font-headings font-semibold">
                  {isEn ? "Agency" : "Agence"}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              <tr>
                <td className="px-5 py-3.5 text-muted-foreground">
                  {isEn ? "Monthly price" : "Tarif mensuel"}
                </td>
                <td className="px-4 py-3.5 text-center font-medium">0 FCFA</td>
                <td className="px-4 py-3.5 text-center font-semibold">2 500 FCFA</td>
                <td className="bg-primary-soft/50 px-4 py-3.5 text-center font-bold text-primary">
                  7 000 FCFA
                </td>
                <td className="px-4 py-3.5 text-center font-semibold">15 000 FCFA</td>
              </tr>
              <tr>
                <td className="px-5 py-3.5 text-muted-foreground">
                  {isEn ? "Monthly project contacts" : "Contacts de projets mensuels"}
                </td>
                <td className="px-4 py-3.5 text-center">1 (essai)</td>
                <td className="px-4 py-3.5 text-center font-semibold">80 / mois</td>
                <td className="bg-primary-soft/50 px-4 py-3.5 text-center font-bold text-primary">
                  200 / mois
                </td>
                <td className="px-4 py-3.5 text-center font-semibold">400 / mois</td>
              </tr>
              <tr>
                <td className="px-5 py-3.5 text-muted-foreground">
                  {isEn ? "Profile & directory badge" : "Badge sur le profil et l’annuaire"}
                </td>
                <td className="px-4 py-3.5 text-center text-muted-foreground">—</td>
                <td className="px-4 py-3.5 text-center font-medium">Badge Pro</td>
                <td className="bg-primary-soft/50 px-4 py-3.5 text-center font-bold text-primary">
                  Badge Pro+
                </td>
                <td className="px-4 py-3.5 text-center font-semibold">Badge Pro++</td>
              </tr>
              <tr>
                <td className="px-5 py-3.5 text-muted-foreground">
                  {isEn ? "Ranking stars" : "Étoiles de classement"}
                </td>
                <td className="px-4 py-3.5 text-center text-muted-foreground">—</td>
                <td className="px-4 py-3.5 text-center">1 ★</td>
                <td className="bg-primary-soft/50 px-4 py-3.5 text-center font-bold text-primary">
                  2 ★★
                </td>
                <td className="px-4 py-3.5 text-center font-semibold">3 ★★★</td>
              </tr>
              {[
                {
                  label: isEn
                    ? "Client contact details (per sharing settings)"
                    : "Coordonnées clients accessibles selon paramètres de partage",
                  vals: [false, false, true, true],
                },
                {
                  label: isEn ? "Premium real-time email alerts" : "Alertes email premium",
                  vals: [false, false, true, true],
                },
                {
                  label: isEn ? "Enhanced directory visibility" : "Visibilité améliorée",
                  vals: [false, false, true, true],
                },
                {
                  label: isEn ? "Suggested profile to clients" : "Profil suggéré aux clients",
                  vals: [false, false, false, true],
                },
                {
                  label: isEn ? "Collaborator & team management" : "Gestion des collaborateurs",
                  vals: [false, false, false, true],
                },
              ].map((row) => (
                <tr key={row.label}>
                  <td className="px-5 py-3.5 text-muted-foreground">{row.label}</td>
                  {row.vals.map((ok, idx) => (
                    <td
                      key={idx}
                      className={cn(
                        "px-4 py-3.5 text-center",
                        idx === 2 && "bg-primary-soft/50"
                      )}
                    >
                      {ok ? (
                        <Check
                          className="mx-auto size-4 text-primary"
                          aria-hidden="true"
                        />
                      ) : (
                        <Minus
                          className="mx-auto size-4 text-muted-foreground/50"
                          aria-hidden="true"
                        />
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ------------------------------ FAQ & RÉSILIATION --------------------- */}
      <section aria-label="FAQ" className="mt-16">
        <h2 className="font-headings text-2xl font-bold tracking-tight">
          {isEn ? "Frequently asked questions" : "Questions fréquentes"}
        </h2>
        <div className="mt-6 border-t border-hairline">
          {faqItems.map((item) => (
            <FaqItem key={item.q} question={item.q} answer={item.a} />
          ))}
        </div>

        <p className="mt-8 rounded-2xl border border-hairline bg-card p-5 text-xs leading-relaxed text-muted-foreground">
          {isEn
            ? "Cancellation conditions: Monthly and annual plans can be cancelled at any time from your account with no penalty. Your badge, ranking stars and remaining monthly project contacts remain active until the end of the paid period."
            : "Conditions de résiliation : les formules mensuelles et annuelles sont résiliables à tout moment depuis votre espace, sans frais ni pénalité. Votre badge, vos étoiles de classement et votre quota de contacts mensuels restent actifs jusqu’à la date d’échéance de la période réglée."}
        </p>
      </section>
    </div>
  );
}
