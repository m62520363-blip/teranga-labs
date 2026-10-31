import { NextResponse } from "next/server";
import { z } from "zod";
import { isServiceConfigured } from "@/lib/supabase/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  email: z.string().email("Adresse email invalide."),
  code: z.string().regex(/^\d{6}$/, "Code à 6 chiffres requis."),
  password: z
    .string()
    .min(8, "Au moins 8 caractères")
    .regex(/[A-Za-z]/, "Au moins une lettre")
    .regex(/\d/, "Au moins un chiffre"),
});

/**
 * POST /api/auth/reset-password
 * Vérifie le code OTP (purpose=password_reset) puis met à jour le mot de passe
 * via le client admin. Aucune session utilisateur requise.
 */
export async function POST(request: Request) {
  if (!isServiceConfigured()) {
    return NextResponse.json(
      { code: "DB_NOT_CONFIGURED", message: "Service indisponible." },
      { status: 503 }
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

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { code: "BAD_REQUEST", message: parsed.error.issues[0]?.message ?? "Requête invalide." },
      { status: 400 }
    );
  }

  const { email, code, password } = parsed.data;
  const target = email.trim().toLowerCase();

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json(
      { code: "SERVER_ERROR", message: "Service indisponible." },
      { status: 503 }
    );
  }

  // Vérification du code OTP.
  const { data: verifyData, error: verifyError } = await admin.rpc("verify_otp", {
    p_channel: "email",
    p_target: target,
    p_code: code,
    p_purpose: "password_reset",
  });

  if (verifyError) {
    log.error({ action: "auth.reset.verify_otp", message: verifyError.message });
    return NextResponse.json(
      { code: "OTP_FAILED", message: "Vérification impossible." },
      { status: 400 }
    );
  }

  const verifyResult = (verifyData ?? {}) as { verified?: boolean; reason?: string };
  if (!verifyResult.verified) {
    const reason = verifyResult.reason ?? "invalid_code";
    const message =
      reason === "code_expired_or_missing"
        ? "Code expiré ou introuvable. Demandez un nouveau code."
        : reason === "too_many_attempts"
          ? "Trop de tentatives. Demandez un nouveau code."
          : "Code incorrect.";
    return NextResponse.json({ code: "INVALID_CODE", message }, { status: 400 });
  }

  // Recherche de l'utilisateur par email.
  let userId: string | null = null;
  try {
    const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
    const found = data?.users?.find((u) => u.email?.toLowerCase() === target);
    userId = found?.id ?? null;
  } catch {
    userId = null;
  }

  if (!userId) {
    return NextResponse.json(
      { code: "USER_NOT_FOUND", message: "Aucun compte pour cette adresse." },
      { status: 404 }
    );
  }

  // Mise à jour du mot de passe via le client admin.
  const { error: updateError } = await admin.auth.admin.updateUserById(userId, {
    password,
  });

  if (updateError) {
    log.error({ action: "auth.reset.update_password", message: updateError.message });
    return NextResponse.json(
      { code: "UPDATE_FAILED", message: "Impossible de mettre à jour le mot de passe." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, message: "Mot de passe mis à jour." });
}
