import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createAdminClient, isServiceConfigured } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** Comparaison de secrets en temps constant (évite le timing attack). */
function isAuthorized(authHeader: string | null, secret: string): boolean {
  if (!authHeader?.startsWith("Bearer ")) return false;
  const token = authHeader.slice("Bearer ".length);
  const a = Buffer.from(token);
  const b = Buffer.from(secret);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || !isAuthorized(authHeader, cronSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isServiceConfigured()) {
    return NextResponse.json(
      { error: "Service role key not configured" },
      { status: 500 }
    );
  }

  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Database client unavailable" },
      { status: 500 }
    );
  }

  // Le cron tourne le 1er du mois à 00h01 : on solde le mois ÉCoulÉ,
  // pas le mois en cours (qui vient de démarrer, sans mission).
  const now = new Date();
  let year = now.getUTCFullYear();
  let month = now.getUTCMonth() + 1; // 1..12
  month -= 1;
  if (month === 0) {
    month = 12;
    year -= 1;
  }

  const { data, error } = await supabase.rpc("leaderboard_settle_month", {
    p_year: year,
    p_month: month,
  });

  if (error) {
    // Message Postgres en interne uniquement (pas de fuite au client).
    console.error("Leaderboard settle error:", error);
    return NextResponse.json({ error: "SETTLE_FAILED" }, { status: 500 });
  }

  return NextResponse.json(data);
}
