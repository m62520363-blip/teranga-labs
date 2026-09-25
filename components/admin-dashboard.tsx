"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  BadgeCheck,
  Ban,
  Briefcase,
  CheckCircle2,
  Coins,
  Eye,
  EyeOff,
  Flag,
  Loader2,
  ShieldCheck,
  TrendingUp,
  UserCheck,
  Users,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatFCFA, formatDate } from "@/lib/formatting";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type AdminStats = {
  requests_total: number;
  requests_open: number;
  developers_total: number;
  developers_pending: number;
  tokens_sold: number;
  tokens_used: number;
  revenue_fcfa: number;
  unlocks_total: number;
  orders_pending: number;
  reports_open: number;
};

type AdminRequest = {
  id: string;
  client_name: string;
  client_whatsapp: string;
  client_city: string;
  project_type: string;
  budget: number;
  budget_verified: boolean;
  status: "ouvert" | "attribué" | "terminé";
  hidden: boolean;
  created_at: string;
};

type AdminDeveloper = {
  id: string;
  full_name: string | null;
  email: string | null;
  whatsapp: string | null;
  skills: string[] | null;
  city: string | null;
  notifications_enabled: boolean;
  status: "pending" | "active" | "rejected" | "suspended";
  balance: number;
  created_at: string;
};

type AdminOrder = {
  id: string;
  developer_id: string;
  developer_name: string | null;
  developer_whatsapp: string | null;
  package_name: string;
  tokens: number;
  price_fcfa: number;
  status: "pending" | "confirmed" | "cancelled";
  created_at: string;
  confirmed_at: string | null;
};

type AdminReport = {
  id: string;
  target_type: "brief" | "developer";
  target_id: string;
  reporter_email: string | null;
  reason: string;
  description: string | null;
  status: "open" | "resolved" | "dismissed";
  created_at: string;
};

type AdminTransaction = {
  id: string;
  developer_name: string | null;
  amount: number;
  amount_fcfa: number | null;
  type: "purchase" | "bonus" | "unlock";
  request_name: string | null;
  created_at: string;
};

export function AdminDashboard() {
  const supabase = createClient();

  const [stats, setStats] = React.useState<AdminStats | null>(null);
  const [requests, setRequests] = React.useState<AdminRequest[]>([]);
  const [developers, setDevelopers] = React.useState<AdminDeveloper[]>([]);
  const [transactions, setTransactions] = React.useState<AdminTransaction[]>([]);
  const [orders, setOrders] = React.useState<AdminOrder[]>([]);
  const [reports, setReports] = React.useState<AdminReport[]>([]);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    setLoading(true);
    const [statsRes, requestsRes, devsRes, txRes, ordersRes, reportsRes] = await Promise.all([
      supabase.rpc("get_admin_stats"),
      supabase.rpc("admin_list_requests"),
      supabase.rpc("admin_list_developers"),
      supabase.rpc("admin_list_transactions", { p_limit: 100 }),
      supabase.rpc("admin_list_orders", { p_status: "pending" }),
      supabase.rpc("admin_list_reports", { p_status: "open" }),
    ]);
    if (statsRes.data) setStats(statsRes.data as AdminStats);
    if (Array.isArray(requestsRes.data)) setRequests(requestsRes.data as AdminRequest[]);
    if (Array.isArray(devsRes.data)) setDevelopers(devsRes.data as AdminDeveloper[]);
    if (Array.isArray(txRes.data)) setTransactions(txRes.data as AdminTransaction[]);
    if (Array.isArray(ordersRes.data)) setOrders(ordersRes.data as AdminOrder[]);
    if (Array.isArray(reportsRes.data)) setReports(reportsRes.data as AdminReport[]);
    setLoading(false);
  }, [supabase]);

  const toggleRequest = async (request: AdminRequest, patch: { status?: AdminRequest["status"]; hidden?: boolean }) => {
    const { error } = await supabase.rpc("admin_update_request", {
      p_request_id: request.id,
      p_status: patch.status ?? null,
      p_hidden: patch.hidden ?? null,
    });
    if (error) {
      toast.error("Impossible de mettre à jour le brief.");
      return;
    }
    toast.success("Brief mis à jour");
    await load();
  };

  const setBudgetVerified = async (request: AdminRequest, verified: boolean) => {
    const { error } = await supabase.rpc("admin_set_budget_verified", {
      p_request_id: request.id,
      p_verified: verified,
    });
    if (error) {
      toast.error(error.message || "Impossible de vérifier le budget.");
      return;
    }
    toast.success(verified ? "Budget vérifié" : "Marque « Budget vérifié » retirée");
    await load();
  };

  const credit = async (developerId: string, amount: number, amountFcfa: number | null) => {
    if (!amount || amount <= 0) return;
    const { error } = await supabase.rpc("credit_tokens", {
      p_developer: developerId,
      p_amount: amount,
      p_amount_fcfa: amountFcfa ? amountFcfa : null,
    });
    if (error) {
      toast.error("Impossible de créditer les Tokens.");
      return;
    }
    toast.success(`${amount} Tokens crédités`);
    await load();
  };

  const setStatus = async (developerId: string, status: string, label: string) => {
    const { error } = await supabase.rpc("set_developer_status", {
      p_developer: developerId,
      p_status: status,
    });
    if (error) {
      toast.error(error.message || "Impossible de mettre à jour le compte.");
      return;
    }
    toast.success(`Compte ${label}`);
    await load();
  };

  const confirmOrder = async (order: AdminOrder) => {
    const { error } = await supabase.rpc("admin_confirm_order", {
      p_order_id: order.id,
    });
    if (error) {
      toast.error(error.message || "Impossible de confirmer la commande.");
      return;
    }
    toast.success(
      `${order.tokens} Tokens crédités à ${order.developer_name ?? "ce développeur"}`
    );
    await load();
  };

  const cancelOrder = async (order: AdminOrder) => {
    const { error } = await supabase.rpc("admin_cancel_order", {
      p_order_id: order.id,
    });
    if (error) {
      toast.error(error.message || "Impossible d’annuler la commande.");
      return;
    }
    toast.success("Commande annulée");
    await load();
  };

  const updateReport = async (report: AdminReport, status: "resolved" | "dismissed") => {
    const { error } = await supabase.rpc("admin_update_report", {
      p_report_id: report.id,
      p_status: status,
    });
    if (error) {
      toast.error(error.message || "Impossible de traiter le signalement.");
      return;
    }
    toast.success(status === "resolved" ? "Signalement traité" : "Signalement ignoré");
    await load();
  };

  return (
    <div className="bg-[#0F0F0F] py-16 md:py-24">
      <div className="container-tl">
        <div>
          <h1 className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
            Administration
          </h1>
          <p className="mt-2 text-base text-muted-foreground">
            Briefs, développeurs et transactions de Tokens.
          </p>
        </div>

        {loading && !stats ? (
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-28 animate-pulse rounded-2xl border border-[#2A2A2A] bg-[#141414]" />
            ))}
          </div>
        ) : null}

        {stats ? (
          <>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatTile icon={Briefcase} label="Briefs publiés" value={String(stats.requests_total)} sub={`${stats.requests_open} ouverts`} />
              <StatTile icon={Users} label="Développeurs" value={String(stats.developers_total)} sub="Comptes inscrits" />
              <StatTile icon={Coins} label="Tokens vendus" value={String(stats.tokens_sold)} sub={`${stats.tokens_used} utilisés`} />
              <StatTile icon={TrendingUp} label="Revenus" value={formatFCFA(stats.revenue_fcfa)} sub={`${stats.unlocks_total} déblocages`} />
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <StatTile icon={UserCheck} label="Comptes à valider" value={String(stats.developers_pending)} sub="Développeurs en attente" />
              <StatTile icon={Coins} label="Commandes en attente" value={String(stats.orders_pending)} sub="À confirmer après encaissement" />
              <StatTile icon={Flag} label="Signalements ouverts" value={String(stats.reports_open)} sub="À modérer" />
            </div>
          </>
        ) : null}

        <div className="mt-8 grid gap-8">
          {!loading && requests.length === 0 && developers.length === 0 ? (
            <div className="rounded-2xl border border-[#2A2A2A] bg-[#141414] p-8 text-center text-sm text-muted-foreground">
              Chargez les données (Supabase configuré et connecté en tant
              qu’admin) pour afficher le pilotage.
            </div>
          ) : null}

          {requests.length > 0 ? (
            <section className="rounded-2xl border border-[#2A2A2A] bg-[#141414] p-6 shadow-sm" aria-label="Gestion des briefs">
              <h2 className="text-lg font-semibold tracking-tight">Briefs</h2>
              <div className="mt-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Client</TableHead>
                      <TableHead>Ville</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Budget</TableHead>
                      <TableHead>WhatsApp</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {requests.map((request) => (
                      <TableRow key={request.id}>
                        <TableCell className="font-medium">{request.client_name}</TableCell>
                        <TableCell>{request.client_city}</TableCell>
                        <TableCell className="capitalize">{request.project_type}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <span>{formatFCFA(request.budget)}</span>
                            {request.budget_verified ? (
                              <Badge variant="secondary" className="gap-1 rounded-full bg-[#122A1C] text-[#3DD68C]">
                                <BadgeCheck className="size-3" aria-hidden="true" />
                                vérifié
                              </Badge>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="tabular-nums">{request.client_whatsapp}</TableCell>
                        <TableCell>
                          <StatusBadge status={request.status} hidden={request.hidden} />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="rounded-lg"
                              onClick={() => setBudgetVerified(request, !request.budget_verified)}
                              title={
                                request.budget_verified
                                  ? "Retirer la vérification du budget"
                                  : "Vérifier le budget après contrôle"
                              }
                            >
                              <BadgeCheck className="size-3.5" aria-hidden="true" />
                              {request.budget_verified ? "Démarquer" : "Vérifier"}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="rounded-lg"
                              onClick={() => toggleRequest(request, { hidden: !request.hidden })}
                            >
                              {request.hidden ? (
                                <Eye className="size-3.5" aria-hidden="true" />
                              ) : (
                                <EyeOff className="size-3.5" aria-hidden="true" />
                              )}
                              {request.hidden ? "Afficher" : "Masquer"}
                            </Button>
                            {request.status === "ouvert" ? (
                              <Button
                                size="sm"
                                className="rounded-lg"
                                onClick={() => toggleRequest(request, { status: "attribué" })}
                              >
                                <CheckCircle2 className="size-3.5" aria-hidden="true" />
                                Attribuer
                              </Button>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                className="rounded-lg"
                                onClick={() => toggleRequest(request, { status: "ouvert" })}
                              >
                                Rouvrir
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </section>
          ) : null}

          {developers.length > 0 ? (
            <section className="rounded-2xl border border-[#2A2A2A] bg-[#141414] p-6 shadow-sm" aria-label="Développeurs inscrits">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-semibold tracking-tight">Développeurs</h2>
                {stats?.developers_pending ? (
                  <Badge variant="secondary" className="rounded-full">
                    <UserCheck className="size-3.5" aria-hidden="true" />
                    {stats.developers_pending} à valider
                  </Badge>
                ) : null}
              </div>
              <div className="mt-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nom</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Ville</TableHead>
                      <TableHead>Compétences</TableHead>
                      <TableHead>Solde</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Inscrit le</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {developers.map((dev) => (
                      <TableRow key={dev.id}>
                        <TableCell className="font-medium">{dev.full_name ?? "—"}</TableCell>
                        <TableCell className="tabular-nums">
                          {dev.whatsapp ?? dev.email ?? "—"}
                        </TableCell>
                        <TableCell>{dev.city ?? "—"}</TableCell>
                        <TableCell className="max-w-52">
                          <span className="line-clamp-1">{dev.skills?.join(", ") ?? "—"}</span>
                        </TableCell>
                        <TableCell className="font-medium">{dev.balance} Tokens</TableCell>
                        <TableCell>
                          <Badge
                            variant={dev.status === "active" ? "default" : "secondary"}
                            className="capitalize"
                          >
                            {dev.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatDate(dev.created_at)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {dev.status !== "active" ? (
                              <Button
                                size="sm"
                                className="rounded-lg"
                                onClick={() => setStatus(dev.id, "active", "validé")}
                              >
                                <UserCheck className="size-3.5" aria-hidden="true" />
                                Valider
                              </Button>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-destructive hover:text-destructive"
                                onClick={() => setStatus(dev.id, "suspended", "suspendu")}
                              >
                                <Ban className="size-3.5" aria-hidden="true" />
                                Suspendre
                              </Button>
                            )}
                            <CreditDialog developer={dev} onCredit={credit} />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </section>
          ) : null}

          {transactions.length > 0 ? (
            <section className="rounded-2xl border border-[#2A2A2A] bg-[#141414] p-6 shadow-sm" aria-label="Transactions de Tokens">
              <h2 className="text-lg font-semibold tracking-tight">Transactions</h2>
              <div className="mt-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Développeur</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Montant</TableHead>
                      <TableHead>FCFA</TableHead>
                      <TableHead>Projet</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((tx) => (
                      <TableRow key={tx.id}>
                        <TableCell className="font-medium">{tx.developer_name ?? "—"}</TableCell>
                        <TableCell>
                          <Badge
                            variant={tx.type === "unlock" ? "secondary" : "default"}
                            className="capitalize"
                          >
                            {tx.type}
                          </Badge>
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {tx.amount > 0 ? `+${tx.amount}` : tx.amount} Tokens
                        </TableCell>
                        <TableCell className="tabular-nums text-muted-foreground">
                          {tx.amount_fcfa ? formatFCFA(tx.amount_fcfa) : "—"}
                        </TableCell>
                        <TableCell>{tx.request_name ?? "—"}</TableCell>
                        <TableCell>{formatDate(tx.created_at)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </section>
          ) : null}

          {orders.length > 0 ? (
            <section className="rounded-2xl border border-[#2A2A2A] bg-[#141414] p-6 shadow-sm" aria-label="Commandes de Tokens en attente">
              <h2 className="text-lg font-semibold tracking-tight">Commandes de Tokens</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Confirmez une commande uniquement après avoir reçu et vérifié
                le paiement (Wave / Max It).
              </p>
              <div className="mt-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Développeur</TableHead>
                      <TableHead>Pack</TableHead>
                      <TableHead>Tokens</TableHead>
                      <TableHead>Montant</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell>
                          <p className="font-medium">{order.developer_name ?? "—"}</p>
                          {order.developer_whatsapp ? (
                            <p className="text-xs text-muted-foreground tabular-nums">
                              {order.developer_whatsapp}
                            </p>
                          ) : null}
                        </TableCell>
                        <TableCell>{order.package_name}</TableCell>
                        <TableCell className="tabular-nums">+{order.tokens}</TableCell>
                        <TableCell className="font-medium">{formatFCFA(order.price_fcfa)}</TableCell>
                        <TableCell>{formatDate(order.created_at)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              className="rounded-lg"
                              onClick={() => confirmOrder(order)}
                            >
                              <ShieldCheck className="size-3.5" aria-hidden="true" />
                              Confirmer
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="rounded-lg"
                              onClick={() => cancelOrder(order)}
                            >
                              Annuler
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </section>
          ) : null}

          {reports.length > 0 ? (
            <section className="rounded-2xl border border-[#2A2A2A] bg-[#141414] p-6 shadow-sm" aria-label="Signalements d'abus">
              <h2 className="text-lg font-semibold tracking-tight">Signalements</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Relisez le brief signalé avant de décider du traitement.
              </p>
              <div className="mt-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Motif</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Signalé par</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reports.map((report) => (
                      <TableRow key={report.id}>
                        <TableCell className="capitalize">{report.target_type}</TableCell>
                        <TableCell className="font-medium">{report.reason}</TableCell>
                        <TableCell className="max-w-64 text-muted-foreground">
                          <span className="line-clamp-2">{report.description ?? "—"}</span>
                        </TableCell>
                        <TableCell>{report.reporter_email ?? "—"}</TableCell>
                        <TableCell>{formatDate(report.created_at)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              className="rounded-lg"
                              onClick={() => updateReport(report, "resolved")}
                            >
                              <CheckCircle2 className="size-3.5" aria-hidden="true" />
                              Résoudre
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="rounded-lg"
                              onClick={() => updateReport(report, "dismissed")}
                            >
                              Ignorer
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="flex flex-col rounded-2xl border border-[#2A2A2A] bg-[#141414] p-6 shadow-sm">
      <span className="flex size-9 items-center justify-center rounded-lg bg-[#2A1A10]">
        <Icon className="size-4 text-[#E86A2C]" aria-hidden="true" />
      </span>
      <p className="mt-4 text-2xl font-semibold tracking-tight">{value}</p>
      <p className="mt-0.5 text-sm font-medium">{label}</p>
      <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}

function StatusBadge({
  status,
  hidden,
}: {
  status: AdminRequest["status"];
  hidden: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Badge variant={hidden ? "secondary" : "default"} className="capitalize">
        {status}
      </Badge>
      {hidden ? <Badge variant="secondary" className="bg-muted">masqué</Badge> : null}
    </div>
  );
}

function CreditDialog({
  developer,
  onCredit,
}: {
  developer: AdminDeveloper;
  onCredit: (developerId: string, amount: number, amountFcfa: number | null) => Promise<void>;
}) {
  const [open, setOpen] = React.useState(false);
  const [amount, setAmount] = React.useState("");
  const [amountFcfa, setAmountFcfa] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const submit = async () => {
    const parsed = parseInt(amount, 10);
    if (!parsed || parsed <= 0) {
      setError("Montant de Tokens invalide.");
      return;
    }
    const fcfa = amountFcfa.trim() ? parseInt(amountFcfa, 10) : null;
    if (amountFcfa.trim() && (!fcfa || fcfa <= 0)) {
      setError("Montant en FCFA invalide.");
      return;
    }
    setError(null);
    setSubmitting(true);
    await onCredit(developer.id, parsed, fcfa);
    setSubmitting(false);
    setOpen(false);
    setAmount("");
    setAmountFcfa("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm" className="rounded-lg" onClick={() => setOpen(true)}>
            <Coins className="size-3.5" aria-hidden="true" />
            Créditer
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Créditer {developer.full_name ?? "ce développeur"}</DialogTitle>
          <DialogDescription>
            Solde actuel : {developer.balance} Tokens. Le crédit est enregistré
            de façon traçable (transaction type bonus/achat).
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="credit-tokens">Nombre de Tokens</Label>
            <Input
              id="credit-tokens"
              type="number"
              min={1}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="h-10 rounded-xl"
              placeholder="10"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="credit-fcfa">Montant payé en FCFA (facultatif)</Label>
            <Input
              id="credit-fcfa"
              type="number"
              min={0}
              value={amountFcfa}
              onChange={(e) => setAmountFcfa(e.target.value)}
              className="h-10 rounded-xl"
              placeholder="5000"
            />
          </div>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <Button onClick={submit} disabled={submitting} className="h-10 rounded-xl">
            {submitting ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Coins className="size-4" aria-hidden="true" />}
            Créditer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}