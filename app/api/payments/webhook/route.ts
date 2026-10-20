import { NextResponse } from "next/server";
import { createAdminClient, isServiceConfigured } from "@/lib/supabase/admin";
import { log } from "@/lib/log";
import {
  amountMatchesSale,
  getChariowSale,
  getPulseReference,
  isChariowApiError,
  isSaleCompleted,
  verifyPulseSignature,
} from "@/lib/payments/chariow";
import { isChariowConfigured, isPulseConfigured } from "@/lib/payments/chariow-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/payments/webhook — point de terminaison des Pulses Chariow.
 *
 * Sécurité, dans l'ordre :
 *   1. `x-chariow-signature` = HMAC-SHA256 du corps BRUT avec le secret
 *      du Pulse (`whsec_...`), comparaison en temps constant — sinon 401.
 *      Le corps est capturé AVANT tout parsing JSON.
 *   2. Seul `successful.sale` est traité ; les autres événements sont
 *      acquittés 200 sans effet (failed/abandoned ne créditent rien).
 *   3. L'intention ou la demande de vérification est retrouvée via
 *      `sale.custom_metadata` (posée à l'initiation du checkout).
 *   4. RE-VÉRIFICATION serveur `GET /v1/sales/{id}` : c'est la réponse
 *      de l'API Chariow qui fait foi pour le statut et le montant, pas
 *      le corps du webhook. API injoignable → 502, Chariow réessaie.
 *   5. Le montant confirmé (XOF) doit être strictement égal au montant
 *      gelé côté serveur.
 *   6. Crédit via `credit_from_payment` / `admin_confirm_verification_payment`
 *      (service_role, idempotents) : un rejeu (5 tentatives Chariow + rejeu
 *      manuel) ne recrédite pas — c'est cette garantie atomique qui remplace
 *      la table de déduplication, `x-pulse-delivery-id` étant journalisé.
 *   7. Réponse rapide 200 (timeout Pulse : 30s), aucune tâche longue.
 */
export async function POST(request: Request) {
  if (!isChariowConfigured() || !isPulseConfigured() || !isServiceConfigured()) {
    return NextResponse.json({ error: "webhook_not_configured" }, { status: 503 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get("x-chariow-signature");

  if (!verifyPulseSignature(rawBody, signature)) {
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
      : (request.headers.get("x-pulse-event") ?? "");

  if (eventType !== "successful.sale") {
    // failed / abandoned / license.* / tests : acquittés sans effet.
    return NextResponse.json({ ok: true, ignored: eventType || "unknown" });
  }

  const sale = (payload.sale ?? null) as {
    id?: string;
    custom_metadata?: Record<string, string> | null;
  } | null;
  if (!sale?.id) {
    return NextResponse.json({ error: "missing_sale" }, { status: 400 });
  }

  const { reference, kind } = getPulseReference(sale);
  if (!reference) {
    return NextResponse.json({ error: "missing_reference" }, { status: 400 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "service_unavailable" }, { status: 503 });
  }

  const deliveryId = request.headers.get("x-pulse-delivery-id") ?? null;

  // Source de vérité : l'API Chariow, jamais le corps du webhook seul.
  let confirmed;
  try {
    confirmed = await getChariowSale(sale.id);
  } catch (err) {
    if (isChariowApiError(err)) {
      log.error({
        action: "pulse.sale.refused",
        provider: "chariow",
        status: err.status,
        message: err.message,
      });
      if (err.status === 404) {
        return NextResponse.json({ error: "sale_not_found" }, { status: 404 });
      }
    } else {
      log.error({
        action: "pulse.sale.unreachable",
        provider: "chariow",
        message: err instanceof Error ? err.message : String(err),
      });
    }
    // 502 : Chariow réessaiera la livraison — mieux vaut retarder un
    // crédit que le calculer sur une donnée non vérifiée.
    return NextResponse.json({ error: "confirm_unavailable" }, { status: 502 });
  }

  if (!isSaleCompleted(confirmed)) {
    return NextResponse.json(
      { error: "status_mismatch", status: confirmed.status },
      { status: 409 }
    );
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
    if (!amountMatchesSale(confirmed, verification.amount_fcfa)) {
      return NextResponse.json({ error: "amount_mismatch" }, { status: 400 });
    }

    const { data: confirmResult, error: confirmError } = await admin.rpc(
      "admin_confirm_verification_payment",
      { p_verification: verification.id }
    );
    if (confirmError) {
      log.error({
        action: "pulse.verification.confirm.failed",
        provider: "chariow",
        message: confirmError.message,
      });
      return NextResponse.json({ error: "confirm_failed" }, { status: 500 });
    }

    void trackCredit(admin, {
      flow: "pulse_chariow_verification",
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
    if (!amountMatchesSale(confirmed, mission.agreed_price_fcfa)) {
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
        provider: "chariow",
        message: confirmError.message,
      });
      return NextResponse.json({ error: "confirm_failed" }, { status: 500 });
    }

    void trackCredit(admin, {
      flow: "pulse_chariow_mission",
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
    // Livraison en double (retry Chariow / rejeu manuel) : déjà crédité.
    return NextResponse.json({ ok: true, credited: false, alreadyPaid: true });
  }
  if (!amountMatchesSale(confirmed, intent.amount_fcfa)) {
    return NextResponse.json({ error: "amount_mismatch" }, { status: 400 });
  }

  const { data: creditResult, error: creditError } = await admin.rpc(
    "credit_from_payment",
    { p_intent_id: intent.id }
  );
  if (creditError) {
    log.error({
      action: "pulse.credit.failed",
      provider: "chariow",
      message: creditError.message,
    });
    return NextResponse.json({ error: "credit_failed" }, { status: 500 });
  }

  void trackCredit(admin, {
    flow: "pulse_chariow",
    amount_fcfa: intent.amount_fcfa,
    tokens: intent.tokens,
    sale_id: confirmed.id,
    delivery_id: deliveryId,
    developer_id: intent.developer_id,
  });

  return NextResponse.json({ ok: true, credited: true, result: creditResult });
}

/**
 * Chariow sert parfois un GET de diagnostic sur l'URL de Pulse.
 * Répondre 200 évite une erreur 404 côté tableau de bord, sans jamais
 * toucher à la logique de crédit.
 */
export async function GET() {
  return NextResponse.json({ ok: true, service: "chariow-pulse" });
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
          provider: "chariow",
          message: error.message,
        });
      }
    });
}
