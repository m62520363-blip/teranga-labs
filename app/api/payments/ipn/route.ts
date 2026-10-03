import { NextResponse } from "next/server";
import { createAdminClient, isServiceConfigured } from "@/lib/supabase/admin";
import {
  amountMatches,
  isPaymentCompleted,
  parseIpnFormData,
  verifyIpnHash,
} from "@/lib/payments/paydunya";
import { isPaydunyaConfigured } from "@/lib/payments/paydunya-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/payments/ipn — endpoint IPN PayDunya (Instant Payment
 * Notification).
 *
 * Format : `application/x-www-form-urlencoded`, tout encapsulé sous la
 * clé racine `data` (sérialisée en JSON). Voir
 * https://developers.paydunya.com/doc/EN/http_json section 8.
 *
 * Sécurité, dans l'ordre :
 *   1. `data.hash` doit valoir SHA-512(MasterKey) — sinon 401. Attention :
 *      ce hash ne couvre PAS le contenu du message (faiblesse du
 *      protocole PayDunya, cf. lib/payments/paydunya.ts), il prouve
 *      seulement que l'appelant connaît la MasterKey.
 *   2. On ne traite QUE `status === "completed"` ; les statuts `pending`,
 *      `cancelled` et `failed` sont acquittés sans effet (PayDunya peut
 *      notifier plusieurs fois, et un paiement annulé ne doit rien créditer).
 *   3. L'intention de paiement est retrouvée via `custom_data.intent_id`.
 *   4. Le montant de l'IPN doit être strictement égal au montant gelé
 *      côté serveur dans `payment_intents`. C'est LE contrôle qui empêche
 *      un IPN forgé de créditer des Tokens : un attaquant connaissant la
 *      MasterKey ne peut pas fixer un montant arbitraire sans que la
 *      comparaison échoue.
 *   5. Le crédit passe par la RPC `credit_from_payment` (service_role
 *      uniquement, idempotente) : un rejeu de l'IPN ne recrédite pas.
 *
 * Réponse : toujours 200 après acquittement, sinon PayDunya réessaie.
 */

function ok(body: Record<string, unknown>) {
  return NextResponse.json(body);
}

export async function POST(request: Request) {
  if (!isPaydunyaConfigured() || !isServiceConfigured()) {
    return NextResponse.json(
      { error: "ipn_not_configured" },
      { status: 503 }
    );
  }

  let form: Record<string, string | string[]>;
  try {
    const entries = await request.formData();
    form = Object.fromEntries(
      Array.from(entries.entries())
        // Un IPN PayDunya n'envoie que des chaînes ; tout File est rejeté
        // en aval par parseIpnFormData, mais on filtre ici pour que le type
        // reste honnête.
        .filter((entry): entry is [string, string] => typeof entry[1] === "string")
    );
  } catch {
    return NextResponse.json({ error: "invalid_form" }, { status: 400 });
  }

  const ipn = parseIpnFormData(form);
  if (!ipn) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  if (!verifyIpnHash(ipn.hash)) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }

  if (!isPaymentCompleted(ipn)) {
    // `pending` / `cancelled` / `failed` : acquittés sans crédit.
    return ok({ ok: true, credited: false, status: ipn.status ?? "unknown" });
  }

  const intentId = ipn.custom_data?.intent_id;
  if (!intentId) {
    return NextResponse.json({ error: "missing_reference" }, { status: 400 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "service_unavailable" }, { status: 503 });
  }

  const { data: intent, error: intentError } = await admin
    .from("payment_intents")
    .select("id, developer_id, tokens, amount_fcfa, status")
    .eq("id", intentId)
    .maybeSingle();

  if (intentError || !intent) {
    return NextResponse.json({ error: "intent_not_found" }, { status: 404 });
  }

  if (intent.status === "paid") {
    // Rejeu d'IPN : déjà crédité, rien à refaire.
    return ok({ ok: true, credited: false, alreadyPaid: true });
  }

  if (!amountMatches(ipn.invoice?.total_amount, intent.amount_fcfa)) {
    return NextResponse.json({ error: "amount_mismatch" }, { status: 400 });
  }

  const { data: creditResult, error: creditError } = await admin.rpc(
    "credit_from_payment",
    { p_intent_id: intent.id }
  );

  if (creditError) {
    console.error("[payments/ipn] credit_from_payment failed:", creditError);
    return NextResponse.json({ error: "credit_failed" }, { status: 500 });
  }

  return ok({ ok: true, credited: true, result: creditResult });
}

/**
 * PayDunya sert parfois un diagnostic de connectivité sur l'URL de
 * callback. Répondre 200 évite une erreur 404 côté tableau de bord,
 * sans jamais toucher la logique de crédit.
 */
export async function GET() {
  return ok({ ok: true, service: "paydunya-ipn" });
}
