import type { Metadata } from "next";
import Link from "next/link";
import {
  Coins,
  ArrowUpRight,
  ArrowDownLeft,
  Wallet,
  Lock,
  Receipt,
  History,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/guards";
import { EmptyState } from "@/components/empty-state";
import { TokenCard } from "@/components/token-card";
import { MISSION_STATUS_LABELS } from "@/lib/mission-labels";
import { findWorldCountryByName } from "@/lib/world-countries";
import type { MissionStatus, TokenPackage } from "@/types/database";

export const metadata: Metadata = {
  title: "Mon wallet",
  description: "Rechargez vos Tokens, suivez les fonds bloqués et vos retraits.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const METHOD_LABELS: Record<string, string> = {
  wave: "Wave",
  orange_money: "Orange Money",
  mobicash: "Mobicash",
  bank_transfer: "Virement bancaire",
};

const STATUS_LABELS: Record<string, string> = {
  requested: "Demandé",
  approved: "Approuvé",
  processing: "En cours",
  paid: "Versé",
  rejected: "Refusé",
  cancelled: "Annulé",
};

const KIND_LABELS: Record<string, string> = {
  pending: "En attente",
  available: "Disponible",
  withdrawal_hold: "Retenu (retrait)",
  withdrawal_paid: "Retrait versé",
  refund: "Remboursement",
  adjustment: "Ajustement",
};

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  confirmed: "Confirmé",
  refunding: "Remboursement",
  refunded: "Remboursé",
  failed: "Échoué",
};

const TOKEN_TYPE_LABELS: Record<string, string> = {
  purchase: "Achat de Tokens",
  unlock: "Contact débloqué",
  bonus: "Bonus",
  publish: "Publication de brief",
  contact: "Contact client",
  adjust: "Ajustement",
  gift: "Cadeau",
  reward: "Récompense de classement",
};

const ESCROW_EXCLUDED = new Set(["completed", "refunded", "cancelled"]);

function missionLabel(status: string): string {
  return MISSION_STATUS_LABELS[status as MissionStatus]?.label ?? status;
}

export default async function WalletPage() {
  const user = await requireUser();

  const supabase = await createClient();
  if (!supabase) {
    return (
      <div className="bg-surface py-16">
        <div className="container-tl">
          <EmptyState
            title="Configuration requise"
            description="La base de données n'est pas configurée."
          />
        </div>
      </div>
    );
  }

  const [summaryRes, historyRes, packagesRes, paymentsRes, profileRes] = await Promise.all([
    supabase.rpc("get_wallet_summary"),
    supabase.rpc("get_wallet_history", { p_limit: 50 }),
    supabase
      .from("token_packages")
      .select("id, name, tokens, price_fcfa, popular")
      .order("price_fcfa", { ascending: true }),
    supabase
      .from("mission_payments")
      .select(
        "id, mission_id, payer_id, amount_fcfa, status, created_at, confirmed_at, refunded_at"
      )
      .order("created_at", { ascending: false })
      .limit(30),
    supabase.from("developers").select("country").eq("id", user.id).maybeSingle(),
  ]);

  /* Pays du profil (onboarding développeur) → sinon pays inscrit en
     metadata à la création du compte → devise locale des packs. */
  const countryName: string | null =
    (profileRes.data?.country as string | null) ??
    ((user.user_metadata?.country as string | undefined) || null);
  const currency = findWorldCountryByName(countryName)?.currency ?? null;

  const summary = (summaryRes.data ?? {}) as Record<string, unknown>;
  const history = (historyRes.data ?? {}) as Record<string, unknown>;

  const tokens = (summary.tokens as number) ?? 0;
  const earningsPending = (summary.earnings_pending_fcfa as number) ?? 0;
  const earningsAvailable = (summary.earnings_available_fcfa as number) ?? 0;
  const earningsHeld = (summary.earnings_held_fcfa as number) ?? 0;
  const earningsPaid = (summary.earnings_paid_fcfa as number) ?? 0;
  const minWithdrawal = (summary.min_withdrawal_fcfa as number) ?? 5000;

  const earnings = (history.earnings as Array<Record<string, unknown>>) ?? [];
  const withdrawals = (history.withdrawals as Array<Record<string, unknown>>) ?? [];
  const tokenOps = (history.tokens as Array<Record<string, unknown>>) ?? [];
  const packages = (packagesRes.data ?? []) as Array<Record<string, unknown>>;
  const payments = (paymentsRes.data ?? []) as Array<Record<string, unknown>>;

  const missionIds = [...new Set(payments.map((p) => p.mission_id as string))];
  const missionsRes = missionIds.length > 0
    ? await supabase.from("missions").select("id, status").in("id", missionIds)
    : { data: null as Array<{ id: string; status: string }> | null };
  const missionStatus = new Map(
    ((missionsRes.data ?? []) as Array<{ id: string; status: string }>).map((m) => [
      m.id,
      m.status,
    ])
  );

  const escrow = payments.filter((p) => {
    if (p.status !== "confirmed") return false;
    const status = missionStatus.get(p.mission_id as string);
    return status ? !ESCROW_EXCLUDED.has(status) : false;
  });
  const receipts = payments.filter((p) => p.payer_id === user.id);

  return (
    <div className="bg-surface py-16 md:py-24">
      <div className="container-tl">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-3xl font-semibold leading-tight tracking-tight">
            Mon wallet
          </h1>
          <p className="mt-3 text-base leading-relaxed text-muted-foreground">
            Rechargez vos Tokens, suivez les fonds bloqués de vos missions et
            demandez vos retraits — tout au même endroit.
          </p>

          <div className="mt-8 grid gap-5 sm:grid-cols-2">
            <div className="rounded-2xl border border-hairline bg-card p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft">
                  <Coins className="size-5 text-primary" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-sm text-muted-foreground">Tokens disponibles</p>
                  <p className="text-2xl font-semibold tracking-tight">{tokens}</p>
                </div>
              </div>
              <Link
                href="#acheter-tokens"
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-ink transition-colors hover:bg-primary-hover"
              >
                Acheter des Tokens
                <ArrowUpRight className="size-4" aria-hidden="true" />
              </Link>
            </div>

            <div className="rounded-2xl border border-hairline bg-card p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-success-soft">
                  <Wallet className="size-5 text-success" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-sm text-muted-foreground">Revenus disponibles</p>
                  <p className="text-2xl font-semibold tracking-tight">
                    {earningsAvailable.toLocaleString("fr-FR")} FCFA
                  </p>
                </div>
              </div>
              {earningsAvailable >= minWithdrawal ? (
                <Link
                  href="/wallet/retraits"
                  className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-surface px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                >
                  Demander un retrait
                  <ArrowDownLeft className="size-4" aria-hidden="true" />
                </Link>
              ) : (
                <p className="mt-4 text-xs text-muted-foreground">
                  Minimum de retrait : {minWithdrawal.toLocaleString("fr-FR")} FCFA
                </p>
              )}
            </div>
          </div>

          <section id="acheter-tokens" className="mt-10 scroll-mt-24">
            <div className="flex items-center gap-2">
              <Receipt className="size-4 text-primary" aria-hidden="true" />
              <h2 className="text-lg font-semibold tracking-tight">
                Acheter des Tokens
              </h2>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Seul endroit du site où l&apos;on recharge : le paiement passe par
              Chariow et vos Tokens sont crédités dès la confirmation.
            </p>
            {packages.length > 0 ? (
              <div className="mt-5 grid gap-5 sm:grid-cols-2">
                {packages.map((pkg) => (
                  <TokenCard key={pkg.id as string} pkg={pkg as TokenPackage} currency={currency} />
                ))}
              </div>
            ) : (
              <div className="mt-5">
                <EmptyState
                  title="Packs indisponibles"
                  description="Connectez Supabase et appliquez les migrations pour charger les packs de Tokens."
                />
              </div>
            )}
          </section>

          <div className="mt-6 grid gap-5 sm:grid-cols-3">
            <div className="rounded-xl border border-hairline bg-muted/60 p-4">
              <p className="text-xs text-muted-foreground">En attente</p>
              <p className="mt-1 text-lg font-semibold">{earningsPending.toLocaleString("fr-FR")} FCFA</p>
            </div>
            <div className="rounded-xl border border-hairline bg-muted/60 p-4">
              <p className="text-xs text-muted-foreground">Retenus (retraits)</p>
              <p className="mt-1 text-lg font-semibold">{earningsHeld.toLocaleString("fr-FR")} FCFA</p>
            </div>
            <div className="rounded-xl border border-hairline bg-muted/60 p-4">
              <p className="text-xs text-muted-foreground">Déjà versés</p>
              <p className="mt-1 text-lg font-semibold">{earningsPaid.toLocaleString("fr-FR")} FCFA</p>
            </div>
          </div>

          {escrow.length > 0 && (
            <div className="mt-8">
              <div className="flex items-center gap-2">
                <Lock className="size-4 text-primary" aria-hidden="true" />
                <h2 className="text-lg font-semibold tracking-tight">
                  Fonds bloqués (escrow)
                </h2>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Les montants des missions en cours restent bloqués jusqu&apos;à
                l&apos;acceptation de la livraison, puis sont libérés
                automatiquement.
              </p>
              <div className="mt-3 space-y-2">
                {escrow.map((p) => (
                  <div
                    key={p.id as string}
                    className="flex items-center justify-between rounded-xl border border-hairline bg-card px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {(p.amount_fcfa as number).toLocaleString("fr-FR")} FCFA
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Mission ·{" "}
                        {missionLabel(missionStatus.get(p.mission_id as string) ?? "")}
                      </p>
                    </div>
                    <Link
                      href={`/missions/${p.mission_id as string}`}
                      className="rounded-lg border border-hairline bg-surface px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
                    >
                      Voir la mission
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}

          {receipts.length > 0 && (
            <div className="mt-8">
              <div className="flex items-center gap-2">
                <Receipt className="size-4 text-primary" aria-hidden="true" />
                <h2 className="text-lg font-semibold tracking-tight">
                  Reçus de paiement
                </h2>
              </div>
              <div className="mt-3 space-y-2">
                {receipts.map((p) => {
                  const st = missionStatus.get(p.mission_id as string);
                  return (
                  <div
                    key={p.id as string}
                    className="flex items-center justify-between rounded-xl border border-hairline bg-card px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {(p.amount_fcfa as number).toLocaleString("fr-FR")} FCFA
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(p.created_at as string).toLocaleDateString("fr-FR")}
                        {st ? ` · ${missionLabel(st)}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium">
                        {PAYMENT_STATUS_LABELS[p.status as string] ?? p.status}
                      </span>
                      <Link
                        href={`/missions/${p.mission_id as string}`}
                        className="rounded-lg border border-hairline bg-surface px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
                      >
                        Détail
                      </Link>
                    </div>
                  </div>
                  );
                })}
              </div>
            </div>
          )}

          {tokenOps.length > 0 && (
            <div className="mt-8">
              <div className="flex items-center gap-2">
                <History className="size-4 text-primary" aria-hidden="true" />
                <h2 className="text-lg font-semibold tracking-tight">
                  Historique des Tokens
                </h2>
              </div>
              <div className="mt-3 space-y-2">
                {tokenOps.slice(0, 20).map((t) => {
                  const amount = (t.amount as number) ?? 0;
                  return (
                    <div
                      key={t.id as string}
                      className="flex items-center justify-between rounded-xl border border-hairline bg-card px-4 py-3"
                    >
                      <div>
                        <p className="text-sm font-medium">
                          {TOKEN_TYPE_LABELS[t.type as string] ?? t.type}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(t.created_at as string).toLocaleDateString("fr-FR")}
                          {typeof t.amount_fcfa === "number" && t.amount_fcfa > 0
                            ? ` · ${(t.amount_fcfa as number).toLocaleString("fr-FR")} FCFA`
                            : ""}
                        </p>
                      </div>
                      <span
                        className={
                          amount >= 0
                            ? "text-sm font-semibold text-success"
                            : "text-sm font-semibold text-muted-foreground"
                        }
                      >
                        {amount >= 0 ? `+${amount}` : amount}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {withdrawals.length > 0 && (
            <div className="mt-8">
              <h2 className="text-lg font-semibold tracking-tight">Historique des retraits</h2>
              <div className="mt-3 space-y-2">
                {withdrawals.map((w) => (
                  <div
                    key={w.id as string}
                    className="flex items-center justify-between rounded-xl border border-hairline bg-card px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {(w.amount_fcfa as number).toLocaleString("fr-FR")} FCFA
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {METHOD_LABELS[w.method as string] ?? w.method} · {w.destination_masked as string}
                      </p>
                    </div>
                    <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium">
                      {STATUS_LABELS[w.status as string] ?? w.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {earnings.length > 0 && (
            <div className="mt-8">
              <h2 className="text-lg font-semibold tracking-tight">Historique des revenus</h2>
              <div className="mt-3 space-y-2">
                {earnings.slice(0, 20).map((e) => (
                  <div
                    key={e.id as string}
                    className="flex items-center justify-between rounded-xl border border-hairline bg-card px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {(e.amount_fcfa as number).toLocaleString("fr-FR")} FCFA
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {KIND_LABELS[e.kind as string] ?? e.kind}
                        {e.note ? ` · ${e.note as string}` : ""}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(e.created_at as string).toLocaleDateString("fr-FR")}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {earnings.length === 0 && withdrawals.length === 0 && tokenOps.length === 0 && (
            <div className="mt-8">
              <EmptyState
                title="Aucune activité"
                description="Vos recharges de Tokens, missions et retraits apparaîtront ici."
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
