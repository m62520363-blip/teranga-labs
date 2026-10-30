import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { DashboardContent, type OrderItem, type UnlockHistoryItem } from "@/components/dashboard-content";
import type { DeveloperStats } from "@/components/dev/performance-panel";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/guards";
import { getConversations } from "@/lib/conversations";
import type { MyDeveloperMission, MyDeveloperReviews } from "@/types/database";

export const metadata: Metadata = {
  title: "Dashboard développeur",
  description:
    "Votre solde de Tokens, vos déblocages, vos devis envoyés et vos missions.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

function notConfigured() {
  return (
    <div className="bg-surface py-16">
      <div className="container-tl mx-auto max-w-md text-center">
        <h1 className="text-2xl font-semibold">Configuration requise</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Connexion à Supabase manquante. Renseignez les variables
          d’environnement, appliquez les migrations puis reconnectez-vous.
        </p>
        <Link href="/" className="mt-6 inline-block text-sm font-medium underline">
          Retour à l’accueil
        </Link>
      </div>
    </div>
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await requireUser();

  const supabase = await createClient();
  if (!supabase) return notConfigured();

  const { tab } = await searchParams;

  const roleRes = await supabase.rpc("get_my_role");
  if (roleRes.data === "client") redirect("/client");

  const [devRes, balanceRes, unlocksRes, transactionsRes, ordersRes, reviewsRes, myReviewsRes, missionsRes, conversations, openProjectsRes, statsRes, prefsRes, referralRes, recentRes] =
    await Promise.all([
      supabase
        .from("developers")
        .select("id, full_name, whatsapp, skills, city, notifications_enabled, status, created_at, username, bio, avatar_url, portfolio_links, is_verified, experience_years, rating_avg, reviews_count, completed_projects_count, reputation_score, reputation_level, penalty, monthly_goal")
        .eq("id", user.id)
        .maybeSingle(),
      supabase.rpc("get_token_balance"),
      supabase.rpc("get_my_unlocks"),
      supabase
        .from("token_transactions")
        .select("id, developer_id, amount, amount_fcfa, type, request_id, target_developer_id, created_at")
        .eq("developer_id", user.id)
        .order("created_at", { ascending: false })
        .limit(200),
      supabase.rpc("get_my_orders"),
      supabase.rpc("get_developer_reviews", { p_developer: user.id }),
      supabase.rpc("list_my_developer_reviews"),
      supabase.rpc("list_my_missions"),
      getConversations(supabase, user.id),
      supabase
        .from("requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "ouvert")
        .eq("hidden", false),
      supabase.rpc("get_my_developer_stats"),
      supabase
        .from("notification_preferences")
        .select("email_new_projects")
        .eq("user_id", user.id)
        .maybeSingle(),
      // Parrainage : la RPC n'existe que si la migration 0072 est
      // appliquée. En cas d'absence, referralRes.data reste null et la
      // carte affiche son état « lien à venir » sans casser la page.
      supabase.rpc("get_my_referral_summary"),
      // Derniers projets ouverts : données réelles de public.requests.
      supabase
        .from("requests")
        .select("id, description, budget, project_type, created_at")
        .eq("status", "ouvert")
        .eq("hidden", false)
        .order("created_at", { ascending: false })
        .limit(4),
    ]);

  const profile = devRes.data ?? null;
  const balance = typeof balanceRes.data === "number" ? balanceRes.data : 0;
  const unlocks = (
    Array.isArray(unlocksRes.data) ? unlocksRes.data : []
  ) as UnlockHistoryItem[];
  const transactions = transactionsRes.data ?? [];
  const orders = (Array.isArray(ordersRes.data) ? ordersRes.data : []) as unknown as OrderItem[];
  const reviews = reviewsRes.data as unknown as {
    total: number;
    average: number;
    satisfaction: number;
    average_criteria: Record<string, number>;
    reviews: {
      id: string;
      rating: number;
      comment: string | null;
      client_name: string | null;
      request_type: string | null;
      request_budget: number | null;
      response: string | null;
      responded_at: string | null;
      created_at: string;
    }[];
  } | null;
  const myReviews = (Array.isArray(myReviewsRes.data)
    ? myReviewsRes.data
    : null) as unknown as MyDeveloperReviews | null;
  const missions = conversations.filter((c) => c.status === "awarded");
  const devisEnAttente = conversations.filter((c) => c.pendingOffers > 0);
  const myMissions = (Array.isArray(missionsRes.data) ? missionsRes.data : []) as unknown as MyDeveloperMission[];
  const tlMissions = missions.map((c) => ({
    conversation_id: c.id,
    name: `${c.request.client_name} · ${c.request.project_type}`,
  }));
  const stats = (statsRes.data ?? null) as DeveloperStats | null;
  const emailNewProjects =
    prefsRes.data?.email_new_projects !== false;

  // Parrainage : on ignore silencieusement l'erreur (RPC absente tant
  // que 0072 n'est pas appliquée) plutôt que de faire échouer la page.
  const referral = referralRes.error
    ? null
    : ((referralRes.data ?? null) as {
        code: string | null;
        total_signups: number;
        converted: number;
        points: number;
        points_per_conversion: number;
      } | null);

  const recentProjects = (recentRes.data ?? []) as {
    id: string;
    description: string;
    budget: number | null;
    project_type: string | null;
    created_at: string;
  }[];

  return (
    <DashboardContent
      userId={user.id}
      profile={profile}
      balance={balance}
      unlocks={unlocks}
      transactions={transactions}
      orders={orders}
      reviews={reviews}
      myReviews={myReviews}
      missions={missions}
      myMissions={myMissions}
      tlMissions={tlMissions}
      devisEnAttente={devisEnAttente}
      openProjects={openProjectsRes.count ?? 0}
      stats={stats}
      emailNewProjects={emailNewProjects}
      referral={referral}
      recentProjects={recentProjects}
      initialTab={(tab ?? "") as never}
    />
  );
}