/**
 * Configuration Chariow (prestataire unique de paiement).
 *
 * Variables d'environnement :
 *   CHARIOW_API_KEY             clé API boutique (sk_...) — serveur UNIQUEMENT
 *   CHARIOW_PULSE_SECRET        secret de signature du Pulse (whsec_...)
 *   CHARIOW_BASE_URL            base API (défaut https://api.chariow.com/v1)
 *   CHARIOW_VERIFICATION_PRODUCT slug du produit « Vérification de profil »
 *
 * Les slugs produits des packs = ids de token_packages (discovery, starter,
 * pro, agence) : aucun mapping à configurer tant que les slugs produits
 * Chariow correspondent aux ids de la table.
 */
export type ChariowConfig = {
  apiKey: string;
  baseUrl: string;
  pulseSecret: string;
};

export function getChariowConfig(): ChariowConfig {
  return {
    apiKey: process.env.CHARIOW_API_KEY ?? "",
    baseUrl: (process.env.CHARIOW_BASE_URL || "https://api.chariow.com/v1").replace(
      /\/+$/,
      ""
    ),
    pulseSecret: process.env.CHARIOW_PULSE_SECRET ?? "",
  };
}

/** Checkout utilisable : une clé API côté serveur est suffisante. */
export function isChariowConfigured(): boolean {
  return Boolean(process.env.CHARIOW_API_KEY);
}

/** Pulse (webhook) vérifiable : le secret de signature est présent. */
export function isPulseConfigured(): boolean {
  return Boolean(process.env.CHARIOW_PULSE_SECRET);
}

/** Mapping des formules d'abonnement vers les identifiants produit Chariow. */
const SUBSCRIPTION_PRODUCT_IDS: Record<string, string> = {
  "pro-monthly": "prd_jn4g8ufi",
  "pro-annual": "prd_ldu3yr3m",
  "pro_max-monthly": "prd_5b4g2vvq",
  "pro_max-annual": "prd_6rk1aavk",
  "agency-monthly": "prd_y4rqrz15",
  "agency-annual": "prd_1whqdoui",
};

/** Slug/ID produit Chariow d'un pack (= id du pack en base, ou mapping Chariow). */
export function getTokenProductSlug(packageId: string): string {
  return SUBSCRIPTION_PRODUCT_IDS[packageId] ?? packageId;
}

/** Slug produit Chariow de la vérification de profil. */
export function getVerificationProductSlug(): string {
  return process.env.CHARIOW_VERIFICATION_PRODUCT || "verification-profil";
}
