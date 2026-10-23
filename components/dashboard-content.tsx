"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Briefcase,
  CalendarClock,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Coins,
  Download,
  ExternalLink,
  Globe,
  LayoutGrid,
  List,
  Loader2,
  MessageCircle,
  MessagesSquare,
  Plus,
  Save,
  Search,
  Send,
  Share2,
  Star,
  Target,
  Trash2,
} from "lucide-react";
import { DashboardStats } from "@/components/dashboard-stats";
import AvailabilityCard from "@/components/availability-card";
import { MissionsManager, type TlMissionOption } from "@/components/dev/missions-manager";
import AgencyManager from "@/components/agency/agency-manager";
import ProPanel from "@/components/sponsoring/pro-panel";
import { ShareProfileButton } from "@/components/dev/share-profile-button";
import { DevReviewsPanel } from "@/components/dev/reviews-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/ui/phone-input";
import { RegionSelectContent } from "@/components/ui/region-select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/empty-state";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import { parseSkills } from "@/lib/validations";
import { formatFCFA, formatDate } from "@/lib/formatting";
import { waLink } from "@/lib/tokens";
import { ALL_REGION_ITEMS } from "@/lib/countries";
import type { ConversationListItem } from "@/lib/conversations";
import type {
  TransactionRow,
  DeveloperProfile,
  TokenOrderStatus,
  CrmStatus,
  PortfolioLink,
  MyDeveloperMission,
  MyDeveloperReviews,
} from "@/types/database";
import { cn } from "cn";

export type UnlockHistoryItem = {
  unlock_id: string;
  request_id: string;
  client_name: string;
  client_city: string;
  project_type: string;
  budget: number;
  client_whatsapp: string;
  unlocked_at: string;
  crm_status: CrmStatus;
  notes: string | null;
  reminder_at: string | null;
  refund_status: string | null;
};

export type OrderItem = {
  id: string;
  package_name: string;
  tokens: number;
  price_fcfa: number;
  status: TokenOrderStatus;
  created_at: string;
};

export type ReviewsSummary = {
  total: number;
  average: number;
  satisfaction: number;
  average_criteria: Record<string, number>;
  reviews: {
    id: string;
    rating: number;
    comment: string | null;
    client_name: string | null;
    request_type: string | null;
    request_budget: number | null;
    response: string | null;
    responded_at: string | null;
    created_at: string;
  }[];
};

const CRM_STATUS_LABELS: Record<CrmStatus, string> = {
  a_contacter: "À contacter",
  en_discussion: "En discussion",
  gagne: "Gagné",
  perdu: "Perdu",
};

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex h-8 items-center rounded-lg border px-2.5 text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
        active
          ? "border-primary/60 bg-primary-soft text-primary-light"
          : "border-hairline bg-transparent text-muted-foreground hover:bg-muted"
      )}
    >
      {children}
    </button>
  );
}

type TabKey = "crm" | "profil" | "activite" | "devis" | "missions" | "avis" | "agence" | "pro";

function DevStatusBanner({ profile }: { profile: DeveloperProfile }) {
  const status = profile.status;
  const verified = Boolean(profile.is_verified) || status === "verified";

  if (verified) {
    return (
      <div className="mt-6 flex items-start gap-3 rounded-2xl border border-success/40 bg-success-soft p-4 sm:p-5">
        <BadgeCheck className="mt-0.5 size-5 shrink-0 text-success" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold tracking-tight">Profil vérifié par Devmarket</p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Votre badge Vérifié est affiché sur votre fiche publique. Merci pour votre confiance.
          </p>
        </div>
      </div>
    );
  }

  if (status === "verification_pending") {
    return (
      <div className="mt-6 flex items-start gap-3 rounded-2xl border border-primary/30 bg-primary-soft p-4 sm:p-5">
        <Clock className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold tracking-tight">Vérification en cours</p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Le paiement est confirmé et notre équipe examine votre dossier.
            Une notification sera envoyée dès la fin de l’examen.
          </p>
        </div>
        <Link
          href="/verification"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-primary/40 bg-surface px-3 py-2 text-xs font-medium text-foreground transition-colors outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary/50"
        >
          Suivre l’état
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </Link>
      </div>
    );
  }

  if (status === "active") {
    return (
      <div className="mt-6 flex items-start gap-3 rounded-2xl border border-hairline bg-primary-soft p-4 sm:p-5">
        <BadgeCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold tracking-tight">Profil actif</p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Votre profil est visible dans le catalogue. Complétez-le pour maximiser vos chances.
          </p>
        </div>
      </div>
    );
  }

  if (status === "suspended") {
    return (
      <DevStatusBannerShell
        tone="error"
        title="Compte suspendu"
        message="Votre compte a été suspendu. Nos conditions d’utilisation ont peut-être été enfreintes. Contactez notre équipe pour toute précision."
      />
    );
  }

  if (status === "rejected") {
    return (
      <DevStatusBannerShell
        tone="error"
        title="Inscription refusée"
        message={
          profile.rejection_reason
            ? `Motif : ${profile.rejection_reason}`
            : "Votre dossier n’a pas été retenu pour le moment. Vous pouvez soumettre une nouvelle demande."
        }
        cta={{ href: "/inscription-developpeur", label: "Relancer mon inscription" }}
      />
    );
  }

  if (status === "changes_requested") {
    return (
      <DevStatusBannerShell
        tone="warn"
        title="Modifications demandées"
        message={
          profile.rejection_reason
            ? `Motif : ${profile.rejection_reason}`
            : "Notre équipe a demandé des corrections sur votre dossier."
        }
        cta={{ href: "/inscription-developpeur", label: "Compléter mon dossier" }}
        hint="Toute nouvelle soumission repasse en attente d’approbation."
      />
    );
  }

  return (
    <DevStatusBannerShell
      tone="warn"
      title="En attente de validation"
      message="Votre profil développeur sera examiné par notre équipe. Tant que le compte n’est pas validé, le déblocage des briefs est suspendu."
      cta={{ href: "/inscription-developpeur", label: "Voir mon dossier" }}
    />
  );
}

function DevStatusBannerShell({
  tone,
  title,
  message,
  hint,
  cta,
}: {
  tone: "warn" | "error";
  title: string;
  message: string;
  hint?: string;
  cta?: { href: string; label: string };
}) {
  return (
    <div
      className={cn(
        "mt-6 flex items-start gap-3 rounded-2xl border p-4 sm:p-5",
        tone === "error"
          ? "border-[var(--error)]/30 bg-[var(--error-soft)]"
          : "border-primary/30 bg-primary-soft"
      )}
    >
      <AlertTriangle
        className={cn(
          "mt-0.5 size-5 shrink-0",
          tone === "error" ? "text-[var(--error)]" : "text-primary"
        )}
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1">
        <p className={cn("text-sm font-semibold tracking-tight", tone === "error" && "text-[var(--error)]")}>
          {title}
        </p>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{message}</p>
        {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
      </div>
      {cta ? (
        <Link
          href={cta.href}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-ink transition-colors outline-none hover:bg-primary-hover focus-visible:ring-2 focus-visible:ring-primary/50"
        >
          {cta.label}
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </Link>
      ) : null}
    </div>
  );
}

export function DashboardContent({
  userId,
  profile,
  balance,
  unlocks,
  transactions,
  orders,
  reviews,
  myReviews,
  missions,
  myMissions,
  tlMissions,
  devisEnAttente,
  initialTab,
}: {
  userId: string;
  profile: DeveloperProfile | null;
  balance: number;
  unlocks: UnlockHistoryItem[];
  transactions: TransactionRow[];
  orders: OrderItem[];
  reviews: ReviewsSummary | null;
  myReviews: MyDeveloperReviews | null;
  missions: ConversationListItem[];
  myMissions: MyDeveloperMission[];
  tlMissions: TlMissionOption[];
  devisEnAttente: ConversationListItem[];
  initialTab?: string;
}) {
  const [p, setP] = React.useState({
    full_name: profile?.full_name ?? "",
    whatsapp: profile?.whatsapp ?? "",
    skills: profile?.skills?.join(", ") ?? "",
    city: profile?.city ?? "",
    username: profile?.username ?? "",
    bio: profile?.bio ?? "",
    experience_years: profile?.experience_years ?? 1,
    notifications_enabled: profile?.notifications_enabled ?? true,
    monthly_goal: profile?.monthly_goal ?? 0,
  });
  const [portfolio, setPortfolio] = React.useState<PortfolioLink[]>(
    profile?.portfolio_links ?? []
  );
  const [crm, setCrm] = React.useState<Record<string, CrmStatus>>(() =>
    Object.fromEntries(unlocks.map((u) => [u.unlock_id, u.crm_status]))
  );
  const [notesDraft, setNotesDraft] = React.useState<Record<string, string>>(() =>
    Object.fromEntries(unlocks.map((u) => [u.unlock_id, u.notes ?? ""]))
  );
  const [pendingRefunds, setPendingRefunds] = React.useState<Record<string, boolean>>(() =>
    Object.fromEntries(unlocks.map((u) => [u.unlock_id, Boolean(u.refund_status)]))
  );
  const [reminders, setReminders] = React.useState<Record<string, string>>(() =>
    Object.fromEntries(unlocks.map((u) => [u.unlock_id, u.reminder_at ?? ""]))
  );
  const [crmView, setCrmView] = React.useState<"board" | "list">("board");
  const [savingGoal, setSavingGoal] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const defaultTab: TabKey = (
    ["crm", "profil", "activite", "devis", "missions", "avis", "agence", "pro"] as TabKey[]
  ).includes(initialTab as TabKey)
    ? (initialTab as TabKey)
    : unlocks.length > 0
      ? "crm"
      : "profil";
  const [tab, setTab] = React.useState<TabKey>(defaultTab);
  /* ?tab=profil vient du menu latéral : suivre l'URL même après le montage
     (navigation depuis /dashboard lui-même, retour arrière, lien depuis
     /parametres…). L'onglet initial seul ne suffisait pas. */
  React.useEffect(() => {
    if (
      (
        ["crm", "profil", "activite", "devis", "missions", "avis", "agence", "pro"] as TabKey[]
      ).includes(initialTab as TabKey)
    ) {
      setTab(initialTab as TabKey);
    }
  }, [initialTab]);
  const [refundFor, setRefundFor] = React.useState<UnlockHistoryItem | null>(null);
  const [refundReason, setRefundReason] = React.useState("");
  const [refunding, setRefunding] = React.useState(false);
  const [crmSaving, setCrmSaving] = React.useState<string | null>(null);
  const [crmQuery, setCrmQuery] = React.useState("");
  const [crmStatusFilter, setCrmStatusFilter] = React.useState<CrmStatus | "all">("all");

  const tokensUsed = transactions
    .filter((t) => t.type === "unlock")
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  /* Progression du profil : photo et portfolio sont des recommandations
     (optionnelles), les autres critères structurent la complétion. */
  const profileChecks: { label: string; done: boolean }[] = [
    { label: "Photo de profil (recommandée)", done: Boolean(profile?.avatar_url) },
    { label: "Bio présentée", done: Boolean(p.bio.trim()) },
    { label: "Identifiant public", done: Boolean(p.username.trim()) },
    { label: "Ville", done: Boolean(p.city.trim()) },
    { label: "Compétences", done: Boolean(p.skills.trim()) },
    {
      label: "Portfolio (optionnel, recommandé)",
      done: portfolio.some((l) => l.title.trim() && l.url.trim()),
    },
  ];
  const profileScore = Math.round(
    (profileChecks.filter((c) => c.done).length / profileChecks.length) * 100
  );
  const heroParts = [
    `${balance} Token${balance > 1 ? "s" : ""} disponible${balance > 1 ? "s" : ""}`,
    `${unlocks.length} contact${unlocks.length > 1 ? "s" : ""} débloqué${unlocks.length > 1 ? "s" : ""}`,
    `${myMissions.length} mission${myMissions.length > 1 ? "s" : ""} en cours`,
  ];
  const heroSubtitle =
    unlocks.length === 0 && myMissions.length === 0 && transactions.length === 0
      ? "Suivez vos Tokens, pilotez vos contacts et soignez votre profil."
      : heroParts.join(" · ");

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const validLinks = portfolio.filter(
      (l) => l.title.trim() && l.url.trim()
    );
    if (validLinks.length !== portfolio.length) {
      toast.error("Certains liens de projet sont incomplets et ont été ignorés.");
    }
    const username = p.username.trim().toLowerCase() || null;
    if (username && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(username)) {
      toast.error("Identifiant invalide : lettres, chiffres et tirets uniquement (ex : moussa-diop).");
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("developers")
      .update({
        full_name: p.full_name.trim() || null,
        whatsapp: p.whatsapp.trim() || null,
        skills: parseSkills(p.skills),
        city: p.city.trim() || null,
        username,
        bio: p.bio.trim() || null,
        experience_years: Number(p.experience_years) || 1,
        portfolio_links: validLinks,
        notifications_enabled: p.notifications_enabled,
      })
      .eq("id", userId);
    setSaving(false);
    if (error) {
      if (error.message?.includes("developers_username_uidx")) {
        toast.error("Cet identifiant est déjà pris. Choisissez-en un autre.");
      } else if (error.message?.includes("TLWA")) {
        toast.error(
          "Ce numéro WhatsApp est déjà associé à un autre compte."
        );
      } else {
        toast.error("Impossible de mettre à jour le profil.");
      }
      return;
    }
    toast.success("Profil mis à jour");
  };

  const updateCrm = async (
    unlockId: string,
    status: CrmStatus,
    notes: string | null,
    reminderAt?: string | null
  ) => {
    setCrmSaving(unlockId);
    const supabase = createClient();
    const { error } = await supabase.rpc("update_unlock_crm", {
      p_unlock_id: unlockId,
      p_status: status,
      p_notes: notes,
      p_reminder_at: reminderAt !== undefined ? (reminderAt || null) : null,
    });
    setCrmSaving(null);
    if (error) {
      toast.error("Impossible de mettre à jour le contact.");
      return false;
    }
    return true;
  };

  const changeStatus = async (item: UnlockHistoryItem, status: CrmStatus) => {
    if (status === item.crm_status) return;
    const previous = crm[item.unlock_id];
    setCrm((prev) => ({ ...prev, [item.unlock_id]: status }));
    const ok = await updateCrm(item.unlock_id, status, notesDraft[item.unlock_id] ?? null, reminders[item.unlock_id] ?? null);
    if (!ok) setCrm((prev) => ({ ...prev, [item.unlock_id]: previous }));
  };

  const saveNotes = async (item: UnlockHistoryItem) => {
    const notes = notesDraft[item.unlock_id] ?? null;
    if (notes === (item.notes ?? "")) return;
    await updateCrm(item.unlock_id, crm[item.unlock_id] ?? item.crm_status, notes, reminders[item.unlock_id] ?? null);
  };

  const saveReminder = async (item: UnlockHistoryItem, value: string) => {
    setReminders((prev) => ({ ...prev, [item.unlock_id]: value }));
    const ok = await updateCrm(
      item.unlock_id,
      crm[item.unlock_id] ?? item.crm_status,
      notesDraft[item.unlock_id] ?? null,
      value || null
    );
    if (ok && value) {
      toast.success("Rappel enregistré.");
    }
  };

  const saveGoal = async () => {
    const goal = Math.max(0, Math.min(1000, Number(p.monthly_goal) || 0));
    setP((prev) => ({ ...prev, monthly_goal: goal }));
    if (goal === (profile?.monthly_goal ?? 0)) return;
    setSavingGoal(true);
    const supabase = createClient();
    const { error } = await supabase.rpc("set_monthly_goal", { p_goal: goal });
    setSavingGoal(false);
    if (error) {
      toast.error("Impossible d'enregistrer l'objectif.");
      return;
    }
    toast.success("Objectif mensuel mis à jour.");
  };

  const cascadeStatus = (current: CrmStatus, direction: -1 | 1): CrmStatus => {
    const order: CrmStatus[] = ["a_contacter", "en_discussion", "gagne", "perdu"];
    const idx = order.indexOf(current);
    const next = Math.max(0, Math.min(order.length - 1, idx + direction));
    return order[next];
  };

  const submitRefund = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!refundFor) return;
    setRefunding(true);
    const supabase = createClient();
    const { error } = await supabase.rpc("request_token_refund", {
      p_unlock_id: refundFor.unlock_id,
      p_reason: refundReason,
    });
    setRefunding(false);
    if (error) {
      toast.error(error.message || "Impossible d’envoyer la demande.");
      return;
    }
    setPendingRefunds((prev) => ({ ...prev, [refundFor.unlock_id]: true }));
    setRefundFor(null);
    setRefundReason("");
    toast.success("Demande de remboursement envoyée. Notre équipe va vérifier le numéro.");
  };

  const addPortfolioLink = () => {
    setPortfolio((prev) => [...prev, { title: "", url: "", description: "" }]);
  };

  const updatePortfolioLink = (index: number, patch: Partial<PortfolioLink>) => {
    setPortfolio((prev) =>
      prev.map((link, i) => (i === index ? { ...link, ...patch } : link))
    );
  };

  const removePortfolioLink = (index: number) => {
    setPortfolio((prev) => prev.filter((_, i) => i !== index));
  };

  const publicUrl = p.username ? `/dev/${p.username.trim().toLowerCase()}` : null;
  const statusCounts = unlocks.reduce<Record<string, number>>(
    (acc, u) => {
      const status = crm[u.unlock_id] ?? u.crm_status;
      acc[status] = (acc[status] ?? 0) + 1;
      return acc;
    },
    {}
  );

  const filteredUnlocks = unlocks.filter((item) => {
    const status = crm[item.unlock_id] ?? item.crm_status;
    if (crmStatusFilter !== "all" && status !== crmStatusFilter) return false;
    const q = crmQuery.trim().toLowerCase();
    if (!q) return true;
    const haystack = `${item.client_name} ${item.client_city} ${item.project_type} ${item.client_whatsapp}`.toLowerCase();
    return haystack.includes(q);
  });

  const wonCount = statusCounts.gagne ?? 0;
  const conversionPct =
    unlocks.length > 0 ? Math.round((wonCount / unlocks.length) * 100) : 0;

  const wonThisMonth = unlocks.filter((u) => {
    const s = crm[u.unlock_id] ?? u.crm_status;
    if (s !== "gagne") return false;
    const d = new Date(u.unlocked_at);
    const now = new Date();
    return (
      d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
    );
  }).length;
  const monthlyGoal = Math.max(0, p.monthly_goal || 0);

  const toLocalInput = (iso: string) => (iso ? new Date(iso).toISOString().slice(0, 16) : "");
  const fromLocalInput = (value: string) => (value ? new Date(value).toISOString() : "");

  const exportCsv = () => {
    const header = [
      "Nom",
      "Ville",
      "Type de projet",
      "Budget FCFA",
      "WhatsApp",
      "Statut",
      "Note privée",
      "Débloqué le",
    ];
    const rows = filteredUnlocks.map((item) => [
      item.client_name,
      item.client_city,
      item.project_type,
      String(item.budget),
      item.client_whatsapp,
      CRM_STATUS_LABELS[crm[item.unlock_id] ?? item.crm_status],
      item.notes ?? "",
      formatDate(item.unlocked_at),
    ]);
    const csv =
      "\uFEFF" +
      [header, ...rows]
        .map((row) =>
          row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(";")
        )
        .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "contacts-devmarket.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const tabs: { key: TabKey; label: string; count?: number }[] = [
    {
      key: "crm",
      label: "Contacts débloqués",
      count: unlocks.length,
    },
    { key: "profil", label: "Mon profil & portfolio" },
    { key: "activite", label: "Réputation & commandes" },
    { key: "devis", label: "Devis & missions", count: missions.length + devisEnAttente.length },
    { key: "missions", label: "Missions réalisées", count: myMissions.length },
    { key: "avis", label: "Mes avis", count: myReviews?.total },
    { key: "agence", label: "Mon agence" },
    { key: "pro", label: "Abonnement PRO" },
  ];

  return (
    <div className="bg-surface py-16 md:py-24">
      <div className="container-tl">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
              {p.full_name ? `Bonjour, ${p.full_name.split(" ")[0]}` : "Votre espace développeur"}
            </h1>
            <p className="mt-2 text-base text-muted-foreground">
              {heroSubtitle}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/conversations"
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-hairline bg-card px-5 text-sm font-medium text-foreground transition-colors outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary/50"
            >
              <MessageCircle className="size-4" aria-hidden="true" />
              Mes discussions
            </Link>
            <Link
              href="/wallet#acheter-tokens"
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-hairline bg-card px-5 text-sm font-medium text-foreground transition-colors outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary/50"
            >
              <Coins className="size-4" aria-hidden="true" />
              Acheter des Tokens
            </Link>
            <Link
              href="/wallet"
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-medium text-ink transition-colors outline-none hover:bg-primary-hover focus-visible:ring-2 focus-visible:ring-primary/50"
            >
              Mon wallet
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
        </div>

        {profile ? <DevStatusBanner profile={profile} /> : null}

        {profileScore < 100 ? (
          <section
            className="mt-6 rounded-2xl border border-hairline bg-card p-5 sm:p-6"
            aria-label="Progression de votre profil"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold tracking-tight">
                  Profil {profileScore} % complet
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Un profil soigné rassure les clients et débloque plus de
                  contacts. Photo et portfolio restent facultatifs.
                </p>
              </div>
              <Button
                type="button"
                onClick={() => setTab("profil")}
                className="h-10 w-full shrink-0 rounded-xl bg-primary px-5 text-sm font-medium text-ink transition-colors hover:bg-primary-hover sm:w-auto"
              >
                Compléter mon profil
                <ArrowRight className="size-4" aria-hidden="true" />
              </Button>
            </div>
            <div
              className="mt-4 h-2 w-full overflow-hidden rounded-full bg-hairline"
              role="progressbar"
              aria-valuenow={profileScore}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Progression du profil"
            >
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${profileScore}%` }}
              />
            </div>
            <ul className="mt-3 flex flex-wrap gap-2">
              {profileChecks.map((c) => (
                <li
                  key={c.label}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs",
                    c.done
                      ? "border-success/40 bg-success-soft text-success"
                      : "border-hairline bg-background text-muted-foreground"
                  )}
                >
                  {c.done ? (
                    <Check className="size-3" aria-hidden="true" />
                  ) : (
                    <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />
                  )}
                  {c.label}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <div className="mt-10">
          <DashboardStats
            balance={balance}
            tokensUsed={tokensUsed}
            unlocksCount={unlocks.length}
          />
        </div>

        <nav
          className="mt-10 flex flex-wrap gap-2 border-b border-hairline pb-px"
          aria-label="Sections du dashboard"
        >
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={cn(
                "inline-flex h-10 items-center gap-2 rounded-t-xl px-4 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/50",
                tab === t.key
                  ? "border border-hairline border-b-transparent bg-card text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t.label}
              {typeof t.count === "number" ? (
                <span className="rounded-full bg-hairline px-2 py-0.5 text-xs text-muted-foreground">
                  {t.count}
                </span>
              ) : null}
            </button>
          ))}
        </nav>

        {tab === "crm" ? (
          <section className="mt-8" aria-label="CRM contacts débloqués">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold tracking-tight">
                  Pilotez vos prospects
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Suivez chaque client débloqué. Vos notes sont privées et
                  restent dans votre espace.
                </p>
              </div>
              {unlocks.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(CRM_STATUS_LABELS) as CrmStatus[]).map((s) => (
                    <span
                      key={s}
                      className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"
                    >
                      {s === "a_contacter" ? null : (
                        <span
                          className={cn(
                            "size-2 rounded-full",
                            s === "en_discussion" && "bg-primary",
                            s === "gagne" && "bg-success",
                            s === "perdu" && "bg-muted"
                          )}
                        />
                      )}
                      {CRM_STATUS_LABELS[s]} : {statusCounts[s] ?? 0}
                    </span>
                  ))}
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-success">
                    Conversion : {conversionPct}%
                  </span>
                </div>
              ) : null}
            </div>

            {unlocks.length > 0 ? (
              <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
                <div className="rounded-2xl border border-hairline bg-card p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="flex items-center gap-2 text-sm font-semibold tracking-tight">
                        <Target className="size-4 text-primary" aria-hidden="true" />
                        Objectif du mois
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Missions gagnées depuis le 1er du mois.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={0}
                        max={1000}
                        value={p.monthly_goal || ""}
                        onChange={(e) =>
                          setP({ ...p, monthly_goal: Number(e.target.value) })
                        }
                        className="h-9 w-24 rounded-lg text-sm"
                        placeholder="Objectif"
                        aria-label="Objectif mensuel de missions gagnées"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-9 rounded-lg"
                        onClick={saveGoal}
                        disabled={savingGoal}
                      >
                        {savingGoal ? (
                          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                        ) : (
                          <Save className="size-3.5" aria-hidden="true" />
                        )}
                        Enregistrer
                      </Button>
                    </div>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-hairline">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-500"
                      style={{
                        width: `${
                          monthlyGoal > 0
                            ? Math.min(100, Math.round((wonThisMonth / monthlyGoal) * 100))
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    <span className="font-medium text-success">{wonThisMonth}</span> gagné
                    {wonThisMonth > 1 ? "s" : ""} ce mois
                    {monthlyGoal > 0 ? ` sur ${monthlyGoal}` : " — renseignez un objectif"} (
                    {monthlyGoal > 0
                      ? Math.min(100, Math.round((wonThisMonth / monthlyGoal) * 100))
                      : 0}
                    %)
                  </p>
                </div>

                <div
                  className="flex shrink-0 items-center gap-1.5"
                  role="group"
                  aria-label="Affichage du CRM"
                >
                  <button
                    type="button"
                    onClick={() => setCrmView("board")}
                    aria-pressed={crmView === "board"}
                    className={cn(
                      "inline-flex h-10 items-center gap-1.5 rounded-xl border px-3.5 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/50",
                      crmView === "board"
                        ? "border-primary/60 bg-primary-soft text-primary-light"
                        : "border-hairline bg-transparent text-muted-foreground hover:bg-muted"
                    )}
                  >
                    <LayoutGrid className="size-4" aria-hidden="true" />
                    Kanban
                  </button>
                  <button
                    type="button"
                    onClick={() => setCrmView("list")}
                    aria-pressed={crmView === "list"}
                    className={cn(
                      "inline-flex h-10 items-center gap-1.5 rounded-xl border px-3.5 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/50",
                      crmView === "list"
                        ? "border-primary/60 bg-primary-soft text-primary-light"
                        : "border-hairline bg-transparent text-muted-foreground hover:bg-muted"
                    )}
                  >
                    <List className="size-4" aria-hidden="true" />
                    Liste
                  </button>
                </div>
              </div>
            ) : null}

            {unlocks.length > 0 ? (
              <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="relative flex-1">
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <Input
                    value={crmQuery}
                    onChange={(e) => setCrmQuery(e.target.value)}
                    placeholder="Rechercher un client, une ville, un projet…"
                    className="h-10 rounded-xl pl-9"
                    aria-label="Rechercher dans les contacts débloqués"
                  />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <FilterChip
                    active={crmStatusFilter === "all"}
                    onClick={() => setCrmStatusFilter("all")}
                  >
                    Tous
                  </FilterChip>
                  {(Object.keys(CRM_STATUS_LABELS) as CrmStatus[]).map((s) => (
                    <FilterChip
                      key={s}
                      active={crmStatusFilter === s}
                      onClick={() => setCrmStatusFilter(s)}
                    >
                      {CRM_STATUS_LABELS[s]}
                    </FilterChip>
                  ))}
                  <button
                    type="button"
                    onClick={exportCsv}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-hairline bg-card px-2.5 text-xs font-medium text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/50"
                  >
                    <Download className="size-3.5" aria-hidden="true" />
                    Export CSV
                  </button>
                </div>
              </div>
            ) : null}

            {unlocks.length === 0 ? (
              <div className="mt-6">
                <EmptyState
                  title="Aucun contact débloqué pour le moment"
                  description="Débloquez un brief avec 1 Token pour démarrer une discussion avec le client et suivre vos candidatures ici."
                  action={
                    <Link
                      href="/briefs"
                      className="inline-flex h-10 items-center gap-2 rounded-xl bg-foreground px-5 text-sm font-medium text-ink transition-colors outline-none hover:bg-foreground"
                    >
                      Voir les briefs
                      <ArrowRight className="size-4" aria-hidden="true" />
                    </Link>
                  }
                />
              </div>
            ) : filteredUnlocks.length === 0 ? (
              <div className="mt-6">
                <EmptyState
                  title="Aucun contact ne correspond"
                  description="Modifiez votre recherche ou changez de filtre pour retrouver vos contacts."
                />
              </div>
            ) : crmView === "board" ? (
              <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {(Object.keys(CRM_STATUS_LABELS) as CrmStatus[]).map((col) => {
                  const colItems = filteredUnlocks.filter(
                    (i) => (crm[i.unlock_id] ?? i.crm_status) === col
                  );
                  return (
                    <div
                      key={col}
                      className="flex min-w-0 flex-col rounded-2xl border border-hairline bg-surface p-3"
                    >
                      <div className="flex items-center justify-between px-1 pb-2">
                        <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          <span
                            className={cn(
                              "size-2 rounded-full",
                              col === "a_contacter" && "bg-muted",
                              col === "en_discussion" && "bg-primary",
                              col === "gagne" && "bg-success",
                              col === "perdu" && "bg-muted-foreground"
                            )}
                          />
                          {CRM_STATUS_LABELS[col]}
                        </span>
                        <span className="rounded-full bg-hairline px-2 py-0.5 text-[11px] text-muted-foreground">
                          {colItems.length}
                        </span>
                      </div>
                      <div className="flex min-h-24 flex-col gap-2.5">
                        {colItems.length === 0 ? (
                          <div className="rounded-xl border border-dashed border-hairline p-4 text-center text-xs text-muted-foreground">
                            Aucun contact
                          </div>
                        ) : (
                          colItems.map((item) => {
                            const current = crm[item.unlock_id] ?? item.crm_status;
                            const saving = crmSaving === item.unlock_id;
                            const reminder = reminders[item.unlock_id] ?? "";
                            const atLine = item.client_city || "Ville inconnue";
                            return (
                              <div
                                key={item.unlock_id}
                                className="rounded-xl border border-hairline bg-card p-3"
                              >
                                <p className="text-sm font-medium leading-snug">
                                  {item.client_name}
                                </p>
                                <p className="mt-0.5 text-xs text-muted-foreground">
                                  {atLine} · {formatFCFA(item.budget)}
                                </p>
                                <a
                                  href={waLink(item.client_whatsapp)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="mt-1 inline-block text-xs font-medium text-primary underline-offset-4 hover:underline"
                                >
                                  {item.client_whatsapp}
                                </a>
                                {reminder ? (
                                  <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                                    <CalendarClock className="size-3 text-primary" aria-hidden="true" />
                                    Rappel : {formatDate(reminder)}
                                  </p>
                                ) : null}
                                <div className="mt-2.5 flex items-center gap-1.5">
                                  <input
                                    type="datetime-local"
                                    value={toLocalInput(reminder)}
                                    disabled={saving}
                                    onChange={(e) =>
                                      setReminders((prev) => ({
                                        ...prev,
                                        [item.unlock_id]: fromLocalInput(e.target.value),
                                      }))
                                    }
                                    onBlur={() => {
                                      if (fromLocalInput(reminder) !== (item.reminder_at ?? "")) {
                                        void saveReminder(item, reminder);
                                      }
                                    }}
                                    className="h-8 w-full rounded-lg border border-hairline bg-surface px-2 text-[11px] text-muted-foreground outline-none focus:border-primary/50 disabled:cursor-not-allowed disabled:opacity-60"
                                    title="Rappel (date et heure)"
                                  />
                                </div>
                                <div className="mt-1.5 flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      changeStatus(item, cascadeStatus(current, -1))
                                    }
                                    disabled={saving || current === "a_contacter"}
                                    className="inline-flex size-7 items-center justify-center rounded-lg border border-hairline text-muted-foreground outline-none transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                                    aria-label={`Revenir à un statut précédent pour ${item.client_name}`}
                                  >
                                    <ChevronLeft className="size-3.5" aria-hidden="true" />
                                  </button>
                                  {current !== "gagne" ? (
                                    <button
                                      type="button"
                                      onClick={() => changeStatus(item, "gagne")}
                                      disabled={saving}
                                      className="inline-flex h-7 flex-1 items-center justify-center gap-1 rounded-lg border border-success/40 bg-success-soft text-[11px] font-medium text-success outline-none transition-colors hover:bg-success-soft disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                      <Check className="size-3" aria-hidden="true" />
                                      Gagné
                                    </button>
                                  ) : (
                                    <span className="inline-flex h-7 flex-1 items-center justify-center gap-1 rounded-lg border border-success/40 bg-success-soft text-[11px] font-medium text-success">
                                      🎉
                                    </span>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() =>
                                      changeStatus(item, cascadeStatus(current, 1))
                                    }
                                    disabled={saving || current === "perdu"}
                                    className="inline-flex size-7 items-center justify-center rounded-lg border border-hairline text-muted-foreground outline-none transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                                    aria-label={`Avancer le statut pour ${item.client_name}`}
                                  >
                                    <ChevronRight className="size-3.5" aria-hidden="true" />
                                  </button>
                                </div>
                                <div className="mt-1.5">
                                  <Input
                                    value={notesDraft[item.unlock_id] ?? ""}
                                    onChange={(e) =>
                                      setNotesDraft((prev) => ({
                                        ...prev,
                                        [item.unlock_id]: e.target.value,
                                      }))
                                    }
                                    onBlur={() => saveNotes(item)}
                                    disabled={saving}
                                    placeholder="Note privée…"
                                    className="h-7 rounded-lg text-[11px]"
                                    aria-label={`Note pour ${item.client_name}`}
                                  />
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <ul className="mt-6 space-y-4">
                {filteredUnlocks.map((item) => {
                  const currentStatus = crm[item.unlock_id] ?? item.crm_status;
                  const savingThis = crmSaving === item.unlock_id;
                  const refundPending = pendingRefunds[item.unlock_id];
                  return (
                    <li
                      key={item.unlock_id}
                      className="rounded-2xl border border-hairline bg-card p-5"
                    >
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium">{item.client_name}</p>
                            {refundPending ? (
                              <span className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary-soft px-2 py-0.5 text-[11px] font-medium text-primary-light">
                                <Clock className="size-3" aria-hidden="true" />
                                Remboursement en cours
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-0.5 text-sm text-muted-foreground">
                            {item.client_city || "Ville inconnue"} ·{" "}
                            {formatFCFA(item.budget)} · Débloqué le{" "}
                            {formatDate(item.unlocked_at)}
                          </p>
                          <div className="mt-1 flex items-center gap-3 text-sm">
                            <a
                              href={waLink(item.client_whatsapp)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 font-medium text-primary underline-offset-4 hover:underline"
                            >
                              {item.client_whatsapp}
                              <ExternalLink className="size-3.5" aria-hidden="true" />
                            </a>
                            {savingThis ? (
                              <Loader2
                                className="size-3.5 animate-spin text-muted-foreground"
                                aria-label="Enregistrement"
                              />
                            ) : null}
                          </div>
                        </div>

                        <div className="flex w-full flex-col gap-3 lg:max-w-sm lg:items-end">
                          <div
                            className="flex w-full flex-wrap gap-1.5"
                            role="group"
                            aria-label={`Statut du contact ${item.client_name}`}
                          >
                            {(Object.keys(CRM_STATUS_LABELS) as CrmStatus[]).map((s) => (
                              <button
                                key={s}
                                type="button"
                                onClick={() => changeStatus(item, s)}
                                disabled={savingThis}
                                className={cn(
                                  "inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/50 disabled:cursor-not-allowed disabled:opacity-60",
                                  currentStatus === s
                                    ? s === "gagne"
                                      ? "border-success/40 bg-success-soft text-success"
                                      : s === "perdu"
                                        ? "border-border-strong bg-muted text-muted-foreground"
                                        : "border-primary/60 bg-primary-soft text-primary-light"
                                    : "border-hairline bg-transparent text-muted-foreground hover:bg-muted"
                                )}
                              >
                                {s === "gagne" ? (
                                  <span aria-hidden="true">🎉</span>
                                ) : null}
                                {CRM_STATUS_LABELS[s]}
                              </button>
                            ))}
                          </div>

                          <div className="flex w-full items-center gap-2">
                            <Input
                              value={notesDraft[item.unlock_id] ?? ""}
                              onChange={(e) =>
                                setNotesDraft((prev) => ({
                                  ...prev,
                                  [item.unlock_id]: e.target.value,
                                }))
                              }
                              onBlur={() => saveNotes(item)}
                              placeholder="Note privée sur cet échange…"
                              className="h-9 rounded-lg text-sm"
                              aria-label={`Note pour ${item.client_name}`}
                            />
                            <a
                              href={`${waLink(item.client_whatsapp)}?text=${encodeURIComponent(
                                `Bonjour ${item.client_name}, je vous contacte au sujet de votre projet (Devmarket).`
                              )}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-foreground px-3 text-xs font-medium text-ink transition-colors outline-none hover:bg-foreground focus-visible:ring-2 focus-visible:ring-primary/50"
                            >
                              <MessagesSquare className="size-3.5" aria-hidden="true" />
                              WhatsApp
                            </a>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              setRefundFor(item);
                              setRefundReason("");
                            }}
                            disabled={Boolean(refundPending)}
                            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground underline-offset-4 transition-colors outline-none hover:text-primary-light focus-visible:ring-2 focus-visible:ring-primary/50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <AlertTriangle className="size-3.5" aria-hidden="true" />
                            {refundPending
                              ? "Demande de remboursement envoyée"
                              : "Signaler un faux numéro"}
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        ) : null}

        {tab === "profil" ? (
          <>
            <section className="mt-8" aria-label="Disponibilité">
              <AvailabilityCard userId={userId} />
            </section>

            <section className="mt-8" aria-label="Profil développeur">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold tracking-tight">
                  Votre carte de visite digitale
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Ce profil est public : visible sur /dev/votre-identifiant.
                  Présentez vos projets pour attirer les clients.
                </p>
              </div>
              {publicUrl ? (
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={publicUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-10 items-center gap-2 rounded-xl border border-hairline bg-card px-5 text-sm font-medium text-foreground transition-colors outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary/50"
                  >
                    <Share2 className="size-4 text-primary" aria-hidden="true" />
                    Voir mon profil public
                  </Link>
                  <ShareProfileButton url={publicUrl} label="Partager" />
                </div>
              ) : null}
            </div>

            {profile?.is_verified ? (
              <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-success/40 bg-success-soft px-3 py-1 text-xs font-medium text-success">
                <BadgeCheck className="size-3.5" aria-hidden="true" />
                Compte vérifié par Devmarket
              </div>
            ) : null}

            <form onSubmit={saveProfile} className="mt-6 grid gap-6 lg:grid-cols-2">
              <div className="rounded-2xl border border-hairline bg-card p-6 sm:p-8">
                <h3 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
                  <Briefcase className="size-4 text-primary" aria-hidden="true" />
                  Informations publiques
                </h3>
                <div className="mt-5 flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="dp-name">Nom</Label>
                    <Input
                      id="dp-name"
                      value={p.full_name}
                      onChange={(e) => setP({ ...p, full_name: e.target.value })}
                      className="h-10 rounded-xl"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="dp-username">Identifiant public (/dev/…)</Label>
                    <Input
                      id="dp-username"
                      value={p.username}
                      onChange={(e) =>
                        setP({ ...p, username: e.target.value.toLowerCase() })
                      }
                      className="h-10 rounded-xl"
                      placeholder="moussa-diop"
                      pattern="[a-z0-9]+(-[a-z0-9]+)*"
                    />
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      Lettres, chiffres et tirets uniquement. Votre profil sera
                      visible sur votre identifiant.
                    </p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="dp-city">Région</Label>
                    <Select
                      value={p.city ?? ""}
                      onValueChange={(v) => setP({ ...p, city: v ?? "" })}
                      items={ALL_REGION_ITEMS}
                    >
                      <SelectTrigger
                        id="dp-city"
                        className="h-10 w-full rounded-xl"
                      >
                        <SelectValue placeholder="Sélectionnez votre région" />
                      </SelectTrigger>
                      <RegionSelectContent />
                    </Select>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="dp-experience">Années d’expérience</Label>
                    <Input
                      id="dp-experience"
                      type="number"
                      min={0}
                      max={50}
                      value={p.experience_years}
                      onChange={(e) =>
                        setP({ ...p, experience_years: Number(e.target.value) })
                      }
                      className="h-10 rounded-xl"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="dp-whatsapp">WhatsApp (contact public)</Label>
                    <PhoneInput
                      id="dp-whatsapp"
                      value={p.whatsapp}
                      onChange={(v) => setP({ ...p, whatsapp: v })}
                      className="h-10 rounded-xl"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="dp-bio">Bio</Label>
                    <Textarea
                      id="dp-bio"
                      value={p.bio}
                      onChange={(e) => setP({ ...p, bio: e.target.value })}
                      className="min-h-28 rounded-xl"
                      placeholder="Développeur web basé à Abidjan, spécialisé dans les sites vitrines et e-commerce pour les PME de la sous-région…"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="dp-skills">Compétences (tags du profil)</Label>
                    <Textarea
                      id="dp-skills"
                      value={p.skills}
                      onChange={(e) => setP({ ...p, skills: e.target.value })}
                      className="min-h-20 rounded-xl"
                      placeholder="Next.js, WordPress, WooCommerce, Mobile…"
                    />
                  </div>
                  <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-hairline p-4">
                    <input
                      type="checkbox"
                      checked={p.notifications_enabled}
                      onChange={(e) =>
                        setP({ ...p, notifications_enabled: e.target.checked })
                      }
                      className="mt-0.5 size-4 rounded border-hairline accent-primary"
                      aria-label="Recevoir les nouveaux briefs par WhatsApp"
                    />
                    <span>
                      <span className="block text-sm font-medium">
                        Recevoir les nouveaux briefs
                      </span>
                      <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                        Alertes WhatsApp des projets correspondant à ma région et
                        à mes compétences.
                      </span>
                    </span>
                  </label>
                </div>
              </div>

              <div className="flex flex-col gap-6">
                <div className="rounded-2xl border border-hairline bg-card p-6 sm:p-8">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
                      <Globe className="size-4 text-primary" aria-hidden="true" />
                      Portfolio (optionnel, recommandé)
                    </h3>
                    <Button
                      type="button"
                      onClick={addPortfolioLink}
                      variant="outline"
                      size="sm"
                      className="h-9"
                    >
                      <Plus className="size-4" aria-hidden="true" />
                      Ajouter
                    </Button>
                  </div>
                  {portfolio.length === 0 ? (
                    <p className="mt-4 text-sm text-muted-foreground">
                      Aucun projet. Ajoutez les sites que vous avez réalisés
                      pour renforcer votre profil public.
                    </p>
                  ) : (
                    <ul className="mt-5 space-y-4">
                      {portfolio.map((link, i) => (
                        <li
                          key={i}
                          className="rounded-xl border border-hairline p-4"
                        >
                          <div className="flex flex-col gap-3">
                            <Input
                              value={link.title}
                              onChange={(e) =>
                                updatePortfolioLink(i, { title: e.target.value })
                              }
                              placeholder="Titre du projet"
                              className="h-9 rounded-lg text-sm"
                              aria-label={`Titre du projet ${i + 1}`}
                            />
                            <Input
                              value={link.url}
                              onChange={(e) =>
                                updatePortfolioLink(i, { url: e.target.value })
                              }
                              placeholder="https://monsite.sn"
                              type="url"
                              className="h-9 rounded-lg text-sm"
                              aria-label={`Adresse du projet ${i + 1}`}
                            />
                            <Input
                              value={link.description ?? ""}
                              onChange={(e) =>
                                updatePortfolioLink(i, {
                                  description: e.target.value,
                                })
                              }
                              placeholder="Courte description (optionnel)"
                              className="h-9 rounded-lg text-sm"
                              aria-label={`Description du projet ${i + 1}`}
                            />
                            <div className="flex justify-end">
                              <button
                                type="button"
                                onClick={() => removePortfolioLink(i)}
                                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-primary/50"
                              >
                                <Trash2 className="size-3.5" aria-hidden="true" />
                                Supprimer
                              </button>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="rounded-2xl border border-hairline bg-card p-6 sm:p-8">
                  <Button type="submit" disabled={saving} className="h-10 w-full sm:w-auto">
                    {saving ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Save className="size-4" aria-hidden="true" />
                    )}
                    Enregistrer le profil
                  </Button>
                  <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                    Le badge « Développeur vérifié » est attribué par
                    l’équipe Devmarket, pas par l’utilisateur.
                  </p>
                </div>
              </div>
            </form>
            </section>
          </>
        ) : null}

        {tab === "activite" ? (
          <>
            <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <section
              className="rounded-2xl border border-hairline bg-card p-6 shadow-sm sm:p-8"
              aria-label="Réputation"
            >
              <h2 className="text-lg font-semibold tracking-tight">Réputation</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Score pondéré : notes des clients, projets terminés et avis
                reçus, moins les pénalités de modération.
              </p>

              <div className="mt-6 flex items-center gap-3 rounded-xl bg-muted p-4">
                <span className="text-3xl font-semibold tracking-tight">
                  {profile?.reputation_score ?? 0}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    sur 100 ·{" "}
                    <span className="text-success">
                      {profile?.reputation_level ?? "Nouveau"}
                    </span>
                  </p>
                  {profile && profile.penalty > 0 ? (
                    <p className="mt-0.5 text-xs font-medium text-error">
                      Pénalité de modération appliquée : -{profile.penalty} pts
                    </p>
                  ) : (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {profile?.reviews_count ?? 0} avis ·{" "}
                      {profile?.completed_projects_count ?? 0} projet
                      {(profile?.completed_projects_count ?? 0) > 1 ? "s" : ""} terminé
                      {(profile?.completed_projects_count ?? 0) > 1 ? "s" : ""}
                    </p>
                  )}
                </div>
              </div>

              {!reviews || reviews.total === 0 ? (
                <div className="mt-6">
                  <EmptyState
                    title="Aucun avis pour le moment"
                    description="Vos premiers avis apparaîtront ici après un projet terminé."
                  />
                </div>
              ) : (
                <div className="mt-6">
                  <div className="flex items-center gap-3 rounded-xl bg-muted p-4">
                    <span className="text-3xl font-semibold tracking-tight">
                      {reviews.average}
                    </span>
                    <div>
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <Star
                            key={n}
                            className={cn(
                              "size-4",
                              n <= Math.round(reviews.average)
                                ? "fill-primary text-primary"
                                : "text-border-strong"
                            )}
                            aria-hidden="true"
                          />
                        ))}
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {reviews.total} avis · {reviews.satisfaction} % de clients satisfaits
                      </p>
                    </div>
                  </div>

                  <ul className="mt-4 space-y-4">
                    {reviews.reviews.map((review) => (
                      <li key={review.id} className="rounded-xl border border-hairline p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold">
                            {review.client_name ?? "Client"}
                            {review.request_type ? (
                              <span className="ml-1.5 font-normal text-muted-foreground">
                                · {review.request_type}
                              </span>
                            ) : null}
                          </p>
                          <div className="flex items-center gap-0.5">
                            {[1, 2, 3, 4, 5].map((n) => (
                              <Star
                                key={n}
                                className={cn(
                                  "size-3.5",
                                  n <= review.rating
                                    ? "fill-primary text-primary"
                                    : "text-border-strong"
                                )}
                                aria-hidden="true"
                              />
                            ))}
                          </div>
                        </div>
                        {review.comment ? (
                          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                            {review.comment}
                          </p>
                        ) : null}
                        {review.response ? (
                          <div className="mt-2 rounded-lg bg-muted p-3">
                            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                              Votre réponse publique
                            </p>
                            <p className="mt-1 text-sm leading-relaxed">
                              {review.response}
                            </p>
                          </div>
                        ) : null}
                        <p className="mt-2 text-xs text-muted-foreground">
                          {formatDate(review.created_at)}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>

            <section
              className="rounded-2xl border border-hairline bg-card p-6 shadow-sm sm:p-8"
              aria-label="Commandes de Tokens"
            >
              <h2 className="text-lg font-semibold tracking-tight">Commandes</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Historique de vos achats de Tokens. Une commande confirmée
                crédite votre solde automatiquement.
              </p>

              {orders.length === 0 ? (
                <div className="mt-6">
                  <EmptyState
                    title="Aucune commande"
                    description="Commandez un pack de Tokens pour débloquer plus de contacts."
                    action={
                      <Link
                        href="/wallet"
                        className="inline-flex h-10 items-center gap-2 rounded-xl bg-foreground px-5 text-sm font-medium text-ink transition-colors outline-none hover:bg-foreground"
                      >
                        Voir les packs
                        <ArrowRight className="size-4" aria-hidden="true" />
                      </Link>
                    }
                  />
                </div>
              ) : (
                <ul className="mt-6 divide-y divide-hairline">
                  {orders.map((order) => (
                    <li key={order.id} className="flex items-start justify-between gap-3 py-4 first:pt-0 last:pb-0">
                      <div className="min-w-0">
                        <p className="font-medium">{order.package_name}</p>
                        <p className="mt-0.5 text-sm text-muted-foreground">
                          {order.tokens} token{order.tokens > 1 ? "s" : ""} ·{" "}
                          {formatFCFA(order.price_fcfa)} · {formatDate(order.created_at)}
                        </p>
                      </div>
                      <Badge
                        variant={order.status === "confirmed" ? "default" : "secondary"}
                        className="shrink-0 capitalize"
                      >
                        {order.status === "pending"
                          ? "En attente"
                          : order.status === "confirmed"
                            ? "Confirmée"
                            : "Annulée"}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            </div>
          </>
        ) : null}

        {tab === "devis" ? (
          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <section
              className="rounded-2xl border border-hairline bg-card p-6 shadow-sm sm:p-8"
              aria-label="Missions en cours"
            >
              <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
                <Check className="size-5 text-primary" aria-hidden="true" />
                Missions en cours
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Les projets que vous avez remportés auprès d’un client.
              </p>

              {missions.length === 0 ? (
                <div className="mt-6">
                  <EmptyState
                    title="Aucune mission pour le moment"
                    description="Quand un client accepte votre devis, la discussion passe ici en mission en cours."
                    action={
                      <Link
                        href="/briefs"
                        className="inline-flex h-10 items-center gap-2 rounded-xl bg-foreground px-5 text-sm font-medium text-ink transition-colors outline-none hover:bg-foreground"
                      >
                        Chercher de nouveaux briefs
                        <ArrowRight className="size-4" aria-hidden="true" />
                      </Link>
                    }
                  />
                </div>
              ) : (
                <ul className="mt-6 space-y-4">
                  {missions.map((c) => (
                    <li
                      key={c.id}
                      className="rounded-2xl border border-success/40 bg-success-soft p-5"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium">{c.request.client_name}</p>
                          <p className="mt-0.5 text-sm text-muted-foreground">
                            {c.request.project_type} ·{" "}
                            {formatFCFA(c.request.budget)}
                          </p>
                        </div>
                        <span className="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-success/40 bg-success-soft px-2.5 py-1 text-[11px] font-medium text-success">
                          <Check className="size-3" aria-hidden="true" />
                          Mission
                        </span>
                      </div>
                      <Link
                        href={`/conversations/${c.id}`}
                        className="mt-4 inline-flex h-9 items-center gap-2 rounded-xl bg-foreground px-4 text-sm font-medium text-ink transition-colors outline-none hover:bg-foreground"
                      >
                        Poursuivre la discussion
                        <MessageCircle className="size-4" aria-hidden="true" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section
              className="rounded-2xl border border-hairline bg-card p-6 shadow-sm sm:p-8"
              aria-label="Devis envoyés en attente"
            >
              <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
                <Send className="size-5 text-primary" aria-hidden="true" />
                Devis envoyés
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Vos propositions chiffrées qui attendent une réponse du client.
              </p>

              {devisEnAttente.length === 0 ? (
                <div className="mt-6">
                  <EmptyState
                    title="Aucun devis en attente"
                    description="Depuis une discussion, envoyez un devis formel : prix, acompte et délai. Il apparaîtra ici tant que le client n’a pas répondu."
                  />
                </div>
              ) : (
                <ul className="mt-6 space-y-4">
                  {devisEnAttente.map((c) => (
                    <li
                      key={c.id}
                      className="rounded-2xl border border-hairline bg-primary-soft p-5"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium">{c.request.client_name}</p>
                          <p className="mt-0.5 text-sm text-muted-foreground">
                            {c.request.project_type} ·{" "}
                            {formatFCFA(c.request.budget)}
                          </p>
                        </div>
                        <span className="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary-soft px-2.5 py-1 text-[11px] font-medium text-primary-light">
                          <Clock className="size-3" aria-hidden="true" />
                          {c.pendingOffers} devis en attente
                        </span>
                      </div>
                      <Link
                        href={`/conversations/${c.id}`}
                        className="mt-4 inline-flex h-9 items-center gap-2 rounded-xl border border-hairline bg-card px-4 text-sm font-medium text-foreground transition-colors outline-none hover:bg-muted"
                      >
                        Suivre la réponse
                        <ArrowRight className="size-4" aria-hidden="true" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        ) : null}

        {tab === "missions" ? (
          <section className="mt-8" aria-label="Missions réalisées">
            <MissionsManager initial={myMissions} tlMissions={tlMissions} />
          </section>
        ) : null}

        {tab === "avis" ? (
          <section className="mt-8" aria-label="Mes avis clients">
            <DevReviewsPanel initial={myReviews} />
          </section>
        ) : null}

        {tab === "agence" ? (
          <section className="mt-8" aria-label="Mon agence">
            <AgencyManager />
          </section>
        ) : null}

        {tab === "pro" ? (
          <section className="mt-8" aria-label="Abonnement PRO">
            <ProPanel />
          </section>
        ) : null}

        <Dialog open={Boolean(refundFor)} onOpenChange={(open) => !open && setRefundFor(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Contester ce déblocage</DialogTitle>
              <DialogDescription>
                Si le numéro WhatsApp de {refundFor?.client_name ?? "ce client"} est
                faux ou injoignable, votre Token (2 500 FCFA) vous sera
                remboursé après vérification par notre équipe.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={submitRefund} className="mt-2 flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="refund-reason">Motif de la contestation</Label>
                <Textarea
                  id="refund-reason"
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  required
                  className="min-h-24 rounded-xl"
                  placeholder="Numéro inexistant, personne ne répond, numéro erroné…"
                />
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setRefundFor(null)}
                >
                  Annuler
                </Button>
                <Button type="submit" disabled={refunding || !refundReason.trim()}>
                  {refunding ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <AlertTriangle className="size-4" aria-hidden="true" />
                  )}
                  Demander le remboursement
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}