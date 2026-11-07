import { NextResponse } from "next/server";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { apiRequireUser } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPaymentProvider, isPaymentApiError } from "@/lib/payments/provider";
import { getTokenProductSlug } from "@/lib/payments/chariow-config";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/payments/subscription-checkout
 *
 * Crée une facture d'abonnement `pending` en base via `create_subscription_checkout`,
 * puis initialise une session Chariow si la passerelle est configurée.
 *
 * Sécurité (Section H) :
 *   - Le tarif provient exclusivement de `public.subscription_plans` côté serveur.
 *   - L'abonnement n'est JAMAIS activé sur simple redirection : seul le webhook
 *     signé après `provider.verifySale` (ou une validation admin serveur) appelle
 *     `confirm_subscription_payment`.
 */
export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { code: "DB_NOT_CONFIGURED", message: "La base Supabase n'est pas configurée." },
      { status: 503 }
    );
  }

  const rl = rateLimit(`sub-checkout:${clientIp(request)}`, 10);
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

  const planId = typeof body.planId === "string" ? body.planId.trim() : "";
  const billingCycle = body.billingCycle === "annual" ? "annual" : "monthly";

  if (!planId || !["pro", "pro_max", "agency"].includes(planId)) {
    return NextResponse.json(
      { code: "INVALID_PLAN", message: "Formule d’abonnement invalide." },
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

  const { data: checkoutRow, error: rpcError } = await supabase.rpc(
    "create_subscription_checkout",
    {
      p_plan_id: planId,
      p_billing_cycle: billingCycle,
    }
  );

  if (rpcError || !checkoutRow || typeof checkoutRow !== "object") {
    return NextResponse.json(
      {
        code: rpcError?.code ?? "CHECKOUT_ERROR",
        message: rpcError?.message || "Impossible de créer la demande d’abonnement.",
      },
      { status: 400 }
    );
  }

  const invoice = checkoutRow as {
    payment_id: string;
    invoice_number: string;
    plan_id: string;
    plan_name_fr: string;
    billing_cycle: string;
    amount_fcfa: number;
    quota: number;
  };

  const provider = getPaymentProvider();
  if (!provider.isConfigured()) {
    return NextResponse.json({
      mode: "invoice_pending",
      paymentId: invoice.payment_id,
      invoiceNumber: invoice.invoice_number,
      amountFcfa: invoice.amount_fcfa,
      planId: invoice.plan_id,
      billingCycle: invoice.billing_cycle,
      message:
        "Facture d’abonnement enregistrée en attente de confirmation de paiement côté serveur.",
    });
  }

  const { data: profile } = await supabase
    .from("developers")
    .select("full_name, whatsapp")
    .eq("id", user.id)
    .maybeSingle();

  const email = user.email?.trim();
  const phone = profile?.whatsapp?.trim() ?? user.phone?.trim();

  if (!email || !phone) {
    return NextResponse.json({
      mode: "invoice_pending",
      paymentId: invoice.payment_id,
      invoiceNumber: invoice.invoice_number,
      amountFcfa: invoice.amount_fcfa,
      planId: invoice.plan_id,
      billingCycle: invoice.billing_cycle,
      message:
        "Facture enregistrée. Complétez votre email et votre numéro WhatsApp dans votre profil pour le paiement en ligne direct.",
    });
  }

  const origin = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
  const admin = createAdminClient();

  try {
    const slug = getTokenProductSlug(`${planId}-${billingCycle}`);
    const checkout = await provider.createCheckout({
      productSlug: slug,
      amount: invoice.amount_fcfa,
      email,
      fullName: profile?.full_name ?? null,
      phone,
      redirectUrl: `${origin}/abonnement?invoice=${encodeURIComponent(invoice.invoice_number)}`,
      metadata: {
        reference: invoice.payment_id,
        kind: "subscription",
        plan_id: planId,
        billing_cycle: billingCycle,
      },
      customerIp:
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    });

    if (admin && checkout.saleId) {
      await admin
        .from("subscription_payments")
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
    if (isPaymentApiError(err)) {
      log.error({
        action: "subscription.checkout.provider_error",
        provider: provider.id,
        user: user.id,
        payment_id: invoice.payment_id,
        status: err.status,
        message: err.message,
      });
    }
    return NextResponse.json({
      mode: "invoice_pending",
      paymentId: invoice.payment_id,
      invoiceNumber: invoice.invoice_number,
      amountFcfa: invoice.amount_fcfa,
      planId: invoice.plan_id,
      billingCycle: invoice.billing_cycle,
      message:
        "Facture d’abonnement générée. L’activation sera effective dès la confirmation serveur du paiement.",
    });
  }
}
