import { NextResponse } from "next/server";
import { createAdminClient, isServiceConfigured } from "@/lib/supabase/admin";
import { phoneOtpSchema } from "@/lib/validations";
import { deliverMessage } from "@/lib/notifications/providers";
import { log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

function phonesMatch(a: string | null | undefined, b: string): boolean {
  if (!a) return false;
  const da = digitsOnly(a);
  const db = digitsOnly(b);
  if (!da || !db) return false;
  if (da === db) return true;
  if (da.length >= 9 && db.length >= 9 && da.slice(-9) === db.slice(-9)) {
    return true;
  }
  return false;
}

/**
 * POST /api/auth/phone-otp/request
 * Recherche le compte par numéro WhatsApp / téléphone (dans developers.whatsapp
 * ou user_metadata.whatsapp ou auth.users.phone), émet un code à 6 chiffres
 * via request_otp et l'envoie par SMS/WhatsApp (et email du compte en secours).
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
      { code: "BAD_REQUEST", message: "Requête invalide." },
      { status: 400 }
    );
  }

  const parsed = phoneOtpSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        code: "BAD_REQUEST",
        message: parsed.error.issues[0]?.message ?? "Numéro invalide.",
      },
      { status: 400 }
    );
  }

  const phone = parsed.data.phone.trim();
  const targetKey = `+${digitsOnly(phone)}`;

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json(
      { code: "SERVER_ERROR", message: "Service indisponible." },
      { status: 503 }
    );
  }

  let matchedUserId: string | null = null;
  let matchedEmail: string | null = null;

  try {
    const { data: listData } = await admin.auth.admin.listUsers({
      perPage: 1000,
    });
    const users = listData?.users ?? [];
    for (const u of users) {
      const metaPhone = String(
        (u.user_metadata as Record<string, unknown> | undefined)?.whatsapp ?? ""
      );
      if (phonesMatch(u.phone, phone) || phonesMatch(metaPhone, phone)) {
        matchedUserId = u.id;
        matchedEmail = u.email ?? null;
        break;
      }
    }

    if (!matchedUserId) {
      const { data: devs } = await admin
        .from("developers")
        .select("id, whatsapp")
        .not("whatsapp", "is", null);
      const foundDev = (devs ?? []).find((d) =>
        phonesMatch(d.whatsapp, phone)
      );
      if (foundDev) {
        matchedUserId = foundDev.id;
        const foundAuth = users.find((u) => u.id === foundDev.id);
        matchedEmail = foundAuth?.email ?? null;
      }
    }
  } catch (err) {
    log.error({
      action: "auth.phone_otp.lookup",
      message: err instanceof Error ? err.message : String(err),
    });
  }

  if (!matchedUserId) {
    return NextResponse.json(
      {
        code: "USER_NOT_FOUND",
        message:
          "Aucun compte n'est associé à ce numéro. Créez votre compte, puis ajoutez ce numéro.",
      },
      { status: 404 }
    );
  }

  const { data: otpData, error: otpErr } = await admin.rpc("request_otp", {
    p_channel: "sms",
    p_target: targetKey,
    p_purpose: "phone_login",
    p_user_id: matchedUserId,
  });

  if (otpErr) {
    const lots = otpErr.code === "TLOTS";
    return NextResponse.json(
      {
        code: lots ? "RATE_LIMITED" : "OTP_FAILED",
        message: lots
          ? "Trop de demandes récentes. Réessayez dans quelques minutes."
          : "Impossible de générer le code.",
      },
      { status: lots ? 429 : 400 }
    );
  }

  const result = (otpData ?? {}) as { code?: string };
  if (!result.code) {
    return NextResponse.json(
      { code: "SERVER_ERROR", message: "Envoi du code impossible." },
      { status: 500 }
    );
  }

  const text = `Votre code de connexion Devmarket : ${result.code} (valable 10 minutes). Ne le partagez avec personne.`;

  try {
    await deliverMessage(
      {
        whatsapp: targetKey,
        email: matchedEmail ?? undefined,
      },
      text,
      {
        jobType: "auth.phone_login",
        requestId: matchedUserId,
        recipientLabel: "phone_login",
        allowEmail: true,
        subject: `Devmarket · Code de connexion : ${result.code}`,
      }
    );
  } catch (err) {
    log.error({
      action: "auth.phone_otp.send",
      message: err instanceof Error ? err.message : String(err),
    });
  }

  return NextResponse.json({ ok: true });
}
