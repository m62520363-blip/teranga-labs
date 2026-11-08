import { NextResponse } from "next/server";
import { z } from "zod";
import { isServiceConfigured } from "@/lib/supabase/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { deliverMessage } from "@/lib/notifications/providers";
import { log } from "@/lib/log";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  email: z.string().email("Adresse email invalide."),
});

/**
 * POST /api/auth/request-reset-code
 * Envoie un code à 6 chiffres par email pour réinitialiser le mot de passe.
 * Ne révèle jamais si le compte existe (réponse identique dans tous les cas).
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

  const email = parsed.data.email.trim().toLowerCase();
  const rl = rateLimit(`reset-request:${clientIp(request)}:${email}`, 5);
  if (!rl.ok) {
    return NextResponse.json(
      { code: "RATE_LIMITED", message: "Trop de demandes. Réessayez dans un instant." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } }
    );
  }
  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json(
      { code: "SERVER_ERROR", message: "Envoi impossible pour le moment." },
      { status: 503 }
    );
  }

  // Recherche de l'utilisateur par email (sans révéler l'existence).
  let userId: string | null = null;
  try {
    const { data: foundData } = await admin.rpc("find_user_by_email" as never, { p_email: email } as never);
    const found = (Array.isArray(foundData) ? foundData[0] : foundData) as { id?: string } | null;
    userId = found?.id ?? null;
  } catch {
    userId = null;
  }

  // Si l'utilisateur existe, on émet un code OTP et on l'envoie.
  if (userId) {
    try {
      const { data, error } = await admin.rpc("request_otp", {
        p_channel: "email",
        p_target: email,
        p_purpose: "password_reset",
        p_user_id: userId,
      });

      if (error) {
        log.error({ action: "auth.reset.request_otp", message: error.message });
      } else {
        const result = (data ?? {}) as { code?: string; expires_in_seconds?: number };
        if (result.code) {
          const code = result.code;
          const origin = (process.env.NEXT_PUBLIC_APP_URL ?? "https://devvmarket.vercel.app").replace(/\/$/, "");
          const html = buildResetEmailHtml(code, origin);
          const text = `Votre code de réinitialisation Devmarket : ${code}\n\nCe code est valable 10 minutes. Ne le partagez avec personne.\n\nDevmarket — Build Your Service\n${origin}`;

          await deliverMessage(
            { email },
            text,
            {
              jobType: "auth.password_reset",
              requestId: userId,
              recipientLabel: "email",
              allowEmail: true,
              html,
              subject: `Devmarket · Code de réinitialisation : ${code}`,
            }
          );
        }
      }
    } catch (err) {
      log.error({
        action: "auth.reset.request",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Réponse identique dans tous les cas (ne pas révéler l'existence du compte).
  return NextResponse.json({
    ok: true,
    message: "Si un compte existe pour cette adresse, un code de réinitialisation vient d'être envoyé.",
  });
}

function buildResetEmailHtml(code: string, origin: string): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Devmarket · Code de réinitialisation</title>
</head>
<body style="margin:0;padding:0;background:#0b132b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0b132b;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#111a36;border:1px solid rgba(57,255,136,0.2);border-radius:16px;overflow:hidden;">
          <tr>
            <td style="padding:32px 32px 16px;text-align:center;">
              <img src="${origin}/logo.png" alt="Devmarket" width="48" height="48" style="display:inline-block;border-radius:12px;" />
              <p style="margin:12px 0 0;font-size:20px;font-weight:700;color:#ffffff;">Devmarket</p>
              <p style="margin:4px 0 0;font-size:12px;font-weight:600;letter-spacing:0.12em;color:#39ff88;text-transform:uppercase;">Build Your Service</p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px 24px;">
              <h1 style="margin:0;font-size:18px;font-weight:600;color:#ffffff;text-align:center;">Réinitialisation de votre mot de passe</h1>
              <p style="margin:12px 0 0;font-size:14px;line-height:1.6;color:rgba(255,255,255,0.7);text-align:center;">
                Vous avez demandé la réinitialisation de votre mot de passe Devmarket.
                Utilisez le code ci-dessous pour créer un nouveau mot de passe.
              </p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:0 32px 24px;">
              <div style="display:inline-block;background:#0b132b;border:2px solid #39ff88;border-radius:12px;padding:16px 32px;">
                <p style="margin:0;font-size:32px;font-weight:700;letter-spacing:0.3em;color:#39ff88;font-family:monospace;">${code}</p>
              </div>
              <p style="margin:12px 0 0;font-size:12px;color:rgba(255,255,255,0.5);text-align:center;">
                Code valable 10 minutes · Ne le partagez avec personne.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px 32px;border-top:1px solid rgba(255,255,255,0.08);">
              <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.4);text-align:center;">
                Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.
                <br />
                Devmarket · Build Your Service
                <br />
                <a href="${origin}" style="color:#39ff88;text-decoration:none;">${origin}</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
