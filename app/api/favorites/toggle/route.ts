import { NextResponse } from "next/server";
import { apiRequireRole, CONNECTED_ROLES } from "@/lib/auth/guards";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { favoriteToggleSchema } from "@/lib/validations";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/favorites/toggle
 * Bascule atomique du favori d'un brief (§25) via la RPC
 * toggle_favorite. Réservé aux sessions authentifiées.
 */
export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { code: "DB_NOT_CONFIGURED", message: "Base Supabase indisponible." },
      { status: 503 }
    );
  }

  const rl = rateLimit(`favorite-toggle:${clientIp(request)}`, 30);
  if (!rl.ok) {
    return NextResponse.json(
      { code: "RATE_LIMITED", message: "Trop de demandes." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } }
    );
  }

  const guard = await apiRequireRole(CONNECTED_ROLES);
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

  const parsed = favoriteToggleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { code: "BAD_REQUEST", message: parsed.error.issues[0]?.message ?? "Requête invalide." },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json(
      { code: "DB_NOT_CONFIGURED", message: "Base Supabase indisponible." },
      { status: 503 }
    );
  }

  const { data, error } = await supabase.rpc("toggle_favorite", {
    p_request_id: parsed.data.request_id,
  });

  if (error) {
    const code = error.code ?? "SERVER_ERROR";
    log.error({
      action: "favorite.toggle",
      user: user.id,
      request_id: parsed.data.request_id,
      message: error.message,
    });
    return NextResponse.json(
      { code, message: code === "TLNOR" ? "Brief introuvable." : "Impossible de modifier le favori." },
      { status: code === "TLNOR" ? 404 : 400 }
    );
  }

  const favorited = ((data ?? {}) as { favorited?: boolean }).favorited === true;
  return NextResponse.json({ favorited, request_id: parsed.data.request_id });
}