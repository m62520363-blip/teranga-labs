import { NextResponse } from "next/server";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { apiOptionalUser } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPaymentProvider, isPaymentApiError } from "@/lib/payments/provider";
import { getTokenProductSlug } from "@/lib/payments/chariow-config";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/payments/brief-boost-checkout
 *
 * Permet à un client (connecté ou muni de sa clé de gestion `managementKey`)
 * de payer une somme fixe en FCFA (7 jours = 2 500 FCFA, 14 jours = 4 500 FCFA,
 * 30 jours = 8 000 FCFA) pour placer son brief en tête du marketplace.
 *
 * Aucun abonnement n'est requis côté client : la publication de brief est
 * gratuite, et la mise en avant est un paiement ponctuel vérifié côté serveur.
 */
export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { code: "DB_NOT_CONFIGURED", message: "La base Supabase n'est pas configurée." },
      { status: 503 }
    );
  }

  const rl = rateLimit(`brief-boost:${clientIp(request)}`, 10);
  if (!rl.ok) {
    return NextResponse.json(
      { code: "RATE_LIMITED", message: "Trop de demandes. Réessayez dans un instant." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { code: "BAD_REQUEST", message: "Corps de requête invalide." },
      { status: 400 }
    );
  }

  const requestId = typeof body.requestId === "string" ? body.requestId.trim() : "";
  const rawDays = Number(body.days);
  const days = [7, 14, 30].includes(rawDays) ? rawDays : 7;
  const managementKey =
    typeof body.managementKey === "string" && body.managementKey.trim()
      ? body.managementKey.trim()
      : null;

  if (!requestId) {
    return NextResponse.json(
      { code: "BAD_REQUEST", message: "Identifiant du projet requis." },
      { status: 400 }
    );
  }

  const user = await apiOptionalUser();
  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json(
      { code: "DB_NOT_CONFIGURED", message: "Base Supabase indisponible." },
      { status: 503 }
    );
  }

  const { data: boostRow, error: rpcError } = await supabase.rpc(
    "create_brief_boost_checkout",
    {
      p_request_id: requestId,
      p_days: days,
      p_management_key: managementKey,
    }
  );

  if (rpcError || !boostRow || typeof boostRow !== "object") {
    return NextResponse.json(
      {
        code: rpcError?.code ?? "BOOST_ERROR",
        message:
          rpcError?.message || "Impossible d’initialiser la mise en avant de ce projet.",
      },
      { status: 400 }
    );
  }

  const invoice = boostRow as {
    payment_id: string;
    invoice_number: string;
    request_id: string;
    days: number;
    amount_fcfa: number;
  };

  const provider = getPaymentProvider();
  if (!provider.isConfigured()) {
    return NextResponse.json({
      mode: "invoice_pending",
      paymentId: invoice.payment_id,
      invoiceNumber: invoice.invoice_number,
      amountFcfa: invoice.amount_fcfa,
      days: invoice.days,
      message: `Demande de mise en avant (${invoice.days} jours · ${invoice.amount_fcfa.toLocaleString("fr-FR")} FCFA, réf. ${invoice.invoice_number}) enregistrée. La mise en tête de liste sera activée dès la confirmation serveur du paiement.`,
    });
  }

  const adminClient = createAdminClient();
  const { data: briefRow } = adminClient
    ? await adminClient
        .from("requests")
        .select("client_name, client_whatsapp")
        .eq("id", requestId)
        .maybeSingle()
    : await supabase
        .from("requests")
        .select("client_name, client_whatsapp")
        .eq("id", requestId)
        .maybeSingle();

  const email = user?.email?.trim() || "client@devmarket.sn";
  const phone = briefRow?.client_whatsapp?.trim() ?? user?.phone?.trim() ?? "";

  if (!phone) {
    return NextResponse.json({
      mode: "invoice_pending",
      paymentId: invoice.payment_id,
      invoiceNumber: invoice.invoice_number,
      amountFcfa: invoice.amount_fcfa,
      days: invoice.days,
      message: `Demande ${invoice.invoice_number} enregistrée (${invoice.amount_fcfa.toLocaleString("fr-FR")} FCFA).`,
    });
  }

  const origin = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
  const slug = getTokenProductSlug(`boost-brief-${days}j`);
  try {
    const checkout = await provider.createCheckout({
      productSlug: slug,
      amount: invoice.amount_fcfa,
      email,
      fullName: briefRow?.client_name ?? null,
      phone,
      redirectUrl: managementKey
        ? `${origin}/brief/${requestId}?key=${encodeURIComponent(managementKey)}&boost=${encodeURIComponent(invoice.invoice_number)}`
        : `${origin}/client/briefs?boost=${encodeURIComponent(invoice.invoice_number)}`,
      metadata: {
        reference: invoice.payment_id,
        kind: "brief_boost",
        request_id: requestId,
        days: String(days),
      },
      customerIp:
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    });

    if (adminClient && checkout.saleId) {
      await adminClient
        .from("brief_boost_payments")
        .update({ provider: provider.id, provider_sale_id: checkout.saleId })
        .eq("id", invoice.payment_id);
    }

    return NextResponse.json({
      mode: "redirect",
      paymentId: invoice.payment_id,
      invoiceNumber: invoice.invoice_number,
      launchUrl: checkout.checkoutUrl,
      sessionId: checkout.saleId,
      provider: provider.id,
    });
  } catch (err) {
    log.error({
      action: "brief_boost.checkout.provider_error",
      provider: provider.id,
      payment_id: invoice.payment_id,
      status: isPaymentApiError(err) ? err.status : 0,
      message: err instanceof Error ? err.message : String(err),
      slug: slug,
    });
    return NextResponse.json({
      mode: "invoice_pending",
      paymentId: invoice.payment_id,
      invoiceNumber: invoice.invoice_number,
      amountFcfa: invoice.amount_fcfa,
      days: invoice.days,
      message: `Demande de mise en avant ${invoice.invoice_number} (${invoice.amount_fcfa.toLocaleString("fr-FR")} FCFA pour ${invoice.days} jours) enregistrée. ERREUR: ${err instanceof Error ? err.message : String(err)}`,
    });
  }
}
