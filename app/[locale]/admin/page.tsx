import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/guards";
import {
  Users,
  Briefcase,
  CreditCard,
  MessageSquare,
  ShieldCheck,
  Settings,
  TrendingUp,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Administration",
  description: "Tableau de bord administrateur Devmarket.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  await requireRole(["admin"]);

  const supabase = await createClient();
  let stats: Record<string, unknown> | null = null;

  if (supabase) {
    const { data } = await supabase.rpc("get_admin_stats");
    if (data && typeof data === "object") {
      stats = data as Record<string, unknown>;
    }
  }

  const cards = [
    {
      title: "Analytics",
      description: "Statistiques et revenus",
      href: "/admin/analytics",
      icon: TrendingUp,
      color: "text-primary",
    },
    {
      title: "Abonnements",
      description: "Gérer les formules, tarifs et abonnés",
      href: "/admin/abonnements",
      icon: CreditCard,
      color: "text-primary",
    },
    {
      title: "Utilisateurs",
      description: "Liste et gestion des comptes",
      href: "/admin/utilisateurs",
      icon: Users,
      color: "text-primary",
    },
    {
      title: "Développeurs",
      description: "Liste et gestion des développeurs",
      href: "/admin/developpeurs",
      icon: Users,
      color: "text-primary",
    },
    {
      title: "Projets",
      description: "Modération des briefs publiés",
      href: "/admin/projets",
      icon: Briefcase,
      color: "text-primary",
    },
    {
      title: "Transactions",
      description: "Historique des paiements et retraits",
      href: "/admin/transactions",
      icon: TrendingUp,
      color: "text-primary",
    },
    {
      title: "Signalements",
      description: "Modération et signalements",
      href: "/admin/signalements",
      icon: AlertTriangle,
      color: "text-error",
    },
    {
      title: "Paramètres",
      description: "Configuration de la plateforme",
      href: "/admin/parametres",
      icon: Settings,
      color: "text-muted-foreground",
    },
    {
      title: "QA & Audit",
      description: "Tableau de bord qualité et tests",
      href: "/admin/qa",
      icon: ShieldCheck,
      color: "text-primary",
    },
  ];

  return (
    <div className="bg-surface py-10 md:py-16">
      <div className="container-tl">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight">Administration</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Tableau de bord administrateur Devmarket.
          </p>
        </div>

        {/* Stats */}
        {stats ? (
          <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Object.entries(stats).map(([key, value]) => (
              <div key={key} className="rounded-2xl border border-hairline bg-card p-4">
                <p className="text-xs text-muted-foreground">{key}</p>
                <p className="mt-1 text-2xl font-semibold">{String(value)}</p>
              </div>
            ))}
          </div>
        ) : null}

        {/* Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => (
            <Link
              key={card.href}
              href={card.href}
              className="group rounded-2xl border border-hairline bg-card p-5 transition-colors hover:border-primary/40"
            >
              <div className="flex items-start justify-between">
                <card.icon className={`size-6 ${card.color}`} aria-hidden="true" />
                <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-1" aria-hidden="true" />
              </div>
              <h2 className="mt-3 text-base font-semibold tracking-tight">{card.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{card.description}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
