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
  /** false = ne pas utiliser l'email (préférence « nouveaux projets »). */
  allowEmail?: boolean;
  /** HTML optionnel pour l'email (Resend). Si absent, seul le texte est envoyé. */
  html?: string;
  /** Sujet optionnel pour l'email (Resend). */
  subject?: string;
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

  if (
    recipient.email &&
    cfg.resendApiKey &&
    cfg.resendFromEmail &&
    meta.allowEmail !== false
  ) {
    await sendResend(
      cfg.resendApiKey,
      cfg.resendFromEmail,
      recipient.email,
      message,
      meta.html,
      meta.subject
    );
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
    let detail = "";
    try {
      const text = await res.text();
      try {
        const json = JSON.parse(text);
        detail = json?.message ?? JSON.stringify(json);
      } catch {
        detail = text;
      }
    } catch {
      detail = "";
    }
    throw new Error(`Green-API a refusé l'envoi (HTTP ${res.status}): ${detail}`);
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
    let detail = "";
    try {
      const text = await res.text();
      try {
        const json = JSON.parse(text);
        detail = json?.message ?? json?.detail ?? JSON.stringify(json);
      } catch {
        detail = text;
      }
    } catch {
      detail = "";
    }
    throw new Error(`Twilio a refusé l'envoi (HTTP ${res.status}): ${detail}`);
  }
}

async function sendResend(
  apiKey: string,
  from: string,
  to: string,
  message: string,
  html?: string,
  subject?: string
): Promise<void> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: subject ?? "Devmarket · Nouveau projet",
      text: message,
      ...(html ? { html } : {}),
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) {
    let detail = "";
    try {
      const text = await res.text();
      try {
        const json = JSON.parse(text);
        detail = json?.message ?? json?.name ?? JSON.stringify(json);
      } catch {
        detail = text;
      }
    } catch {
      detail = "";
    }
    throw new Error(`Resend a refusé l'envoi (HTTP ${res.status}): ${detail}`);
  }
}