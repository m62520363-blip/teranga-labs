import { NextRequest, NextResponse } from "next/server";
import { apiRequireRole } from "@/lib/auth/guards";
import { createAdminClient, isServiceConfigured } from "@/lib/supabase/admin";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/leaderboard/settle
 * Déclenche le settlement mensuel (P1, §22/§35) : recalcule le classement
 * d'un mois donné, crédite les Tokens des rangs 1/2 et archive — le tout
 * idempotent. Réservé aux admins (le cron éventuel passe par service_role).
 */
export async function POST(request: NextRequest) {
  const rl = rateLimit(`leaderboard-settle:${clientIp(request)}`, 3);
  if (!rl.ok) {
    return NextResponse.json(
      { code: "RATE_LIMITED", message: "Trop de demandes." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } }
    );
  }

  const guard = await apiRequireRole(["admin"]);
  if (guard.response) return guard.response;
  const user = guard.user!;

  if (!isServiceConfigured()) {
    return NextResponse.json({ code: "NOT_CONFIGURED", message: "Service indisponible." }, { status: 503 });
  }

  let year = new Date().getFullYear();
  let month = new Date().getMonth() + 1;
  try {
    const body = (await request.json()) as { year?: number; month?: number };
    if (typeof body.year === "number") year = body.year;
    if (typeof body.month === "number") month = body.month;
  } catch {
    // corps optionnel : valeurs par défaut (mois courant)
  }

  if (month < 1 || month > 12) {
    return NextResponse.json({ code: "BAD_REQUEST", message: "Mois invalide (1-12)." }, { status: 400 });
  }
  // Bornes réalistes sur l'année (évite NaN ou une année absurde envoyée
  // à la RPC, qui renverrait une erreur Postgres).
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return NextResponse.json({ code: "BAD_REQUEST", message: "Année invalide." }, { status: 400 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ code: "NOT_CONFIGURED", message: "Service indisponible." }, { status: 503 });
  }

  const { data, error } = await admin.rpc("settle_leaderboard", { p_year: year, p_month: month });
  if (error) {
    // Le message Postgres reste en interne : on ne renvoie qu'un code
    // applicatif générique (pas de fuite de schéma).
    log.error({ action: "leaderboard.settle", user: user.id, year, month, message: error.message });
    return NextResponse.json(
      { code: "SETTLE_FAILED", message: "Échec du settlement." },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true, result: data ?? null });
}