import { chariowProvider } from "@/lib/payments/chariow-provider";

/**
 * Contrat commun aux prestataires de paiement (H2 de la refonte).
 *
 * Une route checkout/webhook ne connaît QUE cette interface : ajouter un
 * second prestataire (Wave, PayDunya…) = écrire un adaptateur qui
 * l'implémente puis l'enregistrer dans getPaymentProvider(), sans
 * toucher aux routes.
 *
 * Invariants transverses, valables pour TOUS les prestataires :
 *   1. Le prix vient TOUJOURS du côté prestataire (le serveur ne fait
 *      que comparer le montant confirmé à l'intention gelée).
 *   2. verifySale() (re-vérification serveur) fait foi — jamais le corps
 *      du webhook seul.
 *   3. amountMatches() : égalité STRICTE du montant, même devise.
 *   4. verifyWebhookSignature() : comparaison en temps constant du corps
 *      BRUT (jamais de re-sérialisation avant comparaison).
 */

export type PaymentProviderId = "chariow";

export type PaymentAmount = {
  value: number;
  currency: string;
};

export type CheckoutParams = {
  productSlug: string;
  /** Variante de prix du prestataire (montants exacts : missions…). */
  priceVariantId?: string | null;
  email: string;
  fullName?: string | null;
  /** Numéro international brut (`+22177…`) — le parsing est au fournisseur. */
  phone: string;
  redirectUrl: string;
  metadata: Record<string, string>;
  customerIp?: string | null;
  /** Devise de paiement forcée (intention gelée en XOF). */
  paymentCurrency?: string;
};

export type CheckoutResult = {
  step: "payment" | "completed" | "already_purchased";
  saleId: string | null;
  checkoutUrl: string | null;
  message: string | null;
  amount: PaymentAmount | null;
};

export type PaymentSale = {
  id: string;
  status: string;
  amount?: PaymentAmount | null;
  /** Métadonnées posées à l'initiation du checkout (lien intention). */
  metadata?: Record<string, string> | null;
};

export type PaymentReference = {
  reference: string | null;
  kind: "token" | "verification" | "mission";
};

export interface PaymentProvider {
  readonly id: PaymentProviderId;
  /** Header HTTP portant la signature du webhook (lu tel quel). */
  readonly webhookSignatureHeader: string;
  /** Checkout utilisable (clé API côté serveur présente). */
  isConfigured(): boolean;
  /** Webhook vérifiable (secret de signature présent). */
  isWebhookConfigured(): boolean;
  createCheckout(params: CheckoutParams): Promise<CheckoutResult>;
  /** Re-vérification serveur : l'état réel de la vente fait foi. */
  verifySale(saleId: string): Promise<PaymentSale>;
  /** `completed`/`settled` = payé (le crédit exige ce test). */
  isSalePaid(sale: PaymentSale): boolean;
  /** Montant confirmé STRICTEMENT égal au montant gelé, même devise. */
  amountMatches(sale: PaymentSale, expectedFcfa: number): boolean;
  /** Référence d'intention portée par les métadonnées du checkout. */
  parseReference(payload: { metadata?: Record<string, string> | null }): PaymentReference;
  /** Signature webhook vérifiée sur le corps BRUT, temps constant. */
  verifyWebhookSignature(rawBody: string, signature: string | null | undefined): boolean;
}

/** Erreur structurée d'appel API prestataire (status HTTP + code). */
export type PaymentApiError = { status: number; code: string; message: string };

export function isPaymentApiError(err: unknown): err is PaymentApiError {
  return err instanceof Error && "status" in err && "code" in err;
}

/**
 * Prestataire actif. Un seul enregistré aujourd'hui (Chariow) ;
 * un second adaptateur s'ajoute ici (et éventuellement via une variable
 * d'environnement), les routes restent inchangées.
 */
export function getPaymentProvider(): PaymentProvider {
  return chariowProvider;
}
