import { createPaydunyaCheckout, isPaydunyaApiError } from "@/lib/payments/paydunya";
import { createCheckoutSession, isWaveApiError } from "@/lib/payments/wave";
import { isPaydunyaConfigured } from "@/lib/payments/paydunya-config";
import { isWaveConfigured } from "@/lib/payments/config";

/**
 * Abstraction PaymentProvider (§6 de l'audit) : PayDunya et Wave implémentent
 * le même contrat pour la partie « création d'un tunnel de paiement ».
 *
 * La vérification des callbacks (IPN PayDunya / webhook Wave) reste dans les
 * routes car les protocoles diffèrent radicalement (form-encoded + hash VS
 * JSON + HMAC) et leur logique financière est volontairement localisée.
 */

export type ProviderName = "paydunya" | "wave";

export type CheckoutInput = {
  /** Montant en FCFA (prix serveur, jamais celui du client). */
  amountFcfa: number;
  description: string;
  /** Référence métier : id d'intention/commande/requête de vérification. */
  reference: string;
  /** Origine publique du site (URLs de retour). */
  origin: string;
  /** Chemin relatif de retour en cas de succès (ex `/tokens?intent=id`). */
  returnPath: string;
  /** Chemin relatif en cas d'annulation (facultatif). */
  cancelPath?: string;
  /** Client pré-rempli pour PayDunya (page tierce). */
  customer?: { name?: string; email?: string; phone?: string };
  /** Libellé produit pour PayDunya (facture PAR). */
  itemName?: string;
  /** Quantité produit pour PayDunya (facture PAR). */
  itemQuantity?: number;
};

export type ProviderCheckoutResult = {
  provider: ProviderName;
  launchUrl: string;
  sessionId: string;
};

export interface PaymentProvider {
  readonly name: ProviderName;
  isConfigured(): boolean;
  isApiError(error: unknown): error is Error;
  createCheckout(input: CheckoutInput): Promise<ProviderCheckoutResult>;
}

const paydunyaProvider: PaymentProvider = {
  name: "paydunya",
  isConfigured: isPaydunyaConfigured,
  isApiError: isPaydunyaApiError,
  async createCheckout(input) {
    const checkout = await createPaydunyaCheckout({
      amountFcfa: input.amountFcfa,
      description: input.description,
      itemName: input.itemName ?? "Règlement TERANGA LABS",
      itemQuantity: input.itemQuantity ?? 1,
      // L'IPN PayDunya ne renvoie pas de référence marchande fiable : la
      // référence transite par custom_data, comme pour les intentions.
      customData: { intent_id: input.reference },
      customer: input.customer,
      siteUrl: input.origin,
      returnUrl: `${input.origin}${input.returnPath}`,
      cancelUrl: input.cancelPath
        ? `${input.origin}${input.cancelPath}`
        : `${input.origin}${input.returnPath}&cancelled=1`,
    });
    return { provider: "paydunya", launchUrl: checkout.redirectUrl, sessionId: checkout.token };
  },
};

const waveProvider: PaymentProvider = {
  name: "wave",
  isConfigured: isWaveConfigured,
  isApiError: isWaveApiError,
  async createCheckout(input) {
    const session = await createCheckoutSession({
      amount: String(input.amountFcfa),
      currency: "XOF",
      successUrl: `${input.origin}${input.returnPath}`,
      errorUrl: input.cancelPath
        ? `${input.origin}${input.cancelPath}`
        : `${input.origin}${input.returnPath}`,
      clientReference: input.reference,
    });
    return { provider: "wave", launchUrl: session.wave_launch_url, sessionId: session.id };
  },
};

export function getProviderByName(name: ProviderName): PaymentProvider {
  return name === "paydunya" ? paydunyaProvider : waveProvider;
}

/**
 * Résout le prestataire à partir de la configuration :
 * - `auto`     : PayDunya si configuré, sinon Wave.
 * - `paydunya` : PayDunya, sinon repli Wave.
 * - `wave`     : uniquement Wave.
 * Retourne `null` quand aucun prestataire n'est opérationnel.
 */
export function getPreferredProvider(
  requested: ProviderName | "auto"
): ProviderName | null {
  const paydunya = isPaydunyaConfigured();
  const wave = isWaveConfigured();
  if (requested === "wave") return wave ? "wave" : null;
  if (requested === "paydunya") return paydunya ? "paydunya" : wave ? "wave" : null;
  return paydunya ? "paydunya" : wave ? "wave" : null;
}