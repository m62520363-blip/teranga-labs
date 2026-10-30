import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/guards";
import { AdminSubscriptions } from "@/components/subscription/admin-subscriptions";
import type { SubscriptionPlanRow } from "@/components/subscription/pro-subscription";

export const metadata: Metadata = {
  title: "Administration des abonnements",
  description: "Gestion commerciale des formules, tarifs, quotas et abonnés Devmarket.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminSubscriptionsPage() {
  await requireRole(["admin"]);

  const supabase = await createClient();
  let plans: SubscriptionPlanRow[] = [];
  let analytics = null;

  if (supabase) {
    const [plansRes, analyticsRes] = await Promise.all([
      supabase.rpc("list_subscription_plans", { p_include_inactive: true }),
      supabase.rpc("admin_get_subscription_analytics"),
    ]);

    if (Array.isArray(plansRes.data)) {
      plans = plansRes.data as unknown as SubscriptionPlanRow[];
    }
    if (analyticsRes.data && typeof analyticsRes.data === "object") {
      analytics = analyticsRes.data as never;
    }
  }

  return (
    <div className="bg-surface py-10 md:py-16">
      <div className="container-tl">
        <AdminSubscriptions
          initialPlans={plans}
          initialAnalytics={analytics}
        />
      </div>
    </div>
  );
}
