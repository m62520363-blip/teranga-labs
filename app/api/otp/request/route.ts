import { NextResponse } from "next/server";
import { getCurrentUser, isSupabaseConfigured } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { otpRequestSchema } from "@/lib/validations";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { deliverMessage } from "@/lib/notifications/providers";
import { log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/otp/request
 * Émet un code OTP (§9) et l'ENVOIE réellement (WhatsApp/SMS/email)
 * via le provider configuré. Le code n'est connu que du serveur
 * (service_role) : la RPC `request_otp` ne le retourne qu'en contexte
 * service_role, jamais au navigateur. La vérification se fait par
 * `verify_otp`, jamais par comparaison côté client.
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

  const rl = rateLimit(`otp-request:${clientIp(request)}`, 5);
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

  const parsed = otpRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { code: "BAD_REQUEST", message: parsed.error.issues[0]?.message ?? "Requête invalide." },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json(
      { code: "SERVER_ERROR", message: "Envoi du code impossible pour le moment." },
      { status: 503 }
    );
  }

  const { data, error } = await admin.rpc("request_otp", {
    p_channel: parsed.data.channel,
    p_target: parsed.data.target,
    p_purpose: parsed.data.purpose,
    p_user_id: user.id,
  });

  if (error) {
    const code = error.code ?? "SERVER_ERROR";
    const status = code === "TLOTS" ? 429 : 400;
    const message =
      code === "TLOTS"
        ? "Trop de demandes récentes pour ce numéro."
        : "Impossible de générer le code.";
    return NextResponse.json({ code, message }, { status });
  }

  const result = (data ?? {}) as {
    code?: string;
    expires_in_seconds?: number;
  };

  // Envoi réel via le premier canal disponible — jamais simulé.
  const target = parsed.data.target;
  if (!result.code) {
    // Service role non reconnu : code introuvable, on refuse d'envoyer.
    return NextResponse.json(
      { code: "SERVER_ERROR", message: "Envoi du code impossible." },
      { status: 500 }
    );
  }

  const message = `Votre code de vérification TERANGA LABS : ${result.code} (valable 10 minutes). Ne le partagez avec personne.`;

  try {
    if (parsed.data.channel === "email") {
      await deliverMessage(
        { email: target },
        message,
        { jobType: "otp.email", requestId: user.id, recipientLabel: "email" }
      );
    } else {
      await deliverMessage(
        { whatsapp: target },
        message,
        { jobType: "otp.whatsapp", requestId: user.id, recipientLabel: "whatsapp" }
      );
    }
  } catch (err) {
    log.error({
      action: "otp.request",
      channel: parsed.data.channel,
      user: user.id,
      status: 502,
      message: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { code: "SEND_FAILED", message: "Envoi du code impossible, réessayez." },
      { status: 502 }
    );
  }

  return NextResponse.json({
    ok: true,
    purpose: parsed.data.purpose,
    channel: parsed.data.channel,
    expires_in_seconds: result.expires_in_seconds ?? 600,
  });
}