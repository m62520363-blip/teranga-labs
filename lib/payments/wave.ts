import { createHmac, timingSafeEqual } from "crypto";
import { getPaymentsConfig } from "@/lib/payments/config";

/**
 * Client minimal de la Checkout API Wave (Business API).
 * Base : https://api.wave.com — sessions de paiement, montants en
 * chaîne sans décimales (XOF), authentification par Bearer API key.
 * Les clés proviennent de https://business.wave.com (dev portal).
 */

export type WaveCheckoutSession = {
  id: string;
  wave_launch_url: string;
  checkout_status: "open" | "complete" | "expired";
  payment_status: "processing" | "cancelled" | "succeeded";
  amount: string;
  currency: string;
  client_reference?: string;
  business_name?: string;
  when_created?: string;
  when_expires?: string;
};

class WaveApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string
  ) {
    super(message);
    this.name = "WaveApiError";
  }
}

export function isWaveApiError(err: unknown): err is WaveApiError {
  return err instanceof WaveApiError;
}

export async function createCheckoutSession(params: {
  amount: string;
  currency: "XOF";
  successUrl: string;
  errorUrl: string;
  clientReference: string;
}): Promise<WaveCheckoutSession> {
  const config = getPaymentsConfig();

  const response = await fetch(`${config.waveBaseUrl}/v1/checkout/sessions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.waveApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: params.amount,
      currency: params.currency,
      success_url: params.successUrl,
      error_url: params.errorUrl,
      client_reference: params.clientReference,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => null)) as {
      code?: string;
      message?: string;
    } | null;
    throw new WaveApiError(
      response.status,
      errorBody?.code ?? "wave_request_failed",
      errorBody?.message ?? `Wave API responded ${response.status}`
    );
  }

  return (await response.json()) as WaveCheckoutSession;
}

/**
 * Vérifie la signature WEBHOOK Wave.
 * Header attendu : `Wave-Signature: t=<timestamp>,v1=<hmac-sha256 hex>`
 * où l'HMAC est calculé sur le corps BRUT de la requête avec le
 * webhook secret (`whsec_...`). La comparaison se fait en temps
 * constant et l'horodatage est borné (tolérance = limite Wave 300s).
 */
export function verifyWaveSignature(
  rawBody: string,
  signatureHeader: string | null
): boolean {
  if (!signatureHeader) return false;

  const parts = new Map<string, string>();
  for (const pair of signatureHeader.split(",")) {
    const idx = pair.indexOf("=");
    if (idx === -1) continue;
    parts.set(pair.slice(0, idx).trim(), pair.slice(idx + 1).trim());
  }

  const timestamp = Number(parts.get("t"));
  const givenHex = parts.get("v1");
  if (!Number.isFinite(timestamp) || !givenHex) return false;

  const config = getPaymentsConfig();
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSeconds - timestamp) > config.waveWebhookTolerance) {
    return false;
  }

  const expected = createHmac("sha256", config.waveWebhookSecret)
    .update(rawBody)
    .digest();

  let given: Buffer;
  try {
    given = Buffer.from(givenHex, "hex");
  } catch {
    return false;
  }

  if (given.length !== expected.length) return false;
  return timingSafeEqual(given, expected);
}

export type WaveWebhookEvent = {
  type: string;
  data: Record<string, unknown>;
};

export const WAVE_EVENT_CHECKOUT_COMPLETED = "checkout.session.completed";
export const WAVE_EVENT_CHECKOUT_FAILED = "checkout.session.payment_failed";
export const WAVE_EVENT_TEST = "test.test_event";

export function isCheckoutCompleted(event: WaveWebhookEvent): boolean {
  return event.type === WAVE_EVENT_CHECKOUT_COMPLETED;
}

export function amountMatches(
  eventAmount: unknown,
  expectedFcfa: number
): boolean {
  const actual = Number(String(eventAmount ?? ""));
  return Number.isFinite(actual) && actual === expectedFcfa;
}