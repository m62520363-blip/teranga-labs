import { NextResponse } from "next/server";
import { createAdminClient, isServiceConfigured } from "@/lib/supabase/admin";
import { newsletterSubscribeSchema } from "@/lib/validations";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { isFeatureEnabled } from "@/lib/features";
import { log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/newsletter
 * Abonne (ou réactive) un email à la newsletter depuis le footer (B16).
 *
 * Route PUBLIQUE (pas de session) : la protection se fait par
 *   - rate-limit par IP (anti-abus) ;
 *   - validation stricte de l'email (zod + CHECK SQL) ;
 *   - RPC newsletter_subscribe (upsert idempotent, SECURITY DEFINER).
 * Aucune fuite : la réponse est toujours `ok: true` que l'email existe
 * déjà ou non (pas de disclosure d'emails inscrits).
 */
export async function POST(request: Request) {
  if (!isServiceConfigured()) {
    return NextResponse.json(
      { code: "DB_NOT_CONFIGURED", message: "Base Supabase indisponible." },
      { status: 503 }
    );
  }

  // Feature flag (H1) : flag éteint = parcours inexistant (404, sans
  // disclosure). Vérifié AVANT le rate-limit pour ne pas consommer le
  // budget IP sur un service désactivé.
  if (!(await isFeatureEnabled("newsletter"))) {
    return NextResponse.json(
      { code: "NOT_FOUND", message: "Service indisponible." },
      { status: 404 }
    );
  }

  const rl = rateLimit(`newsletter:${clientIp(request)}`, 5);
  if (!rl.ok) {
    return NextResponse.json(
      { code: "RATE_LIMITED", message: "Trop de demandes. Réessayez plus tard." },
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

  const parsed = newsletterSubscribeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        code: "BAD_REQUEST",
        message: parsed.error.issues[0]?.message ?? "Requête invalide.",
      },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json(
      { code: "SERVER_ERROR", message: "Inscription impossible pour le moment." },
      { status: 503 }
    );
  }

  const { error } = await admin.rpc("newsletter_subscribe", {
    p_email: parsed.data.email,
    p_locale: parsed.data.locale,
    p_source: parsed.data.source,
  });

  if (error) {
    log.error({
      action: "newsletter.subscribe",
      status: 500,
      message: error.message,
    });
    return NextResponse.json(
      { code: "SERVER_ERROR", message: "Inscription impossible, réessayez." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
