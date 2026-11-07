import {
  createFlutterwaveCheckout,
  getFlutterwaveSale,
  isFlutterwaveSalePaid,
  flutterwaveAmountMatches,
  parseFlutterwaveReference,
  verifyFlutterwaveWebhookSignature,
} from "@/lib/payments/flutterwave";
import {
  isFlutterwaveConfigured,
  isFlutterwaveWebhookConfigured,
} from "@/lib/payments/flutterwave-config";
import type { PaymentProvider } from "@/lib/payments/provider";

export const flutterwaveProvider: PaymentProvider = {
  id: "flutterwave",
  webhookSignatureHeader: "verif-hash",
  isConfigured: isFlutterwaveConfigured,
  isWebhookConfigured: isFlutterwaveWebhookConfigured,
  createCheckout: async (params) => {
    const result = await createFlutterwaveCheckout({
      productSlug: params.productSlug,
      amount: params.amount ?? 0,
      email: params.email,
      fullName: params.fullName,
      phone: params.phone,
      redirectUrl: params.redirectUrl,
      metadata: params.metadata,
      customerIp: params.customerIp,
      paymentCurrency: params.paymentCurrency,
    });
    return result;
  },
  verifySale: getFlutterwaveSale,
  isSalePaid: isFlutterwaveSalePaid,
  amountMatches: flutterwaveAmountMatches,
  parseReference: ({ metadata }) => parseFlutterwaveReference({ metadata: metadata ?? null }),
  verifyWebhookSignature: verifyFlutterwaveWebhookSignature,
};