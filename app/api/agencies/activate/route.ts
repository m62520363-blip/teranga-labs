import { NextResponse } from "next/server";
import { apiRequireUser } from "@/lib/auth/guards";
import { createAdminClient, isServiceConfigured } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/agencies/activate
 * Vérifie côté serveur l'abonnement PRO actif du développeur et active
 * immédiatement son agence nouvellement créée pour qu'elle apparaisse sur /agences.
 */
export async function POST() {
  const guard = await apiRequireUser();
  if (guard.response) return guard.response;
  const user = guard.user!;

  if (!isServiceConfigured()) {
    return NextResponse.json({ ok: true });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ ok: true });
  }

  const { data: sub } = await admin
    .from("subscriptions")
    .select("plan, status, ends_at, grace_until")
    .eq("developer_id", user.id)
    .maybeSingle();

  const now = new Date();
  const isProActive = Boolean(
    sub &&
      sub.plan !== "free" &&
      ["active", "grace_period", "cancelled"].includes(sub.status) &&
      ((sub.ends_at && new Date(sub.ends_at) > now) ||
        (sub.grace_until && new Date(sub.grace_until) > now))
  );

  if (!isProActive) {
    return NextResponse.json(
      {
        code: "PRO_REQUIRED",
        message: "Un abonnement PRO actif est requis pour créer une agence.",
      },
      { status: 403 }
    );
  }

  await admin
    .from("agencies")
    .update({ status: "active" })
    .eq("owner_id", user.id)
    .eq("status", "pending");

  return NextResponse.json({ ok: true });
}
