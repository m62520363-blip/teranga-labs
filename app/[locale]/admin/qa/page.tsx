import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/guards";
import { ShieldCheck } from "lucide-react";
import { QATestRunner } from "@/components/admin/qa-test-runner";

export const metadata: Metadata = {
  title: "QA & Audit",
  description: "Tableau de bord qualité et audit Devmarket.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const BOTS = [
  { name: "Auditeur général", description: "Parcourt toutes les pages et détecte les incohérences visuelles et fonctionnelles" },
  { name: "Testeur espace client", description: "Teste l'inscription, le profil, la publication de briefs, la messagerie, les paiements" },
  { name: "Testeur espace développeur", description: "Teste le profil, les missions, les abonnements, les quotas, les retraits, la disponibilité" },
  { name: "Testeur administration", description: "Teste le dashboard, la gestion des utilisateurs, des développeurs, des projets" },
  { name: "Testeur paiements", description: "Vérifie les abonnements, webhooks Chariow, transactions, escrow, remboursements" },
  { name: "Testeur messagerie", description: "Teste l'envoi, la réception, le temps réel, l'indicateur de frappe" },
  { name: "Expert cybersécurité", description: "Vérifie l'auth, les permissions RLS, les injections, le rate limiting, les headers" },
  { name: "Testeur base de données", description: "Vérifie la structure des tables, les relations, les contraintes, les RPC, les migrations" },
  { name: "Testeur UI/UX", description: "Vérifie le responsive, l'accessibilité, les animations, les états de chargement" },
  { name: "Testeur performance", description: "Mesure le TTFB, le bundle size, le chargement des images" },
  { name: "Testeur SEO", description: "Vérifie les meta tags, le sitemap, les robots.txt, les données structurées" },
  { name: "Coordinateur", description: "Centralise les rapports, classe les problèmes par priorité, propose des corrections" },
];

export default async function QADashboardPage() {
  await requireRole(["admin"]);

  return (
    <div className="bg-surface py-10 md:py-16">
      <div className="container-tl">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight">QA & Audit</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Tableau de bord qualité et audit Devmarket. Les résultats proviennent des tests réellement exécutés.
          </p>
        </div>

        {/* Bots */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold tracking-tight">Équipe de bots (12)</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {BOTS.map((bot) => (
              <div key={bot.name} className="rounded-xl border border-hairline bg-card p-4">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="size-4 text-primary" aria-hidden="true" />
                  <p className="text-sm font-semibold">{bot.name}</p>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{bot.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Test runner */}
        <QATestRunner />
      </div>
    </div>
  );
}
