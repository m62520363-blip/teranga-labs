import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";
import { getNotificationsConfig } from "./config";
import {
  buildClientConfirmationMessage,
  buildDeveloperMatchMessage,
  keywordsForType,
  type ClientConfirmationPayload,
  type DeveloperMatchPayload,
} from "./messages";
import { deliverMessage } from "./providers";

type AdminClient = SupabaseClient<Database>;

type NotificationJob = {
  id: string;
  type: "client_confirmation" | "developer_matches";
  payload: JsonRecord;
  status: string;
  attempts: number;
};

type JsonRecord = {
  request_id: string;
  client_name: string;
  client_whatsapp?: string;
  management_key?: string;
  client_city: string;
  project_type: string;
  budget: number;
};

/**
 * Scrute la file notification_jobs et tente d'envoyer les messages en
 * attente. Exécuté en tâche de fond après publication d'un brief :
 * une erreur d'envoi ne bloque JAMAIS la soumission du client.
 * Les jobs en échec restent en base (statut « failed » + last_error)
 * pour un retraitement ultérieur (worker/cron en production).
 */
export async function flushNotifications(): Promise<number> {
  const admin = createAdminClient();
  if (!admin) return 0;

  const { data, error } = await admin
    .from("notification_jobs")
    .select("id, type, payload, status, attempts")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(20);

  if (error) return 0;

  const jobs = (data ?? []) as unknown as NotificationJob[];
  for (const job of jobs) {
    await processNotificationJob(admin, job);
  }
  return jobs.length;
}

async function processNotificationJob(admin: AdminClient, job: NotificationJob): Promise<void> {
  await admin
    .from("notification_jobs")
    .update({ attempts: job.attempts + 1 })
    .eq("id", job.id);

  try {
    await dispatchJob(admin, job);
    await admin
      .from("notification_jobs")
      .update({ status: "sent", processed_at: new Date().toISOString() })
      .eq("id", job.id);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await admin
      .from("notification_jobs")
      .update({ status: "failed", last_error: message, processed_at: new Date().toISOString() })
      .eq("id", job.id);
  }
}

async function dispatchJob(admin: AdminClient, job: NotificationJob): Promise<void> {
  const portal = getNotificationsConfig().origin;

  if (job.type === "client_confirmation") {
    const payload = job.payload as ClientConfirmationPayload;
    await deliverMessage(
      { whatsapp: payload.client_whatsapp },
      buildClientConfirmationMessage(payload, portal),
      { jobType: job.type, requestId: payload.request_id, recipientLabel: "client" }
    );
    return;
  }

  // developer_matches : on cible les développeurs actifs dont la
  // ville OU les compétences correspondent au brief.
  const payload = job.payload as DeveloperMatchPayload;
  const { data } = await admin.rpc("list_developers_for_brief", {
    p_city: payload.client_city,
    p_keywords: keywordsForType(payload.project_type),
  });
  const matches = (Array.isArray(data) ? data : []) as {
    id: string;
    full_name: string | null;
    whatsapp: string | null;
    email: string | null;
  }[];

  if (matches.length === 0) return; // RIEN à notifier : job marqué « sent » (cas normal).

  // Préférence « alerte email nouveaux projets » (mig 0070). Absence de
  // ligne / colonne = actif. Le WhatsApp reste indépendant de ce réglage.
  const { data: prefRows } = await admin
    .from("notification_preferences")
    .select("user_id, email_new_projects")
    .in("user_id", matches.map((m) => m.id));
  const emailAlerts = new Map<string, boolean>();
  for (const row of prefRows ?? []) {
    emailAlerts.set(row.user_id, row.email_new_projects);
  }

  const message = buildDeveloperMatchMessage(payload, portal);
  let delivered = 0;
  let firstError: unknown = null;

  for (const dev of matches) {
    const wantsEmail = emailAlerts.get(dev.id) !== false;
    // Aucun canal restant : ni WhatsApp, ni email autorisé.
    if (!dev.whatsapp && !wantsEmail) continue;
    try {
      await deliverMessage(
        { whatsapp: dev.whatsapp ?? undefined, email: dev.email ?? undefined },
        message,
        {
          jobType: job.type,
          requestId: payload.request_id,
          recipientLabel: dev.full_name ?? dev.id,
          allowEmail: wantsEmail,
        }
      );
      delivered += 1;
    } catch (err) {
      firstError ??= err;
    }
  }

  if (delivered === 0 && firstError) {
    throw firstError;
  }
}