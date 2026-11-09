import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/guards";
import { AlertTriangle } from "lucide-react";

export const metadata: Metadata = {
  title: "Signalements",
  description: "Modération et signalements Devmarket.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminReportsPage() {
  await requireRole(["admin"]);

  const supabase = await createClient();
  let reports: Record<string, unknown>[] = [];

  if (supabase) {
    const { data } = await supabase.rpc("admin_list_reports");
    if (Array.isArray(data)) {
      reports = data as Record<string, unknown>[];
    }
  }

  return (
    <div className="bg-surface py-10 md:py-16">
      <div className="container-tl">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight">Signalements</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {reports.length} signalement(s) en attente.
          </p>
        </div>

        {reports.length === 0 ? (
          <div className="rounded-2xl border border-hairline bg-card p-8 text-center text-sm text-muted-foreground">
            Aucun signalement.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-hairline bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-hairline">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Type</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Raison</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Statut</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((r, i) => (
                  <tr key={i} className="border-b border-hairline last:border-0">
                    <td className="px-4 py-3 font-medium">{String(r.type ?? r.target_type ?? "—")}</td>
                    <td className="px-4 py-3 text-muted-foreground">{String(r.reason ?? r.description ?? "—")}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                        {String(r.status ?? "—")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {r.created_at ? new Date(String(r.created_at)).toLocaleDateString("fr-FR") : "—"}
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
