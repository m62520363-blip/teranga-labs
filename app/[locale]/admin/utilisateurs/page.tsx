import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth/guards";
import { Users, Search, Shield, ShieldOff } from "lucide-react";

export const metadata: Metadata = {
  title: "Gestion des utilisateurs",
  description: "Liste et gestion des utilisateurs Devmarket.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  await requireRole(["admin"]);

  const supabase = await createClient();
  const admin = createAdminClient();

  let developers: Record<string, unknown>[] = [];
  let clients: Record<string, unknown>[] = [];

  if (supabase) {
    const { data: devs } = await supabase.rpc("admin_list_developers");
    if (Array.isArray(devs)) developers = devs as Record<string, unknown>[];
  }

  if (admin) {
    try {
      const { data } = await admin.auth.admin.listUsers({ perPage: 100 });
      if (data?.users) {
        clients = data.users.map((u) => ({
          id: u.id,
          email: u.email,
          created_at: u.created_at,
          last_sign_in: u.last_sign_in_at,
          role: (u.user_metadata as Record<string, unknown>)?.role ?? "client",
        }));
      }
    } catch {
      // ignore
    }
  }

  return (
    <div className="bg-surface py-10 md:py-16">
      <div className="container-tl">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight">Utilisateurs</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {developers.length} développeur(s) et {clients.length} utilisateur(s) au total.
          </p>
        </div>

        {/* Développeurs */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold tracking-tight">Développeurs ({developers.length})</h2>
          {developers.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-hairline bg-card p-8 text-center text-sm text-muted-foreground">
              Aucun développeur inscrit.
            </div>
          ) : (
            <div className="mt-4 overflow-x-auto rounded-2xl border border-hairline bg-card">
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

        {/* Utilisateurs (clients) */}
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Comptes utilisateurs ({clients.length})</h2>
          {clients.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-hairline bg-card p-8 text-center text-sm text-muted-foreground">
              Aucun utilisateur.
            </div>
          ) : (
            <div className="mt-4 overflow-x-auto rounded-2xl border border-hairline bg-card">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-hairline">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Email</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Rôle</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Inscription</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Dernière connexion</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map((u, i) => (
                    <tr key={i} className="border-b border-hairline last:border-0">
                      <td className="px-4 py-3 font-medium">{String(u.email ?? "—")}</td>
                      <td className="px-4 py-3 text-muted-foreground">{String(u.role ?? "client")}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {u.created_at ? new Date(String(u.created_at)).toLocaleDateString("fr-FR") : "—"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {u.last_sign_in ? new Date(String(u.last_sign_in)).toLocaleDateString("fr-FR") : "Jamais"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
