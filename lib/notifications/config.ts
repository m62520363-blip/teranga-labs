export type NotificationsConfig = {
  origin: string;
  /** Webhook Make / n8n : reçoit un JSON par message et se charge de l'envoi. */
  webhookUrl: string;
  /** Canal WhatsApp direct : "greenapi" | "twilio" | "" (désactivé). */
  whatsappProvider: "greenapi" | "twilio" | "";
  greenApiIdInstance: string;
  greenApiToken: string;
  greenApiUrl: string;
  twilioAccountSid: string;
  twilioAuthToken: string;
  /** Numéro WhatsApp Business expéditeur au format international, ex: +14155238886. */
  twilioWhatsappFrom: string;
  /** Canal email (Resend par défaut). */
  resendApiKey: string;
  resendFromEmail: string;
};

export function getNotificationsConfig(): NotificationsConfig {
  const provider = process.env.WHATSAPP_PROVIDER?.toLowerCase();
  return {
    origin: process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "https://devvmarket.vercel.app",
    webhookUrl: process.env.NOTIFICATION_WEBHOOK_URL ?? "",
    whatsappProvider:
      provider === "greenapi"
        ? "greenapi"
        : provider === "twilio"
          ? "twilio"
          : "",
    greenApiIdInstance: process.env.GREENAPI_ID_INSTANCE ?? "",
    greenApiToken: process.env.GREENAPI_API_TOKEN ?? "",
    greenApiUrl: process.env.GREENAPI_URL ?? "https://api.green-api.com",
    twilioAccountSid: process.env.TWILIO_ACCOUNT_SID ?? "",
    twilioAuthToken: process.env.TWILIO_AUTH_TOKEN ?? "",
    twilioWhatsappFrom: process.env.TWILIO_WHATSAPP_FROM ?? "",
    resendApiKey: process.env.RESEND_API_KEY ?? "",
    resendFromEmail: process.env.RESEND_FROM_EMAIL ?? "",
  };
}

/**
 * Un canal est réellement configuré si au moins une voie d'envoi est
 * prête : webhook générique (Make/n8n), WhatsApp (Green-API ou Twilio)
 * ou email (Resend). Sans canal, aucun message n'est envoyé — rien
 * n'est jamais simulé.
 */
export function hasNotificationChannel(cfg: NotificationsConfig): boolean {
  if (cfg.webhookUrl) return true;
  if (cfg.whatsappProvider === "greenapi" && cfg.greenApiIdInstance && cfg.greenApiToken) {
    return true;
  }
  if (
    cfg.whatsappProvider === "twilio" &&
    cfg.twilioAccountSid &&
    cfg.twilioAuthToken &&
    cfg.twilioWhatsappFrom
  ) {
    return true;
  }
  if (cfg.resendApiKey && cfg.resendFromEmail) return true;
  return false;
}