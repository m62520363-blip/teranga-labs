import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { DashboardContent, type OrderItem, type UnlockHistoryItem } from "@/components/dashboard-content";
import { getCurrentUser, createClient } from "@/lib/supabase/server";
import { getConversations } from "@/lib/conversations";

export const metadata: Metadata = {
  title: "Dashboard développeur",
  description:
    "Votre solde de Tokens, vos déblocages, vos devis envoyés et vos missions.",
};

export const dynamic = "force-dynamic";

function notConfigured() {
  return (
    <div className="bg-[#0F0F0F] py-16">
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
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supabase = await createClient();
  if (!supabase) return notConfigured();

  const { tab } = await searchParams;

  const roleRes = await supabase.rpc("get_my_role");
  if (roleRes.data === "client") redirect("/client");

  const [devRes, balanceRes, unlocksRes, transactionsRes, ordersRes, reviewsRes, conversations] =
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
        .select("id, developer_id, amount, amount_fcfa, type, request_id, created_at")
        .eq("developer_id", user.id)
        .order("created_at", { ascending: false })
        .limit(200),
      supabase.rpc("get_my_orders"),
      supabase.rpc("get_developer_reviews", { p_developer: user.id }),
      getConversations(supabase, user.id),
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
    reviews: {
      id: string;
      rating: number;
      comment: string | null;
      request_name: string | null;
      created_at: string;
    }[];
  } | null;
  const missions = conversations.filter((c) => c.status === "awarded");
  const devisEnAttente = conversations.filter((c) => c.pendingOffers > 0);

  return (
    <DashboardContent
      userId={user.id}
      profile={profile}
      balance={balance}
      unlocks={unlocks}
      transactions={transactions}
      orders={orders}
      reviews={reviews}
      missions={missions}
      devisEnAttente={devisEnAttente}
      initialTab={(tab ?? "") as never}
    />
  );
}