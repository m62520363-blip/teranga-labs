import type { Metadata } from "next";
import Link from "next/link";
import { Coins, ArrowUpRight, ArrowDownLeft, Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/guards";
import { EmptyState } from "@/components/empty-state";

export const metadata: Metadata = {
  title: "Mon wallet",
  description: "Gérez vos Tokens, revenus et retraits.",
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

export default async function WalletPage() {
  await requireUser();

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

  const { data: summaryData } = await supabase.rpc("get_wallet_summary");
  const { data: historyData } = await supabase.rpc("get_wallet_history", {
    p_limit: 50,
  });

  const summary = (summaryData ?? {}) as Record<string, unknown>;
  const history = (historyData ?? {}) as Record<string, unknown>;

  const tokens = (summary.tokens as number) ?? 0;
  const earningsPending = (summary.earnings_pending_fcfa as number) ?? 0;
  const earningsAvailable = (summary.earnings_available_fcfa as number) ?? 0;
  const earningsHeld = (summary.earnings_held_fcfa as number) ?? 0;
  const earningsPaid = (summary.earnings_paid_fcfa as number) ?? 0;
  const minWithdrawal = (summary.min_withdrawal_fcfa as number) ?? 5000;

  const earnings = (history.earnings as Array<Record<string, unknown>>) ?? [];
  const withdrawals = (history.withdrawals as Array<Record<string, unknown>>) ?? [];

  return (
    <div className="bg-surface py-16 md:py-24">
      <div className="container-tl">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-3xl font-semibold leading-tight tracking-tight">
            Mon wallet
          </h1>
          <p className="mt-3 text-base leading-relaxed text-muted-foreground">
            Gérez vos Tokens, suivez vos revenus et demandez vos retraits.
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
                href="/tokens"
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

          {earnings.length === 0 && withdrawals.length === 0 && (
            <div className="mt-8">
              <EmptyState
                title="Aucune activité"
                description="Vos revenus de missions et retraits apparaîtront ici."
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
