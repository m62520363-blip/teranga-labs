import { NextResponse } from "next/server";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { apiRequireUser } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPaymentProvider, isPaymentApiError } from "@/lib/payments/provider";
import { getTokenProductSlug } from "@/lib/payments/chariow-config";
import { paymentCheckoutSchema } from "@/lib/validations";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/payments/checkout
 * Initialise une session de paiement Chariow pour le pack demandé par
 * l'utilisateur connecté. Crée d'abord une "intention de paiement"
 * (montant gelé côté serveur), puis ouvre la session Chariow et renvoie
 * l'URL de redirection. Aucun crédit ici : seul le Pulse signé, après
 * re-vérification serveur de la vente, crédite les Tokens.
 *
 * Le prix facturé vient du produit Chariow (slugs = ids des packs) : le
 * Pulse compare ensuite le montant confirmé à l'intention gelée, ce qui
 * détecte toute divergence de prix entre base et boutique Chariow.
 */
export async function POST(request: Request) {
  const provider = getPaymentProvider();
  if (!provider.isConfigured()) {
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

  const rl = rateLimit(`checkout:${clientIp(request)}`, 10);
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

  const parsed = paymentCheckoutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        code: "BAD_REQUEST",
        message: parsed.error.issues[0]?.message ?? "Requête invalide.",
      },
      { status: 400 }
    );
  }

  const packageId = parsed.data.packageId;

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

  const email = user.email?.trim();
  if (!email) {
    return NextResponse.json(
      { code: "EMAIL_REQUIRED", message: "Ajoutez une adresse e-mail à votre compte pour payer." },
      { status: 400 }
    );
  }
  const phone = profile?.whatsapp?.trim() ?? user.phone?.trim();
  if (!phone) {
    return NextResponse.json(
      {
        code: "PHONE_REQUIRED",
        message:
          "Renseignez votre numéro WhatsApp dans votre profil pour payer en ligne.",
      },
      { status: 400 }
    );
  }

  try {
    const checkout = await provider.createCheckout({
      productSlug: getTokenProductSlug(pkg.id),
      email,
      fullName: profile?.full_name ?? null,
      phone,
      redirectUrl: `${origin}/tokens?intent=${intent.id}`,
      metadata: {
        reference: intent.id,
        kind: "token",
        package_id: pkg.id,
      },
      customerIp: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    });

    if (checkout.step === "already_purchased") {
      // Impossible avec des produits de type Licence (achats répétés
      // autorisés), mais refusé proprement plutôt que de créditer.
      return NextResponse.json(
        { code: "ALREADY_PURCHASED", message: "Vous possédez déjà ce produit." },
        { status: 409 }
      );
    }

    // Mémorise la vente côté serveur (concordance du Pulse).
    if (admin) {
      await admin
        .from("payment_intents")
        .update({
          provider: provider.id,
          provider_session_id: checkout.saleId,
        })
        .eq("id", intent.id);
    }

    // Produit gratuit / remise à zéro : finalisé immédiatement, on
    // crédite tout de suite (la RPC est idempotente).
    if (checkout.step === "completed") {
      if (!admin) {
        return NextResponse.json(
          { code: "SERVER_ERROR", message: "Service de paiement indisponible." },
          { status: 503 }
        );
      }
      const { data: creditResult, error: creditError } = await admin.rpc(
        "credit_from_payment",
        { p_intent_id: intent.id }
      );
      if (creditError) {
        log.error({
          action: "payment.checkout.immediate_credit",
          provider: provider.id,
          user: user.id,
          request_id: intent.id,
          message: creditError.message,
        });
        return NextResponse.json(
          { code: "SERVER_ERROR", message: "Erreur lors du crédit du paiement." },
          { status: 500 }
        );
      }
      return NextResponse.json({
        intentId: intent.id,
        launchUrl: `${origin}/tokens?intent=${intent.id}`,
        sessionId: checkout.saleId,
        provider: provider.id,
        result: creditResult,
      });
    }

    return NextResponse.json({
      intentId: intent.id,
      launchUrl: checkout.checkoutUrl,
      sessionId: checkout.saleId,
      provider: provider.id,
    });
  } catch (err) {
    if (isPaymentApiError(err)) {
      log.error({
        action: "payment.checkout",
        provider: provider.id,
        user: user.id,
        request_id: intent.id,
        status: err.status,
        message: err.message,
      });
      return NextResponse.json(
        {
          code:
            err.code === "chariow_invalid_phone"
              ? "PHONE_REQUIRED"
              : "PROVIDER_ERROR",
          message:
            err.code === "chariow_invalid_phone"
              ? "Votre numéro de téléphone est invalide : corrigez-le dans votre profil."
              : "Le prestataire de paiement a refusé la demande.",
        },
        { status: err.code === "chariow_invalid_phone" ? 400 : 502 }
      );
    }
    log.error({
      action: "payment.checkout",
      provider: provider.id,
      user: user.id,
      request_id: intent.id,
      status: 500,
      message: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { code: "SERVER_ERROR", message: "Erreur inattendue lors du paiement." },
      { status: 500 }
    );
  }
}