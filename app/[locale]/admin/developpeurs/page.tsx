import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/guards";
import { Users, Search } from "lucide-react";
import { formatFCFA } from "@/lib/formatting";

export const metadata: Metadata = {
  title: "Gestion des développeurs",
  description: "Liste et gestion des développeurs Devmarket.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminDevelopersPage() {
  await requireRole(["admin"]);

  const supabase = await createClient();
  let developers: Record<string, unknown>[] = [];

  if (supabase) {
    const { data } = await supabase.rpc("admin_list_developers");
    if (Array.isArray(data)) {
      developers = data as Record<string, unknown>[];
    }
  }

  return (
    <div className="bg-surface py-10 md:py-16">
      <div className="container-tl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Développeurs</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {developers.length} développeur(s) inscrit(s).
            </p>
          </div>
        </div>

        {developers.length === 0 ? (
          <div className="rounded-2xl border border-hairline bg-card p-8 text-center text-sm text-muted-foreground">
            Aucun développeur inscrit.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-hairline bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-hairline">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Nom</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Ville</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Statut</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Abonnement</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Profil</th>
                </tr>
              </thead>
              <tbody>
                {developers.map((dev, i) => (
                  <tr key={i} className="border-b border-hairline last:border-0">
                    <td className="px-4 py-3 font-medium">{String(dev.full_name ?? dev.username ?? "—")}</td>
                    <td className="px-4 py-3 text-muted-foreground">{String(dev.city ?? "—")}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${dev.available ? "bg-success-soft text-success" : "bg-muted text-muted-foreground"}`}>
                        {dev.available ? "Disponible" : "Indisponible"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{String(dev.plan ?? "free")}</td>
                    <td className="px-4 py-3">
                      <a href={`/dev/${dev.username}`} className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">
                        Voir
                      </a>
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
