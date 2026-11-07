import { NextResponse } from "next/server";
import { createAdminClient, isServiceConfigured } from "@/lib/supabase/admin";
import { log } from "@/lib/log";
import { getPaymentProvider, isPaymentApiError } from "@/lib/payments/provider";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/payments/webhook — point de terminaison des webhooks du
 * prestataire de paiement (Pulses Chariow aujourd'hui).
 *
 * Sécurité, dans l'ordre :
 *   1. Signature (header du prestataire) = HMAC-SHA256 du corps BRUT
 *      avec le secret, comparaison en temps constant — sinon 401.
 *      Le corps est capturé AVANT tout parsing JSON.
 *   2. Seul `successful.sale` est traité ; les autres événements sont
 *      acquittés 200 sans effet (failed/abandoned ne créditent rien).
 *   3. L'intention ou la demande de vérification est retrouvée via
 *      les métadonnées du checkout (posées à l'initiation).
 *   4. RE-VÉRIFICATION serveur (provider.verifySale) : c'est la réponse
 *      de l'API prestataire qui fait foi pour le statut et le montant,
 *      pas le corps du webhook. API injoignable → 502, le prestataire
 *      réessaie.
 *   5. Le montant confirmé (XOF) doit être strictement égal au montant
 *      gelé côté serveur.
 *   6. Crédit via `credit_from_payment` / `admin_confirm_verification_payment`
 *      (service_role, idempotents) : un rejeu (5 tentatives + rejeu
 *      manuel) ne recrédite pas — c'est cette garantie atomique qui remplace
 *      la table de déduplication (l'id de livraison étant journalisé).
 *   7. Réponse rapide 200 (timeout webhook : 30s), aucune tâche longue.
 */
export async function POST(request: Request) {
  const provider = getPaymentProvider();
  if (!provider.isConfigured() || !provider.isWebhookConfigured() || !isServiceConfigured()) {
    return NextResponse.json({ error: "webhook_not_configured" }, { status: 503 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get(provider.webhookSignatureHeader);

  if (!provider.verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  const eventType =
    typeof payload.event === "string"
      ? payload.event
      : (request.headers.get("x-pulse-event") ?? request.headers.get("flutterwave-event") ?? "");

  const successEvent = provider.id === "flutterwave" ? "charge.completed" : "successful.sale";
  if (eventType !== successEvent) {
    // failed / abandoned / license.* / tests : acquittés sans effet.
    return NextResponse.json({ ok: true, ignored: eventType || "unknown" });
  }

  // Extraction du sale selon le prestataire.
  let saleId: string | null = null;
  let saleMetadata: Record<string, string> | null = null;
  if (provider.id === "flutterwave") {
    const data = payload.data as { id?: number; meta?: Record<string, string> | null } | null;
    saleId = data?.id ? String(data.id) : null;
    saleMetadata = data?.meta ?? null;
  } else {
    const sale = (payload.sale ?? null) as {
      id?: string;
      custom_metadata?: Record<string, string> | null;
    } | null;
    saleId = sale?.id ?? null;
    saleMetadata = sale?.custom_metadata ?? null;
  }
  if (!saleId) {
    return NextResponse.json({ error: "missing_sale" }, { status: 400 });
  }

  const { reference, kind } = provider.parseReference({
    metadata: saleMetadata,
  });
  if (!reference) {
    return NextResponse.json({ error: "missing_reference" }, { status: 400 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "service_unavailable" }, { status: 503 });
  }

  const deliveryId = request.headers.get("x-pulse-delivery-id") ?? request.headers.get("flutterwave-delivery-id") ?? null;

  // Source de vérité : l'API prestataire, jamais le corps du webhook seul.
  let confirmed;
  try {
    confirmed = await provider.verifySale(saleId);
  } catch (err) {
    if (isPaymentApiError(err)) {
      log.error({
        action: "pulse.sale.refused",
        provider: provider.id,
        status: err.status,
        message: err.message,
      });
      if (err.status === 404) {
        return NextResponse.json({ error: "sale_not_found" }, { status: 404 });
      }
    } else {
      log.error({
        action: "pulse.sale.unreachable",
        provider: provider.id,
        message: err instanceof Error ? err.message : String(err),
      });
    }
    // 502 : le prestataire réessaiera la livraison — mieux vaut retarder
    // un crédit que le calculer sur une donnée non vérifiée.
    return NextResponse.json({ error: "confirm_unavailable" }, { status: 502 });
  }

  if (!provider.isSalePaid(confirmed)) {
    return NextResponse.json(
      { error: "status_mismatch", status: confirmed.status },
      { status: 409 }
    );
  }

  if (kind === "brief_boost") {
    const { data: boostPay, error: boostErr } = await admin
      .from("brief_boost_payments")
      .select("id, request_id, amount_fcfa, status")
      .eq("id", reference)
      .maybeSingle();

    if (boostErr || !boostPay) {
      return NextResponse.json({ error: "brief_boost_payment_not_found" }, { status: 404 });
    }
    if (boostPay.status === "confirmed") {
      return NextResponse.json({ ok: true, confirmed: false, alreadyPaid: true });
    }
    if (!provider.amountMatches(confirmed, boostPay.amount_fcfa)) {
      return NextResponse.json({ error: "amount_mismatch" }, { status: 400 });
    }

    const { data: boostConfirm, error: boostConfirmErr } = await admin.rpc(
      "confirm_brief_boost_payment",
      {
        p_payment_id: boostPay.id,
        p_provider_sale_id: confirmed.id,
      }
    );

    if (boostConfirmErr) {
      log.error({
        action: "pulse.brief_boost.confirm.failed",
        provider: provider.id,
        message: boostConfirmErr.message,
      });
      return NextResponse.json({ error: "confirm_failed" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, confirmed: true, result: boostConfirm });
  }

  if (kind === "subscription") {
    const { data: subPay, error: subErr } = await admin
      .from("subscription_payments")
      .select("id, developer_id, amount_fcfa, status")
      .eq("id", reference)
      .maybeSingle();

    if (subErr || !subPay) {
      return NextResponse.json({ error: "subscription_payment_not_found" }, { status: 404 });
    }
    if (subPay.status === "confirmed") {
      return NextResponse.json({ ok: true, confirmed: false, alreadyPaid: true });
    }
    if (!provider.amountMatches(confirmed, subPay.amount_fcfa)) {
      return NextResponse.json({ error: "amount_mismatch" }, { status: 400 });
    }

    const { data: subConfirm, error: subConfirmErr } = await admin.rpc(
      "confirm_subscription_payment",
      {
        p_payment_id: subPay.id,
        p_provider_sale_id: confirmed.id,
      }
    );

    if (subConfirmErr) {
      log.error({
        action: "pulse.subscription.confirm.failed",
        provider: provider.id,
        message: subConfirmErr.message,
      });
      return NextResponse.json({ error: "confirm_failed" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, confirmed: true, result: subConfirm });
  }

  if (kind === "verification") {
    const { data: verification, error } = await admin
      .from("verification_requests")
      .select("id, developer_id, amount_fcfa, payment_status")
      .eq("id", reference)
      .maybeSingle();

    if (error || !verification) {
      return NextResponse.json({ error: "request_not_found" }, { status: 404 });
    }
    if (verification.payment_status === "confirmed") {
      return NextResponse.json({ ok: true, confirmed: false, alreadyPaid: true });
    }
    if (!provider.amountMatches(confirmed, verification.amount_fcfa)) {
      return NextResponse.json({ error: "amount_mismatch" }, { status: 400 });
    }

    const { data: confirmResult, error: confirmError } = await admin.rpc(
      "admin_confirm_verification_payment",
      { p_verification: verification.id }
    );
    if (confirmError) {
      log.error({
        action: "pulse.verification.confirm.failed",
        provider: provider.id,
        message: confirmError.message,
      });
      return NextResponse.json({ error: "confirm_failed" }, { status: 500 });
    }

    void trackCredit(admin, {
      flow: `pulse_${provider.id}_verification`,
      amount_fcfa: verification.amount_fcfa,
      sale_id: confirmed.id,
      delivery_id: deliveryId,
      developer_id: verification.developer_id,
    });

    return NextResponse.json({ ok: true, confirmed: true, result: confirmResult });
  }

  if (kind === "mission") {
    const { data: mission, error } = await admin
      .from("missions")
      .select("id, client_id, agreed_price_fcfa, status")
      .eq("id", reference)
      .maybeSingle();

    if (error || !mission) {
      return NextResponse.json({ error: "mission_not_found" }, { status: 404 });
    }
    if (!provider.amountMatches(confirmed, mission.agreed_price_fcfa)) {
      return NextResponse.json({ error: "amount_mismatch" }, { status: 400 });
    }

    const { data: confirmResult, error: confirmError } = await admin.rpc(
      "confirm_mission_payment",
      {
        p_mission_id: mission.id,
        p_provider_sale_id: confirmed.id,
        p_amount_fcfa: mission.agreed_price_fcfa,
        p_payer_id: mission.client_id,
      }
    );
    if (confirmError) {
      log.error({
        action: "pulse.mission.confirm.failed",
        provider: provider.id,
        message: confirmError.message,
      });
      return NextResponse.json({ error: "confirm_failed" }, { status: 500 });
    }

    void trackCredit(admin, {
      flow: `pulse_${provider.id}_mission`,
      amount_fcfa: mission.agreed_price_fcfa,
      sale_id: confirmed.id,
      delivery_id: deliveryId,
      mission_id: mission.id,
      client_id: mission.client_id,
    });

    return NextResponse.json({ ok: true, confirmed: true, result: confirmResult });
  }

  const { data: intent, error: intentError } = await admin
    .from("payment_intents")
    .select("id, developer_id, tokens, amount_fcfa, status")
    .eq("id", reference)
    .maybeSingle();

  if (intentError || !intent) {
    return NextResponse.json({ error: "intent_not_found" }, { status: 404 });
  }
  if (intent.status === "paid") {
    // Livraison en double (retry du prestataire / rejeu manuel) : déjà crédité.
    return NextResponse.json({ ok: true, credited: false, alreadyPaid: true });
  }
  if (!provider.amountMatches(confirmed, intent.amount_fcfa)) {
    return NextResponse.json({ error: "amount_mismatch" }, { status: 400 });
  }

  const { data: creditResult, error: creditError } = await admin.rpc(
    "credit_from_payment",
    { p_intent_id: intent.id }
  );
  if (creditError) {
    log.error({
      action: "pulse.credit.failed",
      provider: provider.id,
      message: creditError.message,
    });
    return NextResponse.json({ error: "credit_failed" }, { status: 500 });
  }

  void trackCredit(admin, {
    flow: `pulse_${provider.id}`,
    amount_fcfa: intent.amount_fcfa,
    tokens: intent.tokens,
    sale_id: confirmed.id,
    delivery_id: deliveryId,
    developer_id: intent.developer_id,
  });

  return NextResponse.json({ ok: true, credited: true, result: creditResult });
}

/**
 * Le prestataire sert parfois un GET de diagnostic sur l'URL du webhook.
 * Répondre 200 évite une erreur 404 côté tableau de bord, sans jamais
 * toucher à la logique de crédit.
 */
export async function GET() {
  return NextResponse.json({ ok: true, service: `${getPaymentProvider().id}-pulse` });
}

function trackCredit(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  metadata: Record<string, unknown>
) {
  void admin
    .rpc("track_event", { p_event: "payment.credited", p_metadata: metadata })
    .then(({ error }) => {
      if (error) {
        log.error({
          action: "pulse.credit.track",
          provider: getPaymentProvider().id,
          message: error.message,
        });
      }
    });
}
