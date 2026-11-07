/**
 * Configuration Flutterwave (prestataire de paiement pan-africain).
 *
 * Variables d'environnement :
 *   FLW_PUBLIC_KEY     clé publique (FLWPUBK-...) — client + serveur
 *   FLW_SECRET_KEY     clé secrète (FLWSECK-...) — serveur UNIQUEMENT
 *   FLW_WEBHOOK_SECRET secret de vérification webhook (hash)
 *   FLW_BASE_URL       base API (défaut https://api.flutterwave.com/v3)
 */
export type FlutterwaveConfig = {
  publicKey: string;
  secretKey: string;
  baseUrl: string;
  webhookSecret: string;
};

export function getFlutterwaveConfig(): FlutterwaveConfig {
  return {
    publicKey: process.env.FLW_PUBLIC_KEY ?? "",
    secretKey: process.env.FLW_SECRET_KEY ?? "",
    baseUrl: (process.env.FLW_BASE_URL || "https://api.flutterwave.com/v3").replace(
      /\/+$/,
      ""
    ),
    webhookSecret: process.env.FLW_WEBHOOK_SECRET ?? "",
  };
}

export function isFlutterwaveConfigured(): boolean {
  return Boolean(process.env.FLW_SECRET_KEY);
}

export function isFlutterwaveWebhookConfigured(): boolean {
  return Boolean(process.env.FLW_WEBHOOK_SECRET);
}