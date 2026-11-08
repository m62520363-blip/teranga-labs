import { NextResponse } from "next/server";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { apiRequireUser } from "@/lib/auth/guards";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ code: "DB_NOT_CONFIGURED", message: "Service indisponible." }, { status: 503 });
  }

  const rl = rateLimit(`push-subscribe:${clientIp(request)}`, 10);
  if (!rl.ok) {
    return NextResponse.json({ code: "RATE_LIMITED", message: "Trop de demandes." }, { status: 429 });
  }

  const guard = await apiRequireUser();
  if (guard.response) return guard.response;

  let body: { endpoint?: string; keys?: { p256dh?: string; auth?: string }; userAgent?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ code: "BAD_REQUEST", message: "Corps invalide." }, { status: 400 });
  }

  const endpoint = body.endpoint?.trim();
  const p256dh = body.keys?.p256dh?.trim();
  const auth = body.keys?.auth?.trim();

  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ code: "BAD_REQUEST", message: "Abonnement push invalide." }, { status: 400 });
  }

  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ code: "DB_NOT_CONFIGURED", message: "Base indisponible." }, { status: 503 });
  }

  const { error } = await supabase.rpc("upsert_push_subscription" as never, {
    p_endpoint: endpoint,
    p_p256dh: p256dh,
    p_auth: auth,
    p_user_agent: body.userAgent ?? null,
  } as never);

  if (error) {
    return NextResponse.json({ code: "SUBSCRIBE_FAILED", message: "Échec de l'abonnement." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ code: "DB_NOT_CONFIGURED", message: "Service indisponible." }, { status: 503 });
  }

  const guard = await apiRequireUser();
  if (guard.response) return guard.response;

  let body: { endpoint?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ code: "BAD_REQUEST", message: "Corps invalide." }, { status: 400 });
  }

  const endpoint = body.endpoint?.trim();
  if (!endpoint) {
    return NextResponse.json({ code: "BAD_REQUEST", message: "Endpoint requis." }, { status: 400 });
  }

  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ code: "DB_NOT_CONFIGURED", message: "Base indisponible." }, { status: 503 });
  }

  const { error } = await supabase.rpc("delete_push_subscription" as never, {
    p_endpoint: endpoint,
  } as never);

  if (error) {
    return NextResponse.json({ code: "UNSUBSCRIBE_FAILED", message: "Échec du désabonnement." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
