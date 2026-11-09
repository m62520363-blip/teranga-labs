import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/guards";
import { TrendingUp } from "lucide-react";
import { formatFCFA } from "@/lib/formatting";

export const metadata: Metadata = {
  title: "Gestion des transactions",
  description: "Historique des paiements et transactions Devmarket.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminTransactionsPage() {
  await requireRole(["admin"]);

  const supabase = await createClient();
  let transactions: Record<string, unknown>[] = [];

  if (supabase) {
    const { data } = await supabase.rpc("admin_list_transactions");
    if (Array.isArray(data)) {
      transactions = data as Record<string, unknown>[];
    }
  }

  return (
    <div className="bg-surface py-10 md:py-16">
      <div className="container-tl">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight">Transactions</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {transactions.length} transaction(s) enregistrée(s).
          </p>
        </div>

        {transactions.length === 0 ? (
          <div className="rounded-2xl border border-hairline bg-card p-8 text-center text-sm text-muted-foreground">
            Aucune transaction.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-hairline bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-hairline">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Type</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Montant</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Statut</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((t, i) => (
                  <tr key={i} className="border-b border-hairline last:border-0">
                    <td className="px-4 py-3 font-medium">{String(t.type ?? t.kind ?? "—")}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatFCFA(Number(t.amount ?? t.amount_fcfa ?? 0))}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                        {String(t.status ?? "—")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {t.created_at ? new Date(String(t.created_at)).toLocaleDateString("fr-FR") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
