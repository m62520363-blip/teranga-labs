import { NextRequest, NextResponse } from "next/server";
import { apiRequireUser, apiOptionalUser } from "@/lib/auth/guards";
import { createAdminClient, isServiceConfigured } from "@/lib/supabase/admin";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { trackClientEventSchema } from "@/lib/validations";
import { log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/analytics/track (F3, §36)
 * Événements métier émis côté client :
 *   - `contact_unlocked` : après le déblocage direct par RPC ;
 *   - `profile_view`     : visite de la fiche publique d'un développeur ;
 *   - `contact_click`    : ouverture du bouton « Contacter » d'un profil.
 * `track_event` est réservé au service_role, d'où cette route. Liste
 * d'événements fermée (zod enum), rate-limitée, réponse toujours `ok`
 * pour ne jamais peser sur le parcours.
 *
 * `profile_view` est le seul événement accepté pour un visiteur anonyme
 * (les fiches publiques sont indexées et consultées sans compte). Les
 * autres exigent une session : le déblocage et le contact sont des
 * actions authentifiées.
 */
export async function POST(request: NextRequest) {
  const rl = rateLimit(`analytics-track:${clientIp(request)}`, 60);
  if (!rl.ok) {
    return NextResponse.json(
      { code: "RATE_LIMITED", message: "Trop de demandes." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } }
    );
  }

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

  const { event, developer_id: developerId, request_id: requestId } = parsed.data;

  let actorId: string | null = null;
  if (event === "profile_view") {
    const viewer = await apiOptionalUser();
    actorId = viewer?.id ?? null;
    // Une visite de sa propre fiche ne doit pas gonfler les statistiques.
    if (actorId && actorId === developerId) {
      return NextResponse.json({ ok: true, self: true });
    }
  } else {
    const guard = await apiRequireUser();
    if (guard.response) return guard.response;
    actorId = guard.user!.id;
  }

  if (!isServiceConfigured()) {
    return NextResponse.json({ ok: true, recorded: false });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ ok: true, recorded: false });
  }

  const { error } = await admin.rpc("track_event", {
    p_event: event,
    p_actor_id: actorId ?? undefined,
    p_request_id: requestId ?? undefined,
    p_metadata: developerId ? { developer_id: developerId } : {},
  });
  if (error) {
    // Table analytic_events absente : le suivi est simplement inactif,
    // cela ne doit jamais casser le parcours de l'utilisateur.
    const code = (error as { code?: string }).code;
    if (code === "42P01" || /does not exist/i.test(error.message)) {
      return NextResponse.json({ ok: true, recorded: false });
    }
    log.error({
      action: "analytics.track",
      event,
      user: actorId ?? "anonyme",
      message: error.message,
    });
    return NextResponse.json(
      { code: "TRACK_FAILED", message: "Événement non enregistré." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, recorded: true });
}
