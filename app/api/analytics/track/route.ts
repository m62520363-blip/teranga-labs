import { NextRequest, NextResponse } from "next/server";
import { apiRequireUser } from "@/lib/auth/guards";
import { createAdminClient, isServiceConfigured } from "@/lib/supabase/admin";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { trackClientEventSchema } from "@/lib/validations";
import { log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/analytics/track (F3, §36)
 * Événements métier émisés côté client (ex. `contact_unlocked` après le
 * déblocage direct par RPC) — `track_event` est réservé au service_role,
 * d'où cette route. Liste d'événements fermée (zod enum), rate-limitée,
 * réponse toujours `ok` pour ne jamais peser sur le parcours.
 */
export async function POST(request: NextRequest) {
  const rl = rateLimit(`analytics-track:${clientIp(request)}`, 60);
  if (!rl.ok) {
    return NextResponse.json(
      { code: "RATE_LIMITED", message: "Trop de demandes." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } }
    );
  }

  const guard = await apiRequireUser();
  if (guard.response) return guard.response;
  const user = guard.user!;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { code: "BAD_REQUEST", message: "Corps de requête invalide." },
      { status: 400 }
    );
  }

  const parsed = trackClientEventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { code: "BAD_REQUEST", message: parsed.error.issues[0]?.message ?? "Requête invalide." },
      { status: 400 }
    );
  }

  if (!isServiceConfigured()) {
    return NextResponse.json(
      { code: "NOT_CONFIGURED", message: "Service indisponible." },
      { status: 503 }
    );
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json(
      { code: "NOT_CONFIGURED", message: "Service indisponible." },
      { status: 503 }
    );
  }

  const { error } = await admin.rpc("track_event", {
    p_event: parsed.data.event,
    p_actor_id: user.id,
    p_request_id: parsed.data.request_id,
  });
  if (error) {
    log.error({
      action: "analytics.track",
      event: parsed.data.event,
      user: user.id,
      message: error.message,
    });
    return NextResponse.json(
      { code: "TRACK_FAILED", message: "Événement non enregistré." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
