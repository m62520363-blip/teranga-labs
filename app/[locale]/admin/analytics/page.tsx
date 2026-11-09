import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/guards";
import { TrendingUp, Users, Briefcase, CreditCard } from "lucide-react";
import { formatFCFA } from "@/lib/formatting";

export const metadata: Metadata = {
  title: "Analytics",
  description: "Statistiques et analytics Devmarket.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminAnalyticsPage() {
  await requireRole(["admin"]);

  const supabase = await createClient();
  let stats: Record<string, unknown> | null = null;
  let subscriptionAnalytics: Record<string, unknown> | null = null;

  if (supabase) {
    const [statsRes, subRes] = await Promise.all([
      supabase.rpc("get_admin_stats"),
      supabase.rpc("admin_get_subscription_analytics"),
    ]);
    if (statsRes.data && typeof statsRes.data === "object") {
      stats = statsRes.data as Record<string, unknown>;
    }
    if (subRes.data && typeof subRes.data === "object") {
      subscriptionAnalytics = subRes.data as Record<string, unknown>;
    }
  }

  const statCards = [
    { label: "Utilisateurs", icon: Users, value: stats?.total_users ?? stats?.users ?? "—" },
    { label: "Développeurs", icon: Users, value: stats?.total_developers ?? stats?.developers ?? "—" },
    { label: "Projets", icon: Briefcase, value: stats?.total_requests ?? stats?.requests ?? "—" },
    { label: "Revenus (FCFA)", icon: CreditCard, value: stats?.total_revenue ?? stats?.revenue ?? "—" },
  ];

  return (
    <div className="bg-surface py-10 md:py-16">
      <div className="container-tl">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Statistiques de la plateforme.
          </p>
        </div>

        {/* Stats globales */}
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {statCards.map((card) => (
            <div key={card.label} className="rounded-2xl border border-hairline bg-card p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <card.icon className="size-4 text-primary" aria-hidden="true" />
                {card.label}
              </div>
              <p className="mt-2 text-2xl font-semibold">{String(card.value)}</p>
            </div>
          ))}
        </div>

        {/* Analytics abonnements */}
        {subscriptionAnalytics ? (
          <div className="rounded-2xl border border-hairline bg-card p-6">
            <h2 className="text-base font-semibold">Analytics abonnements</h2>
            <pre className="mt-4 overflow-auto rounded-xl bg-muted p-4 text-xs text-muted-foreground">
              {JSON.stringify(subscriptionAnalytics, null, 2)}
            </pre>
          </div>
        ) : (
          <div className="rounded-2xl border border-hairline bg-card p-8 text-center text-sm text-muted-foreground">
            Aucune donnée analytics disponible.
          </div>
        )}

        {/* Stats brutes */}
        {stats ? (
          <div className="mt-6 rounded-2xl border border-hairline bg-card p-6">
            <h2 className="text-base font-semibold">Statistiques brutes</h2>
            <pre className="mt-4 overflow-auto rounded-xl bg-muted p-4 text-xs text-muted-foreground">
              {JSON.stringify(stats, null, 2)}
            </pre>
          </div>
        ) : null}
      </div>
    </div>
  );
}
