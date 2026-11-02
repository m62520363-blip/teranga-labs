import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  DashboardContent,
  type OrderItem,
  type UnlockHistoryItem,
} from "@/components/dashboard-content";
import type { DeveloperStats } from "@/components/dev/performance-panel";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, isServiceConfigured } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/auth/guards";
import { getConversations } from "@/lib/conversations";
import { BRIEFS_COLUMNS, BRIEFS_PAGE_SIZE } from "@/lib/briefs-pagination";
import type {
  MyDeveloperMission,
  MyDeveloperReviews,
  PublicRequest,
} from "@/types/database";

export const metadata: Metadata = {
  title: "Dashboard développeur",
  description:
    "Projets publiés, votre profil développeur, votre réputation et vos avis.",
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

  const [
    devRes,
    subRes,
    unlocksRes,
    transactionsRes,
    ordersRes,
    reviewsRes,
    myReviewsRes,
    missionsRes,
    conversations,
    openProjectsRes,
    statsRes,
    prefsRes,
    referralRes,
    recentRes,
    briefsRes,
    favoritesRes,
    balanceRes,
    welcomeRes,
  ] = await Promise.all([
    supabase
      .from("developers")
      .select(
        "id, full_name, whatsapp, skills, city, notifications_enabled, status, created_at, username, bio, avatar_url, portfolio_links, is_verified, experience_years, rating_avg, reviews_count, completed_projects_count, reputation_score, reputation_level, penalty, monthly_goal"
      )
      .eq("id", user.id)
      .maybeSingle(),
    supabase.rpc("get_my_subscription"),
    supabase.rpc("get_my_unlocks"),
    supabase
      .from("token_transactions")
      .select(
        "id, developer_id, amount, amount_fcfa, type, request_id, target_developer_id, created_at"
      )
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
    supabase.rpc("get_my_referral_summary"),
    supabase
      .from("requests")
      .select("id, description, budget, project_type, created_at")
      .eq("status", "ouvert")
      .eq("hidden", false)
      .order("created_at", { ascending: false })
      .limit(4),
    supabase
      .from("requests")
      .select(BRIEFS_COLUMNS, { count: "exact" })
      .eq("status", "ouvert")
      .eq("hidden", false)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(BRIEFS_PAGE_SIZE),
    supabase.from("favorites").select("request_id"),
    supabase.rpc("get_token_balance"),
    supabase
      .from("welcome_offer_status")
      .select("has_unlocked_contact, gift_consumed")
      .maybeSingle(),
  ]);

  let profile = devRes.data ?? null;

  // Activation automatique dès que le profil obligatoire est à 100 %
  if (
    profile &&
    profile.status !== "active" &&
    profile.status !== "verified" &&
    profile.status !== "suspended" &&
    Boolean(profile.full_name?.trim()) &&
    Boolean(profile.bio?.trim()) &&
    Boolean(profile.username?.trim()) &&
    Boolean(profile.city?.trim()) &&
    Array.isArray(profile.skills) &&
    profile.skills.length > 0
  ) {
    if (isServiceConfigured()) {
      const admin = createAdminClient();
      if (admin) {
        await admin
          .from("developers")
          .update({
            status: "active",
            rejection_reason: null,
          })
          .eq("id", user.id);
      }
    }
    profile = { ...profile, status: "active" };
  }

  const quota = subRes.error
    ? null
    : ((subRes.data ?? null) as {
        plan_name_fr?: string;
        quota_used?: number;
        quota_limit?: number;
      } | null);
  const unlocks = (
    Array.isArray(unlocksRes.data) ? unlocksRes.data : []
  ) as UnlockHistoryItem[];
  const transactions = transactionsRes.data ?? [];
  const orders = (
    Array.isArray(ordersRes.data) ? ordersRes.data : []
  ) as unknown as OrderItem[];
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
  const myReviews = (
    Array.isArray(myReviewsRes.data) ? myReviewsRes.data : null
  ) as unknown as MyDeveloperReviews | null;
  const missions = conversations.filter((c) => c.status === "awarded");
  const devisEnAttente = conversations.filter((c) => c.pendingOffers > 0);
  const myMissions = (
    Array.isArray(missionsRes.data) ? missionsRes.data : []
  ) as unknown as MyDeveloperMission[];
  const tlMissions = missions.map((c) => ({
    conversation_id: c.id,
    name: `${c.request.client_name} · ${c.request.project_type}`,
  }));
  const stats = (statsRes.data ?? null) as DeveloperStats | null;
  const emailNewProjects = prefsRes.data?.email_new_projects !== false;

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

  const publishedBriefs = (briefsRes.data ?? []) as PublicRequest[];
  const publishedBriefsTotal = briefsRes.count ?? publishedBriefs.length;

  const unlocksMap: Record<
    string,
    { conversation_id?: string; whatsapp?: string }
  > = {};
  for (const row of unlocks) {
    if (row.request_id) {
      unlocksMap[row.request_id] = {
        whatsapp: row.client_whatsapp ?? undefined,
      };
    }
  }
  for (const conv of conversations) {
    if (conv.request.id && unlocksMap[conv.request.id]) {
      unlocksMap[conv.request.id] = {
        ...unlocksMap[conv.request.id],
        conversation_id: conv.id,
      };
    }
  }

  const favoriteIds = (favoritesRes.data ?? [])
    .map((f) => f.request_id)
    .filter((id): id is string => Boolean(id));

  const balance =
    typeof balanceRes.data === "number" ? balanceRes.data : null;
  const welcomeRow = (welcomeRes.data ?? null) as {
    has_unlocked_contact?: boolean;
    gift_consumed?: boolean;
  } | null;
  const welcomeContactFree =
    welcomeRow?.has_unlocked_contact === false &&
    welcomeRow?.gift_consumed === false;

  return (
    <DashboardContent
      userId={user.id}
      profile={profile}
      quota={quota}
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
      publishedBriefs={publishedBriefs}
      publishedBriefsTotal={publishedBriefsTotal}
      unlocksMap={unlocksMap}
      favoriteIds={favoriteIds}
      balance={balance}
      welcomeContactFree={welcomeContactFree}
      initialTab={(tab ?? "") as never}
    />
  );
}
