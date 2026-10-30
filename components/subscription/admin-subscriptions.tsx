"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  Check,
  Crown,
  Loader2,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  TrendingUp,
  Users,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatFCFA } from "@/lib/formatting";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import type { SubscriptionPlanRow } from "@/components/subscription/pro-subscription";

type AnalyticsPayload = {
  active_subscribers: number;
  cancelled_subscribers: number;
  expired_subscribers: number;
  mrr_fcfa: number;
  arr_fcfa: number;
  total_revenue_fcfa: number;
  churn_rate_pct: number;
  renewal_rate_pct: number;
  by_plan: Array<{
    plan_id: string;
    name_fr: string;
    subscribers: number;
  }>;
  recent_payments: Array<{
    id: string;
    invoice_number: string;
    developer_id: string;
    full_name: string | null;
    username: string | null;
    plan_id: string;
    billing_cycle: string;
    amount_fcfa: number;
    status: string;
    created_at: string;
    confirmed_at: string | null;
    refunded_at: string | null;
  }>;
  subscribers: Array<{
    developer_id: string;
    full_name: string | null;
    username: string | null;
    plan: string;
    billing_cycle: string;
    status: string;
    started_at: string;
    ends_at: string;
    quota_used: number;
    quota_limit: number;
    cancel_at_period_end: boolean;
  }>;
};

export function AdminSubscriptions({
  initialPlans,
  initialAnalytics,
}: {
  initialPlans: SubscriptionPlanRow[];
  initialAnalytics: AnalyticsPayload | null;
}) {
  const supabase = React.useMemo(() => createClient(), []);
  const [plans, setPlans] = React.useState<SubscriptionPlanRow[]>(initialPlans);
  const [analytics, setAnalytics] = React.useState<AnalyticsPayload | null>(
    initialAnalytics
  );
  const [busyId, setBusyId] = React.useState<string | null>(null);

  // Formulaire d'octroi exceptionnel d'abonnement
  const [grantDevId, setGrantDevId] = React.useState("");
  const [grantPlanId, setGrantPlanId] = React.useState("pro_max");
  const [grantCycle, setGrantCycle] = React.useState("monthly");
  const [grantDays, setGrantDays] = React.useState("30");
  const [granting, setGranting] = React.useState(false);

  // Formulaire de création d'une nouvelle formule
  const [newPlanId, setNewPlanId] = React.useState("");
  const [newPlanName, setNewPlanName] = React.useState("");
  const [newPlanMonthly, setNewPlanMonthly] = React.useState("5000");
  const [newPlanQuota, setNewPlanQuota] = React.useState("120");
  const [creatingPlan, setCreatingPlan] = React.useState(false);

  const reload = async () => {
    const [pRes, aRes] = await Promise.all([
      supabase.rpc("list_subscription_plans", { p_include_inactive: true }),
      supabase.rpc("admin_get_subscription_analytics"),
    ]);
    if (Array.isArray(pRes.data)) {
      setPlans(pRes.data as unknown as SubscriptionPlanRow[]);
    }
    if (aRes.data && typeof aRes.data === "object") {
      setAnalytics(aRes.data as unknown as AnalyticsPayload);
    }
  };

  const savePlan = async (plan: SubscriptionPlanRow) => {
    setBusyId(plan.id);
    const { data, error } = await supabase.rpc("admin_upsert_subscription_plan", {
      p_payload: plan as unknown as never,
    });
    setBusyId(null);
    if (error) {
      toast.error(error.message || "Impossible d’enregistrer la formule.");
      return;
    }
    if (Array.isArray(data)) {
      setPlans(data as unknown as SubscriptionPlanRow[]);
    }
    toast.success(`Formule ${plan.name_fr} mise à jour.`);
    void reload();
  };

  const createPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlanId.trim() || !newPlanName.trim()) return;
    setCreatingPlan(true);
    const monthly = Number.parseInt(newPlanMonthly, 10) || 0;
    const quota = Number.parseInt(newPlanQuota, 10) || 80;
    const { error } = await supabase.rpc("admin_upsert_subscription_plan", {
      p_payload: {
        id: newPlanId.trim().toLowerCase(),
        name_fr: newPlanName.trim(),
        name_en: newPlanName.trim(),
        description_fr: `Formule ${newPlanName.trim()} (${quota} contacts/mois)`,
        description_en: `${newPlanName.trim()} plan (${quota} contacts/month)`,
        price_monthly_fcfa: monthly,
        annual_discount_pct: 20,
        monthly_contacts_quota: quota,
        badge_label: "Pro",
        ranking_stars: 1,
        is_active: true,
        sort_order: plans.length + 1,
      } as unknown as never,
    });
    setCreatingPlan(false);
    if (error) {
      toast.error(error.message || "Impossible de créer la formule.");
      return;
    }
    setNewPlanId("");
    setNewPlanName("");
    toast.success("Nouvelle formule créée.");
    void reload();
  };

  const grantSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!grantDevId.trim()) return;
    setGranting(true);
    const { error } = await supabase.rpc("admin_grant_subscription", {
      p_developer_id: grantDevId.trim(),
      p_plan_id: grantPlanId,
      p_billing_cycle: grantCycle,
      p_duration_days: Number.parseInt(grantDays, 10) || 30,
    });
    setGranting(false);
    if (error) {
      toast.error(error.message || "Impossible d’accorder l’abonnement.");
      return;
    }
    setGrantDevId("");
    toast.success("Abonnement accordé avec succès.");
    void reload();
  };

  const confirmPayment = async (paymentId: string) => {
    setBusyId(paymentId);
    const { error } = await supabase.rpc("confirm_subscription_payment", {
      p_payment_id: paymentId,
      p_provider_sale_id: "ADMIN-CONFIRMED",
    });
    setBusyId(null);
    if (error) {
      toast.error(error.message || "Impossible de confirmer ce paiement.");
      return;
    }
    toast.success("Paiement confirmé et abonnement activé.");
    void reload();
  };

  const refundPayment = async (paymentId: string) => {
    setBusyId(paymentId);
    const { error } = await supabase.rpc("admin_refund_subscription_payment", {
      p_payment_id: paymentId,
    });
    setBusyId(null);
    if (error) {
      toast.error(error.message || "Impossible de rembourser ce paiement.");
      return;
    }
    toast.success("Paiement remboursé et abonnement résilié.");
    void reload();
  };

  const updatePlanField = <K extends keyof SubscriptionPlanRow>(
    id: string,
    key: K,
    value: SubscriptionPlanRow[K]
  ) => {
    setPlans((prev) =>
      prev.map((p) => (p.id === id ? { ...p, [key]: value } : p))
    );
  };

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">
            Administration commerciale
          </p>
          <h1 className="mt-1 font-headings text-3xl font-bold tracking-tight">
            Gestion des abonnements & revenus
          </h1>
        </div>
        <Button variant="outline" size="sm" onClick={() => void reload()}>
          <RefreshCw className="size-4" aria-hidden="true" />
          Actualiser
        </Button>
      </div>

      {/* ---------------------- INDICATEURS COMMERCIAUX ---------------------- */}
      <section aria-label="Indicateurs commerciaux" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-primary/30 bg-card p-5">
          <p className="text-xs text-muted-foreground">
            Revenus mensuels récurrents (MRR)
          </p>
          <p className="mt-2 font-headings text-2xl font-bold text-primary">
            {formatFCFA(analytics?.mrr_fcfa ?? 0)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            ARR projeté : {formatFCFA(analytics?.arr_fcfa ?? 0)}
          </p>
        </div>

        <div className="rounded-2xl border border-hairline bg-card p-5">
          <p className="text-xs text-muted-foreground">Abonnés actifs</p>
          <p className="mt-2 font-headings text-2xl font-bold">
            {analytics?.active_subscribers ?? 0}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Expirés : {analytics?.expired_subscribers ?? 0} · Résiliés :{" "}
            {analytics?.cancelled_subscribers ?? 0}
          </p>
        </div>

        <div className="rounded-2xl border border-hairline bg-card p-5">
          <p className="text-xs text-muted-foreground">
            Taux de renouvellement / résiliation
          </p>
          <p className="mt-2 font-headings text-2xl font-bold text-success">
            {analytics?.renewal_rate_pct ?? 100} %
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Taux de résiliation : {analytics?.churn_rate_pct ?? 0} %
          </p>
        </div>

        <div className="rounded-2xl border border-hairline bg-card p-5">
          <p className="text-xs text-muted-foreground">
            Revenus d’abonnements encaissés
          </p>
          <p className="mt-2 font-headings text-2xl font-bold">
            {formatFCFA(analytics?.total_revenue_fcfa ?? 0)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Paiements confirmés
          </p>
        </div>
      </section>

      {/* ------------ RÉPARTITION PAR FORMULE (POPULARITÉ) ------------------- */}
      {analytics?.by_plan && analytics.by_plan.length > 0 ? (
        <section className="rounded-2xl border border-hairline bg-card p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <TrendingUp className="size-4 text-primary" aria-hidden="true" />
            Abonnés par formule
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-4">
            {analytics.by_plan.map((bp) => (
              <div
                key={bp.plan_id}
                className="rounded-xl border border-hairline bg-surface p-4"
              >
                <p className="text-xs text-muted-foreground">{bp.name_fr}</p>
                <p className="mt-1 text-2xl font-bold text-primary">
                  {bp.subscribers}
                </p>
                <p className="text-[11px] text-muted-foreground">abonnés actifs</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* ------------ CONFIGURATION DES TARIFS, QUOTAS & RÉDUCTIONS ---------- */}
      <section className="rounded-2xl border border-hairline bg-card p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Crown className="size-4 text-primary" aria-hidden="true" />
          Configurer les formules, tarifs, quotas et réductions annuelles
        </h2>
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className="space-y-3 rounded-xl border border-hairline bg-surface p-4"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold">
                  {plan.name_fr}{" "}
                  <span className="font-mono text-xs text-muted-foreground">
                    ({plan.id})
                  </span>
                </p>
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={plan.is_active}
                    onChange={(e) =>
                      updatePlanField(plan.id, "is_active", e.target.checked)
                    }
                    className="size-4 accent-primary"
                  />
                  Active
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div>
                  <Label className="text-[11px]">Mensuel (FCFA)</Label>
                  <Input
                    type="number"
                    value={plan.price_monthly_fcfa}
                    onChange={(e) =>
                      updatePlanField(
                        plan.id,
                        "price_monthly_fcfa",
                        Number.parseInt(e.target.value, 10) || 0
                      )
                    }
                    className="mt-1 h-9"
                  />
                </div>
                <div>
                  <Label className="text-[11px]">Annuel (FCFA)</Label>
                  <Input
                    type="number"
                    value={plan.price_annual_fcfa}
                    onChange={(e) =>
                      updatePlanField(
                        plan.id,
                        "price_annual_fcfa",
                        Number.parseInt(e.target.value, 10) || 0
                      )
                    }
                    className="mt-1 h-9"
                  />
                </div>
                <div>
                  <Label className="text-[11px]">Réduction an (%)</Label>
                  <Input
                    type="number"
                    value={plan.annual_discount_pct}
                    onChange={(e) =>
                      updatePlanField(
                        plan.id,
                        "annual_discount_pct",
                        Number.parseInt(e.target.value, 10) || 0
                      )
                    }
                    className="mt-1 h-9"
                  />
                </div>
                <div>
                  <Label className="text-[11px]">Quota contacts/mois</Label>
                  <Input
                    type="number"
                    value={plan.monthly_contacts_quota}
                    onChange={(e) =>
                      updatePlanField(
                        plan.id,
                        "monthly_contacts_quota",
                        Number.parseInt(e.target.value, 10) || 0
                      )
                    }
                    className="mt-1 h-9"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  size="sm"
                  onClick={() => void savePlan(plan)}
                  disabled={busyId === plan.id}
                >
                  {busyId === plan.id ? (
                    <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <Save className="size-3.5" aria-hidden="true" />
                  )}
                  Enregistrer
                </Button>
              </div>
            </div>
          ))}
        </div>

        {/* Créer une nouvelle formule */}
        <form
          onSubmit={createPlan}
          className="mt-6 grid gap-3 rounded-xl border border-hairline bg-surface p-4 sm:grid-cols-5 sm:items-end"
        >
          <div>
            <Label className="text-xs">Identifiant (slug)</Label>
            <Input
              value={newPlanId}
              onChange={(e) => setNewPlanId(e.target.value)}
              placeholder="ex: studio_plus"
              className="mt-1 h-9"
            />
          </div>
          <div>
            <Label className="text-xs">Nom de la formule</Label>
            <Input
              value={newPlanName}
              onChange={(e) => setNewPlanName(e.target.value)}
              placeholder="Studio Plus"
              className="mt-1 h-9"
            />
          </div>
          <div>
            <Label className="text-xs">Tarif mensuel (FCFA)</Label>
            <Input
              type="number"
              value={newPlanMonthly}
              onChange={(e) => setNewPlanMonthly(e.target.value)}
              className="mt-1 h-9"
            />
          </div>
          <div>
            <Label className="text-xs">Quota mensuel</Label>
            <Input
              type="number"
              value={newPlanQuota}
              onChange={(e) => setNewPlanQuota(e.target.value)}
              className="mt-1 h-9"
            />
          </div>
          <Button type="submit" disabled={creatingPlan} className="h-9">
            <Plus className="size-4" aria-hidden="true" />
            Créer la formule
          </Button>
        </form>
      </section>

      {/* ------------ ACCORDER EXCEPTIONNELLEMENT UN ABONNEMENT -------------- */}
      <section className="rounded-2xl border border-hairline bg-card p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Users className="size-4 text-primary" aria-hidden="true" />
          Accorder exceptionnellement un abonnement
        </h2>
        <form
          onSubmit={grantSubscription}
          className="mt-4 grid gap-3 sm:grid-cols-5 sm:items-end"
        >
          <div className="sm:col-span-2">
            <Label className="text-xs">UUID du développeur</Label>
            <Input
              value={grantDevId}
              onChange={(e) => setGrantDevId(e.target.value)}
              placeholder="00000000-0000-0000-0000-000000000000"
              className="mt-1 h-9 font-mono text-xs"
            />
          </div>
          <div>
            <Label className="text-xs">Formule</Label>
            <select
              value={grantPlanId}
              onChange={(e) => setGrantPlanId(e.target.value)}
              className="mt-1 h-9 w-full rounded-xl border border-hairline bg-surface px-3 text-sm"
            >
              {plans
                .filter((p) => p.id !== "free")
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name_fr}
                  </option>
                ))}
            </select>
          </div>
          <div>
            <Label className="text-xs">Périodicité</Label>
            <select
              value={grantCycle}
              onChange={(e) => setGrantCycle(e.target.value)}
              className="mt-1 h-9 w-full rounded-xl border border-hairline bg-surface px-3 text-sm"
            >
              <option value="monthly">Mensuel</option>
              <option value="annual">Annuel</option>
            </select>
          </div>
          <div>
            <Label className="text-xs">Durée (jours)</Label>
            <Input
              type="number"
              value={grantDays}
              onChange={(e) => setGrantDays(e.target.value)}
              className="mt-1 h-9"
            />
          </div>
          <Button type="submit" disabled={granting} className="h-9">
            {granting ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Check className="size-4" aria-hidden="true" />
            )}
            Accorder
          </Button>
        </form>
      </section>

      {/* ------------------- PAIEMENTS, RENOUVELLEMENTS & REMBOURSEMENTS ----- */}
      <section className="rounded-2xl border border-hairline bg-card p-6">
        <h2 className="text-lg font-semibold">
          Paiements d’abonnements, factures et remboursements
        </h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-hairline text-xs text-muted-foreground">
                <th className="py-2.5 pr-4">Facture</th>
                <th className="py-2.5 pr-4">Développeur</th>
                <th className="py-2.5 pr-4">Formule</th>
                <th className="py-2.5 pr-4">Montant</th>
                <th className="py-2.5 pr-4">Statut</th>
                <th className="py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {(analytics?.recent_payments ?? []).map((pay) => (
                <tr key={pay.id}>
                  <td className="py-3 pr-4 font-mono text-xs">
                    {pay.invoice_number}
                  </td>
                  <td className="py-3 pr-4">
                    {pay.full_name ?? pay.username ?? pay.developer_id.slice(0, 8)}
                  </td>
                  <td className="py-3 pr-4">
                    {pay.plan_id.toUpperCase()} ({pay.billing_cycle})
                  </td>
                  <td className="py-3 pr-4 font-semibold">
                    {formatFCFA(pay.amount_fcfa)}
                  </td>
                  <td className="py-3 pr-4">
                    <span className="rounded-full border border-hairline bg-surface px-2.5 py-0.5 text-xs">
                      {pay.status}
                    </span>
                  </td>
                  <td className="py-3 text-right">
                    <div className="inline-flex items-center gap-2">
                      {pay.status === "pending" ? (
                        <Button
                          size="sm"
                          onClick={() => void confirmPayment(pay.id)}
                          disabled={busyId === pay.id}
                        >
                          Confirmer
                        </Button>
                      ) : null}
                      {pay.status === "confirmed" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void refundPayment(pay.id)}
                          disabled={busyId === pay.id}
                        >
                          <RotateCcw className="size-3.5" aria-hidden="true" />
                          Rembourser
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
              {(analytics?.recent_payments ?? []).length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-sm text-muted-foreground">
                    Aucun paiement d’abonnement enregistré pour le moment.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
