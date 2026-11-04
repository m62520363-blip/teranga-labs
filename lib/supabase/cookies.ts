export const AUTH_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 jours
export const COOKIE_CONSENT_MAX_AGE_SECONDS = 60 * 60 * 24 * 365; // 1 an

const isProduction =
  typeof process !== "undefined" && process.env?.NODE_ENV === "production";

export function cookieOptionsWithAge(
  options?: { maxAge?: number; [key: string]: unknown }
) {
  const merged: Record<string, unknown> = { ...(options ?? {}) };
  // Sécurise les cookies d'auth en production (HTTPS), sans écraser
  // une valeur explicitement fournie par l'appelant.
  if (merged.secure === undefined && isProduction) merged.secure = true;
  if (merged.sameSite === undefined) merged.sameSite = "lax";
  if (merged.path === undefined) merged.path = "/";
  return {
    ...merged,
    maxAge: (options?.maxAge as number | undefined) ?? AUTH_COOKIE_MAX_AGE_SECONDS,
  } as { [key: string]: string | number | boolean | undefined };
}