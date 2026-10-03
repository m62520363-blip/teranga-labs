import { NextResponse } from "next/server";
import { getCurrentUser, createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createCheckoutSession, isWaveApiError } from "@/lib/payments/wave";
import { isWaveConfigured } from "@/lib/payments/config";
import { createPaydunyaCheckout, isPaydunyaApiError } from "@/lib/payments/paydunya";
import { isPaydunyaConfigured } from "@/lib/payments/paydunya-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/payments/checkout
 * Initialise une session de paiement pour le pack demandé par le
 * développeur connecté. Crée d'abord une "intention de paiement"
 * (montant gelé côté serveur), puis redirige vers le prestataire.
 * Aucun crédit ici : seul le webhook/IPN signé crédite les Tokens.
 *
 * Deux prestataires sont gérés, choisis via `provider` :
 *   - `wave`     : Checkout Session + webhook HMAC.
 *   - `paydunya` : facture PAR + IPN par hash SHA-512 de la MasterKey.
 *
 * `provider` est résolu côté serveur à partir de la configuration : le
 * client ne choisit pas librement son prestataire, il ne fait que
 * demander. Incohérent, il retombe sur celui qui est configuré.
 */
export async function POST(request: Request) {
  const paydunyaReady = isPaydunyaConfigured();
  const waveReady = isWaveConfigured();

  if (!paydunyaReady && !waveReady) {
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

  let body: { packageId?: string; provider?: string };
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

  const { data: profile } = await supabase
    .from("developers")
    .select("id, status, full_name, whatsapp")
    .eq("id", user.id)
    .maybeSingle();

  const { data: roleRow } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile) {
    return NextResponse.json(
      { code: "NO_PROFILE", message: "Créez d'abord un compte." },
      { status: 403 }
    );
  }

  // Le rôle `client` est autorisé SANS avoir un profil développeur validé :
  // un client paie 1 Token par brief publié, il doit donc pouvoir acheter.
  // La migration 0028 (create_token_order) applique déjà cette règle côté
  // commande manuelle ; ce checkout était resté sur l'ancienne version
  // développeur-only, ce qui bloquait les clients à l'achat.
  const role = roleRow?.role ?? null;
  const isClient = role === "client";
  const status = profile.status;

  if (!isClient && status !== "active" && status !== "verified") {
    return NextResponse.json(
      {
        code: "ACCOUNT_NOT_ACTIVE",
        message:
          status === "pending" || status === "verification_pending"
            ? "Votre compte est en attente de validation."
            : "Votre compte ne permet pas d'acheter des Tokens.",
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
  const admin = createAdminClient();

    // Prestataire effectif : PayDunya prioritaire (Mobile Money et carte déjà
    // activés côté compte), Wave en repli.
  const requested = body.provider;
  const usePaydunya =
    requested === "paydunya" ? paydunyaReady : requested === "wave" ? false : paydunyaReady;
  const provider = usePaydunya ? "paydunya" : "wave";

  if (!usePaydunya && !waveReady) {
    return NextResponse.json(
      {
        code: "PAYMENT_NOT_CONFIGURED",
        message: "Le paiement en ligne n'est pas encore activé sur ce serveur.",
      },
      { status: 503 }
    );
  }

  try {
    if (usePaydunya) {
      // Pré-remplissage de la page PayDunya : leur API accepte un nœud
      // `customer` qui renseigne nom, email et téléphone. L'acheteur n'a
      // donc plus rien à saisir sur leur page, ce qui est le principal
      // levier de conversion sur un tunnel qu'on ne contrôle pas.
      // Les valeurs viennent de la session et du profil, jamais du client.
      const customer: { name?: string; email?: string; phone?: string } = {};
      const fullName = profile?.full_name?.trim();
      const email = user.email?.trim();
      // `whatsapp` est le numéro que l'utilisateur a déjà saisi à
      // l'inscription : on le réutilise plutôt que d'en redemander un.
      const phone = profile?.whatsapp?.trim() ?? user.phone?.trim();
      if (fullName) customer.name = fullName;
      if (email) customer.email = email;
      if (phone) customer.phone = phone;

      const checkout = await createPaydunyaCheckout({
        amountFcfa: pkg.price_fcfa,
        description: `Pack ${pkg.name} - ${pkg.tokens} Token(s) TERANGA LABS`,
        itemName: pkg.name,
        itemQuantity: pkg.tokens,
        // L'IPN ne renvoie pas de référence client Wave : l'id d'intention
        // transite par custom_data, seul moyen de le retrouver à l'arrivée.
        customData: { intent_id: intent.id },
        ...(Object.keys(customer).length > 0 ? { customer } : {}),
        siteUrl: origin,
        returnUrl: `${origin}/tokens?intent=${intent.id}`,
        cancelUrl: `${origin}/tokens?intent=${intent.id}&cancelled=1`,
      });

      if (admin) {
        await admin
          .from("payment_intents")
          .update({
            provider: "paydunya",
            provider_session_id: checkout.token,
          })
          .eq("id", intent.id);
      }

      return NextResponse.json({
        intentId: intent.id,
        launchUrl: checkout.redirectUrl,
        sessionId: checkout.token,
        provider: "paydunya",
      });
    }

    const session = await createCheckoutSession({
      amount: String(pkg.price_fcfa),
      currency: "XOF",
      successUrl: `${origin}/tokens?intent=${intent.id}`,
      errorUrl: `${origin}/tokens?intent=${intent.id}`,
      clientReference: intent.id,
    });

    // Mémorise la session Wave côté serveur (pour la concordance webhook).
    if (admin) {
      await admin
        .from("payment_intents")
        .update({
          provider: "wave",
          provider_session_id: session.id,
        })
        .eq("id", intent.id);
    }

    return NextResponse.json({
      intentId: intent.id,
      launchUrl: session.wave_launch_url,
      sessionId: session.id,
      provider,
    });
  } catch (err) {
    if (isPaydunyaApiError(err)) {
      console.error("[payments] PayDunya checkout error:", err.message);
      return NextResponse.json(
        { code: "PROVIDER_ERROR", message: "Le prestataire de paiement a refusé la demande." },
        { status: 502 }
      );
    }
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