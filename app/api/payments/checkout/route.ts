import { NextResponse } from "next/server";
import { getCurrentUser, createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createCheckoutSession, isWaveApiError } from "@/lib/payments/wave";
import { isWaveConfigured } from "@/lib/payments/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/payments/checkout
 * Initialise une session de paiement Wave pour le pack demandé par
 * le développeur connecté. Crée d'abord une "intention de paiement"
 * (montant gelé côté serveur), puis redirige vers Wave.
 * Aucun crédit ici : seul le webhook signé crédite les Tokens.
 */
export async function POST(request: Request) {
  if (!isWaveConfigured()) {
    return NextResponse.json(
      {
        code: "PAYMENT_NOT_CONFIGURED",
        message: "Le paiement en ligne n'est pas encore activé sur ce serveur.",
      },
      { status: 503 }
    );
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      {
        code: "DB_NOT_CONFIGURED",
        message: "La base Supabase n'est pas configurée.",
      },
      { status: 503 }
    );
  }

  let body: { packageId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { code: "BAD_REQUEST", message: "Corps de requête invalide." },
      { status: 400 }
    );
  }

  const packageId = body.packageId;
  if (!packageId || typeof packageId !== "string") {
    return NextResponse.json(
      { code: "BAD_REQUEST", message: "packageId manquant." },
      { status: 400 }
    );
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { code: "UNAUTHENTICATED", message: "Connectez-vous pour acheter des Tokens." },
      { status: 401 }
    );
  }

  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json(
      { code: "DB_NOT_CONFIGURED", message: "Base Supabase indisponible." },
      { status: 503 }
    );
  }

  const { data: developer } = await supabase
    .from("developers")
    .select("id, status")
    .eq("id", user.id)
    .maybeSingle();

  if (!developer) {
    return NextResponse.json(
      { code: "NO_PROFILE", message: "Créez d'abord un compte développeur." },
      { status: 403 }
    );
  }
  if (developer.status !== "active") {
    return NextResponse.json(
      {
        code: "ACCOUNT_NOT_ACTIVE",
        message:
          developer.status === "pending"
            ? "Votre compte développeur est en attente de validation."
            : "Votre compte développeur ne permet pas d'acheter des Tokens.",
      },
      { status: 403 }
    );
  }

  const { data: pkg, error: pkgError } = await supabase
    .from("token_packages")
    .select("id, name, tokens, price_fcfa")
    .eq("id", packageId)
    .maybeSingle();

  if (pkgError || !pkg || pkg.tokens <= 0 || pkg.price_fcfa <= 0) {
    return NextResponse.json(
      { code: "PACKAGE_NOT_FOUND", message: "Pack introuvable." },
      { status: 400 }
    );
  }

  // Intention de paiement : montant fixe, lié au développeur.
  const { data: intent, error: intentError } = await supabase
    .from("payment_intents")
    .insert({
      developer_id: user.id,
      package_id: pkg.id,
      package_name: pkg.name,
      tokens: pkg.tokens,
      amount_fcfa: pkg.price_fcfa,
    })
    .select("id")
    .single();

  if (intentError || !intent) {
    return NextResponse.json(
      { code: "SERVER_ERROR", message: "Impossible d'initialiser le paiement." },
      { status: 500 }
    );
  }

  const origin = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;

  try {
    const session = await createCheckoutSession({
      amount: String(pkg.price_fcfa),
      currency: "XOF",
      successUrl: `${origin}/tokens?intent=${intent.id}`,
      errorUrl: `${origin}/tokens?intent=${intent.id}`,
      clientReference: intent.id,
    });

    // Mémorise la session Wave côté serveur (pour la concordance webhook).
    const admin = createAdminClient();
    if (admin) {
      await admin
        .from("payment_intents")
        .update({ provider_session_id: session.id })
        .eq("id", intent.id);
    }

    return NextResponse.json({
      intentId: intent.id,
      launchUrl: session.wave_launch_url,
      sessionId: session.id,
    });
  } catch (err) {
    if (isWaveApiError(err)) {
      console.error("[payments] Wave checkout error:", err.message);
      return NextResponse.json(
        { code: "PROVIDER_ERROR", message: "Le prestataire de paiement a refusé la demande." },
        { status: 502 }
      );
    }
    console.error("[payments] checkout error:", err);
    return NextResponse.json(
      { code: "SERVER_ERROR", message: "Erreur inattendue lors du paiement." },
      { status: 500 }
    );
  }
}