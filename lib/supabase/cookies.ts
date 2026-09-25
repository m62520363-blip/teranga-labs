export const AUTH_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 jours

export function cookieOptionsWithAge(
  options?: { maxAge?: number; [key: string]: unknown }
) {
  return {
    ...(options ?? {}),
    maxAge: options?.maxAge ?? AUTH_COOKIE_MAX_AGE_SECONDS,
  } as { [key: string]: string | number | boolean | undefined };
}