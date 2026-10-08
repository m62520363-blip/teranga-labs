import { NextResponse } from "next/server";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { apiRequireUser } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { isWaveConfigured } from "@/lib/payments/config";
import { getProviderByName } from "@/lib/payments/provider";
import { verificationCheckoutSchema } from "@/lib/validations";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/verification/checkout
 * Initialise une session de paiement Wave pour la vérification de
 * profil du développeur connecté. Crée (ou récupère) la demande de
 * vérification côté serveur, puis redirige vers Wave.
 * Aucune confirmation ici : seul le webhook signé (ou l'admin, en
 * rapprochement manuel) confirme le paiement.
 */
export async function POST(request: Request) {
  if (!isWaveConfigured()) {
    return NextResponse.json(
      { code: "PAYMENT_NOT_CONFIGURED", message: "Le paiement en ligne n'est pas encore activé." },
      { status: 503 }
    );
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { code: "DB_NOT_CONFIGURED", message: "La base Supabase n'est pas configurée." },
      { status: 503 }
    );
  }

  const rl = rateLimit(`verification-checkout:${clientIp(request)}`, 10);
  if (!rl.ok) {
    return NextResponse.json(
      {
        code: "RATE_LIMITED",
        message: "Trop de demandes. Réessayez dans quelques instants.",
      },
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

  const parsed = verificationCheckoutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        code: "BAD_REQUEST",
        message: parsed.error.issues[0]?.message ?? "Requête invalide.",
      },
      { status: 400 }
    );
  }

  const method = parsed.data.method === "max_it" ? "max_it" : "wave";

  const guard = await apiRequireUser();
  if (guard.response) return guard.response;
  const user = guard.user!;

  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json(
      { code: "DB_NOT_CONFIGURED", message: "Base Supabase indisponible." },
      { status: 503 }
    );
  }

  const { data: dev } = await supabase
    .from("developers")
    .select("id, status")
    .eq("id", user.id)
    .maybeSingle();

  if (!dev) {
    return NextResponse.json(
      { code: "NO_PROFILE", message: "Créez d'abord un compte développeur." },
      { status: 403 }
    );
  }
  if (dev.status !== "active" && dev.status !== "verified") {
    return NextResponse.json(
      { code: "ACCOUNT_NOT_ELIGIBLE", message: "Votre compte n'est pas éligible à la vérification." },
      { status: 403 }
    );
  }

  const { data: price } = await supabase.rpc("get_verification_price");
  if (typeof price !== "number" || price <= 0) {
    return NextResponse.json(
      { code: "PRICE_UNAVAILABLE", message: "La vérification est indisponible pour le moment." },
      { status: 503 }
    );
  }

  // 1) Crée la demande de vérification (prix verrouillé côté serveur).
  const { data: created, error: createError } = await supabase.rpc("submit_verification_request", {
    p_method: method,
  });
  const createdRequest = (created ?? null) as {
    ok?: boolean;
    request_id?: string;
    amount_fcfa?: number;
  } | null;

  let requestId: string;
  if (createError && createError.code === "TLDUP") {
    // Demande déjà en cours : récupère la demande 'pending' existante
    // pour enchaîner un nouveau paiement (cas abandon / relance Wave).
    const { data: existing } = await supabase
      .from("verification_requests")
      .select("id, method")
      .eq("developer_id", user.id)
      .eq("verification_status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!existing) {
      return NextResponse.json(
        { code: "SERVER_ERROR", message: "Impossible de récupérer la demande de vérification." },
        { status: 500 }
      );
    }
    requestId = existing.id as string;
    if (existing.method !== method) {
      const admin = createAdminClient();
      if (admin) {
        await admin.from("verification_requests").update({ method }).eq("id", requestId);
      }
    }
  } else if (createError || !created) {
    const code = createError?.code ?? "SERVER_ERROR";
    const message =
      code === "TLPEN"
        ? "Votre compte n'est pas (encore) éligible à la vérification."
        : code === "TLNOP" || code === "PRICE_UNAVAILABLE"
          ? "La vérification est indisponible pour le moment."
          : "Impossible de créer la demande de vérification.";
    return NextResponse.json({ code, message }, { status: code === "TLPEN" ? 403 : 400 });
  } else {
    requestId = createdRequest?.request_id as string;
  }

  const origin = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
  const impl = getProviderByName("wave");

  try {
    const checkout = await impl.createCheckout({
      amountFcfa: price,
      description: "Vérification de profil TERANGA LABS",
      reference: requestId,
      origin,
      returnPath: `/verification?request=${requestId}`,
      cancelPath: `/verification?request=${requestId}`,
    });

    // Mémorise la session Wave côté serveur (concordance du webhook).
    const admin = createAdminClient();
    if (admin) {
      await admin
        .from("verification_requests")
        .update({ provider_session_id: checkout.sessionId })
        .eq("id", requestId);
    }

    return NextResponse.json({
      requestId,
      launchUrl: checkout.launchUrl,
      sessionId: checkout.sessionId,
    });
  } catch (err) {
    if (impl.isApiError(err)) {
      log.error({
        action: "verification.checkout",
        provider: impl.name,
        user: user.id,
        request_id: requestId,
        status: 502,
        message: err.message,
      });
      return NextResponse.json(
        { code: "PROVIDER_ERROR", message: "Le prestataire de paiement a refusé la demande." },
        { status: 502 }
      );
    }
    log.error({
      action: "verification.checkout",
      provider: impl.name,
      user: user.id,
      request_id: requestId,
      status: 500,
      message: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { code: "SERVER_ERROR", message: "Erreur inattendue lors du paiement." },
      { status: 500 }
    );
  }
}