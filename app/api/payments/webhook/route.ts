import { NextResponse } from "next/server";
import { createAdminClient, isServiceConfigured } from "@/lib/supabase/admin";
import {
  isCheckoutCompleted,
  verifyWaveSignature,
  amountMatches,
  type WaveWebhookEvent,
} from "@/lib/payments/wave";
import { isWaveConfigured } from "@/lib/payments/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/payments/webhook — endpoint IPN Wave.
 *
 * Sécurité :
 *   1. Vérification HMAC-SHA256 (header `Wave-Signature`) sur le corps
 *      BRUT + horodatage borné à 300s. Toute signature invalide → 401.
 *   2. On ne traite QUE `checkout.session.completed`.
 *   3. Le montant et la devise de l'événement doivent correspondre à
 *      l'intention de paiement enregistrée côté serveur.
 *   4. Le crédit passe par la RPC `credit_from_payment` (service_role
 *      uniquement, idempotente) : un rejeu du webhook ne recrédite pas.
 *   5. Répondre vite (timeout Wave 10s) : crédit synchrone + 200.
 */
export async function POST(request: Request) {
  if (!isWaveConfigured() || !isServiceConfigured()) {
    return NextResponse.json(
      { error: "webhook_not_configured" },
      { status: 503 }
    );
  }

  const rawBody = await request.text();
  const signature = request.headers.get("wave-signature");

  if (!verifyWaveSignature(rawBody, signature)) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }

  let event: WaveWebhookEvent;
  try {
    event = JSON.parse(rawBody) as WaveWebhookEvent;
  } catch {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  if (!isCheckoutCompleted(event)) {
    // Ack des autres événements (test ping, failures...) sans effet.
    return NextResponse.json({ ok: true });
  }

  const data = event.data ?? {};
  const clientReference = data.client_reference;
  const eventAmount = data.amount;
  const currency = data.currency;

  if (typeof clientReference !== "string" || !clientReference) {
    return NextResponse.json({ error: "missing_reference" }, { status: 400 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "service_unavailable" }, { status: 503 });
  }

  // Vérifie si la référence correspond à une intention de paiement Tokens
  // ou à une demande de vérification de profil.
  const { data: intent, error: intentError } = await admin
    .from("payment_intents")
    .select("id, developer_id, tokens, amount_fcfa, currency, status")
    .eq("id", clientReference)
    .maybeSingle();

  if (!intentError && intent) {
    if (intent.status === "paid") {
      return NextResponse.json({ ok: true, credited: false });
    }

    if (
      currency !== "XOF" ||
      !amountMatches(eventAmount, intent.amount_fcfa)
    ) {
      return NextResponse.json({ error: "amount_mismatch" }, { status: 400 });
    }

    const { data: creditResult, error: creditError } = await admin.rpc(
      "credit_from_payment",
      { p_intent_id: intent.id }
    );

    if (creditError) {
      console.error("[payments] credit_from_payment failed:", creditError);
      return NextResponse.json({ error: "credit_failed" }, { status: 500 });
    }

    void (async () => {
      const { error } = await admin.rpc("track_event", {
        p_event: "payment.credited",
        p_metadata: { flow: "webhook_wave", amount_fcfa: intent.amount_fcfa },
      });
      if (error) console.error("[payments] track payment.credited failed:", error);
    })();

    return NextResponse.json({ ok: true, credited: true, result: creditResult });
  }

  // Référence d'une demande de vérification : confirme le paiement via
  // admin_confirm_verification_payment (idempotent, service_role).
  const { data: verification, error: verificationError } = await admin
    .from("verification_requests")
    .select("id, developer_id, amount_fcfa, payment_status")
    .eq("id", clientReference)
    .maybeSingle();

  if (verificationError || !verification) {
    return NextResponse.json({ error: "intent_not_found" }, { status: 404 });
  }

  if (verification.payment_status === "confirmed") {
    return NextResponse.json({ ok: true, confirmed: false });
  }

  if (
    currency !== "XOF" ||
    !amountMatches(eventAmount, verification.amount_fcfa)
  ) {
    return NextResponse.json({ error: "amount_mismatch" }, { status: 400 });
  }

  const { data: confirmResult, error: confirmError } = await admin.rpc(
    "admin_confirm_verification_payment",
    { p_verification: verification.id }
  );

  if (confirmError) {
    console.error("[payments] admin_confirm_verification_payment failed:", confirmError);
    return NextResponse.json({ error: "confirm_failed" }, { status: 500 });
  }

  void (async () => {
    const { error } = await admin.rpc("track_event", {
      p_event: "payment.credited",
      p_metadata: { flow: "verification", amount_fcfa: verification.amount_fcfa },
    });
    if (error) console.error("[payments] track payment.credited failed:", error);
  })();

  return NextResponse.json({ ok: true, confirmed: true, result: confirmResult });
}