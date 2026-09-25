import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export function isServiceConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

/**
 * Client stricement serveur (routes API, webhooks) utilisant la clé
 * service_role. Aucune session utilisateur : il contourne la RLS —
 * à réserver aux opérations de confiance (crédits post-paiement).
 * Ne JAMAIS importer dans un composant client.
 */
export function createAdminClient() {
  if (!isServiceConfigured()) return null;

  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }
  );
}