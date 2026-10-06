import { NextResponse } from "next/server";
import { getCurrentUser, isSupabaseConfigured } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { otpVerifySchema } from "@/lib/validations";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/otp/verify
 * Vérifie un code OTP (§9) via la RPC `verify_otp` (comparaison du
 * hash côté base, tentatives bornées, expiration). Le code n'est
 * jamais comparé côté client.
 */
export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { code: "DB_NOT_CONFIGURED", message: "Base Supabase indisponible." },
      { status: 503 }
    );
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { code: "UNAUTHENTICATED", message: "Connectez-vous." },
      { status: 401 }
    );
  }

  const rl = rateLimit(`otp-verify:${clientIp(request)}`, 10);
  if (!rl.ok) {
    return NextResponse.json(
      { code: "RATE_LIMITED", message: "Trop de tentatives." },
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

  const parsed = otpVerifySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { code: "BAD_REQUEST", message: parsed.error.issues[0]?.message ?? "Requête invalide." },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json(
      { code: "SERVER_ERROR", message: "Vérification impossible." },
      { status: 503 }
    );
  }

  const { data, error } = await admin.rpc("verify_otp", {
    p_channel: parsed.data.channel,
    p_target: parsed.data.target,
    p_code: parsed.data.code,
    p_purpose: parsed.data.purpose,
  });

  if (error) {
    return NextResponse.json(
      { code: "VERIFY_ERROR", message: "Vérification impossible." },
      { status: 400 }
    );
  }

  const result = (data ?? {}) as {
    verified?: boolean;
    reason?: string;
  };

  if (!result.verified) {
    const status = result.reason === "too_many_attempts" ? 429 : 400;
    return NextResponse.json(
      { code: "INVALID_CODE", message: "Code incorrect ou expiré.", reason: result.reason },
      { status }
    );
  }

  return NextResponse.json({ verified: true });
}