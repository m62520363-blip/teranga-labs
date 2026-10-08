import { NextRequest, NextResponse } from "next/server";
import { briefSchema } from "@/lib/validations";
import { createClient } from "@/lib/supabase/server";
import { apiRequireUser } from "@/lib/auth/guards";
import { flushNotifications } from "@/lib/notifications/dispatch";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { log } from "@/lib/log";

export const runtime = "nodejs";

/**
 * Soumission serveur d'un brief : validation, publication via la RPC
 * publish_brief (auteur connecté + 1 Token débité), puis déclenchement
 * des notifications en tâche de fond.
 * Les notifications NE bloquent jamais la réponse au client.
 */
export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps de requête invalide." }, { status: 400 });
  }

  // Honeypot anti-spam : on accuse réception sans rien créer.
  if (body.website_confirm) {
    return NextResponse.json({ accepted: true });
  }

  const parsed = briefSchema.safeParse({
    client_name: body.client_name,
    client_whatsapp: body.client_whatsapp,
    client_city: body.client_city,
    project_type: body.project_type,
    budget: body.budget,
    description: body.description,
    features: Array.isArray(body.features) ? body.features : [],
    deadline: typeof body.deadline === "string" ? body.deadline : "",
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." },
      { status: 422 }
    );
  }

  const rl = rateLimit(`brief-publish:${clientIp(request)}`, 5);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Trop de publications récentes. Réessayez un peu plus tard." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } }
    );
  }

  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Configuration Supabase manquante. Renseignez les variables d’environnement puis relancez." },
      { status: 503 }
    );
  }

  // La publication coûte 1 Token : l'auteur doit être connecté.
  const guard = await apiRequireUser();
  if (guard.response) return guard.response;
  const user = guard.user!;

  const values = parsed.data;
  const { data, error } = await supabase.rpc("publish_brief", {
    p_client_name: values.client_name.trim(),
    p_client_whatsapp: values.client_whatsapp.trim(),
    p_client_city: values.client_city,
    p_project_type: values.project_type,
    p_budget: values.budget,
    p_description: values.description.trim(),
    p_features: values.features,
    p_deadline: values.deadline || null,
  });

  if (error) {
    // Codes connus (RPC security definer) : on expose le message afin que
    // l'utilisateur sache pourquoi sa publication a été refusée.
    if (error.code === "TLLOW" || error.code === "TLAUTH") {
      return NextResponse.json({ error: error.message }, { status: 402 });
    }
    return NextResponse.json(
      { error: "Impossible de publier le brief pour le moment. Réessayez dans quelques secondes." },
      { status: 422 }
    );
  }

  const result = data as { id?: string; management_key?: string; gift?: boolean } | null;
  if (!result?.id || !result?.management_key) {
    return NextResponse.json({ error: "Une erreur est survenue. Réessayez." }, { status: 422 });
  }

  void flushNotifications().catch(() => {
    /* silencieux : la file conserve les jobs pending */
  });

  // Journal d'usage réel (migration 0039) : non bloquant.
  const admin = createAdminClient();
  if (admin) {
    void (async () => {
      const { error } = await admin.rpc("track_event", {
        p_event: "brief_published",
        p_actor_id: user.id,
        p_request_id: result.id,
      });
      if (error) log.error({ action: "track.brief_published", message: error.message });
    })();
  }

  return NextResponse.json({
    id: result.id,
    management_key: result.management_key,
    // 1re publication du compte = offerte (migration 0033).
    gift: result.gift === true,
  });
}