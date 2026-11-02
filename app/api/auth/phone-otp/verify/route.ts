import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient, isServiceConfigured } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  phone: z.string().min(6),
  code: z.string().regex(/^\d{6}$/, "Le code comporte 6 chiffres."),
});

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
 * POST /api/auth/phone-otp/verify
 * Vérifie le code à 6 chiffres et retourne un token_hash de session
 * permettant d'ouvrir immédiatement la session Supabase côté client.
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

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        code: "BAD_REQUEST",
        message: parsed.error.issues[0]?.message ?? "Code invalide.",
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

  const { data: verifyData, error: verifyErr } = await admin.rpc("verify_otp", {
    p_channel: "sms",
    p_target: targetKey,
    p_code: parsed.data.code,
    p_purpose: "phone_login",
  });

  if (verifyErr) {
    return NextResponse.json(
      { code: "VERIFY_ERROR", message: "Vérification impossible." },
      { status: 400 }
    );
  }

  const result = (verifyData ?? {}) as { verified?: boolean; reason?: string };
  if (!result.verified) {
    return NextResponse.json(
      {
        code: "INVALID_CODE",
        message:
          result.reason === "code_expired_or_missing"
            ? "Code expiré. Demandez-en un nouveau."
            : "Code incorrect. Vérifiez les 6 chiffres et réessayez.",
      },
      { status: 400 }
    );
  }

  // Retrouve l'email de l'utilisateur pour émettre un lien de session
  let matchedEmail: string | null = null;
  const { data: listData } = await admin.auth.admin.listUsers({
    perPage: 1000,
  });
  const users = listData?.users ?? [];
  for (const u of users) {
    const metaPhone = String(
      (u.user_metadata as Record<string, unknown> | undefined)?.whatsapp ?? ""
    );
    if (phonesMatch(u.phone, phone) || phonesMatch(metaPhone, phone)) {
      matchedEmail = u.email ?? null;
      break;
    }
  }

  if (!matchedEmail) {
    const { data: devs } = await admin
      .from("developers")
      .select("id, whatsapp")
      .not("whatsapp", "is", null);
    const foundDev = (devs ?? []).find((d) => phonesMatch(d.whatsapp, phone));
    if (foundDev) {
      const foundAuth = users.find((u) => u.id === foundDev.id);
      matchedEmail = foundAuth?.email ?? null;
    }
  }

  if (!matchedEmail) {
    return NextResponse.json(
      { code: "USER_NOT_FOUND", message: "Compte introuvable." },
      { status: 404 }
    );
  }

  const { data: linkData, error: linkErr } =
    await admin.auth.admin.generateLink({
      type: "magiclink",
      email: matchedEmail,
    });

  const hashedToken = linkData?.properties?.hashed_token;
  if (linkErr || !hashedToken) {
    return NextResponse.json(
      { code: "SESSION_FAILED", message: "Ouverture de session impossible." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    token_hash: hashedToken,
  });
}
