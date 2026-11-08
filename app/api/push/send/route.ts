import { NextResponse } from "next/server";
import { createAdminClient, isServiceConfigured } from "@/lib/supabase/admin";
import { apiRequireUser } from "@/lib/auth/guards";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { isPushConfigured, sendPushToUser } from "@/lib/push/send";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isServiceConfigured()) {
    return NextResponse.json({ code: "DB_NOT_CONFIGURED", message: "Service indisponible." }, { status: 503 });
  }

  const rl = rateLimit(`push-send:${clientIp(request)}`, 20);
  if (!rl.ok) {
    return NextResponse.json({ code: "RATE_LIMITED", message: "Trop de demandes." }, { status: 429 });
  }

  const guard = await apiRequireUser();
  if (guard.response) return guard.response;

  if (!isPushConfigured()) {
    return NextResponse.json({ code: "PUSH_NOT_CONFIGURED", message: "Notifications push non configurées." }, { status: 503 });
  }

  let body: { userId?: string; title?: string; body?: string; url?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ code: "BAD_REQUEST", message: "Corps invalide." }, { status: 400 });
  }

  const targetUserId = body.userId?.trim() || guard.user!.id;
  const title = body.title?.trim() || "Devmarket";
  const message = body.body?.trim() || "Nouvelle notification";
  const url = body.url?.trim() || "/";

  // Seul l'admin peut envoyer à un autre utilisateur.
  const isAdmin = guard.user!.id === targetUserId;
  if (!isAdmin) {
    // Vérifier si l'utilisateur est admin.
    const admin = createAdminClient();
    if (admin) {
      const { data } = await admin.rpc("has_role", { p_roles: ["admin"] });
      if (!data) {
        return NextResponse.json({ code: "FORBIDDEN", message: "Accès refusé." }, { status: 403 });
      }
    }
  }

  const result = await sendPushToUser(targetUserId, { title, body: message, url });

  return NextResponse.json({ ok: true, ...result });
}
