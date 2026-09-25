import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";
import { cookieOptionsWithAge } from "@/lib/supabase/cookies";

export function isSupabaseConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export async function createClient() {
  if (!isSupabaseConfigured()) return null;

  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, {
                ...options,
                ...cookieOptionsWithAge(options),
              })
            );
          } catch {
            // Appelé depuis un Server Component → rafraîchissement géré par middleware
          }
        },
      },
    }
  );
}

export async function getCurrentUser() {
  const supabase = await createClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function getCurrentDeveloper() {
  const user = await getCurrentUser();
  if (!user) return null;
  const supabase = await createClient();
  if (!supabase) return null;
  const { data } = await supabase
    .from("developers")
    .select("id, full_name, whatsapp, skills, created_at")
    .eq("id", user.id)
    .maybeSingle();
  return data;
}

export async function getCurrentRole(): Promise<string | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data } = await supabase.rpc("get_my_role");
  return typeof data === "string" ? data : null;
}