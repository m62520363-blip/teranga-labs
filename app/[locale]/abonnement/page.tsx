import type { Metadata } from "next";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { createClient, getCurrentRole, getCurrentUser } from "@/lib/supabase/server";
import {
  ProSubscription,
  type DeveloperSubscriptionSummary,
  type SubscriptionPlanRow,
} from "@/components/subscription/pro-subscription";

export const metadata: Metadata = {
  title: "Nos abonnements",
  description:
    "Découvrez les formules d’abonnement développeur de Devmarket : Pro (2 500 FCFA/mois, 80 contacts), Pro Max (7 000 FCFA/mois, 200 contacts) et Agence (15 000 FCFA/mois, 400 contacts).",
};

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ invoice?: string }>;
};

export default async function AbonnementPage({ searchParams }: Props) {
  const sp = await searchParams;
  const supabase = await createClient();
  const [user, role] = await Promise.all([getCurrentUser(), getCurrentRole()]);

  // Les abonnements concernent uniquement l'espace développeur : l'espace
  // client n'a pas d'abonnement (publication gratuite + option de mise en avant par brief).
  if (role === "client") {
    redirect({ href: "/client", locale: await getLocale() });
  }

  let plans: SubscriptionPlanRow[] = [];
  let subscription: DeveloperSubscriptionSummary | null = null;
  let hasDeveloperProfile = false;

  if (supabase) {
    const { data: plansData } = await supabase.rpc("list_subscription_plans", {
      p_include_inactive: false,
    });
    if (Array.isArray(plansData)) {
      plans = plansData as unknown as SubscriptionPlanRow[];
    }

    if (user) {
      const [subRes, devRes] = await Promise.all([
        supabase.rpc("get_my_subscription"),
        supabase
          .from("developers")
          .select("id")
          .eq("id", user.id)
          .maybeSingle(),
      ]);

      if (!subRes.error && subRes.data && typeof subRes.data === "object") {
        subscription = subRes.data as unknown as DeveloperSubscriptionSummary;
      }
      hasDeveloperProfile = Boolean(devRes.data?.id);
    }
  }

  return (
    <div className="bg-surface py-10 md:py-16">
      <div className="container-tl">
        <ProSubscription
          plans={plans}
          subscription={subscription}
          isAuthenticated={Boolean(user)}
          hasDeveloperProfile={hasDeveloperProfile}
          pendingInvoice={
            typeof sp?.invoice === "string" && sp.invoice.trim()
              ? sp.invoice.trim()
              : null
          }
        />
      </div>
    </div>
  );
}
