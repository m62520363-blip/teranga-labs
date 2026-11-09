import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/guards";
import { Briefcase } from "lucide-react";
import { formatFCFA } from "@/lib/formatting";

export const metadata: Metadata = {
  title: "Gestion des projets",
  description: "Modération des briefs publiés sur Devmarket.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminProjectsPage() {
  await requireRole(["admin"]);

  const supabase = await createClient();
  let projects: Record<string, unknown>[] = [];

  if (supabase) {
    const { data } = await supabase.rpc("admin_list_requests");
    if (Array.isArray(data)) {
      projects = data as Record<string, unknown>[];
    }
  }

  return (
    <div className="bg-surface py-10 md:py-16">
      <div className="container-tl">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight">Projets</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {projects.length} projet(s) publié(s).
          </p>
        </div>

        {projects.length === 0 ? (
          <div className="rounded-2xl border border-hairline bg-card p-8 text-center text-sm text-muted-foreground">
            Aucun projet publié.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-hairline bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-hairline">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Client</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Type</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Ville</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Budget</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Statut</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((p, i) => (
                  <tr key={i} className="border-b border-hairline last:border-0">
                    <td className="px-4 py-3 font-medium">{String(p.client_name ?? "—")}</td>
                    <td className="px-4 py-3 text-muted-foreground">{String(p.project_type ?? "—")}</td>
                    <td className="px-4 py-3 text-muted-foreground">{String(p.client_city ?? "—")}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatFCFA(Number(p.budget ?? 0))}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                        {String(p.status ?? "—")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {p.created_at ? new Date(String(p.created_at)).toLocaleDateString("fr-FR") : "—"}
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
