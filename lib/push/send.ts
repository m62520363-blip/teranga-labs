import * as webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY ?? "";
const VAPID_SUBJECT = process.env.VAPID_SUBJECT ?? "mailto:contact@devmarket.com";

let configured = false;
if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  configured = true;
}

export function isPushConfigured(): boolean {
  return configured;
}

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
};

/**
 * Envoie une notification push à tous les abonnements d'un utilisateur.
 * Supprime automatiquement les abonnements expirés (410 Gone).
 */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload
): Promise<{ sent: number; failed: number }> {
  if (!configured) return { sent: 0, failed: 0 };

  const admin = createAdminClient();
  if (!admin) return { sent: 0, failed: 0 };

  const { data: subs } = await admin
    .from("push_subscriptions" as never)
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", userId) as { data: { id: string; endpoint: string; p256dh: string; auth: string }[] | null };

  if (!subs || subs.length === 0) return { sent: 0, failed: 0 };

  let sent = 0;
  let failed = 0;

  for (const sub of subs) {
    const pushSub = {
      endpoint: sub.endpoint,
      keys: { p256dh: sub.p256dh, auth: sub.auth },
    };
    try {
      await webpush.sendNotification(pushSub, JSON.stringify(payload));
      sent++;
    } catch (err: unknown) {
      failed++;
      const statusCode = (err as { statusCode?: number })?.statusCode;
      if (statusCode === 410 || statusCode === 404) {
        // Abonnement expiré : supprimer.
        await admin.from("push_subscriptions" as never).delete().eq("id", sub.id);
      }
    }
  }

  return { sent, failed };
}
