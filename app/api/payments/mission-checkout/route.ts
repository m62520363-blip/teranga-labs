import { NextResponse } from "next/server";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { apiRequireUser } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPaymentProvider, isPaymentApiError } from "@/lib/payments/provider";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { log } from "@/lib/log";
import type { Json } from "@/types/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/payments/mission-checkout
 *
 * Ouvre la session Chariow pour payer une mission (client uniquement,
 * statut `awaiting_payment`). Le montant facturé doit correspondre au
 * prix convenu de la mission : il est obtenu par une VARIANTE DE PRIX
 * Chariow configurée pour ce montant exact (app_settings
 * `mission_price_variants` : {"15000":"pvr_…"}), faute de quoi la
 * requête est refusée — jamais de montant approximatif.
 *
 * Aucun crédit ici : le Pulse signé appelle `confirm_mission_payment`
 * (service_role, idempotent) après re-vérification serveur du montant.
 */
export async function POST(request: Request) {
  const provider = getPaymentProvider();
  if (!provider.isConfigured()) {
    return NextResponse.json(
      { code: "PAYMENT_NOT_CONFIGURED", message: "Le paiement en ligne n'est pas activé." },
      { status: 503 }
    );
  }
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { code: "DB_NOT_CONFIGURED", message: "La base Supabase n'est pas configurée." },
      { status: 503 }
    );
  }

  const rl = rateLimit(`mission-checkout:${clientIp(request)}`, 10);
  if (!rl.ok) {
    return NextResponse.json(
      { code: "RATE_LIMITED", message: "Trop de demandes. Réessayez dans un instant." },
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

  const missionId =
    typeof (body as { missionId?: unknown })?.missionId === "string"
      ? ((body as { missionId: string }).missionId)
      : null;
  if (!missionId) {
    return NextResponse.json(
      { code: "BAD_REQUEST", message: "missionId requis." },
      { status: 400 }
    );
  }

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

  const { data: mission, error: missionError } = await supabase
    .from("missions")
    .select("id, client_id, agreed_price_fcfa, status")
    .eq("id", missionId)
    .maybeSingle();

  if (missionError || !mission) {
    return NextResponse.json(
      { code: "MISSION_NOT_FOUND", message: "Mission introuvable." },
      { status: 404 }
    );
  }
  if (mission.client_id !== user.id) {
    return NextResponse.json(
      { code: "FORBIDDEN", message: "Seul le client de la mission peut la payer." },
      { status: 403 }
    );
  }
  if (mission.status !== "awaiting_payment") {
    return NextResponse.json(
      { code: "MISSION_NOT_AWAITING_PAYMENT", message: "Cette mission n'attend plus de paiement." },
      { status: 409 }
    );
  }

  // Produit + variante de prix configurés côté serveur (app_settings en
  // service_role : la RLS n'autorise aucune lecture publique).
  const admin = createAdminClient();
  const { data: settings } = admin
    ? await admin
        .from("app_settings")
        .select("key, value")
        .in("key", ["mission_product_id", "mission_price_variants"])
    : { data: null };

  const settingRaw = (key: string): Json | null =>
    (settings?.find((s) => s.key === key)?.value as Json | undefined) ?? null;

  const productId =
    process.env.CHARIOW_MISSION_PRODUCT_ID ||
    (typeof settingRaw("mission_product_id") === "string"
      ? (settingRaw("mission_product_id") as string)
      : null);

  if (!productId) {
    return NextResponse.json(
      {
        code: "MISSION_PAYMENT_NOT_CONFIGURED",
        message:
          "Le paiement de mission n'est pas encore configuré (produit Chariow manquant). Contactez l'équipe.",
      },
      { status: 503 }
    );
  }

  const variantsRaw = settingRaw("mission_price_variants");
  const variants =
    variantsRaw && typeof variantsRaw === "object" && !Array.isArray(variantsRaw)
      ? (variantsRaw as Record<string, unknown>)
      : {};
  const variantEntry = variants[String(mission.agreed_price_fcfa)];
  const priceVariantId = typeof variantEntry === "string" ? variantEntry : null;

  if (!priceVariantId) {
    return NextResponse.json(
      {
        code: "MISSION_PRICE_NOT_AVAILABLE",
        message:
          "Aucun moyen de paiement n'est configuré pour le montant de cette mission (" +
          mission.agreed_price_fcfa +
          " FCFA). Contactez l'équipe pour régler ce montant.",
      },
      { status: 503 }
    );
  }

  const email = user.email?.trim();
  if (!email) {
    return NextResponse.json(
      { code: "EMAIL_REQUIRED", message: "Ajoutez une adresse e-mail à votre compte pour payer." },
      { status: 400 }
    );
  }

  const { data: profile } = await supabase
    .from("developers")
    .select("full_name, whatsapp")
    .eq("id", user.id)
    .maybeSingle();

  const phone = profile?.whatsapp?.trim() || user.phone?.trim();
  if (!phone) {
    return NextResponse.json(
      {
        code: "PHONE_REQUIRED",
        message: "Renseignez votre numéro de téléphone dans votre profil pour payer.",
      },
      { status: 400 }
    );
  }

  const origin = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;

  try {
    const checkout = await provider.createCheckout({
      productSlug: productId,
      amount: mission.agreed_price_fcfa,
      priceVariantId,
      email,
      fullName: profile?.full_name ?? null,
      phone,
      redirectUrl: `${origin}/missions/${mission.id}?paid=1`,
      metadata: {
        reference: mission.id,
        kind: "mission",
      },
      customerIp: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    });

    if (checkout.step === "already_purchased") {
      return NextResponse.json(
        { code: "ALREADY_PURCHASED", message: "Ce paiement a déjà été réglé." },
        { status: 409 }
      );
    }

    // Filet immédiat : une variante inconnue/inactive est ignorée par
    // Chariow et le prix du produit s'appliquerait alors. On refuse
    // avant même de renvoyer l'URL plutôt que de diriger le client vers
    // un mauvais montant (le Pulse re-vérifiera de toute façon).
    if (
      checkout.amount &&
      (checkout.amount.currency !== "XOF" ||
        checkout.amount.value !== mission.agreed_price_fcfa)
    ) {
      log.error({
        action: "payment.mission.checkout.amount_mismatch",
        provider: provider.id,
        user: user.id,
        mission_id: mission.id,
        status: 409,
        message: `Montant du prestataire ${checkout.amount.value} ${checkout.amount.currency} ≠ ${mission.agreed_price_fcfa} XOF`,
      });
      return NextResponse.json(
        {
          code: "MISSION_PRICE_NOT_AVAILABLE",
          message:
            "Le montant proposé par le prestataire ne correspond pas à celui de la mission. Contactez l'équipe.",
        },
        { status: 409 }
      );
    }

    return NextResponse.json({
      missionId: mission.id,
      launchUrl: checkout.checkoutUrl,
      sessionId: checkout.saleId,
      provider: provider.id,
    });
  } catch (err) {
    if (isPaymentApiError(err)) {
      log.error({
        action: "payment.mission.checkout",
        provider: provider.id,
        user: user.id,
        mission_id: mission.id,
        status: err.status,
        message: err.message,
      });
      return NextResponse.json(
        {
          code: err.code === "chariow_invalid_phone" ? "PHONE_REQUIRED" : "PROVIDER_ERROR",
          message:
            err.code === "chariow_invalid_phone"
              ? "Votre numéro de téléphone est invalide : corrigez-le dans votre profil."
              : "Le prestataire de paiement a refusé la demande.",
        },
        { status: err.code === "chariow_invalid_phone" ? 400 : 502 }
      );
    }
    log.error({
      action: "payment.mission.checkout",
      provider: provider.id,
      user: user.id,
      mission_id: mission.id,
      status: 500,
      message: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { code: "SERVER_ERROR", message: "Erreur inattendue lors du paiement." },
      { status: 500 }
    );
  }
}
