import {
  amountMatchesSale,
  createChariowCheckout,
  getChariowSale,
  getPulseReference,
  isSaleCompleted,
  verifyPulseSignature,
} from "@/lib/payments/chariow";
import { isChariowConfigured, isPulseConfigured } from "@/lib/payments/chariow-config";
import type { PaymentProvider } from "@/lib/payments/provider";

/**
 * Adaptateur Chariow du contrat PaymentProvider.
 *
 * Aucune logique ici : déléguation pure vers lib/payments/chariow.ts
 * (transport, parsing, signature) — c'est le SEUL module qui doit
 * changer si l'API Chariow bouge.
 */
export const chariowProvider: PaymentProvider = {
  id: "chariow",
  webhookSignatureHeader: "x-chariow-signature",
  isConfigured: isChariowConfigured,
  isWebhookConfigured: isPulseConfigured,
  createCheckout: createChariowCheckout,
  verifySale: getChariowSale,
  isSalePaid: isSaleCompleted,
  amountMatches: amountMatchesSale,
  parseReference: ({ metadata }) => getPulseReference({ custom_metadata: metadata ?? null }),
  verifyWebhookSignature: verifyPulseSignature,
};
