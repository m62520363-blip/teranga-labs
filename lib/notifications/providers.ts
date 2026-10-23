import { getNotificationsConfig, hasNotificationChannel } from "./config";
import { normalizeWhatsApp } from "@/lib/tokens";

export type NotificationRecipient = {
  whatsapp?: string;
  email?: string;
};

export type DeliveryMeta = {
  jobType: string;
  requestId: string;
  recipientLabel: string;
};

/**
 * Envoie un message via le premier canal disponible :
 *   1. Webhook générique (Make / n8n) : un POST JSON par destinataire.
 *   2. WhatsApp direct (Green-API ou Twilio) si un numéro est fourni.
 *   3. Email (Resend) en secours si une adresse est fournie.
 *
 * Lever une erreur = aucune voie n'a pu livrer le message : le job
 * sera marqué « failed ». Aucun envoi n'est jamais simulé.
 */
export async function deliverMessage(
  recipient: NotificationRecipient,
  message: string,
  meta: DeliveryMeta
): Promise<void> {
  const cfg = getNotificationsConfig();
  if (!hasNotificationChannel(cfg)) {
    throw new Error(
      "Aucun canal de notification configuré (NOTIFICATION_WEBHOOK_URL, WHATSAPP_PROVIDER ou RESEND_API_KEY)."
    );
  }

  if (cfg.webhookUrl) {
    await postGenericWebhook(cfg.webhookUrl, {
      event: "notification.deliver",
      type: meta.jobType,
      request_id: meta.requestId,
      recipient,
      message,
    });
    return;
  }

  if (recipient.whatsapp && cfg.whatsappProvider === "greenapi") {
    await sendGreenApi(cfg.greenApiIdInstance, cfg.greenApiToken, cfg.greenApiUrl, recipient.whatsapp, message);
    return;
  }

  if (recipient.whatsapp && cfg.whatsappProvider === "twilio") {
    await sendTwilio(
      cfg.twilioAccountSid,
      cfg.twilioAuthToken,
      cfg.twilioWhatsappFrom,
      recipient.whatsapp,
      message
    );
    return;
  }

  if (recipient.email && cfg.resendApiKey && cfg.resendFromEmail) {
    await sendResend(cfg.resendApiKey, cfg.resendFromEmail, recipient.email, message);
    return;
  }

  throw new Error(`Aucun canal applicable pour « ${meta.recipientLabel} ».`);
}

async function postGenericWebhook(url: string, payload: unknown): Promise<void> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) {
    throw new Error(`Webhook de notification refusé (HTTP ${res.status}).`);
  }
}

async function sendGreenApi(
  idInstance: string,
  apiToken: string,
  baseUrl: string,
  whatsapp: string,
  message: string
): Promise<void> {
  const chatId = `${normalizeWhatsApp(whatsapp)}@c.us`;
  const url = `${baseUrl.replace(/\/$/, "")}/waInstance${idInstance}/sendMessage/${apiToken}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chatId, message }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) {
    throw new Error(`Green-API a refusé l'envoi (HTTP ${res.status}).`);
  }
}

async function sendTwilio(
  accountSid: string,
  authToken: string,
  from: string,
  to: string,
  message: string
): Promise<void> {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const form = new URLSearchParams();
  form.set("From", `whatsapp:${normalizeWhatsApp(from)}`);
  form.set("To", `whatsapp:${normalizeWhatsApp(to)}`);
  form.set("Body", message);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
    },
    body: form.toString(),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) {
    throw new Error(`Twilio a refusé l'envoi (HTTP ${res.status}).`);
  }
}

async function sendResend(apiKey: string, from: string, to: string, message: string): Promise<void> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: "Devmarket · Nouveau brief",
      text: message,
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) {
    throw new Error(`Resend a refusé l'envoi (HTTP ${res.status}).`);
  }
}