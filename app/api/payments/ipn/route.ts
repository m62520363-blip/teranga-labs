import { NextResponse } from "next/server";
import { createAdminClient, isServiceConfigured } from "@/lib/supabase/admin";
import { log } from "@/lib/log";
import {
  amountMatches,
  confirmPaydunyaCheckout,
  isPaymentCompleted,
  isPaydunyaApiError,
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
 *      ce hash ne couvre PAS le contenu du message (faiblesse du protocole
 *      PayDunya, cf. lib/payments/paydunya.ts), il prouve seulement que
 *      l'appelant connaît la MasterKey.
 *   2. On ne traite QUE `status === "completed"` ; les statuts `pending`,
 *      `cancelled` et `failed` sont acquittés sans effet (PayDunya peut
 *      notifier plusieurs fois, et un paiement annulé ne doit rien créditer).
 *   3. L'intention de paiement est retrouvée via `custom_data.intent_id`.
 *   4. RÉ-VÉRIFICATION auprès de l'API PayDunya
 *      (`checkout-invoice/confirm/{token}`). C'est LE contrôle qui rend le
 *      Credit trustworthy : puisque le hash ne couvre pas le contenu, un
 *      IPN forgé peut annoncer n'importe quel état. On redemande donc l'état
 *      et le montant à PayDunya, et c'est cette réponse qui fait foi — pas
 *      le corps de la requête. Le jeton vérifié est celui stocké en base
 *      (`provider_session_id`), jamais celui fourni par l'appelant.
 *   5. Le montant doit être strictement égal au montant gelé côté serveur
 *      dans `payment_intents` ET à celui renvoyé par PayDunya.
 *   6. Le crédit passe par la RPC `credit_from_payment` (service_role
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
    .select(
      "id, developer_id, tokens, amount_fcfa, status, provider, provider_session_id"
    )
    .eq("id", intentId)
    .maybeSingle();

  if (intentError || !intent) {
    return NextResponse.json({ error: "intent_not_found" }, { status: 404 });
  }

  if (intent.status === "paid") {
    // Rejeu d'IPN : déjà crédité, rien à refaire.
    return ok({ ok: true, credited: false, alreadyPaid: true });
  }

  // On ne peut vérifier auprès de PayDunya que si l'intention porte un
  // jeton de facture que NOUS avons émis. Sans lui, aucune vérification
  // n'est possible : on refuse plutôt que de créditer sur la seule foi du
  // corps de la requête.
  const invoiceToken =
    intent.provider === "paydunya" ? intent.provider_session_id : null;
  if (!invoiceToken) {
    return NextResponse.json(
      { error: "missing_invoice_token" },
      { status: 409 }
    );
  }

  // Source de vérité : la réponse de l'API PayDunya, pas l'IPN.
  let confirmed;
  try {
    confirmed = await confirmPaydunyaCheckout(invoiceToken);
  } catch (err) {
    if (isPaydunyaApiError(err)) {
      log.error({ action: "ipn.confirm.refused", provider: "paydunya", message: err.message });
    } else {
      log.error({ action: "ipn.confirm.unreachable", provider: "paydunya", message: String(err) });
    }
    // 502 : l'API est momentanément indisponible. PayDunya réessaiera, ce
    // qui est le comportement voulu — mieux vaut retarder un crédit que le
    // calculer sur une donnée non vérifiée.
    return NextResponse.json({ error: "confirm_unavailable" }, { status: 502 });
  }

  if (confirmed.status !== "completed") {
    // L'IPN annonçait `completed` mais PayDunya dit autre chose : c'est la
    // preuve qu'un IPN a été forgé. Rien n'est crédité.
    return NextResponse.json(
      { error: "status_mismatch", status: confirmed.status },
      { status: 409 }
    );
  }

  // Le montant de l'IPN, celui renvoyé par PayDunya et celui gelé en base
  // doivent concorder. Les deux premiers sont vérifiés pour ne pas faire
  // confiance au corps de la requête ; le troisième est la référence.
  if (!amountMatches(ipn.invoice?.total_amount, intent.amount_fcfa)) {
    return NextResponse.json({ error: "amount_mismatch" }, { status: 400 });
  }

  if (
    confirmed.totalAmount === undefined ||
    !amountMatches(confirmed.totalAmount, intent.amount_fcfa)
  ) {
    return NextResponse.json(
      { error: "amount_mismatch_confirmed" },
      { status: 400 }
    );
  }

  const { data: creditResult, error: creditError } = await admin.rpc(
    "credit_from_payment",
    { p_intent_id: intent.id }
  );

  if (creditError) {
    log.error({
      action: "ipn.credit.failed",
      provider: "paydunya",
      message: creditError.message,
    });
    return NextResponse.json({ error: "credit_failed" }, { status: 500 });
  }

  void (async () => {
    const { error } = await admin.rpc("track_event", {
      p_event: "payment.credited",
      p_metadata: {
        flow: "ipn_paydunya",
        amount_fcfa: intent.amount_fcfa,
        tokens: intent.tokens,
        developer_id: intent.developer_id,
      },
    });
    if (error)
      log.error({
        action: "ipn.credit.track",
        provider: "paydunya",
        message: error.message,
      });
  })();

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
