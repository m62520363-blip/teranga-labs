import { timingSafeEqual } from "crypto";
import { getFlutterwaveConfig } from "@/lib/payments/flutterwave-config";

export class FlutterwaveApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string
  ) {
    super(message);
    this.name = "FlutterwaveApiError";
  }
}

export function isFlutterwaveApiError(err: unknown): err is FlutterwaveApiError {
  return err instanceof FlutterwaveApiError;
}

export type FlutterwaveAmount = {
  value: number;
  currency: string;
};

export type FlutterwaveTransaction = {
  id: string;
  status: string;
  amount?: { value: number; currency: string } | null;
  tx_ref?: string;
  meta?: Record<string, string> | null;
};

export type FlutterwaveCheckoutResult = {
  step: "payment" | "completed" | "already_purchased";
  saleId: string | null;
  checkoutUrl: string | null;
  message: string | null;
  amount: FlutterwaveAmount | null;
};

export type FlutterwaveWebhookPayload = {
  event?: string;
  data?: {
    id?: number;
    tx_ref?: string;
    amount?: number;
    currency?: string;
    status?: string;
    meta?: Record<string, string> | null;
  };
};

/**
 * Crée une session de paiement Flutterwave et retourne l'URL de redirection.
 */
export async function createFlutterwaveCheckout(params: {
  productSlug: string;
  email: string;
  fullName?: string | null;
  phone: string;
  redirectUrl: string;
  metadata: Record<string, string>;
  customerIp?: string | null;
  paymentCurrency?: string;
  amount: number;
}): Promise<FlutterwaveCheckoutResult> {
  const config = getFlutterwaveConfig();
  const currency = params.paymentCurrency ?? "XOF";

  const body: Record<string, unknown> = {
    tx_ref: params.productSlug + "-" + Date.now(),
    amount: params.amount,
    currency,
    redirect_url: params.redirectUrl,
    customer: {
      email: params.email,
      phonenumber: params.phone.replace(/^\+/, ""),
      name: params.fullName ?? params.email,
    },
    customizations: {
      title: "Devmarket",
      description: params.productSlug,
    },
    meta: params.metadata,
  };

  const response = await fetch(`${config.baseUrl}/payments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.secretKey}`,
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => null)) as
    | {
        status?: string;
        message?: string;
        data?: { link?: string; id?: number };
      }
    | null;

  if (!response.ok || !payload?.data?.link) {
    throw new FlutterwaveApiError(
      response.status,
      "flutterwave_request_failed",
      payload?.message ?? `Flutterwave API a répondu ${response.status}.`
    );
  }

  return {
    step: "payment",
    saleId: payload.data.id ? String(payload.data.id) : null,
    checkoutUrl: payload.data.link,
    message: null,
    amount: { value: params.amount, currency },
  };
}

/**
 * Re-vérification serveur : récupère la transaction Flutterwave.
 */
export async function getFlutterwaveSale(saleId: string): Promise<FlutterwaveTransaction> {
  const config = getFlutterwaveConfig();
  const response = await fetch(`${config.baseUrl}/transactions/${saleId}/verify`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${config.secretKey}`,
    },
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => null)) as
    | {
        status?: string;
        message?: string;
        data?: {
          id?: number;
          status?: string;
          amount?: number;
          currency?: string;
          tx_ref?: string;
          meta?: Record<string, string> | null;
        };
      }
    | null;

  if (!response.ok || !payload?.data) {
    throw new FlutterwaveApiError(
      response.status,
      "flutterwave_sale_fetch_failed",
      payload?.message ?? `Flutterwave API a répondu ${response.status}.`
    );
  }

  return {
    id: String(payload.data.id),
    status: payload.data.status ?? "unknown",
    amount:
      payload.data.amount != null
        ? { value: payload.data.amount, currency: payload.data.currency ?? "XOF" }
        : null,
    tx_ref: payload.data.tx_ref,
    meta: payload.data.meta,
  };
}

export function isFlutterwaveSalePaid(sale: FlutterwaveTransaction): boolean {
  return sale.status === "successful";
}

export function flutterwaveAmountMatches(sale: FlutterwaveTransaction, expectedFcfa: number): boolean {
  return sale.amount?.value === expectedFcfa && sale.amount?.currency === "XOF";
}

export function parseFlutterwaveReference(payload: {
  metadata?: Record<string, string> | null;
}): { reference: string | null; kind: "token" | "verification" | "mission" | "subscription" | "brief_boost" } {
  const meta = payload.metadata ?? {};
  const reference = meta.reference ?? null;
  const kind = (meta.kind as "token" | "verification" | "mission" | "subscription" | "brief_boost") ?? "token";
  return { reference, kind };
}

/**
 * Vérification de signature webhook Flutterwave.
 * Flutterwave envoie un header `verif-hash` contenant un hash SHA256
 * du payload avec le secret key.
 */
export function verifyFlutterwaveWebhookSignature(
  rawBody: string,
  signature: string | null | undefined
): boolean {
  const config = getFlutterwaveConfig();
  if (!signature || !config.webhookSecret) return false;
  // Flutterwave sends the secret hash directly in verif-hash header.
  // Compare in constant time.
  const a = Buffer.from(signature);
  const b = Buffer.from(config.webhookSecret);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function getPulseReference(payload: { custom_metadata?: Record<string, string> | null }) {
  const meta = payload.custom_metadata ?? null;
  return {
    reference: meta?.reference ?? null,
    kind: (meta?.kind as "token" | "verification" | "mission" | "subscription" | "brief_boost") ?? "token",
  };
}