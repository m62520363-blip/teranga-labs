import { createBrowserClient } from "@supabase/ssr";
import { AUTH_COOKIE_MAX_AGE_SECONDS } from "@/lib/supabase/cookies";

export function isSupabaseConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

function parseCookies(): { name: string; value: string }[] {
  if (typeof document === "undefined") return [];
  return document.cookie
    .split(";")
    .map((c) => c.trim())
    .filter(Boolean)
    .map((c) => {
      const idx = c.indexOf("=");
      if (idx === -1) return { name: c, value: "" };
      return { name: c.slice(0, idx).trim(), value: c.slice(idx + 1).trim() };
    });
}

function serializeCookie(
  name: string,
  value: string,
  options?: Record<string, unknown>
) {
  const parts = [`${encodeURIComponent(name)}=${encodeURIComponent(value)}`];
  parts.push(`path=${typeof options?.path === "string" ? options.path : "/"}`);
  const maxAge =
    typeof options?.maxAge === "number"
      ? options.maxAge
      : AUTH_COOKIE_MAX_AGE_SECONDS;
  if (maxAge > 0) parts.push(`max-age=${maxAge}`);
  parts.push(
    `samesite=${typeof options?.sameSite === "string" ? options.sameSite : "lax"}`
  );
  if (options?.secure) parts.push("secure");
  return parts.join("; ");
}

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return parseCookies();
        },
        setAll(cookiesToSet) {
          if (typeof document === "undefined") return;
          cookiesToSet.forEach(({ name, value, options }) => {
            if (!value) {
              document.cookie = `${encodeURIComponent(name)}=; path=${options?.path ?? "/"}; max-age=0`;
              return;
            }
            document.cookie = serializeCookie(name, value, options);
          });
        },
      },
    }
  );
}