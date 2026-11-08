import { NextResponse } from "next/server";
import { apiRequireUser } from "@/lib/auth/guards";
import { createAdminClient, isServiceConfigured } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/agencies/activate
 * Vérifie côté serveur l'abonnement PRO actif du développeur via la RPC
 * get_my_subscription (pas de table agencies typée dans le schéma).
 */
export async function POST() {
  const guard = await apiRequireUser();
  if (guard.response) return guard.response;
  const user = guard.user!;
  const rl = rateLimit(`agencies-activate:${user.id}`, 5);
  if (!rl.ok) {
    return NextResponse.json(
      { code: "RATE_LIMITED", message: "Trop de demandes. Réessayez dans un instant." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } }
    );
  }

  if (!isServiceConfigured()) {
    return NextResponse.json({ ok: true });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ ok: true });
  }

  const { data: sub } = await admin.rpc("get_my_subscription");
  const subData = (sub ?? null) as {
    active?: boolean;
    plan_id?: string;
  } | null;

  const isProActive = Boolean(
    subData?.active && subData?.plan_id && subData.plan_id !== "free"
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

  const { data: agencyRows } = await (admin as unknown as {
    from: (table: string) => {
      select: (cols: string) => {
        eq: (col: string, val: string) => {
          maybeSingle: () => Promise<{ data: { id: string } | null; error: unknown }>;
        };
      };
      update: (vals: Record<string, string>) => {
        eq: (col: string, val: string) => Promise<{ error: unknown }>;
      };
    };
  }).from("agencies")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();

  const agency = agencyRows as { id: string } | null;
  if (agency?.id) {
    await (admin as unknown as {
      from: (table: string) => {
        update: (vals: Record<string, string>) => {
          eq: (col: string, val: string) => Promise<{ error: unknown }>;
        };
      };
    }).from("agencies")
      .update({ status: "active" })
      .eq("id", agency.id);
  }

  return NextResponse.json({ ok: true });
}
