import { createClient } from "@/lib/supabase/server";

/**
 * Lit un feature flag public (table feature_flags, mig 0049) via la RPC
 * is_feature_enabled : défaut FALSE si la clé n'existe pas — une
 * fonctionnalité non posée par la console admin est inactive.
 *
 * Sans Supabase configuré : false aussi (comportement « par défaut
 * prudent » de la RPC, jamais de leak silencieux).
 */
export async function isFeatureEnabled(key: string): Promise<boolean> {
  const supabase = await createClient();
  if (!supabase) return false;
  const { data, error } = await supabase.rpc("is_feature_enabled", { p_key: key });
  if (error) return false;
  return data === true;
}
