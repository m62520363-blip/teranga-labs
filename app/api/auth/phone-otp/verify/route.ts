import { NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit, clientIp } from "@/lib/rate-limit";
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
  if (!a || !b) return false;
  const da = digitsOnly(a);
  const db = digitsOnly(b);
  if (!da || !db) return false;
  // Comparaison stricte sur le numéro complet normalisé : pas de
  // comparaison partielle (les 9 derniers chiffres) qui confondrait
  // des numéros de pays différents.
  return da === db;
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

  const rl = rateLimit(`phone-otp-verify:${clientIp(request)}:${parsed.data.phone}`, 10);
  if (!rl.ok) {
    return NextResponse.json(
      { code: "RATE_LIMITED", message: "Trop de demandes. Réessayez dans un instant." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } }
    );
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json(
      { code: "SERVER_ERROR", message: "Service indisponible." },
      { status: 503 }
    );
  }

  const { data: verifyData, error: verifyErr } = await admin.rpc("verify_otp_server" as never, {
    p_channel: "sms",
    p_target: targetKey,
    p_code: parsed.data.code,
    p_purpose: "phone_login",
  } as never);

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
  const foundUserData = await admin.rpc("find_user_by_phone" as never, { p_phone: targetKey } as never);
  const foundUser = (foundUserData as { data?: unknown }).data;
  const u = (Array.isArray(foundUser) ? foundUser[0] : foundUser) as { id?: string; email?: string } | null;
  if (u) matchedEmail = u?.email ?? null;

  // Fallback : recherche dans les métadonnées (whatsapp).
  if (!matchedEmail) {
    const { data: listData } = await admin.auth.admin.listUsers({ perPage: 1000 });
    for (const uu of (listData?.users ?? [])) {
      const metaPhone = String(
        (uu.user_metadata as Record<string, unknown> | undefined)?.whatsapp ?? ""
      );
      if (phonesMatch(metaPhone, phone)) {
        matchedEmail = uu.email ?? null;
        break;
      }
    }
  }

  if (!matchedEmail) {
    const { data: devs } = await admin
      .from("developers")
      .select("id, whatsapp")
      .not("whatsapp", "is", null);
    const foundDev = (devs ?? []).find((d) => phonesMatch(d.whatsapp, phone));
    if (foundDev) {
      const { data: authUser } = await admin.auth.admin.getUserById(foundDev.id);
      matchedEmail = authUser?.user?.email ?? null;
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
